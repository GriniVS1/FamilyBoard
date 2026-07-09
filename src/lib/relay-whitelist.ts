import "server-only";

// Remote path whitelist — deny by default. Second line of defense behind the
// relay Worker's own whitelist (relay/src/whitelist.ts): even a compromised
// relay must not be able to reach anything but the phone's bearer-guarded data
// plane. Everything else on port 3000 is UNauthenticated LAN-trust CRUD.
// KEEP IN SYNC with relay/src/whitelist.ts.

export function isAllowedRemotePath(method: string, path: string): boolean {
  if (path === "/api/mobile" || path.startsWith("/api/mobile/")) return true;
  if (
    method === "POST" &&
    (path === "/api/devices/me/fcm-token" || path === "/api/devices/me/heartbeat")
  ) {
    return true;
  }
  // Web pairing: the SPA served from the relay Worker (relay/public) has no
  // LAN access, so it must be able to redeem a pairing code remotely. Safe to
  // allow because the code is short-lived + admin-PIN-gated at creation time,
  // and the relay's own rate limit (120 req/min/DO) makes brute force of the
  // code space impractical.
  if (method === "POST" && path === "/api/devices/pair") return true;
  return false;
}
