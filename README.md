# FamilyBoard

A self-hosted family command center inspired by Cozyla — shared Google Calendar, chores with star rewards, to-dos, sticky notes, photo screensaver, and a touch-friendly dashboard. Designed for a wall-mounted tablet, runs in Docker today, on a Raspberry Pi tomorrow.

## Quick start (Docker)

```bash
cp .env.example .env
# Generate the two secrets and paste them into .env
openssl rand -base64 48      # -> NEXTAUTH_SECRET
openssl rand -hex 32         # -> ENCRYPTION_KEY

# Add Google OAuth credentials (see below) to .env
docker compose up --build
```

Open http://localhost:3000 — the first-run setup wizard creates your family.

## Google Calendar setup

1. Go to https://console.cloud.google.com/ → APIs & Services → Credentials.
2. Create an **OAuth 2.0 Client ID** of type *Web application*.
3. Authorized redirect URI: `http://<your-host>:3000/api/auth/callback/google` (replace `<your-host>` with `localhost`, your LAN IP, or your Pi's hostname).
4. Enable the **Google Calendar API** for the project.
5. Copy the client ID + secret into `.env` as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

Each family member can connect their own Google account from the setup wizard or settings.

## Local development

```bash
npm install
cp .env.example .env  # fill in the same values as above
npx prisma db push
npm run dev
```

## Raspberry Pi (ARM64)

The image is built for both `linux/amd64` and `linux/arm64`. On a Pi 4/5 running 64-bit OS, the same `docker compose up --build` works unchanged. Persistent data lives in `./data` (SQLite database + uploaded photos) and is bind-mounted into the container.

## Architecture

See `CLAUDE.md` for the architecture overview, conventions, and the multi-agent build workflow.
