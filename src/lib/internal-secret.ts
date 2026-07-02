import "server-only";

import { randomBytes } from "node:crypto";

export const INTERNAL_SECRET_HEADER = "x-internal-secret";

// The secret is kept on process.env — NOT in the frozen `env` object — so that
// instrumentation.ts (the cron caller) and the route handlers (the verifier)
// resolve the SAME value even though Next may bundle them into separate module
// graphs. Both sides read process.env at call time; the first to run mints it.
// Set INTERNAL_API_SECRET explicitly when the app runs as more than one process.
//
// This module deliberately avoids importing the DB/Prisma chain so it is safe
// for instrumentation.ts to import without breaking Next's bundling pass.
export function getInternalSecret(): string {
  if (!process.env.INTERNAL_API_SECRET) {
    process.env.INTERNAL_API_SECRET = randomBytes(32).toString("hex");
  }
  return process.env.INTERNAL_API_SECRET;
}

export function internalHeaders(): Record<string, string> {
  return { [INTERNAL_SECRET_HEADER]: getInternalSecret() };
}
