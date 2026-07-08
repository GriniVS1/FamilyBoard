import { ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Marks the currently running version as acknowledged, dismissing the
// "successfully updated" toast. Unauthenticated on purpose: the kiosk itself
// calls this, and the worst an attacker on the LAN can do is hide a toast.
export const POST = withErrorHandling(async () => {
  if (env.APP_VERSION !== "dev") {
    await db.setting.upsert({
      where: { key: "update_ack_version" },
      update: { value: env.APP_VERSION },
      create: { key: "update_ack_version", value: env.APP_VERSION },
    });
  }
  return ok({ ok: true });
});
