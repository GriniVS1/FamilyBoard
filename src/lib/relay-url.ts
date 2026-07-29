import "server-only";

import { db } from "./db";
import { env } from "./env";
import { getOrCreateInstallation } from "./queries";

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

/**
 * The phone's remote address, but only once the tunnel is actually up — a URL
 * for a tunnel that isn't connected would just fail, and publishing it earlier
 * widens the TOFU window (see relay/src/index.ts). Returns null when remote
 * access is off or the wall isn't currently connected to the relay.
 *
 * Same rule as /api/settings/pair-code and /api/mobile/identity apply inline;
 * new callers should use this helper.
 */
export async function connectedRemoteUrl(): Promise<string | null> {
  const [stateRow, enabledRow] = await Promise.all([
    db.setting.findUnique({ where: { key: "relay_state" } }),
    db.setting.findUnique({ where: { key: "remote_access_enabled" } }),
  ]);
  if (enabledRow && enabledRow.value !== "true") return null;
  if (!stateRow) return null;
  try {
    if ((JSON.parse(stateRow.value) as { connected?: boolean }).connected !== true) {
      return null;
    }
  } catch {
    return null;
  }
  const installation = await getOrCreateInstallation();
  return remoteUrlFor(installation.id);
}
