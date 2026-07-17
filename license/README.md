# FamilyBoard license server

Cloudflare Worker that lets shipped devices activate offline and check in for
short-lived signed leases. See docs / `src/lib/license.ts`.

- Device activates with an Ed25519 license key `FB1.<payload>.<sig>` (minted by
  the vendor with `tool/sign-license.mjs sign`), verified on-device with the
  baked `LICENSE_PUBLIC_KEY` — no server needed to activate.
- Device then checks in here (`POST /license/checkin {deviceId, key}`) and gets
  a lease `FBL1.<payload>.<sig>` valid ~`LEASE_DAYS` (30). The device caches it
  and keeps working while the lease + grace window last (survives offline), then
  hard-locks. The lease is signed with the SAME keypair as the license key, so
  the device verifies it with the key it already has.

## KV = revocation/override list (not an entitlement store)
A validly signed, device-bound key is trusted by its signature — the happy path
needs NO KV entry. Entries exist only to revoke or override:

```
wrangler kv key put --namespace-id <id> key:<sha256url(licenseKey)> '{"status":"revoked"}'
# override plan or cap the lease:  '{"plan":"pro","leaseUntilCap":"2027-01-01T00:00:00Z"}'
```

## Deploy
1. `wrangler kv namespace create LICENSE_KV` → paste the id into `wrangler.toml`.
2. Set `LICENSE_PUBLIC_KEY` (base64 SPKI DER, same as the device's) in `[vars]`.
3. `wrangler secret put LICENSE_PRIVATE_KEY` — base64 of the PKCS8 DER: take
   `tool/.license-private.pem`, strip the `-----BEGIN/END-----` lines and
   newlines; the remaining base64 IS the DER. (The signing key stays offline
   otherwise; only the Worker holds this copy.)
4. `wrangler deploy` (creates the `license.familyboard.ch` custom domain).
5. Set the vendor-console secret:
   `openssl rand -base64 32 | tr -d '\n' | wrangler secret put LICENSE_ADMIN_TOKEN`.

## Vendor console (`/admin`)

Because every sold device passes through the workshop, keys are minted from a
small web console served by the Worker at `https://license.familyboard.ch/admin`.
It is gated by `LICENSE_ADMIN_TOKEN` (entered once, kept in the browser's
localStorage; every API call carries it as a Bearer header).

Workflow per device: assemble → boot → read the device's `deviceId` (Pi serial)
with `curl http://<board-ip>:3000/api/license` → paste it into the console with
the customer → **Key erzeugen**. Include the printed `FB1…` key with the device;
if a customer loses it, search by name or deviceId to re-find and resend it.

Keys are **perpetual and device-bound** (no expiry in the key; the lease is the
expiry/revocation surface). Issuing is idempotent per `deviceId` — re-scanning a
device returns its existing key unless you tick *reissue*.

Admin endpoints (all require `Authorization: Bearer <LICENSE_ADMIN_TOKEN>`):

```
POST /license/issue    {deviceId, customer?, plan?, reissue?}  → mints/returns FB1 key + stores record
GET  /license/lookup   ?deviceId=… | ?q=<customer|device>       → records (+ live revocation status)
POST /license/revoke   {deviceId}                               → revokes the record's key
POST /license/restore  {deviceId}                               → un-revokes
```

Records are stored under `rec:<deviceId>` in the same KV namespace; revocation
reuses the `key:<sha256url(key)>` entries above, so a revoked key stops getting
fresh leases and the device lapses into grace → soft → hard.

Public endpoints: `POST /license/checkin`, `GET /health`.
