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

Endpoints: `POST /license/checkin`, `GET /health`.
