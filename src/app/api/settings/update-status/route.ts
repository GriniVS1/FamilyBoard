import { ok, withErrorHandling } from "@/lib/api";
import { requireAdminPin } from "@/lib/admin-pin";
import { getOrCreateInstallation } from "@/lib/queries";
import { requestUpdateCheck } from "@/lib/update-request";

export const runtime = "nodejs";

export const GET = withErrorHandling(async () => {
  const installation = await getOrCreateInstallation();
  return ok({
    version: installation.appVersion ?? "unknown",
    channel: installation.updateChannel,
  });
});

// Pokes the host OTA updater to check now. Auto-update runs nightly regardless
// (no opt-out) — this is just the manual "check now" trigger.
export const POST = withErrorHandling(async (req) => {
  await requireAdminPin(req);
  requestUpdateCheck();
  return ok({ requested: true });
});
