import { apiFetch } from "../api.js";
import { t, dateTimeFormatter } from "../i18n.js";
import { escapeHtml, accentClass, loadingState, emptyState } from "../ui.js";

const INITIAL_RANGE_DAYS = 30;
const STEP_DAYS = 30;
const MAX_RANGE_DAYS = 180;

let anchor = startOfToday();
let rangeDays = INITIAL_RANGE_DAYS;
let events = [];
let loading = true;
let loadError = false;

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function localDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function utcDateKey(iso) {
  return iso.slice(0, 10);
}

export function renderCalendar(root) {
  root.innerHTML = `
    <h1 style="font-family:var(--font-display);font-size:1.15rem;margin:0 0 14px;">${escapeHtml(t("calendar.title"))}</h1>
    <div id="calendar-list"></div>
  `;

  anchor = startOfToday();
  rangeDays = INITIAL_RANGE_DAYS;
  void load();
}

function listEl() {
  return document.getElementById("calendar-list");
}

async function load() {
  loading = true;
  loadError = false;
  renderList();
  try {
    const from = anchor.toISOString();
    const to = addDays(anchor, rangeDays).toISOString();
    const data = await apiFetch(`/api/mobile/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    events = Array.isArray(data?.events) ? data.events : [];
  } catch {
    loadError = true;
  } finally {
    loading = false;
    renderList();
  }
}

function groupByDay(list) {
  const groups = new Map();
  for (const ev of list) {
    const key = ev.allDay ? utcDateKey(ev.startsAt) : localDateKey(new Date(ev.startsAt));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(ev);
  }
  const keys = [...groups.keys()].sort();
  return keys.map((key) => ({
    key,
    events: groups.get(key).sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
    }),
  }));
}

function dayLabel(key) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return dateTimeFormatter({ weekday: "long", day: "numeric", month: "long" }).format(date);
}

function timeLabel(ev) {
  if (ev.allDay) return t("calendar.allDay");
  return dateTimeFormatter({ hour: "2-digit", minute: "2-digit" }).format(new Date(ev.startsAt));
}

function renderList() {
  const el = listEl();
  if (!el) return;

  if (loading) {
    el.innerHTML = loadingState();
    return;
  }
  if (loadError) {
    el.innerHTML = emptyState(t("calendar.loadError"));
    return;
  }
  if (events.length === 0) {
    el.innerHTML = `${emptyState(t("calendar.empty"))}${loadMoreHtml()}`;
    attachLoadMore(el);
    return;
  }

  const groups = groupByDay(events);
  el.innerHTML =
    groups
      .map(
        (group) => `
      <div class="day-group">
        <p class="day-group__label">${escapeHtml(dayLabel(group.key))}</p>
        ${group.events.map(eventRowHtml).join("")}
      </div>
    `,
      )
      .join("") + loadMoreHtml();

  attachLoadMore(el);
}

function eventRowHtml(ev) {
  const member = ev.member;
  const dotClass = accentClass(member?.color ?? ev.color);
  const emoji = member?.emoji ? escapeHtml(member.emoji) : "";
  return `
    <div class="event-row">
      <div class="event-time tabular">${escapeHtml(timeLabel(ev))}</div>
      <div class="event-body">
        <div class="event-title-row">
          <span class="member-dot ${dotClass}" aria-hidden="true"></span>
          <span class="event-title">${emoji ? `${emoji} ` : ""}${escapeHtml(ev.title)}</span>
        </div>
        ${ev.location ? `<div class="event-location">${escapeHtml(ev.location)}</div>` : ""}
      </div>
    </div>
  `;
}

function loadMoreHtml() {
  if (rangeDays >= MAX_RANGE_DAYS) {
    return `<p class="pair-hint">${escapeHtml(t("calendar.maxRange"))}</p>`;
  }
  return `<button type="button" id="calendar-load-more" class="btn btn-secondary" style="width:100%;margin-top:8px;">${escapeHtml(t("calendar.loadMore"))}</button>`;
}

function attachLoadMore(el) {
  const btn = el.querySelector("#calendar-load-more");
  if (!btn) return;
  btn.addEventListener("click", () => {
    rangeDays = Math.min(rangeDays + STEP_DAYS, MAX_RANGE_DAYS);
    void load();
  });
}
