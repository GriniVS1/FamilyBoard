export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const intervalMs = Number(process.env.SYNC_INTERVAL_MS ?? 5 * 60 * 1000);
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const tick = async () => {
    try {
      await fetch(`${baseUrl}/api/sync/google`, { method: "POST" });
    } catch (err) {
      console.warn(
        "[instrumentation] sync tick failed",
        err instanceof Error ? err.message : err,
      );
    }
  };

  setTimeout(tick, 10_000);
  setInterval(tick, intervalMs);
}
