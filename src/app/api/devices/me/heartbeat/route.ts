import { ok, withErrorHandling } from "@/lib/api";
import { requireMobileAuth } from "@/lib/mobile-auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withErrorHandling(async (req) => {
  const ctx = await requireMobileAuth(req);

  // lastSeenAt is already bumped by requireMobileAuth; read it back for the response.
  const device = await db.mobileDevice.findUnique({
    where: { id: ctx.deviceId },
    select: { lastSeenAt: true },
  });

  return ok({
    ok: true,
    deviceId: ctx.deviceId,
    memberId: ctx.memberId,
    lastSeenAt: device?.lastSeenAt ?? null,
  });
});
