import { apiFetch } from "../api.js";
import { t, dateTimeFormatter } from "../i18n.js";
import { escapeHtml, icon, showToast, confirmDialog, loadingState, emptyState } from "../ui.js";

/** @type {Array<{id:string,title:string,done:boolean,dueDate:string|null}>} */
let todos = [];
let loading = true;
let loadError = false;

function formatDue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return dateTimeFormatter({ day: "numeric", month: "short" }).format(d);
}

export function renderTodos(root) {
  root.innerHTML = `
    <div class="todo-add">
      <input id="todo-new-input" type="text" placeholder="${escapeHtml(t("todos.addPlaceholder"))}" />
      <button type="button" id="todo-add-btn" class="btn btn-primary btn-icon" aria-label="${escapeHtml(t("todos.add"))}">${icon("plus")}</button>
    </div>
    <div id="todo-list"></div>
  `;

  root.querySelector("#todo-add-btn").addEventListener("click", handleAdd);
  root.querySelector("#todo-new-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleAdd();
  });

  renderList();
  void load();
}

function listEl() {
  return document.getElementById("todo-list");
}

async function load() {
  loading = true;
  loadError = false;
  renderList();
  try {
    const data = await apiFetch("/api/mobile/todos");
    todos = Array.isArray(data) ? data : Array.isArray(data?.todos) ? data.todos : [];
  } catch {
    loadError = true;
  } finally {
    loading = false;
    renderList();
  }
}

function renderList() {
  const el = listEl();
  if (!el) return;

  if (loading) {
    el.innerHTML = loadingState();
    return;
  }
  if (loadError) {
    el.innerHTML = emptyState(t("todos.loadError"));
    return;
  }
  if (todos.length === 0) {
    el.innerHTML = emptyState(t("todos.empty"));
    return;
  }

  const open = todos.filter((td) => !td.done);
  const done = todos.filter((td) => td.done);

  const rowHtml = (todo) => `
    <div class="todo-row ${todo.done ? "is-done" : ""}" data-id="${escapeHtml(todo.id)}">
      <button type="button" class="todo-check ${todo.done ? "is-done" : ""}" data-action="toggle" aria-label="${escapeHtml(todo.title)}">
        ${todo.done ? icon("check") : ""}
      </button>
      <div class="todo-title">
        ${escapeHtml(todo.title)}
        ${todo.dueDate ? `<div class="todo-due">${escapeHtml(t("todos.due", { date: formatDue(todo.dueDate) }))}</div>` : ""}
      </div>
      <button type="button" class="btn btn-ghost btn-icon" data-action="delete" aria-label="${escapeHtml(t("notes.delete"))}">${icon("trash")}</button>
    </div>
  `;

  el.innerHTML = `
    ${open.length > 0 ? `<p class="todo-section-title">${escapeHtml(t("todos.open"))}</p>${open.map(rowHtml).join("")}` : ""}
    ${done.length > 0 ? `<p class="todo-section-title">${escapeHtml(t("todos.done"))}</p>${done.map(rowHtml).join("")}` : ""}
  `;

  el.querySelectorAll('[data-action="toggle"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.closest(".todo-row").dataset.id;
      void toggle(id);
    });
  });
  el.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.closest(".todo-row").dataset.id;
      void remove(id);
    });
  });
}

async function handleAdd() {
  const input = document.getElementById("todo-new-input");
  const title = input.value.trim();
  if (!title) return;
  input.value = "";

  const tempId = `tmp-${Date.now()}`;
  todos = [{ id: tempId, title, done: false, dueDate: null }, ...todos];
  renderList();

  try {
    const created = await apiFetch("/api/mobile/todos", { method: "POST", body: { title } });
    todos = todos.map((td) => (td.id === tempId ? created : td));
  } catch {
    todos = todos.filter((td) => td.id !== tempId);
    showToast(t("todos.loadError"));
  }
  renderList();
}

async function toggle(id) {
  const idx = todos.findIndex((td) => td.id === id);
  if (idx === -1) return;
  const prev = todos[idx];
  const optimistic = { ...prev, done: !prev.done };
  todos = todos.map((td) => (td.id === id ? optimistic : td));
  renderList();

  try {
    const updated = await apiFetch(`/api/mobile/todos/${id}`, {
      method: "PATCH",
      body: { done: optimistic.done },
    });
    todos = todos.map((td) => (td.id === id ? updated : td));
  } catch {
    todos = todos.map((td) => (td.id === id ? prev : td));
    showToast(t("todos.loadError"));
  }
  renderList();
}

async function remove(id) {
  const todo = todos.find((td) => td.id === id);
  if (!todo) return;
  const ok = await confirmDialog({
    title: t("todos.deleteConfirmTitle"),
    body: t("todos.deleteConfirmBody"),
    danger: true,
  });
  if (!ok) return;

  const prevList = todos;
  todos = todos.filter((td) => td.id !== id);
  renderList();

  try {
    await apiFetch(`/api/mobile/todos/${id}`, { method: "DELETE" });
  } catch {
    todos = prevList;
    renderList();
    showToast(t("todos.loadError"));
  }
}
