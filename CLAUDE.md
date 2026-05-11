# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

FamilyBoard is a self-hosted family command center inspired by Cozyla — shared calendar with Google 2-way sync, chores with star rewards, to-dos, sticky notes, photo screensaver, weather. Single-family per installation (one Pi per family). Designed for a wall-mounted touchscreen, runs in Docker on amd64 and arm64.

The long-term plan is a sellable product (v3) with monthly/yearly licensing — the data model and `src/lib/license.ts` already carve out the seam for that, but everything is unlicensed/open in v1.

## Commands

```bash
# Local dev (creates ./data/app.db on first run)
npm install
npm run db:push        # apply Prisma schema to SQLite
npm run dev            # http://localhost:3000

# Type-checking and build
npm run typecheck      # tsc --noEmit
npm run build          # prisma generate + next build

# Docker
docker compose up --build               # local
docker buildx build --platform linux/arm64 -t familyboard:arm64 .   # Pi image
```

`DATABASE_URL` defaults to `file:../data/app.db` (resolved relative to `prisma/`, so it lands at `<repo>/data/app.db`). For one-off Prisma commands, the `db:push`/`db:migrate`/`db:studio` npm scripts inject this default — for dev mode it's read by `src/lib/env.ts`.

## Architecture

### Stack

- **Next.js 15** App Router + TypeScript + React 19
- **Tailwind v3** + custom design tokens (`src/app/globals.css`) + `framer-motion` + `lucide-react`
- **Prisma + SQLite** — single file at `data/app.db`; perfect for self-hosted use, ARM64-friendly. Binary targets: native + `linux-musl-openssl-3.0.x` + `linux-musl-arm64-openssl-3.0.x` so the image ships with engines for both Docker target architectures.
- **TanStack Query** for client data fetching and optimistic mutations.
- **Google OAuth via raw `googleapis`** (no NextAuth/Auth.js — see "Why no NextAuth" below).
- **AES-256-GCM** for refresh-token encryption at rest (`src/lib/crypto.ts`).
- **bcryptjs** for the admin PIN.

### Big-picture data flow

1. **First run** → `getOrCreateInstallation()` creates a single `Installation` row. License fields are inert in v1; v3 will check in remotely.
2. **Setup wizard** (`/setup`) creates the `Family`, 1–8 `Member`s (each gets a member color), an admin PIN (bcrypt-hashed in `Setting`), and weather location.
3. **Google OAuth round-trip** — `/api/members/[id]/connect-google` mints a state token (stored in `Setting`), returns an `authorizeUrl`. The browser navigates there, Google redirects to `/api/auth/google/callback`, the route handler exchanges the code, encrypts the refresh token, writes it onto the member, and triggers an immediate sync.
4. **Background sync** (`src/instrumentation.ts`) hits its own `POST /api/sync/google` every 5 min. The route runs `runGoogleSyncForAllMembers()` in `src/lib/sync.ts` — incremental pull per member via `syncToken`, falling back to a 30-day window full sync on `410 Gone`.
5. **Local events** are mirrored to Google immediately via `pushLocalEvent` if the assigned member has Google linked. Google-sourced events are read-only locally except for `memberId`/`color`.

### Module boundaries

- `src/app/api/**` — every route uses `runtime = "nodejs"`, Zod-validated input, wrapped in `withErrorHandling` from `src/lib/api.ts`. Errors come back as `{ error: { code, message } }`.
- `src/lib/db.ts` — Prisma singleton. Always import `db` from here.
- `src/lib/env.ts` — Zod-validated env. Never `process.env.X` scattered around.
- `src/lib/api.ts` — `AppError`, `ok`, `fail`, `withErrorHandling`.
- `src/lib/crypto.ts` — AES-GCM wrappers. Encrypt all OAuth refresh tokens before writing to DB. Never log tokens.
- `src/lib/google.ts` — `googleapis` SDK helpers (`getOAuth2Client`, `getCalendarForMember`, `listIncrementalEvents`). Persists rotated tokens via the `tokens` event listener.
- `src/lib/sync.ts` — pull/push reconciler (`runGoogleSyncForAllMembers`, `pullForMember`, `pushLocalEvent`, `deleteRemoteEvent`).
- `src/lib/license.ts` — v1 stub. Always returns `ACTIVE`. Same shape will be replaced by a real license-server check in v3.
- `src/lib/queries.ts` — server-component-friendly read helpers (no API round-trip).
- `src/lib/pin.ts` — bcrypt admin PIN.
- `src/instrumentation.ts` — minimal: a `setInterval` that fetches `/api/sync/google` from inside the Node runtime. It deliberately does not import `googleapis` — that import chain breaks Next's Edge bundling pass. All real sync work happens in the route handler.

### Why no NextAuth

The app has no per-user accounts (it's a wall display). Auth.js would force a session model we don't need. Instead: `googleapis` OAuth2 directly, with `state` tokens stored in `Setting` to bind the round-trip to a specific `Member`. This keeps the data model simple and makes per-member token management explicit.

### Design system

- Tokens (`src/app/globals.css`): `--bg`, `--surface`, `--ink`, `--muted`, `--border`, plus 8 accent colors (`peach`, `mint`, `sun`, `sky`, `lilac`, `rose`, `teal`, `sand`). Each accent is referenced as `bg-accent-peach`, `text-accent-peach`, etc., and tints with `/30`, `/40`. **Never hardcode hex.**
- Cards: `rounded-3xl`, `bg-surface`, `border border-border`, `shadow-soft`, generous padding.
- Glass: `.glass` class (backdrop-blur + translucent surface).
- Type: Geist Sans (display) + Inter (body). Tabular numerals on clocks/temps/dates.
- Motion: 180–220 ms ease. Buttons spring on press. Star burst on chore complete uses `framer-motion`.
- Touch targets ≥ 48 px everywhere (use `tap-target` class or `min-h-12`).
- Light + dark parity is mandatory — always use tokens.

### Member color flow

Each member has a `color` (one of the 8 accent names). Events and chore rows tint themselves with `bg-accent-{member.color}/30` and a `border-l-4 border-accent-{member.color}` accent stripe. `MEMBER_COLORS` is exported from `src/lib/utils.ts` for validators.

## Conventions

- TypeScript strict mode. No `any`. No commented-out code.
- Comments only for non-obvious WHY. Don't describe what the code does.
- Server Components by default; `"use client"` only when needed (state, motion, browser APIs).
- Prefer Tailwind primitives. Never write CSS modules.
- Prisma client is a singleton from `src/lib/db.ts`.
- All env vars validated through `src/lib/env.ts` (Zod).
- All API routes: `export const runtime = "nodejs"`, wrapped in `withErrorHandling`, Zod-validated input.

## Project layout

- `src/**` — the wall (Next.js 15, the wall-mounted touchscreen app).
- `prisma/**` — schema + migrations for the wall's SQLite store.
- `mobile/**` — the Flutter companion app (iOS + Android). Hand-authored Dart sources; native project shells are not in git — developers run `flutter create --org com.familyboard --platforms=ios,android .` once per clone. See `mobile/README.md`.

## Multi-agent build workflow

Project-scoped subagents are defined in `.claude/agents/`:

- **`frontend-developer`** — owns `src/app/**` (UI), `src/components/**`, Tailwind, motion, accessibility, responsive behavior.
- **`backend-developer`** — owns `prisma/**`, `src/app/api/**`, `src/lib/{db,auth,crypto,google,sync,license,pin,queries,env,enums,api}.ts`, `instrumentation.ts`, Docker.
- **`mobile-developer`** — owns `mobile/**` (Flutter companion app). Cannot edit `src/**` or `prisma/**`.
- **`app-tester`** — runs the app, exercises endpoints, and writes bug reports into `.claude/bug-reports/<UTC-ISO>-<slug>.md`. **Cannot edit source code** — that's the load-bearing constraint that keeps verification honest.

For each feature slice the orchestrator (you) splits work across the relevant developer agents (run them in parallel via a single message with multiple Agent tool uses), then dispatches `app-tester`. Bug reports route via the `owner` frontmatter field. When a developer fixes a bug, they update `status: fixed` and append a `## Fix` section to the report. Re-run the tester for the slice; loop until clean.

If the agents aren't available in your session (they only load when you start Claude Code in this directory), fall back to invoking them inline via `general-purpose` agents and copy the relevant `.claude/agents/*.md` system prompt into your prompt.

## v1 / v2 / v3 roadmap

- **v1 (current):** setup wizard, dashboard, calendar with Google 2-way sync, chores + stars, to-dos, notes, photos, weather, settings + PIN, dark mode, Docker (multi-arch).
- **v2:** meal planning + recipes + grocery list, Apple/Outlook/CalDAV sync, smart-home hub, mobile companion app (Flutter, see `./mobile/`), push notifications, Google Photos.
- **v3 (commercial):** license activation flow, remote license-server check-in (extend `src/lib/license.ts`), billing portal link, plan tiers, graceful degradation when expired, OTA updates. The `Installation` model is already in place.
