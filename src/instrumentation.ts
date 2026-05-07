export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const intervalMs = Number(process.env.SYNC_INTERVAL_MS ?? 5 * 60 * 1000);
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const googleSyncTick = async () => {
    try {
      await fetch(`${baseUrl}/api/sync/google`, { method: "POST" });
    } catch (err) {
      console.warn(
        "[instrumentation] google sync tick failed",
        err instanceof Error ? err.message : err,
      );
    }
  };

  const caldavSyncTick = async () => {
    try {
      await fetch(`${baseUrl}/api/sync/caldav`, { method: "POST" });
    } catch (err) {
      console.warn(
        "[instrumentation] caldav sync tick failed",
        err instanceof Error ? err.message : err,
      );
    }
  };

  const microsoftSyncTick = async () => {
    try {
      await fetch(`${baseUrl}/api/sync/microsoft`, { method: "POST" });
    } catch (err) {
      console.warn(
        "[instrumentation] microsoft sync tick failed",
        err instanceof Error ? err.message : err,
      );
    }
  };

  const pushTick = async () => {
    try {
      await fetch(`${baseUrl}/api/push/tick`, { method: "POST" });
    } catch (err) {
      console.warn(
        "[instrumentation] push tick failed",
        err instanceof Error ? err.message : err,
      );
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
