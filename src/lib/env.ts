import "server-only";

import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Baked into the Docker image at build time (--build-arg APP_VERSION=vX.Y.Z);
  // synced into Installation.appVersion at boot for the OTA updater.
  APP_VERSION: z.string().default("dev"),
  DATABASE_URL: z.string().min(1).default("file:../data/app.db?connection_limit=1"),
  NEXTAUTH_URL: z.string().url().default("http://localhost:3000"),
  NEXTAUTH_SECRET: z.string().min(32).default("dev-secret-change-me-please-32-characters"),
  ENCRYPTION_KEY: z
    .string()
    .min(64)
    .default("0".repeat(64))
    .describe("64-char hex (32 bytes) for AES-256-GCM"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  // OAuth broker for shipped devices (no local client secret). When Google
  // isn't configured locally, connect-google routes through this broker and
  // adopts the token via /api/auth/google/adopt. See docs/google-oauth-broker-plan.md.
  OAUTH_BROKER_URL: z.string().url().default("https://familyboard.ch"),
  // Relay for remote (off-LAN) mobile access. The Pi opens an outbound
  // WebSocket here; the phone reaches the wall via <https-origin>/f/<id>.
  // Default points at the vendor relay so shipped devices need zero config.
  RELAY_URL: z.string().url().default("wss://relay.familyboard.ch"),
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_TENANT: z.string().optional().default("common"),
  SYNC_INTERVAL_MS: z.coerce.number().int().positive().default(5 * 60 * 1000),
  // Only trust the X-Forwarded-For header (for rate-limit client IPs) when the
  // app runs behind a trusted reverse proxy that sets it. Left off, the header
  // is attacker-controlled and would let clients evade IP-keyed rate limits by
  // rotating the value — so untrusted deployments fall back to a shared bucket.
  TRUST_PROXY: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  // Optional VAPID key overrides — if set, DB-generated keys are ignored.
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  // Firebase service-account JSON for mobile push (FCM). Optional — if absent,
  // FCM silently no-ops and only web-push is used.
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional(),
  // Ed25519 public key (base64 SPKI DER) for offline license verification.
  // When unset, the baked-in dev key from src/lib/license.ts is used — safe for
  // development/testing but the matching private key must never be committed.
  LICENSE_PUBLIC_KEY: z.string().optional(),
  // License server for device check-in (mints the signed lease). Default points
  // at the vendor Worker so shipped devices need zero config; override to a
  // local `wrangler dev` when testing the check-in loop.
  LICENSE_SERVER_URL: z.string().url().default("https://license.familyboard.ch"),
});

export const env = schema.parse(process.env);

// Refuse to run in production with the built-in dev secrets: the zero-key would
// encrypt every OAuth refresh token under a publicly known key, and the default
// NEXTAUTH_SECRET is equally public. Fail fast rather than ship a false sense of
// encryption. Dev/test may keep the defaults for zero-config local runs.
//
// Skipped during `next build`: page-data collection runs route modules with
// NODE_ENV=production but no real secrets in the environment — those are only
// injected at container start (e.g. the Pi's first-boot secret generation).
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
if (env.NODE_ENV === "production" && !isBuildPhase) {
  const weak: string[] = [];
  if (env.ENCRYPTION_KEY === "0".repeat(64)) weak.push("ENCRYPTION_KEY");
  if (env.NEXTAUTH_SECRET === "dev-secret-change-me-please-32-characters") {
    weak.push("NEXTAUTH_SECRET");
  }
  if (weak.length > 0) {
    throw new Error(
      `Refusing to start in production with default ${weak.join(" and ")}. ` +
        `Set a strong value (generate ENCRYPTION_KEY with: openssl rand -hex 32).`,
    );
  }
}

export const googleConfigured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
// Shipped devices have no local Google credentials but can still sync by
// refreshing access tokens through the OAuth broker (which holds the vendor
// client secret). OAUTH_BROKER_URL always has a default, so this is effectively
// always available as the fallback path when googleConfigured is false.
export const brokerConfigured = Boolean(env.OAUTH_BROKER_URL);
export const microsoftConfigured = Boolean(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET);
