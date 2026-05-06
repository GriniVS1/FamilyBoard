import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { verifyAdminPin } from "@/lib/pin";
import { getClientIp, hitRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  pin: z.string().min(1).max(12),
});

export const POST = withErrorHandling(async (req) => {
  const ip = getClientIp(req.headers);
  const limit = hitRateLimit(`pin-verify:${ip}`, 5, 60_000);
  if (!limit.allowed) {
    throw new AppError(
      "Too many PIN attempts. Please wait a minute.",
      "TOO_MANY_ATTEMPTS",
      429,
    );
  }

  const { pin } = bodySchema.parse(await req.json());
  const valid = await verifyAdminPin(pin);
  return ok({ ok: valid });
});
