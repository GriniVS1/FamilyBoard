import { z } from "zod";
import { withErrorHandling, ok } from "@/lib/api";
import { requireMobileAuth } from "@/lib/mobile-auth";
import { connectCaldav } from "@/lib/calendar-connect";

export const runtime = "nodejs";

const bodySchema = z.object({
  serverUrl: z.string().url().optional(),
  username: z.string().min(1),
  password: z.string().min(1),
  preset: z
    .enum(["icloud", "fastmail", "nextcloud", "yahoo", "custom"] as const)
    .optional(),
});

export const POST = withErrorHandling(async (req) => {
  const { memberId } = await requireMobileAuth(req);
  const body = bodySchema.parse(await req.json());
  const result = await connectCaldav(memberId, body);
  return ok(result);
});
