import { z } from "zod";
import { ok, withErrorHandling } from "@/lib/api";
import {
  applyDisplaySleepTick,
  getDisplaySleepSettings,
  setDisplaySleepSettings,
} from "@/lib/display";
import { requireAdminPin } from "@/lib/admin-pin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  return ok(await getDisplaySleepSettings());
});

const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "expected HH:MM");

const PatchBody = z.object({
  enabled: z.boolean(),
  start: HHMM,
  end: HHMM,
});

export const PATCH = withErrorHandling(async (req) => {
  await requireAdminPin(req);
  const body = PatchBody.parse(await req.json());
  await setDisplaySleepSettings(body);

  // Apply immediately so enabling inside the window (or disabling while the
  // screen is dark) takes effect now, not at the next minute tick. Fire and
  // forget — the response must not wait on host xset calls.
  applyDisplaySleepTick().catch((err) => {
    console.warn(
      "[display] immediate apply failed",
      err instanceof Error ? err.message : err,
    );
  });

  return ok(body);
});
