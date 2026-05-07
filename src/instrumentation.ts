export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const intervalMs = Number(process.env.SYNC_INTERVAL_MS ?? 5 * 60 * 1000);
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const syncTick = async () => {
    try {
      await fetch(`${baseUrl}/api/sync/google`, { method: "POST" });
    } catch (err) {
      console.warn(
        "[instrumentation] sync tick failed",
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

  setTimeout(syncTick, 10_000);
  setInterval(syncTick, intervalMs);

  // Push scheduler runs every 60 s — checks upcoming events and daily digest.
  setTimeout(pushTick, 15_000);
  setInterval(pushTick, 60_000);
}
