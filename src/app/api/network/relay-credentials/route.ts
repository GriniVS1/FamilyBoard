import { randomBytes } from "node:crypto";
import { ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getOrCreateInstallation } from "@/lib/queries";
import { requireInternalOrAdmin } from "@/lib/internal-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read by the in-process relay client (instrumentation.ts) — internal-secret
// gated. Lazily mints the per-device secret the relay pins on first connect.
export const GET = withErrorHandling(async (req) => {
  await requireInternalOrAdmin(req);

  const installation = await getOrCreateInstallation();

  let secretRow = await db.setting.findUnique({ where: { key: "relay_device_secret" } });
  if (!secretRow) {
    secretRow = await db.setting.upsert({
      where: { key: "relay_device_secret" },
      update: {},
      create: { key: "relay_device_secret", value: randomBytes(32).toString("hex") },
    });
  }

  const enabledRow = await db.setting.findUnique({ where: { key: "remote_access_enabled" } });
  const enabled = enabledRow ? enabledRow.value === "true" : true; // default ON

  return ok({
    installationId: installation.id,
    deviceSecret: secretRow.value,
    enabled,
    relayUrl: env.RELAY_URL,
  });
});
