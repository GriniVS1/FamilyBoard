import { ok, withErrorHandling } from "@/lib/api";
import { requireAdminPin } from "@/lib/admin-pin";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getOrCreateInstallation } from "@/lib/queries";
import { readUpdateProgress, requestUpdateCheck } from "@/lib/update-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACK_KEY = "update_ack_version";

// justUpdated: the app runs a version the user hasn't acknowledged yet (the
// dashboard shows a "successfully updated" toast and POSTs /update-ack). A
// missing ack row is seeded silently so fresh installs — and the first boot
// after this feature ships — don't greet the user with a phantom update toast.
async function computeJustUpdated(): Promise<boolean> {
  if (env.APP_VERSION === "dev") return false;
  const row = await db.setting.findUnique({ where: { key: ACK_KEY } });
  if (!row) {
    await db.setting.upsert({
      where: { key: ACK_KEY },
      update: {},
      create: { key: ACK_KEY, value: env.APP_VERSION },
    });
    return false;
  }
  return row.value !== env.APP_VERSION;
}

export const GET = withErrorHandling(async () => {
  const installation = await getOrCreateInstallation();
  return ok({
    version: installation.appVersion ?? "unknown",
    channel: installation.updateChannel,
    justUpdated: await computeJustUpdated(),
    progress: readUpdateProgress(),
  });
});

// Pokes the host OTA updater to check now. Auto-update runs nightly regardless
// (no opt-out) — this is just the manual "check now" trigger.
export const POST = withErrorHandling(async (req) => {
  await requireAdminPin(req);
  requestUpdateCheck();
  return ok({ requested: true });
});
