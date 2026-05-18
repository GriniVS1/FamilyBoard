// Pre-setup: network routes are open (no PIN exists yet).
// Post-setup: routes require X-Admin-Pin header so only the admin can
// change WiFi after the family is set up.
import { getSetupStatus } from "@/lib/queries";
import { verifyAdminPin } from "@/lib/pin";
import { AppError } from "@/lib/api";

export async function requireNetworkAccess(req: Request): Promise<void> {
  const { setupComplete } = await getSetupStatus();
  if (!setupComplete) return;

  const pin = req.headers.get("x-admin-pin");
  if (!pin) {
    throw new AppError("Admin PIN required", "PIN_REQUIRED", 403);
  }
  const valid = await verifyAdminPin(pin);
  if (!valid) {
    throw new AppError("Invalid admin PIN", "PIN_INVALID", 403);
  }
}
