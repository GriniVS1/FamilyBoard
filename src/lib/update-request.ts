import "server-only";

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { env } from "./env";

// The host OTA updater (familyboard-updater.path) watches
// <data>/update-request. Writing it from the app is how the wall UI's
// "check for updates" button pokes the host updater — no Docker socket in the
// container. See docs/ota-update-plan.md.
function dataDir(): string {
  const file = env.DATABASE_URL.replace(/^file:/, "").split("?")[0];
  // Production: DATABASE_URL is absolute (/app/data/app.db) → the bind-mounted
  // dir the host unit watches. Dev: relative path; the flag is a no-op there
  // (no updater running) so a best-effort ./data is fine.
  return path.isAbsolute(file) ? path.dirname(file) : path.resolve(process.cwd(), "data");
}

export function requestUpdateCheck(): void {
  const target = path.join(dataDir(), "update-request");
  // Content is just a timestamp; the updater only cares that the file appears.
  writeFileSync(target, new Date().toISOString() + "\n");
}

// Tail of the host updater's log (written to <data>/update.log). Empty string
// when no update run has happened yet (or on a device whose base image predates
// file logging — the log only appears once the host updater writes it).
export function readUpdateLog(maxLines = 300): { log: string; available: boolean } {
  const target = path.join(dataDir(), "update.log");
  try {
    const lines = readFileSync(target, "utf8").split("\n");
    return { log: lines.slice(-maxLines).join("\n").trimEnd(), available: true };
  } catch {
    return { log: "", available: false };
  }
}

export type UpdaterProgress = {
  phase:
    | "checking"
    | "downloading"
    | "verifying"
    | "installing"
    | "health"
    | "done"
    | "failed"
    | "rolledback"
    | "uptodate";
  version?: string;
  percent?: number;
  message?: string;
  updatedAt: string;
};

const ACTIVE_PHASES = new Set(["checking", "downloading", "verifying", "installing", "health"]);
const ALL_PHASES = new Set([...ACTIVE_PHASES, "done", "failed", "rolledback", "uptodate"]);

// Machine-readable progress the host updater writes to <data>/update-status.json.
// Returns null when nothing useful is there: never written (old updater / no
// run yet), unparseable, or stale — an "active" phase older than 10 minutes
// means the updater died mid-run (or the file predates a reboot), and terminal
// phases stop being interesting after 30 minutes.
export function readUpdateProgress(): UpdaterProgress | null {
  const target = path.join(dataDir(), "update-status.json");
  let parsed: UpdaterProgress;
  try {
    parsed = JSON.parse(readFileSync(target, "utf8")) as UpdaterProgress;
  } catch {
    return null;
  }
  if (!parsed || !ALL_PHASES.has(parsed.phase) || typeof parsed.updatedAt !== "string") {
    return null;
  }
  const age = Date.now() - new Date(parsed.updatedAt).getTime();
  if (Number.isNaN(age)) return null;
  const maxAge = ACTIVE_PHASES.has(parsed.phase) ? 10 * 60_000 : 30 * 60_000;
  if (age > maxAge) return null;
  return parsed;
}
