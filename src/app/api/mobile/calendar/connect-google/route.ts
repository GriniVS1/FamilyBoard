import { withErrorHandling, ok } from "@/lib/api";
import { requireMobileAuth } from "@/lib/mobile-auth";
import { startGoogleConnect } from "@/lib/calendar-connect";
import { getRequestOrigin } from "@/lib/network";

export const runtime = "nodejs";

export const POST = withErrorHandling(async (req) => {
  const { memberId } = await requireMobileAuth(req);

  // In broker mode the phone's browser must land back on THIS device once
  // Google redirects to the broker — derive the return URL from the address
  // the phone actually used to reach us (LAN IP), not env.NEXTAUTH_URL, which
  // may be a hostname the phone can't resolve/route to. Direct mode ignores
  // this: the registered Google redirect_uri is fixed and can't vary.
  const returnUrl = `${getRequestOrigin(req)}/api/auth/google/adopt`;
  const result = await startGoogleConnect(memberId, { returnUrl, source: "mobile" });
  return ok(result);
});
