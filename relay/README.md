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
custom domain + the TunnelDO SQLite migration on first deploy). No secrets.
