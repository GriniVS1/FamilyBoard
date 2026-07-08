---
title: "npm run dev returns 500 on every route — webpack chokes on node:crypto in instrumentation's edge bundle"
severity: P0
area: backend
owner: backend-developer
status: fixed
slice: calendar setup from paired phone
created: 2026-07-08T07:30:59Z
---

## Reproduction

1. `git status` confirms `src/instrumentation.ts` and `src/lib/internal-secret.ts` are unmodified by this slice's diff (only referenced here because they are the root cause).
2. Clean `.next` cache: `rm -rf .next`.
3. `DATABASE_URL="file:../data/app.db" node node_modules/next/dist/bin/next dev` (equivalent to `npm run dev`, invoked via direct path per the broken `.bin` symlinks noted in CLAUDE.md).
4. Wait for `✓ Ready`.
5. `curl http://localhost:3000/api/setup/status` (or literally any route, including `GET /`).

## Expected

The dev server serves the app; API routes return JSON via `withErrorHandling`, pages render normally — same as `npm run build && npm start`.

## Actual

Every single route — API and page — returns HTTP 500 with Next's generic `_error` page. Server log shows a build-time module error for `src/lib/internal-secret.ts` (imported by `src/instrumentation.ts`), which then poisons the shared dev bundle for all subsequent requests:

```
⨯ node:crypto
Module build failed: UnhandledSchemeError: Reading from "node:crypto" is not handled by plugins (Unhandled scheme).
Webpack supports "data:" and "file:" URIs by default.
You may need an additional plugin to handle "node:" URIs.
Import trace for requested module:
node:crypto
./src/lib/internal-secret.ts
✓ Ready in 1999ms
```

Any subsequent curl, e.g.:
```
$ curl http://localhost:3000/api/setup/status
... "err":{"name":"ModuleBuildError","source":"server","message":"Module build failed: UnhandledSchemeError: Reading from \"node:crypto\" is not handled by plugins (Unhandled scheme). ..."}
HTTP 500
```
Confirmed this hits every route, including the plain `GET /` homepage (not just API):
```
GET /api/setup/status 500
POST /api/sync/google 500
GET /api/mobile/calendar/status 500
GET / 500
```

This makes `npm run dev` — the documented local dev command in CLAUDE.md — completely unusable. It fully blocked the dev-mode portion of this slice's test plan; I had to switch to a production build (`NODE_ENV=production next build && next start`) to exercise any endpoint at all. Production build/start is unaffected (builds and serves cleanly), so this is a dev-mode-only regression, but it's a total blocker for `npm run dev`.

## Evidence

```text
 ⨯ node:crypto
Module build failed: UnhandledSchemeError: Reading from "node:crypto" is not handled by plugins (Unhandled scheme).
Webpack supports "data:" and "file:" URIs by default.
You may need an additional plugin to handle "node:" URIs.
Import trace for requested module:
node:crypto
./src/lib/internal-secret.ts
 ✓ Ready in 1999ms
 ○ Compiling /instrumentation ...
 ✓ Compiled /api/sync/google in 924ms (375 modules)
 GET /api/setup/status 500 in 3104ms
 POST /api/sync/google 500 in 2828ms
```

## Notes

- `src/lib/internal-secret.ts` imports `node:crypto` and is deliberately kept dependency-free ("This module deliberately avoids importing the DB/Prisma chain so it is safe for instrumentation.ts to import without breaking Next's bundling pass" — but it still breaks the pass, just on a different import). `src/instrumentation.ts`'s own comment already flags this exact class of problem for `googleapis` ("that import chain breaks Next's Edge bundling pass") — the same edge-bundling attempt is now failing on a *built-in* Node module instead of a third-party one.
- Root cause is likely that Next's dev webpack build always compiles `instrumentation.ts` for the edge runtime target in addition to nodejs, regardless of the `process.env.NEXT_RUNTIME !== "nodejs"` runtime guard inside `register()` — that guard only prevents *execution*, not *bundling*. `node:crypto` has no edge polyfill via plain webpack.
- Confirmed this is not caused by this slice's diff — none of the files in the error's import trace are touched by the calendar-setup-from-phone changes, and reverting to `main` would not change this (same file contents). Filing against backend-developer since instrumentation/internal-secret are backend-owned files and this blocks the primary local dev loop for the whole team, not just this slice.
- Production build was used as a workaround to complete the rest of this slice's verification (`NEXT_PHASE=phase-production-build NODE_ENV=production next build`, then `NODE_ENV=production next start`) — that path built and served without issue.

## Fix

Root cause confirmed exactly as diagnosed: Next 15's dev webpack build
compiles `instrumentation.ts`'s module graph for the Edge target as well as
Node.js, regardless of the `process.env.NEXT_RUNTIME !== "nodejs"` guard
inside `register()` (that guard only skips *execution*, not *bundling* — the
dynamic `await import("@/lib/internal-secret")` is still statically
discovered and bundled for both targets). `src/lib/internal-secret.ts`
imported `randomBytes` from `node:crypto`, which Edge webpack has no loader
for, poisoning the whole dev bundle.

Fixed by removing the `node:crypto` dependency from
`src/lib/internal-secret.ts` entirely — it now mints the secret via
`globalThis.crypto.getRandomValues()` (Web Crypto API), which is available
natively in both Node.js 20+ (this repo's minimum, per `Dockerfile`'s
`node:20-alpine`) and the Edge runtime. No behavior change: same 32
random bytes, hex-encoded, cached on `process.env.INTERNAL_API_SECRET`.

No changes needed to `instrumentation.ts` itself — the runtime guard there
was already correct and is the right pattern going forward; the fix is
scoped to the module it imports.

Verified:
- `rm -rf .next && DATABASE_URL="file:../data/app.db" node node_modules/next/dist/bin/next dev`
  — no more `node:crypto` / `UnhandledSchemeError` in the log; `/instrumentation`
  compiles cleanly.
- `curl http://localhost:3000/api/setup/status` → `200`
- `curl http://localhost:3000/` → `200`
- `curl http://localhost:3000/api/mobile/calendar/status` → `401 UNAUTHORIZED`
  (correct auth-gated response, not a 500)
- Instrumentation's background ticks (`/api/sync/google`, `/api/push/tick`,
  `/api/system/display-tick`) all fired and returned `200` in the dev log.
- Prod build still succeeds:
  `NEXT_PHASE=phase-production-build NODE_ENV=production node node_modules/next/dist/bin/next build`
- `node node_modules/typescript/lib/tsc.js --noEmit` passes.
- Dev server killed after verification.
