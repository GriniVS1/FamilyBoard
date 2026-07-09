import { consumeArrivalHashIfPresent } from "./arrival.js";
import { loadSession, clearSession, setUnauthorizedHandler } from "./api.js";
import { t, getLocale, setLocale, LOCALES } from "./i18n.js";
import { escapeHtml, icon } from "./ui.js";
import { renderPair } from "./views/pair.js";
import { renderTodos } from "./views/todos.js";
import { renderNotes } from "./views/notes.js";
import { renderCalendar } from "./views/calendar.js";

const ROUTES = ["/todos", "/notes", "/calendar", "/pair"];

consumeArrivalHashIfPresent();

setUnauthorizedHandler(() => {
  navigate("/pair");
});

function currentRoute() {
  const raw = location.hash.replace(/^#/, "");
  if (ROUTES.includes(raw)) return raw;
  return null;
}

function navigate(route) {
  if (location.hash === `#${route}`) {
    render();
    return;
  }
  location.hash = `#${route}`;
}

function appRoot() {
  return document.getElementById("app");
}

function headerHtml(session) {
  const title = session
    ? `${escapeHtml(session.familyName || t("appTitle"))}`
    : `<span class="brand-coral">Family</span>Board`;

  const localeOptions = LOCALES.map(
    (l) => `<option value="${l}" ${l === getLocale() ? "selected" : ""}>${l.toUpperCase()}</option>`,
  ).join("");

  return `
    <header class="fb-header">
      <span class="fb-header__title">${title}</span>
      <select id="fb-locale-select" class="fb-locale-select" aria-label="Language">
        ${localeOptions}
      </select>
      ${
        session
          ? `<button type="button" id="fb-logout-btn" class="fb-logout">${icon("logout")}<span>${escapeHtml(t("logout"))}</span></button>`
          : ""
      }
    </header>
  `;
}

function bottomNavHtml(activeRoute) {
  const tabs = [
    { route: "/todos", label: t("nav.todos"), icon: "todos" },
    { route: "/notes", label: t("nav.notes"), icon: "notes" },
    { route: "/calendar", label: t("nav.calendar"), icon: "calendar" },
  ];
  return `
    <nav class="fb-bottomnav">
      ${tabs
        .map(
          (tab) => `
        <button type="button" class="fb-navbtn ${activeRoute === tab.route ? "is-active" : ""}" data-route="${tab.route}">
          ${icon(tab.icon)}
          <span>${escapeHtml(tab.label)}</span>
        </button>
      `,
        )
        .join("")}
    </nav>
  `;
}

function render() {
  const session = loadSession();
  let route = currentRoute();

  if (!session) {
    route = "/pair";
    if (location.hash !== "#/pair") {
      history.replaceState(null, "", `${location.pathname}${location.search}#/pair`);
    }
  } else if (!route || route === "/pair") {
    route = "/todos";
    history.replaceState(null, "", `${location.pathname}${location.search}#/todos`);
  }

  const root = appRoot();
  root.innerHTML = `
    ${headerHtml(session)}
    <main class="fb-main ${route === "/pair" ? "fb-main--pair" : ""}" id="fb-main"></main>
    ${session ? bottomNavHtml(route) : ""}
  `;

  root.querySelector("#fb-locale-select").addEventListener("change", (e) => {
    setLocale(e.target.value);
    render();
  });

  const logoutBtn = root.querySelector("#fb-logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearSession();
      navigate("/pair");
    });
  }

  root.querySelectorAll(".fb-navbtn").forEach((btn) => {
    btn.addEventListener("click", () => navigate(btn.dataset.route));
  });

  const main = document.getElementById("fb-main");
  if (route === "/pair") {
    renderPair(main, { onPaired: () => navigate("/todos") });
  } else if (route === "/todos") {
    renderTodos(main);
  } else if (route === "/notes") {
    renderNotes(main);
  } else if (route === "/calendar") {
    renderCalendar(main);
  }
}

window.addEventListener("hashchange", render);
render();
