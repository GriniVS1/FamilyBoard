import { ok, withErrorHandling } from "@/lib/api";
import { getLicenseSnapshot } from "@/lib/license";

export const runtime = "nodejs";

function serializeSnapshot(snap: Awaited<ReturnType<typeof getLicenseSnapshot>>) {
  return {
    status: snap.status,
    gate: snap.gate,
    plan: snap.plan,
    validUntil: snap.validUntil?.toISOString() ?? null,
    isActive: snap.isActive,
    deviceId: snap.deviceId,
    graceEndsAt: snap.graceEndsAt?.toISOString() ?? null,
    softEndsAt: snap.softEndsAt?.toISOString() ?? null,
  };
}

export const GET = withErrorHandling(async () => {
  const snapshot = await getLicenseSnapshot();
  return ok(serializeSnapshot(snapshot));
});
