# 03 – Umsetzungsplan (Koordinator)

Grundlage sind [01-ux-analysis.md](01-ux-analysis.md) (Abläufe und AK-1…AK-39) und [02-design-direction.md](02-design-direction.md) (Tokens, Komponenten, Piktogramme). Wo sich beide widersprechen, gilt die Entscheidung hier.

## Entscheidungen

| # | Thema | Entscheidung | Begründung |
|---|---|---|---|
| E1 | Abhak-Ziel | **Die ganze Aufgabenkarte ist der Abhak-Knopf** (≥ 88 px hoch). Der Ring rechts ist nur Zustandsanzeige, 56–64 px. Kein separates Demo-Tippziel auf dem Bild. | Das grösste mögliche Ziel ist für 3-Jährige fehlertoleranter und lässt dem Titel mehr Breite in schmalen Spalten. Das weicht von UX 2.2 und Design TaskCard ab. |
| E2 | Handlungs-Demo | Das Bild der Karte **"als Nächstes" spielt seine Demo-Animation automatisch ab**: beim Erscheinen und danach alle ~12 s. Beim Abhaken spielt das Bild der Karte die Demo einmal. Bei `prefers-reduced-motion` gibt es keine Demo. | Eine visuelle Demonstration ohne Tippen und ohne Lesen: "Was soll ich tun?" |
| E3 | Rückgängig | Nach dem Abhaken erscheint **8 s lang** ein ↶ (UndoButton mit Countdown-Ring) an der Karte **und** im Toast. Danach führt ein Tipp auf eine erledigte Karte dazu, dass ↶ für 5 s erscheint, also 2 Tipps. Ein erledigtes Kärtchen vergibt nie erneut Sterne. | UX 2.3 mit 8 statt 10 s, gemäss Design UndoButton. |
| E4 | Eltern-Modus | Knopf **"Bearbeiten 🔒"** im Kopf von `/chores` öffnet PIN-Pad (bestehende Admin-PIN), danach Eltern-Modus. Er endet nach 5 min, nach 120 s ohne Berührung oder über "Fertig". **Nur Aufgaben-Verwaltung** ist gesperrt: +, ✏️, Löschen, Wochenzähler. **Kein Long-Press** (versteckte Geste). | UX 2.12, eingeschränkt. |
| E5 | To-dos, Notizen, Fotos, Kalender | **Kein PIN.** Das sind Erwachsenenbereiche, die weiter normal bedienbar bleiben. Pflicht: keine unsichtbaren (opacity 0) Bedienelemente; Löschen nur über sichtbaren 48-px-Knopf → In-App-Bestätigung (kein `window.confirm`) → 8 s ↶-Toast, wo die API ein Wiederherstellen erlaubt, sonst nur Bestätigung. Tipp auf leere Kalenderstunde bleibt (Erwachsenen-Kürzel). | Bestehende Funktionen bleiben erhalten; Erwachsene müssen nicht für jeden Eintrag eine PIN eingeben. |
| E6 | Navigation | **Wand/Tablet (≥ md):** schmale Icon-Leiste 112 px, Kachel mit Piktogramm 44–48 px und einzeiligem Label 14 px darunter. Aktiv: Tint der Bereichsfarbe, `shadow-pop` und 4-px-Balken links. **Handy:** Bottom-Nav mit 5 Plätzen (Heute, Aufgaben, Kalender, Essen, Mehr), Picto 32, Label 13–14 px auf allen Plätzen. "Mehr" öffnet ein Sheet mit 2×2 Kacheln à ≥ 96 px. Kinderbereiche stehen vor Erwachsenenbereichen. "Dashboard" heisst jetzt **"Heute"**, "Mahlzeiten" in der Nav **"Essen"**. | UX 2.8 und Design NavTile, Mass aus UX (Platz für Spalten). |
| E7 | `/chores` Layout Wand | Alle Personen nebeneinander, Spalten ≥ 260 px, interner Scroll, sticky Kopf. "Für alle" ist eine eigene neutrale Spalte (Gruppensymbol) am Ende. Bei zu wenig Breite horizontal Snap-Scroll, die Avatarleiste zeigt immer alle. Tageszeit-Gruppen Morgen/Tag/Abend/Jederzeit. Aktuelle Phase und Jederzeit sind aufgeklappt, andere als Chip-Zeile eingeklappt. Erledigte stehen am Gruppenende. | UX 2.7 |
| E8 | "als Nächstes" | Regel exakt nach UX 2.1: pure Funktion mit Unit-Tests; Phasen 05–11 / 11–17 / 17–24 / Nacht. | – |
| E9 | Fortschritt | Tagesfortschritt "heute erledigt / heute gesamt" als Ring um den Avatar. Wochensterne nur als Zahl im Stern-Pill. | UX AK-20 |
| E10 | Farben | Die Personenfarbe zeigt Zugehörigkeit, der Status wird **immer** über Form + Symbol gezeigt. Fehlertexte nutzen `text-danger-ink` statt `text-accent-rose`. | Design §2 |
| E11 | Reduzierte Bewegung | `MotionConfig reducedMotion="user"` global, CSS-Regeln aus `globals.css`. | AK-34 |
| E13 | Ort von ↶ (ersetzt den Kartenteil von E3, Review-Runde 3) | ↶ erscheint **nur im Toast unten mittig**, nie auf einer Karte. Frisch abgehakt: 8 s Toast mit Aufgabenbild, Avatar, "+N ⭐" und ↶. Tipp auf eine ältere erledigte Karte bzw. ein Mini-Bild im ✓-Streifen: derselbe Toast für 5 s. ↶ reagiert erst 600 ms nach dem Erscheinen. Die Karte selbst zeigt nur den Zustand (gefüllt, ✓, durchgestrichen). | Beide Reviewer wiesen unabhängig nach, dass jedes ↶ auf der Kartenfläche durch einen zweiten, langsamen Tipp (0,7–1 s) versehentlich ausgelöst wird (R3-01, B-16). Ein fester Ort ist zudem konsistenter (UX §3, Regel 2). Das weicht bewusst von AK-8 ("an der Karte") ab. |
| E12 | Nicht in diesem Umbau | Mehrfach-Aufgaben pro Tag, Foto-Avatare, Ton, konfigurierbare Phasen, Mahlzeit-Bild auf dem Dashboard (P2), Lizenzbanner verschieben. | Umfang |

## Gemeinsame Bausteine (bereits vorhanden)

- `src/components/pictos` – `Picto`, `PictoDemo`, `usePictoDemo`, `resolvePicto`, `PICTO_META`, i18n `pictos.*`
- `src/components/kids/tone.ts` – `toneOf(color)` liefert literale Tailwind-Klassen je Personenfarbe (`bg`, `tint`, `ink`, `ring`, `stroke` …)
- `src/components/kids/undo-button.tsx` – ↶ mit optionalem Countdown-Ring
- `src/components/kids/kid-toast.tsx` – Toast unten mittig, Erfolg/Fehler, Aktion undo/retry
- `src/components/kids/state-views.tsx` – `EmptyState`, `ErrorState`, `Skeleton`
- `src/components/kids/confirm-dialog.tsx` – In-App-Bestätigung (Löschen) statt `window.confirm`
- `src/lib/time-of-day.ts` – `phaseOf(now)`, `PHASE_ORDER`, `earlierPhases`, `laterPhases` (pure, testbar mit `node --test`)
- i18n `kids.*` (undo, retry, dismiss, add, errorGeneric, offline, loading)
- Backend: `GET /api/chores` → `completionsToday[]`, `today`, `chore.timeOfDay`; `POST …/complete` dedupliziert 5 s; `DELETE /api/chores/[id]/completions/[completionId]`

## Zuständigkeiten (keine Überschneidung)

| Agent | Dateien |
|---|---|
| **FE-Aufgaben** | `src/components/chores/**`, `src/app/chores/**`, `src/components/dashboard/widget-chores.tsx`, `src/components/shared/member-avatar.tsx`, neue Dateien unter `src/components/kids/**` (bestehende nur erweitern, nicht brechen), `src/lib/time-of-day.ts`, `src/lib/chore-state.ts` + Tests, `tsconfig.json`, `package.json` (nur `test`-Script) |
| **FE-Shell** | `src/components/shell/**`, `src/components/shared/**` (ausser `member-avatar.tsx`), `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/error.tsx`, `src/app/loading.tsx`, `src/components/providers/**`, `src/components/dashboard/**` (ausser `widget-chores.tsx`), `src/components/{calendar,todos,notes,photos,meals}/**`, `src/app/{calendar,todos,notes,photos,meals}/**`, `src/components/settings/**` (nur Theme-Umschalter und Farb-Sweep), `src/app/globals.css`, `tailwind.config.ts` |
| Messages | Beide bearbeiten `src/messages/*.json`, **nur in eigenen Namespaces** und immer frisch lesen, dann gezielt editieren. FE-Aufgaben: `chores`, `dashboard.widgets.chores`, `parentMode`. FE-Shell: alle anderen. |

## Vertrag Dashboard

`src/app/page.tsx` (FE-Shell) rendert `<WidgetChores className=… members=… />` (FE-Aufgaben) als **erste Zeile über die volle Breite**. Die Props bleiben gleich: `members: {id, name, color, emoji}[]`. Das Widget wird zur Avatarleiste "Heute": Avatar mit Tagesring und Piktogramm "als Nächstes"; ein Tipp führt zu `/chores?member=<id>`.
