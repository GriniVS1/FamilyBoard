import "server-only";

import { AppError } from "./api";
import { getSetupStatus } from "./queries";

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
    throw new AppError(
      "Setup is already complete — use the settings screen (admin PIN required)",
      "SETUP_ALREADY_COMPLETE",
      403,
    );
  }
}
