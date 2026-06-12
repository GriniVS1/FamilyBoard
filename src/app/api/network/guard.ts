// Pre-setup: network routes are open (no PIN exists yet).
// Post-setup: routes require X-Admin-Pin header so only the admin can
// change WiFi after the family is set up.
import { requireAdminPin } from "@/lib/admin-pin";

export async function requireNetworkAccess(req: Request): Promise<void> {
  return requireAdminPin(req);
}
