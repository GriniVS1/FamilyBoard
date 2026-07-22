import { withErrorHandling, ok } from "@/lib/api";
import { requireMobileAuth } from "@/lib/mobile-auth";
import { startMicrosoftConnect } from "@/lib/calendar-connect";
import { getRequestOrigin } from "@/lib/network";

export const runtime = "nodejs";

export const POST = withErrorHandling(async (req) => {
  const { memberId } = await requireMobileAuth(req);

  // Broker mode redirects the phone back to THIS device — derive the return URL
  // from the LAN address the phone reached us on (not env.NEXTAUTH_URL). Direct
  // mode ignores it. Same rationale as connect-google.
  const returnUrl = `${getRequestOrigin(req)}/api/auth/microsoft/adopt`;
  const result = await startMicrosoftConnect(memberId, { returnUrl, source: "mobile" });
  return ok(result);
});
