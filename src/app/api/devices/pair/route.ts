import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { getClientIp, hitRateLimit } from "@/lib/rate-limit";
import { generateDeviceToken, hashDeviceToken } from "@/lib/mobile-tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  code: z.string().min(1).max(10),
  name: z.string().trim().min(1).max(100),
  platform: z.enum(["ios", "android", "unknown"]),
});

export const POST = withErrorHandling(async (req) => {
  const ip = getClientIp(req.headers);
  const limit = hitRateLimit(`devices-pair:${ip}`, 10, 5 * 60_000);
  if (!limit.allowed) {
    throw new AppError(
      "Too many pairing attempts. Please wait 5 minutes.",
      "TOO_MANY_ATTEMPTS",
      429,
    );
  }

  const body = bodySchema.parse(await req.json());
  const normalizedCode = body.code.toUpperCase();

  const now = new Date();

  const pairingCode = await db.pairingCode.findUnique({
    where: { code: normalizedCode },
    include: {
      member: { select: { id: true, name: true, color: true, emoji: true } },
      family: { select: { id: true, name: true } },
    },
  });

  if (
    !pairingCode ||
    pairingCode.consumedAt !== null ||
    pairingCode.expiresAt <= now
  ) {
    throw new AppError(
      "Invalid or expired pairing code",
      "INVALID_PAIR_CODE",
      400,
    );
  }

  const token = generateDeviceToken();
  const tokenHash = await hashDeviceToken(token);

  const [device] = await db.$transaction([
    db.mobileDevice.create({
      data: {
        familyId: pairingCode.familyId,
        memberId: pairingCode.memberId,
        name: body.name,
        platform: body.platform,
        tokenHash,
      },
      select: { id: true },
    }),
    db.pairingCode.update({
      where: { code: normalizedCode },
      data: { consumedAt: now },
    }),
  ]);

  return ok({
    token,
    deviceId: device.id,
    member: {
      id: pairingCode.member.id,
      name: pairingCode.member.name,
      color: pairingCode.member.color,
      emoji: pairingCode.member.emoji,
    },
    family: {
      id: pairingCode.family.id,
      name: pairingCode.family.name,
    },
  });
});
