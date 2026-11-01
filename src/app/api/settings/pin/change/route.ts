import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { checkAdminPin } from "@/lib/admin-pin";
import { setAdminPin } from "@/lib/pin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  currentPin: z.string().min(1).max(12),
  newPin: z.string().regex(/^\d{6}$/, "PIN must be exactly 6 digits"),
});

export const POST = withErrorHandling(async (req) => {
  const { currentPin, newPin } = bodySchema.parse(await req.json());
  const valid = await checkAdminPin(req, currentPin);
  if (!valid) {
    throw new AppError("Current PIN is incorrect", "INVALID_PIN", 401);
  }
  await setAdminPin(newPin);
  return ok({ ok: true });
});
