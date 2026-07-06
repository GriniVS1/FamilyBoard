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
