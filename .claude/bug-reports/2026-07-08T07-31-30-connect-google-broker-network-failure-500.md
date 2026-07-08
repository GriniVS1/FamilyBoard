---
title: "connect-google returns generic 500 INTERNAL_ERROR instead of 502 BROKER_UNREACHABLE when broker fetch itself fails"
severity: P1
area: backend
owner: backend-developer
status: fixed
slice: calendar setup from paired phone
created: 2026-07-08T07:31:30Z
---

## Reproduction

1. Start the app in broker mode (no `GOOGLE_CLIENT_SECRET`/`GOOGLE_CLIENT_ID`, so `googleConfigured` is false) and point `OAUTH_BROKER_URL` at an address that refuses connections, e.g.:
   `GOOGLE_CLIENT_SECRET="" GOOGLE_CLIENT_ID="" OAUTH_BROKER_URL="http://127.0.0.1:19999" NODE_ENV=production next start`.
2. Confirm broker mode: `curl http://localhost:3000/api/setup/status` → `"googleConfigured":false`.
3. Pair a mobile device, get a bearer token.
4. `curl -X POST http://localhost:3000/api/mobile/calendar/connect-google -H "Authorization: Bearer <token>"`.

## Expected

Per the test plan and the existing error-code contract (the Flutter client explicitly maps `BROKER_UNREACHABLE` to a dedicated, localized error message — see `mobile/lib/models/calendar_setup.dart`'s `CalendarSetupErrorCode.brokerUnreachable`), an unreachable broker should return `502 { "error": { "code": "BROKER_UNREACHABLE" } }` cleanly, regardless of *how* the broker is unreachable (non-2xx response vs. the fetch itself throwing due to connection refused/DNS failure/timeout).

## Actual

```
$ curl -X POST http://localhost:3000/api/mobile/calendar/connect-google -H "Authorization: Bearer w3BiBo_bmeR3kFXZkIgSEV5kEtMYNfue_C0y63QNcFk"
{"error":{"code":"INTERNAL_ERROR","message":"Internal server error"}}
HTTP 500
```

The mobile client's `_mapErrorCode` falls through to `CalendarSetupErrorCode.unknown` for `INTERNAL_ERROR`, so the user sees the generic "something went wrong" copy instead of the more actionable broker-unreachable message that was clearly intended for exactly this scenario.

## Evidence

```text
$ curl http://localhost:3000/api/setup/status
{"installationId":"...","googleConfigured":false,...}

$ curl -X POST http://localhost:3000/api/mobile/calendar/connect-google -H "Authorization: Bearer <token>" --max-time 15
{"error":{"code":"INTERNAL_ERROR","message":"Internal server error"}}
HTTP 500
```

## Notes

Root cause is in `src/lib/calendar-connect.ts`, `startGoogleConnect`:

```ts
const res = await fetch(`${env.OAUTH_BROKER_URL}/oauth/google/start`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ memberId, adoptSecret, returnUrl }),
});
if (!res.ok) {
  throw new AppError("Update broker unreachable", "BROKER_UNREACHABLE", 502);
}
```

The `if (!res.ok)` check only covers the case where the broker responds with a non-2xx status. If `fetch()` itself throws (connection refused, DNS failure, timeout — the actual "broker unreachable" case, and the one most likely on a Pi with flaky WiFi or when `familyboard.ch` is down), the exception isn't caught here and falls through to `withErrorHandling`'s generic catch-all, which reports `500 INTERNAL_ERROR`. Wrap the `fetch` call in a `try/catch` and rethrow as the same `AppError("...", "BROKER_UNREACHABLE", 502)` on network failure. This affects both the mobile route (`src/app/api/mobile/calendar/connect-google`) and the wall's admin route (`src/app/api/members/[id]/connect-google`), since both call the same shared `startGoogleConnect`.

## Fix

`src/lib/calendar-connect.ts`'s `startGoogleConnect` now wraps the broker
`fetch()` call itself in a `try/catch`, not just the `res.ok` check. Any
network-level failure (connection refused, DNS failure, timeout, TLS error)
now throws the same `AppError("OAuth broker unreachable", "BROKER_UNREACHABLE", 502)`
as a non-2xx HTTP response, so both the mobile route
(`src/app/api/mobile/calendar/connect-google`) and the wall's admin route
(`src/app/api/members/[id]/connect-google`) — which both call this shared
function — now surface `502 { "error": { "code": "BROKER_UNREACHABLE" } }`
instead of falling through to `withErrorHandling`'s generic `500 INTERNAL_ERROR`.

Verified: `node node_modules/typescript/lib/tsc.js --noEmit` passes; prod build
(`NEXT_PHASE=phase-production-build NODE_ENV=production next build`) succeeds.
Could not re-drive the exact `curl` repro in this sandbox (no OAuth broker
reachable), but the fix is a direct, minimal try/catch around the documented
failure path and mirrors the existing `!res.ok` branch exactly.
