const menuToggle = document.querySelector(".menu-toggle");
const primaryNav = document.querySelector("#primary-nav");

function setMenuOpen(isOpen) {
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.querySelector(".sr-only").textContent = isOpen
    ? "Close navigation menu"
    : "Open navigation menu";
  primaryNav.classList.toggle("is-open", isOpen);
}

menuToggle.addEventListener("click", () => {
  setMenuOpen(menuToggle.getAttribute("aria-expanded") !== "true");
});

primaryNav.addEventListener("click", (event) => {
  if (event.target.closest("a")) {
    setMenuOpen(false);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menuToggle.getAttribute("aria-expanded") === "true") {
    setMenuOpen(false);
    menuToggle.focus();
  }
});

function addText(parent, tagName, text, className) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  parent.append(element);
  return element;
}

function renderAbout(about) {
  const container = document.querySelector("[data-about]");
  container.replaceChildren();
  addText(container, "p", about.lead, "lead");
  addText(container, "p", about.description);
  const link = addText(container, "a", "A bit more about me ↓", "text-link");
  link.href = "#contact";
}

function renderPrinciples(principles) {
  const container = document.querySelector("[data-principles]");
  container.replaceChildren();

  principles.forEach((principle, index) => {
    const article = document.createElement("article");
    article.className = "principle";
    addText(article, "span", String(index + 1).padStart(2, "0"), "principle-number");
    addText(article, "h3", principle.title);
    addText(article, "p", principle.description);
    container.append(article);
  });
}

function createProjectCard(project, index) {
  const article = document.createElement("article");
  article.className = `project-card${index === 0 ? " project-card-featured" : ""}`;

  const visual = document.createElement("div");
  visual.className = `project-visual project-visual-${index % 2 === 0 ? "one" : "two"}`;
  visual.setAttribute("aria-hidden", "true");
  const illustration = addText(visual, "span", String(index + 1).padStart(2, "0"), "project-art-number");
  const orbit = document.createElement("span");
  orbit.className = "project-art-orbit";
  illustration.append(orbit);
  const core = document.createElement("span");
  core.className = "project-art-core";
  illustration.append(core);
  addText(visual, "span", `${String(index + 1).padStart(2, "0")} / ${project.type.toUpperCase()}`, "visual-index");
  article.append(visual);

  const info = document.createElement("div");
  info.className = "project-info";
  const heading = document.createElement("div");
  addText(heading, "p", project.type, "project-type");
  addText(heading, "h3", project.title);
  info.append(heading);

  const link = document.createElement("a");
  link.className = "project-link";
  link.href = "#contact";
  link.setAttribute("aria-label", `View ${project.title}`);
  link.textContent = "↗";
  if (project.url) {
    const projectUrl = new URL(project.url);
    if (projectUrl.protocol !== "https:" && projectUrl.protocol !== "http:") {
      throw new Error(`Project link must use HTTP or HTTPS: ${project.title}`);
    }
    link.href = projectUrl.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }
  info.append(link);

  addText(info, "p", project.description, "project-description");
  const tags = document.createElement("ul");
  tags.className = "tag-list";
  tags.setAttribute("aria-label", `${project.title} technologies`);
  project.technologies.forEach((technology) => addText(tags, "li", technology));
  info.append(tags);
  article.append(info);
  return article;
}

function renderProjects(projects) {
  const container = document.querySelector("[data-projects]");
  container.replaceChildren(...projects.map(createProjectCard));
}

function renderSkills(groups) {
  const container = document.querySelector("[data-skills]");
  container.replaceChildren();

  groups.forEach((group) => {
    const section = document.createElement("div");
    section.className = "skill-group";
    addText(section, "span", group.label, "skill-label");
    const list = document.createElement("ul");
    list.className = "skill-list";
    group.items.forEach((skill) => addText(list, "li", skill));
    section.append(list);
    container.append(section);
  });

  const footnote = document.createElement("div");
  footnote.className = "skill-footnote";
  addText(footnote, "span", "✳").setAttribute("aria-hidden", "true");
  footnote.append(document.createTextNode(" Always making room to learn something new."));
  container.append(footnote);
}

function renderExperience(experience) {
  const container = document.querySelector("[data-experience]");
  container.replaceChildren();

  experience.forEach((entry) => {
    const article = document.createElement("article");
    article.className = "timeline-entry";
    addText(article, "span", entry.date, "timeline-date");
    const detail = document.createElement("div");
    detail.className = "timeline-detail";
    addText(detail, "h3", entry.role);
    addText(detail, "p", entry.organization, "timeline-organization");
    addText(detail, "p", entry.description);
    article.append(detail);
    const marker = document.createElement("span");
    marker.className = "timeline-marker";
    marker.setAttribute("aria-hidden", "true");
    article.append(marker);
    container.append(article);
  });
}

function renderEducation(education) {
  const container = document.querySelector("[data-education]");
  container.replaceChildren();
  addText(container, "span", "✳", "education-icon").setAttribute("aria-hidden", "true");
  const detail = document.createElement("div");
  addText(detail, "p", "EDUCATION", "project-type");
  addText(detail, "h3", education.degree);
  addText(detail, "p", education.institution, "timeline-organization");
  addText(detail, "p", education.description);
  container.append(detail);
}

function watchReveals() {
  if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll(".principle, .project-card, .skill-group, .timeline-entry, .education-card").forEach((element) => {
    element.setAttribute("data-reveal", "");
    revealObserver.observe(element);
  });
}

function renderPortfolio(portfolio) {
  document.querySelector("[data-profile-role]").textContent = portfolio.profile.role.toUpperCase();
  document.querySelector("[data-profile-location]").textContent = portfolio.profile.location.toUpperCase();
  document.querySelector("[data-headline-primary]").textContent = portfolio.profile.headline[0];
  document.querySelector("[data-headline-secondary]").textContent = portfolio.profile.headline[1];
  document.querySelector("[data-profile-intro]").textContent = portfolio.profile.intro;
  document.querySelector("#hero-title").setAttribute("aria-label", portfolio.profile.headline.join(" "));
  document.title = `${portfolio.profile.name} — ${portfolio.profile.role}`;

  document.querySelectorAll(".wordmark > span:last-child").forEach((wordmark) => {
    wordmark.replaceChildren(document.createTextNode(portfolio.profile.name.replace(/\.$/, "")));
    const period = document.createElement("span");
    period.className = "wordmark-period";
    period.textContent = ".";
    wordmark.append(period);
  });

  renderAbout(portfolio.about);
  renderPrinciples(portfolio.principles);
  renderProjects(portfolio.projects);
  renderSkills(portfolio.skills);
  renderExperience(portfolio.experience);
  renderEducation(portfolio.education);
}

async function loadPortfolio() {
  const response = await fetch("/api/portfolio");
  if (!response.ok) {
    throw new Error(`Portfolio API returned ${response.status}`);
  }
  renderPortfolio(await response.json());
  watchReveals();
}

async function submitContact(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const status = form.querySelector("[data-contact-status]");
  button.disabled = true;
  status.textContent = "Sending your message…";

  try {
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    const result = await response.json();
    if (!response.ok) {
      const message = Array.isArray(result.errors) ? result.errors.join(" ") : result.error;
      throw new Error(message || `Request failed with status ${response.status}`);
    }

    form.reset();
    status.textContent = "Thanks — your message has been received.";
  } catch (error) {
    status.textContent = error.message || "Your message could not be sent. Please try again.";
  } finally {
    button.disabled = false;
  }
}

document.querySelector("[data-year]").textContent = new Date().getFullYear();
document.querySelector("[data-contact-form]").addEventListener("submit", submitContact);

loadPortfolio().catch((error) => {
  console.error("Could not load portfolio content:", error);
  document.querySelector("[data-contact-status]").textContent =
    "Portfolio data could not be loaded. Start the website with npm start and refresh this page.";
});
