import "server-only";

import { env } from "./env";

// The phone reaches the wall at <relay-https-origin>/f/<installationId>. Derive
// the HTTPS origin from RELAY_URL (a wss:// URL) so both come from one config.
export function relayHttpsOrigin(): string {
  const u = new URL(env.RELAY_URL);
  u.protocol = u.protocol === "ws:" ? "http:" : "https:";
  return u.origin;
}

export function remoteUrlFor(installationId: string): string {
  return `${relayHttpsOrigin()}/f/${installationId}`;
}
