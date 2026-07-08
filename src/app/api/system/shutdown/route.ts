import { AppError, ok, withErrorHandling } from "@/lib/api";
import { shutdownHost } from "@/lib/display";
import { hostCommand } from "@/lib/network";
import { requireAdminPin } from "@/lib/admin-pin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Graceful poweroff — same contract as ../reboot: probe host access so
// non-appliance installs fail cleanly, respond first, act after a grace
// period so the response and the UI overlay reach the client.
export const POST = withErrorHandling(async (req) => {
  await requireAdminPin(req);

  try {
    await hostCommand(["true"], 5_000);
  } catch {
    throw new AppError(
      "Host is not reachable from this deployment",
      "HOST_UNAVAILABLE",
      502,
    );
  }

  setTimeout(() => {
    shutdownHost().catch((err) => {
      console.error(
        "[system] shutdown failed",
        err instanceof Error ? err.message : err,
      );
    });
  }, 1_500);

  return ok({ ok: true });
});
