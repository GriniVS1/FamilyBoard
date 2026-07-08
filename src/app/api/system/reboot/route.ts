import { AppError, ok, withErrorHandling } from "@/lib/api";
import { rebootHost } from "@/lib/display";
import { hostCommand } from "@/lib/network";
import { requireAdminPin } from "@/lib/admin-pin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withErrorHandling(async (req) => {
  await requireAdminPin(req);

  // Probe host access first so a dev machine / plain Docker install gets a
  // clean error instead of a success that never reboots.
  try {
    await hostCommand(["true"], 5_000);
  } catch {
    throw new AppError(
      "Host is not reachable from this deployment",
      "HOST_UNAVAILABLE",
      502,
    );
  }

  // Respond first, reboot after a grace period so the HTTP response (and the
  // kiosk UI's "rebooting" overlay) reach the client before the box goes down.
  setTimeout(() => {
    rebootHost().catch((err) => {
      console.error(
        "[system] reboot failed",
        err instanceof Error ? err.message : err,
      );
    });
  }, 1_500);

  return ok({ ok: true });
});
