import "server-only";

import { getSetupStatus } from "@/lib/queries";
import { verifyAdminPin } from "@/lib/pin";
import { AppError } from "@/lib/api";
import { getClientIp, hitRateLimit } from "@/lib/rate-limit";

export async function requireAdminPin(req: Request): Promise<void> {
  const { setupComplete } = await getSetupStatus();
  if (!setupComplete) return;

  // The 6-digit PIN only has ~1M combinations; without a lockout here every
  // PIN-gated route is an unlimited brute-force oracle (bcrypt slows but does
  // not stop it). Throttle attempts before touching the hash.
  const ip = getClientIp(req.headers);
  const limit = hitRateLimit(`admin-pin:${ip}`, 10, 60_000);
  if (!limit.allowed) {
    throw new AppError(
      "Too many attempts. Please wait a minute.",
      "TOO_MANY_ATTEMPTS",
      429,
    );
  }

  const pin = req.headers.get("x-admin-pin");
  if (!pin) {
    throw new AppError("Admin PIN required", "PIN_REQUIRED", 403);
  }
  if (!(await verifyAdminPin(pin))) {
    throw new AppError("Invalid admin PIN", "PIN_INVALID", 403);
  }
}
