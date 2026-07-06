# Google/Microsoft OAuth broker — architecture plan

> Status: Entwurf (2026-07-06). Ziel: Google-Kalender (und Outlook) auf
> ausgelieferten LAN-Geräten verknüpfbar machen, ohne Client-Secrets aufs Gerät
> zu backen und ohne dass Google eine `http://…​.local`-Redirect-URI akzeptieren
> müsste. Entscheidung vom 2026-07-03: **zentraler Broker** auf `familyboard.ch`.

## 1. Warum ein Broker

Direkte OAuth vom Gerät scheitert an zwei Dingen:

1. **Kein Secret aufs Gerät.** Ein pro-Gerät eingebackenes `GOOGLE_CLIENT_SECRET`
   läge auf jeder SD-Karte → faktisch öffentlich.
2. **Redirect-URI.** Google/Microsoft akzeptieren nur `https://` auf einer
   registrierten Domain — nicht `http://familyboard.local:3000`.

Der Broker löst beides: **eine** Vendor-OAuth-App (Secret nur im Broker),
Redirect auf `https://familyboard.ch/oauth/<provider>/callback`. Das NAT-Problem
(Gerät kann nichts eingehend empfangen) wird gelöst, weil der Browser, der die
Zustimmung gibt, ohnehin im Heimnetz ist und das Gerät lokal erreichen kann.

## 2. Ablauf (Redirect-Adopt)

```
Wall-App (Pi, LAN)          Broker (familyboard.ch)         Google
   │  1. POST /oauth/google/start {installationId, memberId}
   │─────────────────────────▶│
   │  ◀── {authorizeUrl, state}│  speichert pending{state → memberId,
   │                           │  adoptSecret, exp=10min} in KV
   │  2. Browser (Wall-Chromium ODER Handy im WLAN) öffnet authorizeUrl
   │──────────────────────────────────────────────────────▶│
   │                           │  3. GET /oauth/google/callback?code&state
   │                           │◀───────────────────────────│
   │                           │  tauscht code → refresh_token,
   │                           │  verschlüsselt mit adoptSecret
   │  4. 302 → http://familyboard.local:3000/api/auth/google/adopt?state&payload
   │◀──────────────────────────│ (Browser-Redirect zurück ins LAN)
   │  5. /adopt entschlüsselt payload (kennt adoptSecret zur state),
   │     speichert Refresh-Token (mit eigenem ENCRYPTION_KEY), startet Sync
   ▼
 verbunden → /settings?google=connected
```

Der Broker **persistiert das Token nicht** — er hält es nur flüchtig in der
Redirect-Payload; nach dem Adopt existiert es nur noch verschlüsselt auf dem
Gerät (wie heute schon, `member.googleRefreshTokenEnc`).

## 3. Broker-Endpoints (Cloudflare Worker)

- `POST /oauth/:provider/start` — Input `{ installationId, memberId }` (signiert,
  s.u.). Legt `pending` in KV an (Key = zufälliger `state`, TTL 10 min, Wert =
  `{ memberId, adoptSecret, provider }`), liefert `{ authorizeUrl }` mit
  `redirect_uri=https://familyboard.ch/oauth/:provider/callback` und `state`.
- `GET /oauth/:provider/callback?code&state` — lädt `pending`, tauscht `code`
  gegen Tokens (Vendor-Client-Secret aus Worker-Secret), verschlüsselt das
  Refresh-Token mit `adoptSecret` (AES-GCM), löscht `pending`, **302** auf
  `http://familyboard.local:3000/api/auth/:provider/adopt?state&payload`.
- Provider `google` und `microsoft` teilen sich dieselbe Mechanik (nur andere
  Token-Endpoints/Scopes).

## 4. Geräteseitige Änderungen (`src/`)

- `POST /api/members/[id]/connect-google` ruft künftig den **Broker** `/start`
  statt lokal `buildAuthorizeUrl` — behält aber `requireAdminPin`. Speichert die
  `adoptSecret` lokal (in `Setting`, an `state` gebunden, wie heute die
  OAuth-States).
- **Neu** `GET /api/auth/google/adopt` — Gegenstück zum heutigen `callback`:
  lädt die lokale `adoptSecret` per `state`, entschlüsselt `payload`, schreibt
  `googleRefreshTokenEnc` (mit dem Geräte-`ENCRYPTION_KEY`), triggert
  `pullForMember`. Der bestehende `/api/auth/google/callback` bleibt als
  Fallback für den Self-Hosted-Direktmodus (env-Credentials gesetzt).
- Broker-Basis-URL als env `OAUTH_BROKER_URL` (default `https://familyboard.ch`),
  im Pi-Image gesetzt. Kein Secret nötig.
- Dieselben zwei Punkte analog für Microsoft.

## 5. Sicherheit

- **Kein Client-Secret aufs Gerät** — nur im Broker (Worker-Secret).
- **Refresh-Token** transitiert den Broker nur flüchtig, verschlüsselt mit einer
  pro-Flow zufälligen `adoptSecret`, die ausschließlich das Gerät kennt (der
  Broker sieht das Token im Klartext nur im RAM während des Tausches, speichert
  es nie). Nach dem Adopt liegt es nur verschlüsselt auf dem Gerät.
- **`start` authentisieren**, damit nicht Fremde Flows anstoßen/pollen: HMAC der
  Anfrage mit einem pro-Installation-Secret (bei OTA-Pairing/erstem Check-in
  vergeben) — oder in Phase-1 minimal: unratbarer `state` + 10-min-TTL +
  Rate-Limit. Für Produktion HMAC vorsehen.
- `state` und `adoptSecret` je ≥256 bit, einmalig, kurzlebig.
- Redirect-Ziel auf dem Gerät strikt auf `familyboard.local`/lokale IP begrenzen
  (kein offener Redirect).

## 6. Der große Haken: Google-Verifizierung

`calendar.events` ist ein **sensibler Scope**. Für fremde Nutzer (nicht dein
eigenes Testkonto) muss die OAuth-App durch Googles **Verifizierung** (Consent-
Screen-Review, ggf. CASA-Sicherheitsaudit) — **Wochen**, und Voraussetzung, bevor
mehr als ~100 Nutzer / der „Testing"-Modus überschritten werden. **Unabhängig vom
Broker-Code sofort starten** (siehe `docs/google-cloud-setup.md`). Für deinen
eigenen Test reicht der Testing-Modus (bis 100 Testnutzer) sofort.

## 7. Hosting & Kosten

- **Cloudflare Worker** (`familyboard.ch/oauth/*`) + **KV** für die 10-min-
  `pending`-Einträge. Free-Tier deckt das locker. Vendor-Client-Secrets als
  Worker-Secrets.
- Koexistiert mit `updates.familyboard.ch` (R2) und der Webseite — nur ein Route-
  Muster `/oauth/*` auf der Zone.
- Laufende Kosten: **~0 €** (im Free-Tier).

## 8. Aufgaben & Aufwand

- [ ] **Google-Cloud-App + Verifizierung anstoßen** (du; langer Strang) — `docs/google-cloud-setup.md`
- [ ] Cloudflare Worker: `/oauth/google/{start,callback}` + KV, Vendor-Secret (1–2 T)
- [ ] Geräteseite: `connect-google` → Broker, neuer `/adopt`-Endpoint, `OAUTH_BROKER_URL` (1 T)
- [ ] Microsoft analog im Worker + Gerät (0,5–1 T)
- [ ] `start` per HMAC/Install-Secret absichern (0,5 T)
- [ ] E2E-Test am Gerät (Wall-Chromium + Handy im WLAN) (0,5 T)
- [ ] Pi-Image: `OAUTH_BROKER_URL` setzen → neue Basis

**Gesamt ~3,5–5 Entwicklungstage** (Broker-Code), plus die extern getaktete
Google-Verifizierung.

## 9. Offene Punkte
- Handy **muss im selben WLAN** sein (für den `familyboard.local`-Redirect). Für
  „Handy überall" bräuchte es das Poll-Modell (Gerät pollt Broker statt Redirect)
  — als spätere Option notiert, nicht MVP.
- Microsoft: `MICROSOFT_TENANT=common`, Redirect analog; gleiche Verifizierungs-
  Frage ist bei Microsoft milder als bei Google.
