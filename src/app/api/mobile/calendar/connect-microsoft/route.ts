import { withErrorHandling, ok } from "@/lib/api";
import { requireMobileAuth } from "@/lib/mobile-auth";
import { startMicrosoftConnect } from "@/lib/calendar-connect";

export const runtime = "nodejs";

export const POST = withErrorHandling(async (req) => {
  const { memberId } = await requireMobileAuth(req);
  const result = await startMicrosoftConnect(memberId, { source: "mobile" });
  return ok(result);
});
