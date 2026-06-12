import "server-only";

import { getSetupStatus } from "@/lib/queries";
import { verifyAdminPin } from "@/lib/pin";
import { AppError } from "@/lib/api";

export async function requireAdminPin(req: Request): Promise<void> {
  const { setupComplete } = await getSetupStatus();
  if (!setupComplete) return;

  const pin = req.headers.get("x-admin-pin");
  if (!pin) {
    throw new AppError("Admin PIN required", "PIN_REQUIRED", 403);
  }
  if (!(await verifyAdminPin(pin))) {
    throw new AppError("Invalid admin PIN", "PIN_INVALID", 403);
  }
}
