# Google Cloud OAuth setup (for the calendar broker)

Do this once, as the vendor. It's the **long pole** — Google's verification for
the calendar scope takes weeks, so start now, in parallel with building the
broker (`docs/google-oauth-broker-plan.md`). Your own test account works
immediately in "Testing" mode; verification is only needed for other people's
accounts / >100 users.

## 1. Project
console.cloud.google.com → create project **FamilyBoard** (or reuse one).

## 2. Enable the API
APIs & Services → **Enable APIs** → enable **Google Calendar API**.

## 3. OAuth consent screen
APIs & Services → **OAuth consent screen**:
- User type: **External**.
- App name **FamilyBoard**, support email, developer email.
- App logo + homepage `https://familyboard.ch` + privacy-policy URL + terms URL
  (all **required** for verification — the privacy policy must mention Google
  user data / calendar access).
- **Scopes**: add `https://www.googleapis.com/auth/calendar.events` (this is the
  sensitive one), plus `openid`, `email`.
- **Test users**: add your own Gmail so you can test before verification.
- Save. Leave in **Testing** for now.

## 4. OAuth client (Web application)
APIs & Services → **Credentials** → Create credentials → **OAuth client ID** →
type **Web application**:
- Name: `familyboard-broker`
- **Authorized redirect URIs**: `https://familyboard.ch/oauth/google/callback`
  (exactly — this is the broker callback, not the device)
- Create → copy **Client ID** + **Client secret**.

These two go into the **broker** (Cloudflare Worker secrets:
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) — **never** onto a device.

## 5. Test now (Testing mode)
With your Gmail as a test user, the whole flow works immediately — no
verification needed. Verify the broker end-to-end against your own account
first.

## 6. Start verification (for real customers)
OAuth consent screen → **Publish app** → **Prepare for verification**:
- Google reviews the consent screen, domain ownership (verify `familyboard.ch`
  in Search Console), and the sensitive-scope justification (a short video/demo
  of the calendar use is usually requested).
- `calendar.events` may trigger a **CASA security assessment** (restricted-scope
  review) — budget weeks and possibly a third-party assessment fee.
- Until verified, you're capped at 100 test users and users see an
  "unverified app" warning.

## 7. Microsoft (later, same idea)
Azure Portal → App registrations → new registration, redirect
`https://familyboard.ch/oauth/microsoft/callback`, add Microsoft Graph
`Calendars.ReadWrite` + `offline_access`. Microsoft's review is lighter than
Google's. Client ID/secret → broker secrets `MICROSOFT_CLIENT_ID/SECRET`.

## Summary — what goes where
| Value | Where |
|---|---|
| Google Client ID / Secret | Broker (Cloudflare Worker secrets) — never on device |
| Redirect URI | `https://familyboard.ch/oauth/google/callback` |
| Test user | your Gmail (Testing mode) |
| Verification | required before non-test users; weeks — start early |
