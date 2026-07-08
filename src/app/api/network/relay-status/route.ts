import { z } from "zod";
import { ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getOrCreateInstallation } from "@/lib/queries";
import { remoteUrlFor } from "@/lib/relay-url";
import { requireInternalOrAdmin } from "@/lib/internal-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RelayState = { connected: boolean; since: string | null; lastError: string | null };

function readState(value: string | undefined): RelayState {
  if (!value) return { connected: false, since: null, lastError: null };
  try {
    const p = JSON.parse(value) as Partial<RelayState>;
    return {
      connected: p.connected === true,
      since: typeof p.since === "string" ? p.since : null,
      lastError: typeof p.lastError === "string" ? p.lastError : null,
    };
  } catch {
    return { connected: false, since: null, lastError: null };
  }
}

// GET is LAN-open (like other settings reads) so the settings UI can show
// connection status without a PIN.
export const GET = withErrorHandling(async () => {
  const [stateRow, enabledRow, installation] = await Promise.all([
    db.setting.findUnique({ where: { key: "relay_state" } }),
    db.setting.findUnique({ where: { key: "remote_access_enabled" } }),
    getOrCreateInstallation(),
  ]);
  const state = readState(stateRow?.value);
  const enabled = enabledRow ? enabledRow.value === "true" : true;
  return ok({
    enabled,
    connected: state.connected,
    since: state.since,
    remoteUrl: state.connected ? remoteUrlFor(installation.id) : null,
  });
});

const PostBody = z.object({
  connected: z.boolean(),
  lastError: z.string().nullish(),
});

// POST is internal-only — written by the relay client on connect/disconnect.
export const POST = withErrorHandling(async (req) => {
  await requireInternalOrAdmin(req);
  const body = PostBody.parse(await req.json());
  const prev = readState(
    (await db.setting.findUnique({ where: { key: "relay_state" } }))?.value,
  );
  const since = body.connected
    ? prev.connected && prev.since
      ? prev.since
      : new Date().toISOString()
    : null;
  const value = JSON.stringify({
    connected: body.connected,
    since,
    lastError: body.lastError ?? null,
  });
  await db.setting.upsert({
    where: { key: "relay_state" },
    update: { value },
    create: { key: "relay_state", value },
  });
  return ok({ ok: true });
});
