import { ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { remoteUrlFor } from "@/lib/relay-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Deliberately unauthenticated: the mobile app uses this to re-identify its
// board — after the LAN IP changed (mDNS re-discovery) and to verify a relay
// candidate — matching on installationId before trusting a host.
//
// When the request arrives THROUGH the relay (x-familyboard-relay), it came
// from the public internet: redact familyName/appVersion (the app only needs
// installationId to verify) and never advertise the relay URL back out.
export const GET = withErrorHandling(async (req) => {
  const viaRelay = req.headers.get("x-familyboard-relay") === "1";
  const installation = await db.installation.findFirst({
    include: { family: { select: { name: true } } },
  });

  let remoteUrl: string | null = null;
  if (!viaRelay && installation) {
    const row = await db.setting.findUnique({ where: { key: "relay_state" } });
    const enabledRow = await db.setting.findUnique({
      where: { key: "remote_access_enabled" },
    });
    const enabled = enabledRow ? enabledRow.value === "true" : true;
    let connected = false;
    try {
      connected = row ? (JSON.parse(row.value) as { connected?: boolean }).connected === true : false;
    } catch {
      connected = false;
    }
    if (enabled && connected) remoteUrl = remoteUrlFor(installation.id);
  }

  return ok({
    installationId: installation?.id ?? null,
    familyName: viaRelay ? null : (installation?.family?.name ?? null),
    appVersion: viaRelay ? null : env.APP_VERSION,
    remoteUrl,
  });
});
