import { ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Listing paired devices is non-destructive — the existing /settings PinGate
// already protects access to this UI. Mirrors the pattern of GET /api/settings/family
// and the other list endpoints. Destructive routes (DELETE below) still require
// the PIN explicitly.
export const GET = withErrorHandling(async () => {
  const family = await db.family.findFirst({ select: { id: true } });
  if (!family) return ok({ devices: [] });

  const devices = await db.mobileDevice.findMany({
    where: { familyId: family.id },
    select: {
      id: true,
      name: true,
      platform: true,
      memberId: true,
      member: { select: { name: true, color: true, emoji: true } },
      lastSeenAt: true,
      createdAt: true,
      revokedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return ok({
    devices: devices.map((d) => ({
      id: d.id,
      name: d.name,
      platform: d.platform,
      memberId: d.memberId,
      memberName: d.member.name,
      memberColor: d.member.color,
      memberEmoji: d.member.emoji,
      lastSeenAt: d.lastSeenAt,
      createdAt: d.createdAt,
      revokedAt: d.revokedAt,
    })),
  });
});
