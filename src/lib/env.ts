import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1).default("file:../data/app.db"),
  NEXTAUTH_URL: z.string().url().default("http://localhost:3000"),
  NEXTAUTH_SECRET: z.string().min(32).default("dev-secret-change-me-please-32-characters"),
  ENCRYPTION_KEY: z
    .string()
    .min(64)
    .default("0".repeat(64))
    .describe("64-char hex (32 bytes) for AES-256-GCM"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_TENANT: z.string().optional().default("common"),
  SYNC_INTERVAL_MS: z.coerce.number().int().positive().default(5 * 60 * 1000),
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
});

export const env = schema.parse(process.env);

export const googleConfigured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
export const microsoftConfigured = Boolean(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET);
