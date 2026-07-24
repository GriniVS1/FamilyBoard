import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { assertSetupIncomplete } from "@/lib/setup-guard";
import { db } from "@/lib/db";
import { setAdminPin } from "@/lib/pin";
import { generateDeviceToken, hashDeviceToken } from "@/lib/mobile-tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  pin: z.string().regex(/^\d{6}$/, "PIN must be exactly 6 digits"),
  // App-first onboarding: the phone that finishes setup gets paired to the
  // admin member in the same call, so it stays connected (and can immediately
  // connect a calendar) instead of losing access the instant setup completes
  // and the /api/setup/* endpoints start 403-ing. The on-wall wizard omits
  // this and just sets the PIN.
  device: z
    .object({
      name: z.string().trim().min(1).max(100),
      platform: z.enum(["ios", "android", "web", "unknown"]),
    })
    .optional(),
});

export const POST = withErrorHandling(async (req) => {
  await assertSetupIncomplete();
  const json = await req.json();
  const { pin, device } = bodySchema.parse(json);

  // Setting the PIN flips setupComplete → true, so anything relying on the
  // setup-incomplete trust window (minting this device token) must happen in
  // the same request, after the PIN write.
  await setAdminPin(pin);

  if (!device) {
    return ok({ ok: true });
  }

  const family = await db.family.findFirst({ select: { id: true, name: true } });
  if (!family) {
    throw new AppError("Family not found", "FAMILY_NOT_FOUND", 400);
  }

  // The setup-doer is the admin: pair the finishing device to the family's
  // ADMIN member (the first member created in the members step).
  const admin = await db.member.findFirst({
    where: { familyId: family.id, role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, color: true, emoji: true },
  });
  if (!admin) {
    throw new AppError("Admin member not found", "ADMIN_NOT_FOUND", 400);
  }

  const token = generateDeviceToken();
  const tokenHash = await hashDeviceToken(token);
  const created = await db.mobileDevice.create({
    data: {
      familyId: family.id,
      memberId: admin.id,
      name: device.name,
      platform: device.platform,
      tokenHash,
    },
    select: { id: true },
  });

  return ok({
    ok: true,
    session: {
      token,
      deviceId: created.id,
      member: {
        id: admin.id,
        name: admin.name,
        color: admin.color,
        emoji: admin.emoji,
      },
      family: { id: family.id, name: family.name },
    },
  });
});
