// Shared render helpers: escaping, toasts, a generic confirm sheet, icons,
// and the member/note accent color set (mirrors MEMBER_COLORS in src/lib/utils.ts).

import { t } from "./i18n.js";

export const MEMBER_COLORS = [
  "peach",
  "mint",
  "sun",
  "sky",
  "lilac",
  "rose",
  "teal",
  "sand",
];

export function accentClass(color) {
  return MEMBER_COLORS.includes(color) ? `accent-${color}` : "accent-sand";
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function icon(name) {
  switch (name) {
    case "todos":
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>';
    case "notes":
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9z"/><path d="M15 3v6h6"/></svg>';
    case "calendar":
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
    case "plus":
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>';
    case "trash":
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>';
    case "pin":
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l1.5 5.5L19 9l-4 4 1 6-4-3-4 3 1-6-4-4 5.5-1.5z"/></svg>';
    case "logout":
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>';
    case "check":
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
    default:
      return "";
  }
}

let toastTimer = null;
export function showToast(message) {
  let el = document.getElementById("fb-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "fb-toast";
    document.body.appendChild(el);
  }
  el.className = "toast";
  el.textContent = message;
  el.setAttribute("role", "alert");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.remove();
  }, 3500);
}

/**
 * Renders a bottom-sheet confirm dialog and resolves true/false.
 * @param {{ title: string, body: string, confirmLabel?: string, danger?: boolean }} opts
 */
export function confirmDialog(opts) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal-sheet" role="dialog" aria-modal="true">
        <p class="modal-title">${escapeHtml(opts.title)}</p>
        <p>${escapeHtml(opts.body)}</p>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" data-action="cancel">${escapeHtml(t("common.cancel"))}</button>
          <button type="button" class="btn ${opts.danger ? "btn-danger" : "btn-primary"}" data-action="confirm">${escapeHtml(opts.confirmLabel ?? t("common.confirm"))}</button>
        </div>
      </div>
    `;
    function close(result) {
      overlay.remove();
      resolve(result);
    }
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close(false);
    });
    overlay.querySelector('[data-action="cancel"]').addEventListener("click", () => close(false));
    overlay.querySelector('[data-action="confirm"]').addEventListener("click", () => close(true));
    document.body.appendChild(overlay);
  });
}

export function skeletonRows(count) {
  return Array.from({ length: count })
    .map(() => '<div class="skeleton"></div>')
    .join("");
}

export function emptyState(message) {
  return `<div class="state-block"><p>${escapeHtml(message)}</p></div>`;
}

export function loadingState() {
  return `<div class="state-block"><div class="spinner" aria-hidden="true"></div><p>${escapeHtml(t("common.loading"))}</p></div>`;
}
