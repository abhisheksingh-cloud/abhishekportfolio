const http = require("node:http");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { mkdir, readFile, appendFile } = require("node:fs/promises");

const ROOT = __dirname;
const MAX_BODY_BYTES = 10 * 1024;
const MAX_MESSAGES_PER_WINDOW = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const CONTENT_TYPES = {
  "/": "text/html; charset=utf-8",
  "/index.html": "text/html; charset=utf-8",
  "/styles.css": "text/css; charset=utf-8",
  "/script.js": "text/javascript; charset=utf-8",
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendJson(response, status, data) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(data));
}

async function readJsonBody(request) {
  const contentType = request.headers["content-type"] || "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "Content-Type must be application/json.");
  }

  const declaredLength = Number(request.headers["content-length"] || 0);
  if (declaredLength > MAX_BODY_BYTES) {
    throw new HttpError(413, "Request body is too large.");
  }

  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_BODY_BYTES) {
      throw new HttpError(413, "Request body is too large.");
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Request body must contain valid JSON.");
  }
}

function validateContact(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new HttpError(400, "Request body must be a JSON object.");
  }

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  const errors = [];

  if (name.length < 1 || name.length > 100) {
    errors.push("Name must be between 1 and 100 characters.");
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("Enter a valid email address (maximum 254 characters).");
  }
  if (message.length < 1 || message.length > 5000) {
    errors.push("Message must be between 1 and 5000 characters.");
  }
  if (errors.length > 0) {
    const error = new HttpError(400, "Please correct the contact form and try again.");
    error.details = errors;
    throw error;
  }

  return { name, email, message };
}

function createServer({ dataDirectory = path.join(ROOT, "data") } = {}) {
  const portfolioPath = path.join(dataDirectory, "portfolio.json");
  const messagesPath = path.join(dataDirectory, "messages.jsonl");
  const submissionsByAddress = new Map();
  let messageWriteQueue = Promise.resolve();

  function saveMessage(message) {
    const write = messageWriteQueue.then(() =>
      appendFile(messagesPath, `${JSON.stringify(message)}\n`, { encoding: "utf8", flag: "a" }),
    );
    messageWriteQueue = write.catch((error) => {
      console.error("Could not save contact message:", error);
    });
    return write;
  }

  async function handleRequest(request, response) {
    const requestUrl = new URL(request.url, "http://localhost");
    const pathname = requestUrl.pathname;

    if (pathname === "/api/portfolio" && request.method === "GET") {
      try {
        const content = await readFile(portfolioPath, "utf8");
        sendJson(response, 200, JSON.parse(content));
      } catch (error) {
        console.error("Could not read portfolio data:", error);
        sendJson(response, 500, { error: "Portfolio content is temporarily unavailable." });
      }
      return;
    }

    if (pathname === "/api/contact" && request.method === "POST") {
      let payload;
      try {
        payload = await readJsonBody(request);
        if (payload && typeof payload === "object" && !Array.isArray(payload) && payload.website) {
          sendJson(response, 202, { message: "Thanks — your message has been received." });
          return;
        }
        const contact = validateContact(payload);
        const address = request.socket.remoteAddress || "unknown";
        const now = Date.now();
        const recentSubmissions = (submissionsByAddress.get(address) || [])
          .filter(({ timestamp }) => now - timestamp < RATE_LIMIT_WINDOW_MS);
        if (recentSubmissions.length >= MAX_MESSAGES_PER_WINDOW) {
          sendJson(response, 429, { error: "Too many messages. Please try again later." });
          return;
        }

        const reservation = { timestamp: now };
        recentSubmissions.push(reservation);
        submissionsByAddress.set(address, recentSubmissions);
        const savedMessage = { id: randomUUID(), ...contact, receivedAt: new Date(now).toISOString() };
        try {
          await saveMessage(savedMessage);
        } catch (error) {
          const remainingSubmissions = recentSubmissions.filter((entry) => entry !== reservation);
          if (remainingSubmissions.length) {
            submissionsByAddress.set(address, remainingSubmissions);
          } else {
            submissionsByAddress.delete(address);
          }
          throw error;
        }
        sendJson(response, 201, { message: "Thanks — your message has been received." });
      } catch (error) {
        if (response.headersSent || response.destroyed) return;
        if (error instanceof HttpError) {
          sendJson(response, error.status, {
            error: error.message,
            ...(error.details ? { errors: error.details } : {}),
          });
          return;
        }
        console.error("Could not process contact submission:", error);
        sendJson(response, 500, { error: "Your message could not be saved. Please try again later." });
      }
      return;
    }

    if ((pathname === "/api/portfolio" && request.method !== "GET")
      || (pathname === "/api/contact" && request.method !== "POST")) {
      response.setHeader("Allow", pathname === "/api/portfolio" ? "GET" : "POST");
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }

    const filePath = pathname === "/" ? "/index.html" : pathname;
    const contentType = CONTENT_TYPES[filePath];
    if (!contentType) {
      sendJson(response, 404, { error: "Not found." });
      return;
    }

    try {
      const content = await readFile(path.join(ROOT, filePath.slice(1)));
      response.writeHead(200, {
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      });
      response.end(request.method === "HEAD" ? undefined : content);
    } catch (error) {
      console.error(`Could not serve ${filePath}:`, error);
      sendJson(response, 500, { error: "The requested page could not be served." });
    }
  }

  return http.createServer((request, response) => {
    handleRequest(request, response).catch((error) => {
      console.error("Unexpected request error:", error);
      if (!response.headersSent && !response.destroyed) {
        sendJson(response, 500, { error: "An unexpected server error occurred." });
      } else if (!response.destroyed) {
        response.destroy();
      }
    });
  });
}

async function start() {
  const dataDirectory = path.resolve(process.env.DATA_DIR || path.join(ROOT, "data"));
  await mkdir(dataDirectory, { recursive: true });

  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error("PORT must be an integer between 0 and 65535.");
  }

  const server = createServer({ dataDirectory });
  const host = process.env.HOST || "127.0.0.1";
  server.once("error", (error) => {
    console.error("Could not start the portfolio server:", error);
    process.exitCode = 1;
  });
  server.listen(port, host, () => {
    console.log(`Portfolio available at http://${host}:${server.address().port}`);
    console.log(`Portfolio data: ${path.join(dataDirectory, "portfolio.json")}`);
    console.log(`Contact submissions: ${path.join(dataDirectory, "messages.jsonl")}`);
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error("Could not start the portfolio server:", error);
    process.exitCode = 1;
  });
}

module.exports = { createServer };
