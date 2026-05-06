---
title: tailwind.config.ts uses require() under ESM, crashes /setup compile
severity: P0
area: infra
owner: frontend-developer
status: fixed
slice: setup-wizard
created: 2026-05-06T15:07:17Z
---

## Reproduction

1. Reset DB: `rm -f data/app.db && DATABASE_URL="file:../data/app.db" npx prisma db push --skip-generate`
2. Start dev server: `DATABASE_URL="file:../data/app.db" NEXTAUTH_SECRET="dev-secret-32chars-or-more-12345678" ENCRYPTION_KEY="$(printf '%064d' 1)" npm run dev`
3. Hit any UI route that triggers Tailwind/PostCSS, e.g.:
   `curl -sS http://localhost:3000/setup`

## Expected

The route compiles and returns the setup wizard HTML (200) or, when the DB is already seeded, a 307 redirect to `/`.

## Actual

The dev server throws a fatal `ReferenceError: require is not defined` while loading `tailwind.config.ts` via `tailwindcss/lib/lib/load-config.js`, the request never returns, and the Next.js dev server process exits. Subsequent requests get `Empty reply from server` and then `Couldn't connect to server`.

## Evidence

```
○ Compiling /setup ...
ReferenceError: require is not defined
    at /Users/.../FamilyBoard/tailwind.config.ts:59:12
    at ModuleJobSync.runSync (node:internal/modules/esm/module_job:541:37)
    at ModuleLoader.importSyncForRequire (node:internal/modules/esm/loader:366:47)
    at loadESMFromCJS (node:internal/modules/cjs/loader:1648:24)
    ...
```

Offending line in `tailwind.config.ts`:

```
59:  plugins: [require("tailwindcss-animate")],
```

This file is a TypeScript module (`import type { Config } from "tailwindcss"`) and is being loaded as ESM by Tailwind's `load-config.js`, where `require` is not defined.

## Notes (likely root cause)

Mixing CJS `require()` with ESM `import` syntax in `tailwind.config.ts`. Fix: replace the dynamic `require("tailwindcss-animate")` with a static `import tailwindcssAnimate from "tailwindcss-animate"` at the top of the file and reference `tailwindcssAnimate` in `plugins`. Same applies to any other `require()` usages elsewhere in the config.

This is a P0 because no UI route can render — every page request that triggers PostCSS/Tailwind will crash the dev server. All API endpoints work (no Tailwind on the server-only route handlers), but `/setup` and `/` cannot be exercised.

## Fix

`tailwind.config.ts`: replaced `require("tailwindcss-animate")` with a top-level `import tailwindcssAnimate from "tailwindcss-animate"` and reference the imported binding in `plugins`. Also corrected the `DATABASE_URL` default in `src/lib/env.ts` to `file:../data/app.db` so Prisma's schema-relative resolution lands the SQLite file at `<project-root>/data/app.db` (matching the spec); `.env.example` documents this.
