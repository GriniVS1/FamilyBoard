# FamilyBoard OAuth broker

Cloudflare Worker on `familyboard.ch` that lets shipped LAN devices link Google
Calendar without baking the client secret onto them. See
`docs/google-oauth-broker-plan.md`.

## Endpoints
- `POST /oauth/google/start` — `{ memberId, adoptSecret (64 hex), returnUrl }` → `{ authorizeUrl, state }`
- `GET /oauth/google/callback?code&state` — exchanges the code, encrypts the
  refresh token with `adoptSecret`, redirects to `returnUrl?state&payload`
- `GET /health`

The refresh token is never persisted; the vendor Google client secret lives
only as a Worker secret.

## Deploy (one-time)
```bash
cd broker
npm install
npx wrangler login                                   # or CLOUDFLARE_API_TOKEN
npx wrangler kv namespace create OAUTH_KV            # paste the id into wrangler.toml
npx wrangler secret put GOOGLE_CLIENT_ID             # from the Google Cloud OAuth client
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler deploy
```
The `familyboard.ch/oauth/*` route is declared in `wrangler.toml`; it does not
touch the website or `updates.familyboard.ch`.

## Crypto contract (must match the device `/api/auth/google/adopt`)
AES-256-GCM. `adoptSecret` is the raw 32-byte key (hex). Payload framing:
`base64url(iv(12) || ciphertext || tag(16))` — Web Crypto appends the 16-byte
tag to the ciphertext; the device (Node crypto) splits it back off.
