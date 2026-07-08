import "server-only";

export const INTERNAL_SECRET_HEADER = "x-internal-secret";

// The secret is kept on process.env — NOT in the frozen `env` object — so that
// instrumentation.ts (the cron caller) and the route handlers (the verifier)
// resolve the SAME value even though Next may bundle them into separate module
// graphs. Both sides read process.env at call time; the first to run mints it.
// Set INTERNAL_API_SECRET explicitly when the app runs as more than one process.
//
// This module deliberately avoids importing the DB/Prisma chain so it is safe
// for instrumentation.ts to import without breaking Next's bundling pass. It
// also deliberately uses the Web Crypto API (globalThis.crypto, available in
// both Node 20+ and the Edge runtime) instead of `node:crypto` — Next's dev
// webpack build bundles instrumentation.ts's module graph for the Edge target
// too (the `NEXT_RUNTIME !== "nodejs"` guard in instrumentation.ts only skips
// *execution*, not bundling), and Edge webpack has no loader for the
// `node:` URI scheme.
export function getInternalSecret(): string {
  if (!process.env.INTERNAL_API_SECRET) {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
    process.env.INTERNAL_API_SECRET = Array.from(bytes, (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
  }
  return process.env.INTERNAL_API_SECRET;
}

export function internalHeaders(): Record<string, string> {
  return { [INTERNAL_SECRET_HEADER]: getInternalSecret() };
}
