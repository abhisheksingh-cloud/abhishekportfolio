const assert = require("node:assert/strict");
const { mkdtemp, readFile, rm, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { after, before, test } = require("node:test");
const { createServer } = require("../server");

let dataDirectory;
let server;
let baseUrl;

before(async () => {
  dataDirectory = await mkdtemp(path.join(os.tmpdir(), "portfolio-test-"));
  const portfolio = await readFile(path.join(__dirname, "..", "data", "portfolio.json"), "utf8");
  await writeFile(path.join(dataDirectory, "portfolio.json"), portfolio);
  server = createServer({ dataDirectory });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  await rm(dataDirectory, { recursive: true, force: true });
});

test("serves the portfolio page and data", async () => {
  const page = await fetch(baseUrl);
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-type"), /text\/html/);

  const response = await fetch(`${baseUrl}/api/portfolio`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /no-store/);
  const portfolio = await response.json();
  assert.equal(portfolio.profile.role, "Software Developer");
  assert.ok(portfolio.projects.length > 0);
});

test("validates and stores contact messages as JSON lines", async () => {
  const invalid = await fetch(`${baseUrl}/api/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "", email: "not-an-email", message: "" }),
  });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).errors.length, 3);

  const response = await fetch(`${baseUrl}/api/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: " Ada ", email: "ada@example.com", message: " Hello " }),
  });
  assert.equal(response.status, 201);

  const [storedMessage] = (await readFile(path.join(dataDirectory, "messages.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map(JSON.parse);
  assert.equal(storedMessage.name, "Ada");
  assert.equal(storedMessage.email, "ada@example.com");
  assert.equal(storedMessage.message, "Hello");
  assert.ok(storedMessage.id);
  assert.ok(storedMessage.receivedAt);
});

test("rejects malformed, oversized, and non-JSON contact submissions", async () => {
  const wrongContentType = await fetch(`${baseUrl}/api/contact`, {
    method: "POST",
    body: "name=Ada",
  });
  assert.equal(wrongContentType.status, 415);

  const invalidJson = await fetch(`${baseUrl}/api/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{invalid",
  });
  assert.equal(invalidJson.status, 400);

  const oversized = await fetch(`${baseUrl}/api/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Ada",
      email: "ada@example.com",
      message: "x".repeat(11 * 1024),
    }),
  });
  assert.equal(oversized.status, 413);
});

test("uses a honeypot to skip bot submissions and limits message volume", async () => {
  const spam = await fetch(`${baseUrl}/api/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ website: "bot", name: "", email: "", message: "" }),
  });
  assert.equal(spam.status, 202);

  const responses = await Promise.all(Array.from({ length: 5 }, (_, index) =>
    fetch(`${baseUrl}/api/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Ada",
        email: "ada@example.com",
        message: `Hello ${index}`,
      }),
    }),
  ));
  const statuses = await Promise.all(responses.map((response) => response.status));
  assert.equal(statuses.filter((status) => status === 201).length, 4);
  assert.equal(statuses.filter((status) => status === 429).length, 1);
});
