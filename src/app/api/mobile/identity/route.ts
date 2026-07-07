import { ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Deliberately unauthenticated: the mobile app uses this to re-identify its
// board after the LAN IP changed (mDNS re-discovery matches on installationId
// before trusting a candidate host). Exposes no personal data beyond the
// family display name, and only to callers already inside the LAN.
export const GET = withErrorHandling(async () => {
  const installation = await db.installation.findFirst({
    include: { family: { select: { name: true } } },
  });
  return ok({
    installationId: installation?.id ?? null,
    familyName: installation?.family?.name ?? null,
    appVersion: env.APP_VERSION,
  });
});
