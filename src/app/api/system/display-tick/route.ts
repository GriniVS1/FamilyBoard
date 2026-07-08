import { ok, withErrorHandling } from "@/lib/api";
import { applyDisplaySleepTick } from "@/lib/display";
import { requireInternalOrAdmin } from "@/lib/internal-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Driven once a minute by instrumentation.ts, mirroring the sync/push ticks.
export const POST = withErrorHandling(async (req) => {
  await requireInternalOrAdmin(req);
  return ok(await applyDisplaySleepTick());
});
