import { ok, withErrorHandling } from "@/lib/api";
import { requireInternalOrAdmin } from "@/lib/internal-auth";
import { checkInWithLicenseServer } from "@/lib/license";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Driven by the instrumentation timer (and admin-triggerable). Renews the
// device lease from the license server. Whitelisted from the write-gate under
// `/api/license` so a soft/hard-gated device can still recover by checking in.
export const POST = withErrorHandling(async (req) => {
  await requireInternalOrAdmin(req);
  await checkInWithLicenseServer();
  return ok({ ok: true });
});
