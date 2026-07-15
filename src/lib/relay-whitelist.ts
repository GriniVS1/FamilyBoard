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
  // /api/devices/pair is deliberately NOT allowed remotely — pairing is
  // LAN-only (QR scan at home); remote access is app-only.
  return false;
}
