import "server-only";

import { AppError } from "./api";
import { db } from "./db";
import { getSetupStatus } from "./queries";

const ALREADY_COMPLETE_MESSAGE =
  "Setup is already complete — use the settings screen (admin PIN required)";

/**
 * The /api/setup/* mutation routes are deliberately unauthenticated so both
 * the wall's own wizard AND the phone app (during app-first onboarding, over
 * the LAN) can drive first-run setup. That LAN-trust window must CLOSE once
 * setup completes — otherwise anyone on the LAN could e.g. overwrite the admin
 * PIN forever. Call this first in every setup mutation.
 */
export async function assertSetupIncomplete(): Promise<void> {
  const status = await getSetupStatus();
  if (status.setupComplete) {
    throw new AppError(ALREADY_COMPLETE_MESSAGE, "SETUP_ALREADY_COMPLETE", 403);
  }
}

/**
 * GET /api/setup/members is unauthenticated like the mutation routes above,
 * but it can't just gate on setupComplete: the mobile app-first wizard's
 * "who are you?" step calls it right after POST /api/setup/pin succeeds
 * (see mobile/lib/state/setup_onboarding_controller.dart's submitPin), and
 * setupComplete flips true the moment the PIN is set (weatherSet doesn't
 * gate it — see getSetupStatus). Gate on whether any phone has ever actually
 * paired instead (a MobileDevice row is only created by POST
 * /api/devices/pair): that window — after PIN, before the first phone
 * finishes pairing — is when the who-are-you picker legitimately needs this
 * endpoint. Once a device has paired, later pairings go through the
 * PIN-gated Settings-screen QR flow, which never calls this route, so it's
 * safe to close for good at that point.
 */
export async function assertMemberListReadable(): Promise<void> {
  const status = await getSetupStatus();
  if (!status.setupComplete) return;
  const pairedDeviceCount = await db.mobileDevice.count();
  if (pairedDeviceCount > 0) {
    throw new AppError(ALREADY_COMPLETE_MESSAGE, "SETUP_ALREADY_COMPLETE", 403);
  }
}
