import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { verifyAdminPin } from "@/lib/pin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pinHeaderSchema = z.string().min(1).max(12);

async function getPinFromRequest(req: Request): Promise<string> {
  const headerPin = req.headers.get("x-admin-pin");
  if (headerPin) {
    return pinHeaderSchema.parse(headerPin);
  }
  throw new AppError("Missing X-Admin-Pin header", "UNAUTHORIZED", 401);
}

type RouteContext = { params: Promise<{ id: string }> };

export const DELETE = withErrorHandling(async (req, ctx: RouteContext) => {
  const { id } = await ctx.params;

  const pin = await getPinFromRequest(req);
  const valid = await verifyAdminPin(pin);
  if (!valid) {
    throw new AppError("PIN is incorrect", "INVALID_PIN", 401);
  }

  const family = await db.family.findFirst({ select: { id: true } });
  if (!family) {
    throw new AppError("Family not found", "FAMILY_NOT_FOUND", 400);
  }

  const device = await db.mobileDevice.findUnique({
    where: { id },
    select: { id: true, familyId: true, revokedAt: true },
  });

  if (!device || device.familyId !== family.id) {
    throw new AppError("Device not found", "DEVICE_NOT_FOUND", 404);
  }

  if (device.revokedAt !== null) {
    throw new AppError("Device is already revoked", "ALREADY_REVOKED", 409);
  }

  await db.mobileDevice.update({
    where: { id },
    data: { revokedAt: new Date() },
  });

  return ok({ ok: true });
});
