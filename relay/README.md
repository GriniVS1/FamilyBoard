# FamilyBoard relay

Cloudflare Worker + Durable Object that lets the phone reach the wall's mobile
API from outside the home LAN, without port forwarding.

The Pi opens an outbound WebSocket to its per-installation Durable Object
(`GET /connect`, authenticated by a device secret, trust-on-first-use). The
phone's HTTPS requests to `https://relay.familyboard.ch/f/<installationId>/…`
are forwarded through that tunnel as JSON frames. End-to-end auth stays the
existing mobile bearer token — the Pi validates it; the relay is transport only.

Only the phone's data plane is forwardable (see `src/whitelist.ts`, mirrored on
the Pi in `src/lib/relay-whitelist.ts`): `/api/mobile/**` +
`POST /api/devices/me/{fcm-token,heartbeat}`. Everything else is denied.

Deploy: `npm install && npx wrangler deploy` (creates the `relay.familyboard.ch`
custom domain + the TunnelDO SQLite migration on first deploy). One secret,
`RELAY_ADMIN_TOKEN` (see below) — set it once with
`npx wrangler secret put RELAY_ADMIN_TOKEN` before the first deploy that uses it.

## Repair: device secret mismatch after factory reset

**Symptom:** a device that used remote access before a factory reset now shows
`connected: false, since: null` forever. `GET /status/<installationId>` returns
`{"online":false}` even though the Pi is up and `/health` is fine.

**Cause:** `/connect` pins the device's secret on first use (trust-on-first-use)
in the installation's Durable Object storage. A factory reset used to wipe
*all* Settings, including `relay_device_secret` — so the wall mints a brand
new secret, but the relay still has the OLD one pinned. Every reconnect gets
`403 forbidden` before it can update anything. (Fixed going forward: factory
reset now preserves `relay_device_secret` — see
`src/app/api/settings/factory-reset/route.ts`. This repair is for devices that
already hit the bug, or any other case where the pinned secret and the
device's secret have diverged.)

**Fix — clear the stale pin once, from an operator machine:**

```bash
curl -X POST "https://relay.familyboard.ch/admin/reset-secret/<installationId>" \
  -H "Authorization: Bearer $RELAY_ADMIN_TOKEN"
# {"ok":true,"cleared":true}
```

The next time the Pi's relay client reconnects (it retries continuously — or
restart the `familyboard` container to force it), it re-pins its current
secret and remote access resumes. No wall-side action needed; nothing on the
Pi has to change.
