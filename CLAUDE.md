# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

FamilyBoard is a self-hosted family command center inspired by Cozyla — shared calendar with Google 2-way sync, chores with star rewards, to-dos, sticky notes, photo screensaver, weather. Single-family per installation (one Pi per family). Designed for a wall-mounted touchscreen, runs in Docker on amd64 and arm64.

The long-term plan is a sellable product (v3) with monthly/yearly licensing — the data model and `src/lib/license.ts` already carve out the seam for that, but everything is unlicensed/open in v1.

## Commands

```bash
# Local dev (creates ./data/app.db on first run)
npm install
npm run db:migrate     # apply committed migrations (prisma migrate dev)
npm run dev            # http://localhost:3000

# Type-checking and build
npm run typecheck      # tsc --noEmit
npm run build          # prisma generate + next build

# Docker
docker compose up --build               # local
docker buildx build --platform linux/arm64 -t familyboard:arm64 .   # Pi image
```

`DATABASE_URL` defaults to `file:../data/app.db` (resolved relative to `prisma/`, so it lands at `<repo>/data/app.db`). For one-off Prisma commands, the `db:push`/`db:migrate`/`db:studio` npm scripts inject this default — for dev mode it's read by `src/lib/env.ts`.

**Schema changes go through committed migrations** (`prisma/migrations/`, canonical since the OTA groundwork — see `docs/ota-update-plan.md`): edit `schema.prisma`, then `npm run db:migrate` to generate + apply. `db:push` is for throwaway prototyping only — the Docker entrypoint (`scripts/docker-migrate.mjs`) runs `migrate deploy` and auto-baselines old `db push` databases. If your local `data/app.db` predates the migrations, run once: `npx prisma migrate resolve --applied 0_baseline`.

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

- **v1 — shipped.** setup wizard, dashboard, calendar with Google 2-way sync, chores + stars, to-dos, notes, photos, weather, settings + PIN (6-digit), dark mode, Docker (multi-arch), i18n (en/de/fr/it).
- **v2 — mostly shipped.** Done: meal planning + recipes + grocery (#3), PWA push notifications (#4), CalDAV sync (#5), Outlook / Microsoft Graph sync (#6), Flutter mobile app with pairing + FCM native push + Today/Todos/Chores/Grocery/Notes/Calendar-agenda screens (#8–11, #17–20). Still open: Apple Photos / Google Photos import, smart-home hub, offline drift cache + write-queue on mobile.
- **v3 (commercial) — not started.** license activation flow, remote license-server check-in (extend `src/lib/license.ts`), billing portal link, plan tiers, graceful degradation when expired, OTA updates. The `Installation` model is already in place.

### Mobile app status (`./mobile/`)

Per-screen feature parity with the wall:

| Screen | Read | Write |
|---|---|---|
| Today / Dashboard | ✓ (M2.2a) | ✓ (M2.2b) |
| Calendar (agenda) | ✓ (M3.3) | — (M3.4) |
| Todos | ✓ | ✓ (M2.2b) |
| Chores | ✓ | ✓ (M2.2b) |
| Grocery | ✓ (M3.1) | ✓ (M3.1) |
| Notes | ✓ (M3.2) | ✓ (M3.2) |
| Meal plan | — (M3.4) | — |
| Settings / member admin / OAuth | wall only | wall only |

Bearer-auth API surface lives under `src/app/api/mobile/**`, all routes go through `requireMobileAuth` from `src/lib/mobile-auth.ts`. Mutations follow the optimistic-flag + `ref.invalidate(<provider>)` pattern; 401 clears the session and lets `go_router` redirect to `/pair`.

### Known gaps / next slices

- **M3.4** — mobile meal-plan read + tick grocery items from this week's plan. Same pattern as Grocery: 1 read endpoint + screen.
- **M3.5** — offline drift cache. Local SQLite, write-queue replays on reconnect. Big architectural slice.
- **Recurring event push (CalDAV + Microsoft)** — Stage 1 (LOCAL-only) and Stage 2 (Google push + pull-dedup) shipped. CalDAV recurrence push needs the `RRULE` property on the master VEVENT in `buildVEventString`; Microsoft needs Graph's structured `recurrence` object. *Pull* expansion is fully wired across all three providers (Google `singleEvents: true`, Microsoft `calendarView/delta`, CalDAV `ICAL.Event.iterator()` with EXDATE + RECURRENCE-ID overrides — see `expandRecurring` in `src/lib/caldav.ts`).
- **Pi install: done.** Bootstrap script at `scripts/pi/install.sh`; full walkthrough at `docs/raspberry-pi-setup.md`. One-liner: `bash <(curl -fsSL https://raw.githubusercontent.com/GriniVS1/FamilyBoard/main/scripts/pi/install.sh)`.

### Useful files for a fresh agent landing on this codebase

- `scripts/generate-app-icons.mjs` — re-renders PWA + Android icons from inline SVG via `sharp`. Brand tokens at the top.
- `src/lib/mobile-auth.ts` — bearer-auth pattern used by all `/api/mobile/*` routes.
- `src/lib/notifications.ts` + `src/lib/fcm.ts` — fan-out web push + FCM in parallel.
- `mobile/lib/widgets/familyboard_logo.dart` + `src/components/shared/logo.tsx` — keep CORAL / INK / CREAM in sync if rebranding.
- `mobile/tool/sync_messages.dart` — verifies ARB parity across en/de/fr/it.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Working conventions, ops & gotchas (durable)

### Git / repo

- Repo **GriniVS1/FamilyBoard is PUBLIC**. Domain **familyboard.ch** on Cloudflare.
- **OneDrive flips file-mode bits** (`100644↔100755`) across the whole tree → massive phantom diffs. Leave mode bits alone (do not touch `core.fileMode`). Stage **content only**: `git -c core.fileMode=false add <files>` — **never** `git add -A`.
- **SSH push is broken.** Push/fetch over HTTPS with the gh token: `git push https://github.com/GriniVS1/FamilyBoard.git <branch>` ; `git fetch https://github.com/GriniVS1/FamilyBoard.git main:refs/remotes/origin/main`.
- **Every PR merge needs the user's explicit "ja"/ok first.** Create the PR, then wait.
- Commit trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`; PR body ends with the Claude Code generated-with line.

### Broken toolchain symlinks (OneDrive)

`node_modules/.bin/*` symlinks are broken → run tools by direct path:
- Typecheck: `node node_modules/typescript/lib/tsc.js --noEmit`
- Build: `NEXT_PHASE=phase-production-build NODE_ENV=production node node_modules/next/dist/bin/next build`
- Prisma: `node node_modules/prisma/build/index.js …`
- **Always build with `NODE_ENV=production`** before shipping — dev default masks prod-only failures (e.g. the prod-secret refusal in `env.ts`).

### Secrets

Never route secrets (API tokens, client secrets, private keys, PINs) through chat or screenshots. Interactive secret entry (`wrangler secret put`, Google client secret) is the user's job. For deploys Claude runs, the user exports the token into `~/.zshenv` and Claude reads it from env — verify only set/unset, never print. Client IDs / KV ids / account ids are **not** secret.

### Releases: base image ≠ OTA release

- **Base image** (flashed before shipping a Pi): `bash scripts/pi/build-image.sh vX.Y.ZZ` (pi-gen, needs Docker Desktop + buildx). A local build **does not publish** anything.
- **OTA release**: push a git tag `vX.Y.ZZ` → `.github/workflows/release.yml` builds arm64, signs, uploads to R2. Only a tag publishes.
- **Versions are zero-padded** (`v1.1.02`, `v1.1.04`) so `sort -V` orders correctly.
- **Everything ships via OTA — shipped devices are never re-flashed.** Host-side changes (updater script, systemd units, compose override, sudoers, packages) ride the **host payload** baked into every app image (`scripts/pi/host-payload/apply.sh` + files listed in the Dockerfile's `./host-payload/` COPY): at container start, `scripts/host-sync.sh` streams it onto the host via `sudo nsenter -t 1` (the container is privileged + pid:host) and runs `apply.sh` when `/var/lib/familyboard/host-payload-version` ≠ `APP_VERSION`. New host file → add it to the payload COPY list **and** `apply.sh`. **`apply.sh` must NEVER restart `familyboard.service` or `familyboard-updater.service`** (would kill the driving container / the updater mid-health-check); unit changes take effect on their next natural start. Base images are only the factory starting point.

### OTA architecture

Pull-based over HTTPS, **R2 tarballs** (not a registry), **auto-update always on, no opt-out**. Ed25519-signed manifest: `tool/sign-release.mjs`, public key `tool/release-pub.pem` baked into the image, private key offline with the user. Host updater `scripts/pi/familyboard-updater.sh`: verify sig → download → sha check → `docker load` → health check → rollback on failure; clears the `update-request` flag **at run start** (after flock), not only on success (else the `.path` unit stays armed → stuck "check for updates"). R2 bucket is **EU-jurisdiction** → CI must use the regional endpoint `https://<accountid>.eu.r2.cloudflarestorage.com` (`R2_JURISDICTION` var), served via `updates.familyboard.ch`. Field-device manual unstick: `sudo systemctl start familyboard-updater`.

### Google OAuth broker

Central Cloudflare Worker at `familyboard.ch/oauth/*` (dir `broker/`), so shipped devices need no per-family Google credentials. `connect-google` → broker `POST /oauth/google/start` (stores pending state in KV 10 min, returns authorizeUrl) → `GET /oauth/google/callback` exchanges the code, encrypts the refresh token, 302s back → device `/api/auth/google/adopt` decrypts (AES-256-GCM, framing `iv(12)||ct||tag(16)`). **Login works.**
- **KNOWN GAP (open):** calendar **sync** on broker devices needs the client secret to refresh the access token, and that secret lives only on the broker. Fix = broker `POST /oauth/google/refresh` (mint access token from refresh token) + device `google.ts` obtains tokens via the broker in broker mode + relax the `googleConfigured` guards in `src/lib/sync.ts`.

### Security posture

- Prod refuses to start with default `ENCRYPTION_KEY`/`NEXTAUTH_SECRET` — but the check is **guarded by `NEXT_PHASE === "phase-production-build"`** so `next build` (which runs under `NODE_ENV=production`) isn't blocked. Keep that guard.
- `TRUST_PROXY` gates whether `x-forwarded-for` is honored (behind Cloudflare/reverse proxy only).
- Admin PIN endpoints go through `requireAdminPin` (rate-limited); internal endpoints through `requireInternalOrAdmin`.

### Recurring field-bug patterns

- **API ↔ widget field-name drift** → `NaN`/blank UI (weather widget expected `ts`/`maxC`/`minC` vs API `time`/`tempMaxC`). Keep response shape and consumer in sync.
- **Kiosk on-screen keyboard (onboard) — LAUNCH WIRING REVERTED.** Our React OSK can't cover third-party pages (Google login), so the plan is `onboard` (X11-wide OSK). A first attempt (PR #109) put the launch wiring in the pi-gen `.xinitrc` — the `exec dbus-run-session -- "$0"` re-exec **black-screened the kiosk on real hardware** (X session died, tty console cursor, no boot to UI). That wiring is now removed from `.xinitrc` and `chromium-kiosk.service`; the `.xinitrc` is back to the known-good version. **Only the packages (`onboard at-spi2-core dbus-x11`) still ship via the host-payload OTA** — the binaries are present, nothing launches them. LESSON: never put unverified X11 changes in a base image (`.xinitrc` isn't OTA-updatable, and a bad one bricks a networkless device with no SSH). Next attempt must be iterated LIVE over SSH on a booting board before going anywhere near the image; prefer a fail-safe launch (e.g. `dbus-launch --sh-syntax` with `|| true`, never `exec`) or a docked/toggle keyboard over the finicky AT-SPI auto-show.
- **Pi has a single WiFi radio** → phone-based WiFi setup has a ~5-min timeout; don't assume simultaneous AP + client.
