import { z } from "zod";
import { ok, withErrorHandling } from "@/lib/api";
import { activateLicense, getLicenseSnapshot } from "@/lib/license";

export const runtime = "nodejs";

const schema = z.object({
  key: z.string().min(1).max(4096),
});

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

export const POST = withErrorHandling(async (req) => {
  const body = schema.parse(await req.json());
  const snapshot = await activateLicense(body.key);
  return ok({ ok: true, snapshot: serializeSnapshot(snapshot) });
});
