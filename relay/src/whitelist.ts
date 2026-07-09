// Remote path whitelist — deny by default. Only the phone's bearer-guarded
// data plane may traverse the relay; everything else on the wall's port 3000
// is UNauthenticated LAN-trust CRUD and must never be reachable remotely.
//
// Deliberately duplicated on the Pi side (src/lib/relay-whitelist.ts in the
// app repo) — the Worker and the app share no build, and defense in depth
// means a compromised relay still cannot reach non-whitelisted routes.
// KEEP THE TWO FILES IN SYNC.

export function isAllowedRemotePath(method: string, path: string): boolean {
  // Bearer-guarded mobile data plane (GET /api/mobile/identity is the single
  // unauthenticated route here; the Pi redacts it for relay-origin requests).
  if (path === "/api/mobile" || path.startsWith("/api/mobile/")) return true;

  // Push-token upkeep — bearer-guarded via requireMobileAuth.
  if (
    method === "POST" &&
    (path === "/api/devices/me/fcm-token" || path === "/api/devices/me/heartbeat")
  ) {
    return true;
  }

  // Web pairing: the SPA served from this same Worker (relay/public) has no
  // LAN access, so it must be able to redeem a pairing code remotely. Safe to
  // allow because the code is short-lived + admin-PIN-gated at creation time,
  // and the relay's own rate limit (120 req/min/DO) makes brute force of the
  // code space impractical.
  if (method === "POST" && path === "/api/devices/pair") return true;

  // Explicitly NOT: every other route (wall UI API, settings, system,
  // network, sync, ...).
  return false;
}
