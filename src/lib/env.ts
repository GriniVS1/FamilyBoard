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
  SYNC_INTERVAL_MS: z.coerce.number().int().positive().default(5 * 60 * 1000),
});

export const env = schema.parse(process.env);

export const googleConfigured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
