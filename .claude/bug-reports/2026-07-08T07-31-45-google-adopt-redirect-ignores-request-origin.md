---
title: "google/adopt's final redirect to /calendar-connected uses NEXTAUTH_URL, discarding the phone's LAN returnUrl"
severity: P1
area: backend
owner: backend-developer
status: fixed
slice: calendar setup from paired phone
created: 2026-07-08T07:31:45Z
---

## Reproduction (code review — see Notes for why this couldn't be driven live in this environment)

1. Read `src/app/api/mobile/calendar/connect-google/route.ts`: it deliberately computes
   `returnUrl = getRequestOrigin(req) + "/api/auth/google/adopt"` so that, in broker mode, the
   phone's browser lands back on **whatever LAN address the phone actually used to reach the
   device** (not `NEXTAUTH_URL`, which per `src/lib/network.ts`'s own comments "may be a
   hostname the phone can't resolve/route to" — e.g. an mDNS `.local` name that many Android
   phones can't resolve).
2. Read `src/lib/calendar-connect.ts`'s `startGoogleConnect`: this `returnUrl` is sent to the
   broker's `/oauth/google/start` and stored nowhere else — the broker is expected to redirect
   the phone's browser to exactly that LAN URL after the Google round-trip.
3. Read `src/app/api/auth/google/adopt/route.ts`'s `redirect()` helper (the endpoint the broker
   redirects to): for `source === "mobile"` it builds the final redirect with
   `new URL("/calendar-connected", env.NEXTAUTH_URL)` — i.e. it ignores the request it just
   received (which arrived at the phone-reachable LAN address) and instead redirects to
   `NEXTAUTH_URL`.

## Expected

The browser should be redirected to `/calendar-connected` on the **same host the phone just
successfully used** to reach `/api/auth/google/adopt` (i.e. derived from the incoming request,
the same way `connect-google` derives `returnUrl` via `getRequestOrigin(req)`) — not
`env.NEXTAUTH_URL`.

## Actual

`adopt/route.ts` hardcodes `env.NEXTAUTH_URL` for the mobile-source final redirect:

```ts
function redirect(reason: string, memberId?: string, ok = false, source?: "mobile") {
  if (source === "mobile") {
    const url = new URL("/calendar-connected", env.NEXTAUTH_URL); // <-- ignores req
    ...
  }
```

Whenever `NEXTAUTH_URL` differs from the LAN address the phone actually reached (the exact
scenario `getRequestOrigin`/`returnUrl` was built to handle — Pi ships with
`NEXTAUTH_URL=http://familyboard.local:3000`, and per `src/lib/network.ts`'s own comment "many
Androids don't [resolve mDNS]"), the phone's browser gets redirected to a host it cannot reach
after completing the OAuth round-trip. The user sees a browser error instead of the
success/error confirmation screen, even though the Google token was adopted successfully
server-side.

## Evidence

```text
$ git diff -- src/app/api/auth/google/adopt/route.ts
+function redirect(reason: string, memberId?: string, ok = false, source?: "mobile") {
+  if (source === "mobile") {
+    const url = new URL("/calendar-connected", env.NEXTAUTH_URL);
+    ...
```
No `getRequestOrigin` import in this file at all — confirmed via `grep -n "getRequestOrigin" src/app/api/auth/google/adopt/route.ts` returning nothing.

## Notes

- Not reproducible via a single localhost curl (localhost happens to equal `NEXTAUTH_URL` in
  this dev setup, so the bug is invisible unless the phone's LAN IP differs from
  `NEXTAUTH_URL`'s host — which is the Pi's real-world default). Verified by full code trace of
  the three files instead.
- The Microsoft callback (`src/app/api/auth/microsoft/callback/route.ts`) and the Google direct
  (non-broker) callback (`src/app/api/auth/google/callback/route.ts`) do **not** have this bug:
  both use a fixed `redirect_uri` registered with the provider that always equals
  `NEXTAUTH_URL`, so the browser is already on that host when the final redirect fires — using
  `env.NEXTAUTH_URL` there is correct and consistent.
- Fix: in `src/app/api/auth/google/adopt/route.ts`, derive the mobile-source redirect base from
  the incoming request (e.g. reuse `getRequestOrigin(req)` from `src/lib/network.ts`, already
  used by `connect-google/route.ts` for exactly this purpose) instead of `env.NEXTAUTH_URL`.

## Fix

`src/app/api/auth/google/adopt/route.ts`'s local `redirect()` helper now takes
the incoming `Request` and, for `source === "mobile"`, builds the final
`/calendar-connected` redirect from `getRequestOrigin(req)` (imported from
`src/lib/network.ts`) instead of `env.NEXTAUTH_URL`. All five call sites in
`GET` were updated to pass `req`. The non-mobile (`/settings`) branch is
unchanged — the wall's own browser already loaded the page from
`NEXTAUTH_URL`, so that's still correct there.

Confirmed no equivalent bug in `src/app/api/auth/google/callback/route.ts` or
`src/app/api/auth/microsoft/callback/route.ts`: both register a fixed
`redirect_uri = ${env.NEXTAUTH_URL}${...REDIRECT_PATH}` with the provider
(`src/lib/google.ts`'s `getOAuth2Client`, `src/lib/microsoft.ts`'s two
`redirectUri` builders), so the provider itself always redirects the browser
back to `NEXTAUTH_URL` first — the browser is already on that host by the
time these two callbacks fire their own final redirect. `adopt/route.ts` is
different because it's reached via the *broker's* redirect, not a
provider-registered `redirect_uri` tied to `NEXTAUTH_URL`, which is exactly
why `returnUrl` (the LAN address) is threaded through in the first place.

Verified: `node node_modules/typescript/lib/tsc.js --noEmit` passes; prod
build succeeds. Not re-driven with a live phone/broker round-trip (same
sandbox limitation as the original report), but the change is a direct
substitution using the same `getRequestOrigin` helper and trust rules already
proven in `connect-google/route.ts`.
