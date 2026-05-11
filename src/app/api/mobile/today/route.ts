import { ok, withErrorHandling } from "@/lib/api";
import { requireMobileAuth } from "@/lib/mobile-auth";
import { getTodayForMember } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async (req) => {
  const ctx = await requireMobileAuth(req);
  const payload = await getTodayForMember(ctx.familyId, ctx.memberId);
  return ok(payload);
});
