# OTA-Updates für FamilyBoard-Geräte — Infrastruktur-Plan

> Status: beschlossen (2026-07-03) — alle Grundsatzentscheidungen geklärt, siehe §7.
> Ziel: ausgelieferte Raspberry Pis aktualisieren sich
> selbstständig und sicher aus der Ferne (DACH, Consumer-Heimnetze). Das vor dem
> Versand geflashte Image (z. B. `v1.0.11`) ist die **Basisversion** — jede Basis
> muss noch Jahre später auf den aktuellen Stand kommen.

## 1. Ausgangslage

Was heute existiert und wiederverwendet wird:

| Baustein | Zustand | Rolle im OTA-Plan |
|---|---|---|
| App läuft als Docker-Container (`familyboard:latest`), beim First-Boot per `docker load` aus eingebackenem Tarball | ✓ shipped | Update = neues Image ziehen + `compose up -d` — gleiche Mechanik |
| `familyboard.service` / `docker-compose.pi.yml` auf dem Host | ✓ | wird vom Updater neu gestartet |
| Ed25519-Signatur-Seam (`tool/sign-license.mjs`, `LICENSE_PUBLIC_KEY` in `env.ts`) | ✓ | gleiche Technik für signierte Update-Manifeste |
| `Installation`-Modell (Prisma) | ✓ | bekommt `appVersion`, `updateChannel` |
| Domain `familyboard.ch` | ✓ vorhanden | `updates.` + später `api.` Subdomains |
| Prisma-Migrationen | ✗ **fehlt** (nur `db push`) | **Blocker** — muss vor dem ersten OTA-Release auf `prisma migrate` umgestellt werden |
| Ausgehende Verbindung der Geräte | nur WLAN des Kunden, hinter NAT/CGNAT | erzwingt **Pull-Architektur** über HTTPS 443 |

## 2. Architektur (Pull-basiert)

```
┌──────────────────────────── Cloud ────────────────────────────┐
│                                                               │
│  GitHub Repo ──▶ GitHub Actions (Release-Tag)                 │
│                    │  1. arm64-Image bauen                    │
│                    │  2. als .tar.gz exportieren → R2         │
│                    │  3. Manifest signieren (Ed25519)         │
│                    ▼                                          │
│  updates.familyboard.ch  (Cloudflare R2 + Worker)             │
│  stable.json / beta.json + app-vX.Y.Z.tar.gz                  │
│                                                               │
└───────────────▲───────────────────────────────────────────────┘
                │ HTTPS 443 (Pull, Polling)
┌───────────────┴───────────────────────────────────────────────┐
│ Raspberry Pi (Kundenheimnetz, NAT — keine eingehenden Ports)  │
│                                                               │
│  familyboard-updater (Host: Script + systemd timer/path unit) │
│   1. Manifest holen → Ed25519-Signatur prüfen                 │
│   2. Version vergleichen (monoton steigend, Anti-Rollback)    │
│   3. Tarball laden (~400–600 MB) → SHA-256 prüfen             │
│   4. docker load (gleiche Mechanik wie First-Boot)            │
│   5. Container stoppen → data/app.db sichern                  │
│   6. compose up -d → /api/health prüfen                       │
│   7. OK: alte Version als :previous taggen                    │
│      FEHLER: Rollback auf :previous + Version als "bad" merken│
└───────────────────────────────────────────────────────────────┘
```

Warum Pull statt Push: Die Geräte stehen hinter beliebigen NATs, CGNAT
(LTE-Router), Fritzboxen etc. Ausgehendes HTTPS auf Port 443 funktioniert in
jedem DACH-Heimnetz ohne Konfiguration. Kein VPN, kein Port-Forwarding, kein
Fleet-Broker nötig.

### Signiertes Manifest (`stable.json`)

```json
{
  "version": "1.2.0",
  "appBundleUrl": "https://updates.familyboard.ch/app/familyboard-v1.2.0.tar.gz",
  "appBundleSha256": "…",
  "minBaseVersion": "1.0.11",
  "hostBundleUrl": "https://updates.familyboard.ch/host/v1.2.0.tar.gz",
  "hostBundleSha256": "…",
  "releaseNotes": { "de": "…", "en": "…" },
  "rollout": { "percent": 100 },
  "publishedAt": "2026-07-10T08:00:00Z",
  "signature": "base64-ed25519-über-alles-oben"
}
```

Signatur **detached** (`stable.json` + `stable.json.sig`), nicht eingebettet:
das Gerät verifiziert die exakt geladenen Bytes → keine JSON-Kanonisierung, die
schiefgehen kann. Signaturformat: base64 einer rohen 64-Byte-Ed25519-Signatur;
`tool/sign-release.mjs` erzeugt sie, der Updater prüft mit `openssl pkeyutl
-verify -rawin` (der Pi-Host hat openssl, aber kein Node).

- **Signatur zusätzlich zu TLS**: selbst wenn CDN/DNS kompromittiert wäre,
  akzeptiert das Gerät nur Manifeste, die mit dem privaten Release-Key signiert
  sind (Public Key ist ins OS-Image eingebacken — gleiche Ed25519-Mechanik wie
  der License-Seam).
- **`appBundleSha256` pinnt das Artefakt**: das Gerät verifiziert den Hash vor
  dem `docker load` — ein manipulierter Tarball wird verworfen.
- **`hostBundle`**: seltene Host-Änderungen (compose-Datei, Kiosk-Scripts,
  der Updater selbst) als signiertes Tar. Updater-Self-Update zweistufig
  (neues Script erst beim nächsten Lauf aktiv).
- **Absolute Referenzen, keine Delta-Ketten**: ein Gerät, das 12 Monate offline
  war, springt in einem Schritt von Basis → aktuell.

### Geräteseite

- **Auto-Update ist immer aktiv — nicht deaktivierbar** (Produktentscheidung
  2026-07-03). Konsequenz: ein fehlerhaftes Release erreicht zwangsläufig die
  ganze Flotte → der automatische Rollback (unten) und der gestaffelte Rollout
  (Phase 2) sind damit nicht optional, sondern die zentrale Sicherung. Vor dem
  ersten größeren Flotten-Rollout sollte Phase 2 (beta-Kanal + `rollout.percent`)
  live sein.
- `familyboard-updater.timer`: täglich + Zufalls-Jitter (Lastverteilung),
  Standard-Fenster 03:00–05:00 lokal.
- `familyboard-updater.path`: watcht `./data/update-request` — die Wall-UI
  (Settings → "Nach Updates suchen") schreibt die Flag-Datei, der Host-Updater
  feuert sofort. Kein Docker-Socket im App-Container nötig.
- Vor dem Manifest-Check: `systemd-timesyncd` abwarten (Pi hat keine RTC —
  ohne korrekte Uhr scheitert TLS).
- Reihenfolge pro Update: pull → stop → `app.db`-Backup (Datei-Kopie) →
  up → Health-Check (`/api/health`, Timeout 60 s) → Erfolg melden bzw.
  Rollback. Die letzten 2 DB-Backups bleiben liegen.

### Datenbank-Migrationen (der versteckte Kern)

Heute: `prisma db push` (kein Migrationsverlauf). Für OTA **zwingend** auf
committete Migrationen umstellen:

1. `prisma migrate dev` einführen; Baseline-Migration für den v1.0.11-Stand.
2. Container-Entrypoint: `prisma migrate deploy` vor dem App-Start — jedes
   Update bringt die SQLite-DB deterministisch auf Stand, egal von welcher
   Basisversion.
3. Regel: Migrationen nur additiv/rückwärtskompatibel innerhalb eines
   Rollback-Fensters (die :previous-Version muss mit dem neuen Schema starten
   können, sonst greift das DB-Backup).

## 3. Entscheidungen & Empfehlungen

| Frage | Optionen | Entscheidung |
|---|---|---|
| Artefakt-Verteilung | (a) GHCR-Registry (Layer-Delta ~50–150 MB/Update) · (b) R2-Tarballs (~400–600 MB voll, dafür ohne Registry-Auth) | ✅ **(b) R2-Tarballs** (entschieden 2026-07-03): kein öffentlicher Registry-Katalog, keine Geräte-Auth, gleiche `docker load`-Mechanik wie der First-Boot. Trade-off bewusst akzeptiert: voller Download pro Update. Alte Releases in R2 prunen (letzte ~5 behalten + jeweils die neueste pro Basisversion) |
| Manifest-Hosting | Cloudflare R2 + Worker vs. eigener VPS | **Cloudflare** (Free-Tier, PoPs in Zürich/Frankfurt/Wien/München → schnell in DACH, R2 ohne Egress-Kosten) |
| Telemetrie/Check-in-API (Phase 2) | Cloudflare Worker + D1 vs. Hetzner-VPS | **Hetzner CX22, Falkenstein/Nürnberg** (~5 €/Mt.) — DSGVO-sauber in DE, und derselbe VPS trägt später die v3-License-API |
| OS-Sicherheitspatches | Voll-Image-A/B (Mender/RAUC) vs. `unattended-upgrades` | **`unattended-upgrades`** für Debian-Patches; A/B-OS-Updates sind für ein Wanddisplay Overkill. Katastrophenfall = SD neu flashen (dokumentierter Weg) |
| Update-Kanäle | sofort alle vs. stable/beta + staged rollout | Phase 1: nur `stable`. Phase 2: `beta`-Kanal (eigene Geräte + Pilotkunden) + `rollout.percent` für gestaffelte Verteilung |

**Koexistenz mit der Webseite:** `familyboard.ch`/`www` = Webseite (z. B.
Cloudflare Pages), `updates.familyboard.ch` = Manifeste + Host-Bundles,
`api.familyboard.ch` = reserviert für License/Telemetrie. Kein Konflikt.

## 4. Kosten

**Laufend (monatlich):**

| Posten | MVP (Phase 1) | mit Phase 2 |
|---|---|---|
| Cloudflare (DNS, Worker, R2) | 0–1 € | 0–1 € |
| GitHub Actions (arm64-Build via QEMU, ~15 min/Release) | 0 € (im Free-Kontingent) | 0 € |
| Hetzner VPS CX22 (Telemetrie + spätere License-API) | — | ~5–8 € |
| **Summe** | **< 2 €/Mt.** | **< 10 €/Mt.** |

R2-Speicher: ~0,5–0,6 GB pro Release; Free-Tier = 10 GB → mit Pruning
(letzte ~5 Releases) dauerhaft kostenlos, darüber 0,015 $/GB-Monat.
Skaliert bis in die Tausende Geräte praktisch ohne Mehrkosten — R2 berechnet
**keine Egress-Gebühren**, egal wie viele Geräte den Tarball laden; nur der
VPS würde irgendwann eine Stufe größer.

**Einmalig:** keine Hardware/Lizenzen — nur Entwicklungszeit (unten).

## 5. Aufgaben & Aufwand

### Phase 0 — Voraussetzung (~1 Tag) ✅ erledigt
- [x] **Prisma auf `migrate` umstellen**: `0_baseline` (v1.0.11-Stand) + `scripts/docker-migrate.mjs` als Container-Entrypoint — erkennt `db push`-Bestandsdatenbanken und baselined sie automatisch, dann `migrate deploy`. Ersetzt das gefährliche `db push --accept-data-loss` im Docker-CMD.
- [x] `Installation.appVersion` + `updateChannel` Felder (Migration `20260703000001`); `APP_VERSION` als Docker-Build-Arg (`build-image.sh` reicht `$VERSION` durch), Sync in `getOrCreateInstallation()`

### Phase 1 — MVP „Geräte updaten sich" (~5–7 Tage)
- [x] **Signing-Tool** `tool/sign-release.mjs` (keygen/sign/verify, Ed25519). Krypto-Round-Trip offline verifiziert: sign → openssl-verify (Geräte-Pfad) → Manipulations- + Falscher-Key-Test korrekt abgelehnt.
- [x] **`familyboard-updater`**: Host-Script + `service`/`timer`/`path`-Units + `updater.env`. Signaturprüfung (openssl), Versionsvergleich (`sort -V`), Bundle-SHA-256, DB-Backup, Health-Check, Rollback auf `:previous`, `bad-versions`-Merkliste, flock. `bash -n` sauber.
- [ ] CI-Release-Pipeline: Tag → arm64-Build → Tarball-Export (`-o type=docker` + gzip, wie `build-image.sh`) → R2-Upload → Manifest generieren + signieren (1–1,5 T) — **braucht R2-Creds**
- [ ] `updates.familyboard.ch`: R2-Bucket + Worker/Custom-Domain (0,5 T) — **braucht Cloudflare-Zugang**
- [ ] Settings-UI: aktuelle Version, „Nach Updates suchen" (schreibt `data/update-request`), Update-läuft-Anzeige, Release-Notes — bewusst **ohne** Deaktivierungs-Toggle (1 T)
- [ ] pi-gen-Integration: Updater + Units + Public Key in die Basisversion backen, Timer/Path aktivieren, `current-version` seeden → **neue Basis `v1.1.0`** (0,5 T) — **braucht den echten Release-Key**
- [ ] End-to-End-Test am echten Pi: Basis flashen → OTA auf latest → Rollback provozieren (1 T)

### Phase 2 — Flottenbetrieb (~3–5 Tage)
- [ ] Kanäle `stable`/`beta` + `rollout.percent` (gestaffelt ausrollen)
- [ ] Check-in-Telemetrie: Gerät meldet `installationId`, Version, Erfolg/Fehler an `api.familyboard.ch` (Hetzner; minimaler Datensatz, DSGVO-konform)
- [ ] Mini-Flotten-Dashboard: welche Version läuft wo, Fehlerquote pro Release
- [ ] Push-Hinweis auf dem Display: „Update verfügbar — heute Nacht wird installiert"

### Phase 3 — Härtung (~2–4 Tage)
- [ ] `unattended-upgrades` für Debian-Security-Patches (im pi-gen-Stage aktivieren)
- [ ] Updater-Self-Update über signiertes Host-Bundle (zweistufig)
- [ ] Anti-Rollback + „bad version"-Merkliste; Doku Notfall-Reflash
- [ ] Synergie v3: Update-Check-in und License-Check-in auf denselben API-Endpunkt legen

**Gesamt: ~11–17 Entwicklungstage**, davon MVP (Phase 0+1) ~6–8 Tage.

## 6. Sicherheit & DSGVO

- Nur ausgehende Verbindungen (443) — kein offener Port auf dem Gerät.
- Zwei Schichten: TLS **und** Ed25519-Manifest-Signatur (Key offline halten,
  z. B. nur in CI-Secret + lokalem Backup).
- Artefakte per SHA-256-Digest gepinnt; Versionen monoton (kein Downgrade
  durch Replay alter Manifeste).
- Telemetrie-Minimalprinzip: Geräte-ID (`installationId`), Version, Zeitstempel,
  Erfolg/Fehler. Keine Nutzerdaten, keine IP-Speicherung über Logs hinaus.
  Hosting DE (Hetzner). Datenschutzhinweis auf familyboard.ch ergänzen.
- Restrisiko dokumentieren: Wer den privaten Release-Key besitzt, kann die
  Flotte aktualisieren → Key-Rotation über Host-Bundle vorsehen.

## 7. Entscheidungen (alle geklärt, 2026-07-03)

1. ~~GHCR vs. R2-Tarballs~~ → ✅ **R2-Tarballs**.
2. ~~Auto-Update default?~~ → ✅ **Immer an, nicht deaktivierbar.** Kein
   Opt-out in den Settings; die UI zeigt Version, Release-Notes und den
   Hinweis „Update wird heute Nacht installiert". Sicherungsnetz statt
   Opt-out: Health-Check-Rollback (Phase 1) + gestaffelter Rollout (Phase 2).
3. ~~VPS jetzt oder später?~~ → ✅ **Hetzner-VPS erst mit Phase 2**
   (Telemetrie/Dashboard; trägt später auch die v3-License-API). Das MVP
   läuft vollständig auf Cloudflare.
