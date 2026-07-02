export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { internalHeaders } = await import("@/lib/internal-secret");

  const intervalMs = Number(process.env.SYNC_INTERVAL_MS ?? 5 * 60 * 1000);
  // Use loopback unconditionally — NEXTAUTH_URL is for OAuth redirect URIs, not
  // internal calls; on the Pi the external hostname may not resolve inside the container.
  const baseUrl = `http://127.0.0.1:${process.env.PORT ?? 3000}`;

  let googleRunning = false;
  let caldavRunning = false;
  let microsoftRunning = false;
  let pushRunning = false;

  const googleSyncTick = async () => {
    if (googleRunning) return;
    googleRunning = true;
    try {
      await fetch(`${baseUrl}/api/sync/google`, {
        method: "POST",
        headers: internalHeaders(),
        signal: AbortSignal.timeout(240_000),
      });
    } catch (err) {
      console.warn(
        "[instrumentation] google sync tick failed",
        err instanceof Error ? err.message : err,
      );
    } finally {
      googleRunning = false;
    }
  };

  const caldavSyncTick = async () => {
    if (caldavRunning) return;
    caldavRunning = true;
    try {
      await fetch(`${baseUrl}/api/sync/caldav`, {
        method: "POST",
        headers: internalHeaders(),
        signal: AbortSignal.timeout(240_000),
      });
    } catch (err) {
      console.warn(
        "[instrumentation] caldav sync tick failed",
        err instanceof Error ? err.message : err,
      );
    } finally {
      caldavRunning = false;
    }
  };

  const microsoftSyncTick = async () => {
    if (microsoftRunning) return;
    microsoftRunning = true;
    try {
      await fetch(`${baseUrl}/api/sync/microsoft`, {
        method: "POST",
        headers: internalHeaders(),
        signal: AbortSignal.timeout(240_000),
      });
    } catch (err) {
      console.warn(
        "[instrumentation] microsoft sync tick failed",
        err instanceof Error ? err.message : err,
      );
    } finally {
      microsoftRunning = false;
    }
  };

  const pushTick = async () => {
    if (pushRunning) return;
    pushRunning = true;
    try {
      await fetch(`${baseUrl}/api/push/tick`, {
        method: "POST",
        headers: internalHeaders(),
        signal: AbortSignal.timeout(240_000),
      });
    } catch (err) {
      console.warn(
        "[instrumentation] push tick failed",
        err instanceof Error ? err.message : err,
      );
    } finally {
      pushRunning = false;
    }
  };

  setTimeout(googleSyncTick, 10_000);
  setInterval(googleSyncTick, intervalMs);

  // Stagger CalDAV sync by 30 s so it doesn't overlap with Google on cold start.
  setTimeout(caldavSyncTick, 40_000);
  setInterval(caldavSyncTick, intervalMs);

  // Stagger Microsoft sync by 60 s after CalDAV to avoid all three stacking at cold start.
  setTimeout(microsoftSyncTick, 70_000);
  setInterval(microsoftSyncTick, intervalMs);

  // Push scheduler runs every 60 s — checks upcoming events and daily digest.
  setTimeout(pushTick, 15_000);
  setInterval(pushTick, 60_000);
}
