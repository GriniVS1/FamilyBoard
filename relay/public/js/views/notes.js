import { apiFetch } from "../api.js";
import { t } from "../i18n.js";
import {
  escapeHtml,
  icon,
  showToast,
  confirmDialog,
  loadingState,
  emptyState,
  accentClass,
  MEMBER_COLORS,
} from "../ui.js";

/** @type {Array<any>} */
let notes = [];
let loading = true;
let loadError = false;

export function renderNotes(root) {
  root.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
      <h1 style="font-family:var(--font-display);font-size:1.15rem;margin:0;">${escapeHtml(t("notes.title"))}</h1>
      <button type="button" id="notes-add-btn" class="btn btn-primary btn-icon" aria-label="${escapeHtml(t("notes.add"))}">${icon("plus")}</button>
    </div>
    <div id="notes-grid"></div>
  `;

  root.querySelector("#notes-add-btn").addEventListener("click", () => openNoteModal(null));

  renderGrid();
  void load();
}

function gridEl() {
  return document.getElementById("notes-grid");
}

async function load() {
  loading = true;
  loadError = false;
  renderGrid();
  try {
    const data = await apiFetch("/api/mobile/notes");
    notes = Array.isArray(data?.notes) ? data.notes : [];
  } catch {
    loadError = true;
  } finally {
    loading = false;
    renderGrid();
  }
}

function avatarHtml(author) {
  if (!author) {
    return `<span class="avatar-dot accent-sand">?</span>`;
  }
  const initial = author.name ? author.name[0].toUpperCase() : "?";
  const content = author.emoji ? escapeHtml(author.emoji) : escapeHtml(initial);
  return `<span class="avatar-dot ${accentClass(author.color)}">${content}</span>`;
}

function renderGrid() {
  const el = gridEl();
  if (!el) return;

  if (loading) {
    el.innerHTML = loadingState();
    return;
  }
  if (loadError) {
    el.innerHTML = emptyState(t("notes.loadError"));
    return;
  }
  if (notes.length === 0) {
    el.innerHTML = emptyState(t("notes.empty"));
    return;
  }

  el.className = "notes-grid";
  el.innerHTML = notes
    .map(
      (note) => `
      <div class="note-card ${accentClass(note.color)}" data-id="${escapeHtml(note.id)}">
        <div class="note-body">${escapeHtml(note.body)}</div>
        <div class="note-meta">
          <span class="note-author">
            ${avatarHtml(note.author)}
            <span>${escapeHtml(note.author?.name ?? t("notes.noAuthor"))}</span>
            ${note.pinned ? icon("pin") : ""}
          </span>
          <span class="note-actions">
            <button type="button" class="btn btn-ghost btn-icon" data-action="edit" aria-label="${escapeHtml(t("notes.edit"))}">${icon("notes")}</button>
            <button type="button" class="btn btn-ghost btn-icon" data-action="delete" aria-label="${escapeHtml(t("notes.delete"))}">${icon("trash")}</button>
          </span>
        </div>
      </div>
    `,
    )
    .join("");

  el.querySelectorAll('[data-action="edit"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.closest(".note-card").dataset.id;
      const note = notes.find((n) => n.id === id);
      if (note) openNoteModal(note);
    });
  });
  el.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.closest(".note-card").dataset.id;
      void remove(id);
    });
  });
}

function openNoteModal(existing) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const selectedColor = existing?.color ?? "sun";
  overlay.innerHTML = `
    <div class="modal-sheet" role="dialog" aria-modal="true">
      <p class="modal-title">${escapeHtml(existing ? t("notes.edit") : t("notes.newNote"))}</p>
      <div class="field">
        <label for="note-body-input">${escapeHtml(t("notes.bodyLabel"))}</label>
        <textarea id="note-body-input" placeholder="${escapeHtml(t("notes.bodyPlaceholder"))}">${escapeHtml(existing?.body ?? "")}</textarea>
      </div>
      <div class="field">
        <label>${escapeHtml(t("notes.colorLabel"))}</label>
        <div class="swatch-row" id="note-swatch-row">
          ${MEMBER_COLORS.map(
            (c) =>
              `<button type="button" class="swatch accent-${c} ${c === selectedColor ? "is-selected" : ""}" data-color="${c}" aria-label="${c}"></button>`,
          ).join("")}
        </div>
      </div>
      <label class="checkbox-row">
        <input type="checkbox" id="note-pinned-input" ${existing?.pinned ? "checked" : ""} />
        ${escapeHtml(t("notes.pinned"))}
      </label>
      <div class="modal-actions">
        ${existing ? `<button type="button" class="btn btn-danger" data-action="delete" style="margin-right:auto;">${escapeHtml(t("notes.delete"))}</button>` : ""}
        <button type="button" class="btn btn-secondary" data-action="cancel">${escapeHtml(t("common.cancel"))}</button>
        <button type="button" class="btn btn-primary" data-action="save">${escapeHtml(t("notes.save"))}</button>
      </div>
    </div>
  `;

  let color = selectedColor;
  overlay.querySelectorAll(".swatch").forEach((btn) => {
    btn.addEventListener("click", () => {
      color = btn.dataset.color;
      overlay.querySelectorAll(".swatch").forEach((b) => b.classList.toggle("is-selected", b === btn));
    });
  });

  function close() {
    overlay.remove();
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector('[data-action="cancel"]').addEventListener("click", close);

  if (existing) {
    overlay.querySelector('[data-action="delete"]').addEventListener("click", async () => {
      close();
      await remove(existing.id);
    });
  }

  overlay.querySelector('[data-action="save"]').addEventListener("click", async () => {
    const body = overlay.querySelector("#note-body-input").value.trim();
    const pinned = overlay.querySelector("#note-pinned-input").checked;
    if (!body) return;
    close();
    await save(existing, { body, color, pinned });
  });

  document.body.appendChild(overlay);
  overlay.querySelector("#note-body-input").focus();
}

async function save(existing, payload) {
  try {
    if (existing) {
      const updated = await apiFetch(`/api/mobile/notes/${existing.id}`, {
        method: "PATCH",
        body: payload,
      });
      notes = notes.map((n) => (n.id === existing.id ? updated : n));
    } else {
      const created = await apiFetch("/api/mobile/notes", { method: "POST", body: payload });
      notes = [created, ...notes];
    }
  } catch {
    showToast(t("notes.saveError"));
  }
  renderGrid();
}

async function remove(id) {
  const ok = await confirmDialog({
    title: t("notes.deleteConfirmTitle"),
    body: t("notes.deleteConfirmBody"),
    danger: true,
  });
  if (!ok) return;

  const prev = notes;
  notes = notes.filter((n) => n.id !== id);
  renderGrid();

  try {
    await apiFetch(`/api/mobile/notes/${id}`, { method: "DELETE" });
  } catch {
    notes = prev;
    renderGrid();
    showToast(t("notes.deleteError"));
  }
}
