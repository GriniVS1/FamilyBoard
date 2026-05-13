import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { setAdminPin, verifyAdminPin } from "@/lib/pin";
import { getClientIp, hitRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  currentPin: z.string().min(1).max(12),
  newPin: z.string().regex(/^\d{6}$/, "PIN must be exactly 6 digits"),
});

export const POST = withErrorHandling(async (req) => {
  const ip = getClientIp(req.headers);
  const limit = hitRateLimit(`pin-change:${ip}`, 5, 60_000);
  if (!limit.allowed) {
    throw new AppError(
      "Too many PIN attempts. Please wait a minute.",
      "TOO_MANY_ATTEMPTS",
      429,
    );
  }

  const { currentPin, newPin } = bodySchema.parse(await req.json());
  const valid = await verifyAdminPin(currentPin);
  if (!valid) {
    throw new AppError("Current PIN is incorrect", "INVALID_PIN", 401);
  }
  await setAdminPin(newPin);
  return ok({ ok: true });
});
