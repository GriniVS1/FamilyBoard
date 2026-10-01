# Kinderfreundliches UI: Abschlussbericht

Branch `feat/kid-friendly-ui`, Stand 01.10.2026, nicht committet. Betrifft die Wall-App (`src/**`). Die Mobile-API und die Flutter-App sind unverändert; einzige Ausnahme ist das zusätzliche Feld `timeOfDay`.

## Dokumente

| Datei | Inhalt |
|---|---|
| [00-brief-and-reference.md](00-brief-and-reference.md) | Auftrag, Annahmen (Zielalter 3–99, Primärpersona 3–7 J.), Dæly-Referenz: beobachtet vs. eigene Vorschläge |
| [01-ux-analysis.md](01-ux-analysis.md) | 57 Hindernisse mit Beleg, Soll-Abläufe, Regel "als Nächstes", Textlos-Testprotokoll, AK-1…AK-39 |
| [02-design-direction.md](02-design-direction.md) | Palette mit berechneten Kontrasten, Komponenten-Spezifikation, Motion, Piktogramm-Stilguide (59 Motive) |
| [03-plan.md](03-plan.md) | Koordinator-Entscheidungen E1–E13 und Zuständigkeiten |
| [04](04-review-round-1.md) / [05](05-review-round-2.md) / [07](07-review-round-3.md) / [08](08-review-round-4.md) | Unabhängiges Review A, Runden 1–4 + Schlussprüfung |
| [06-review-second-reviewer.md](06-review-second-reviewer.md) | Unabhängiges Review B, Runden 2–4 |
| `before/`, `after/`, `compare/` | Screenshots vorher/nachher; `compare/` zeigt jeweils beide nebeneinander |

## Umgesetzte Verbesserungen

- **Eigene Bildsprache:** 59 SVG-Piktogramme in einheitlichem Stil, die die Handlung zeigen (Tropfen fällt ins Glas, Spielzeug fällt in die Kiste, Heft fällt in den Rucksack …).
  - Sie sind in Light und Dark identisch und unabhängig von der Emoji-Schrift der Plattform.
  - Bestehende Emoji-Icons werden automatisch zugeordnet, Titel in de/en/fr/it inkl. Schweizerdeutsch werden erkannt.
  - Beim Speichern bleibt `Chore.icon` ein Emoji, damit die Flutter-App weiter etwas Passendes zeigt.
- **Aufgaben (`/chores`):**
  - Eine farbige Spalte pro Person mit Avatar, Tagesfortschritts-Ring und Sternzähler.
  - Gruppen nach Tageszeit (Morgen/Tag/Abend/Jederzeit), mit Nacht- und "Später wieder"-Zustand.
  - Grosse Karten; die ganze Karte ist das Abhak-Ziel.
  - Drei Zustände, jeweils mit Form + Symbol + Farbe: offen (leerer Ring), als Nächstes (Rahmen, ➜, Bild spielt die Handlung vor), erledigt (gefüllt, ✓, durchgestrichen).
  - Rückmeldung: fliegende Sterne, "+N"-Chip, Pokal bzw. Konfetti bei kompletter Gruppe.
  - Rückgängig über ↶ im Toast unten mittig. Wenn zwei Kinder kurz nacheinander abhaken, hat jedes ein eigenes ↶.
  - Fokus-Modus "nur meine Aufgaben" per Avatar.
  - "Wer war's"-Bilddialog für Aufgaben "für alle".
  - Freundliche Fehler mit ↻, Skelett beim Laden.
- **Schutz vor Versehen:**
  - Das Layout bleibt stehen, solange eine Spalte berührt wird.
  - Tipp- und Layout-Sperren pro Spalte.
  - Serverseitig wird Mehrfachtippen innerhalb von 5 s dedupliziert.
  - ↶ wird erst nach 600 ms aktiv.
- **Eltern-Modus:** "Bearbeiten 🔒" + Admin-PIN. Anlegen geht bildgeführt: Bild → Person → Tageszeit → Sterne, der Titel wird vorbefüllt. Im Kinder-Modus gibt es keine Bearbeiten-Knöpfe.
- **Navigation:**
  - Farbige, gegenständliche Piktogramme mit Labels.
  - Wand und Tablet: 112-px-Leiste. Handy: 5 Plätze + "Mehr".
  - Kinderbereiche stehen vor den Erwachsenenbereichen, "Aufgaben" fest auf Platz 2. "Dashboard" heisst jetzt "Heute".
- **Dashboard "Heute":**
  - Avatarleiste mit Tagesring und dem Bild "als Nächstes"; ein Tipp öffnet die eigenen Aufgaben.
  - Zeitleiste der Tagestermine mit Bild pro Termin, laufendem Termin und Jetzt-Linie.
- **Kalender:**
  - Personenfilter "nur diese Person".
  - Bild und Avatar in jedem Termin, "+N"-Sammelblock bei vielen parallelen Terminen.
  - Nur das Raster scrollt zur aktuellen Uhrzeit.
- **To-dos, Notizen, Fotos, Essen, Einstellungen:**
  - Keine unsichtbaren Knöpfe mehr.
  - Löschen über In-App-Bestätigung bzw. 8-s-Rückgängig; kein `window.confirm` mehr im Code.
  - Lokalisierte Labels, Kontrast-Sweep (`danger-ink`), Touch-Ziele ≥ 48 px (Kinder-Hauptaktionen ≥ 64 px).
- **Global:**
  - Neue Tokens (Tint/Ink je Personenfarbe, success/danger/warning, focus) mit Light/Dark-Parität.
  - Sichtbarer Fokusring, `prefers-reduced-motion` respektiert.
  - Deutsche Texte einheitlich in Schweizer Schreibung (ss).
- **Backend (additiv):**
  - Neues Feld `Chore.timeOfDay`, Migration `20260930171915_chore_time_of_day`.
  - `GET /api/chores` liefert zusätzlich `completionsToday` und `today`.
  - 5-s-Dedupe beim Abhaken, Familienprüfung beim Rückgängig.

## Durchgeführte Tests und Ergebnisse

| Prüfung | Ergebnis |
|---|---|
| Unit-Tests `npm test` (`node --test`): chore-state, time-of-day, undo-guard, tap-guards | **58/58 grün** |
| `tsc --noEmit` | grün |
| Produktions-Build `NODE_ENV=production next build` | grün (exit 0; bekannte, bereits vorhandene PRAGMA-Meldungen beim Build ohne DB) |
| Funktionstest (app-tester) über 5 Runden, echte Bedienung per CDP + API + DB | R1: 27 ok / 6 Bugs · R2: 31 / 1 · R3: 34 / 2 · R4: 19 / 1 · Schluss: 12 / 0. **Alle 10 Bug-Reports `verified`** |
| Konsole | 72 Seitenaufrufe (9 Seiten × Wand/Handy × 4 Sprachen): 0 Fehler/Warnungen, keine rohen i18n-Keys |
| i18n | Schlüssel-Parität de/en/fr/it vollständig |
| Mobile-API | Keine Felder entfernt oder umbenannt; nur `timeOfDay` additiv |
| Doppeltipp-Matrix (echte Touch-Events, Wand/Tablet/Handy, Gesamt + Fokus, Morgen/Tag/Abend) | 32/32 mit genau 1 Erledigung in der DB |
| Textlos-Test (heuristisch, zwei unabhängige Reviewer) | Handlung aus dem Bild erkannt: Runde 1 14/20 → Schluss **20/20** (beide Reviewer) |
| Fünf Review-Fragen (Avatar-Zuordnung, Handlung ohne Lesen, als Nächstes, abschliessen/korrigieren, viele Aufgaben) | Schlussstand: **alle Ja** auf Wand 1280 + 1920, Tablet, Handy (Reviewer A und B) |
| Abnahmekriterien AK-1…AK-39 | erfüllt bis auf AK-6 teilweise (Ring an der 1280-Wand 52 statt 56–64 px; Tippziel ist die ganze Karte) und AK-8 bewusst geändert (E13: ↶ im Toast statt an der Karte) |

Review-Verlauf: Insgesamt wurden 2 Befunde der Stufe S1 und 10 der Stufe S2 gefunden und behoben, unter anderem:
- Ein Doppeltipp machte das Abhaken sofort rückgängig.
- Ein Doppeltipp hakte eine fremde Aufgabe ab, weil sich das Layout unter dem Finger verschob.
- Ein ↶ auf der Karte wurde durch einen langsamen zweiten Tipp ausgelöst.
- Der Toast auf dem Handy überlagerte die Ringe.

Zuletzt waren keine S1/S2 offen, beide Reviewer haben **heuristisch** abgenommen.

## Verbleibende Einschränkungen

- **Keine Tests mit echten Kindern.** Alle Aussagen zur Verständlichkeit sind heuristisch (Textlos-Screenshots, Expertenurteil). Eine Eignung für Kinder ist nicht nachgewiesen.
- **Offene S3-Punkte:**
  - Tablet hochkant zeigt 2 von 4 Personenspalten; der Rest ist per Wischen bzw. Avatar → Fokus erreichbar.
  - Ring an der 1280-Wand 52 px.
  - Eingeklappte Tageszeit-Zeilen zeigen bei Platzmangel "+N".
  - Beim Pyjama-Bild könnten die erhobenen Arme als Jubeln gelesen werden.
  - Die Mindestlänge für Termintitel fehlt.
- **Avatare bleiben Emoji** und sehen damit je Plattform etwas anders aus. Foto-Avatare wären der nächste Schritt.
- **Ein Mal pro Tag = erledigt.** Mehrfach-Aufgaben wie "Wasser 3×" sind nicht modelliert.
- **Zeitzone:** Die Tagesphase kommt aus der Uhr des Geräts, "heute" aus der Serverzeit. Das Docker-Image setzt kein `TZ`; auf dem Pi ist "heute" dann UTC. Für die Schweiz betrifft das nur 00:00–02:00 Uhr, sollte aber mit `TZ=Europe/Zurich` im Image behoben werden.
- **Bereits vorher vorhanden, nicht Teil des Umbaus:**
  - Der Kalender zeigt erst ab 06:00.
  - `GET /api/members` gibt Token-Felder aus; das läuft als separate Aufgabe.
  - Bei offener Bildschirmtastatur geht der erste Tipp auf "Speichern" gelegentlich verloren.
- `/dev/pictos` ist eine Vorschauseite für Entwickler und liefert in Produktion 404.

## Empfehlungen für Tests mit Kindern

1. **Teilnehmende:** 5–8 Kinder je Altersgruppe 3–4, 5–6 und 7–8 Jahre, jeweils mit einem Elternteil, am echten Wand-Gerät in der Familienküche (Höhe und Licht wie im Alltag).
2. **Aufgaben ohne Erklärung:** "Zeig mir deine Aufgaben", "Was musst du als Nächstes machen?", "Du hast Wasser getrunken, zeig es dem Bildschirm", "Oh, das war falsch, mach es wieder weg".
3. **Beobachten statt fragen:**
   - Wo tippt das Kind zuerst?
   - Erkennt es den eigenen Avatar?
   - Benennt es die Handlung nur aus dem Bild?
   - Findet es ↶ im Toast?
   - Bemerkt es den "als Nächstes"-Pfeil?
4. **Messen:** Erfolgsquote ohne Hilfe, Zeit bis zum Abhaken, Fehltipps, Anzahl versehentlicher Erledigungen und Rückgängig-Erfolg.
5. **Besonders prüfen:**
   - Die schwächsten Bilder: Bett machen, Pyjama, Schuhe versorgen.
   - Ob ↶ unten mittig für 3-Jährige erreichbar und verständlich ist.
   - Ob die 600-ms-Sperre bei sehr schnellen Kindern stört.
   - Ob Eltern den Eltern-Modus finden.
6. **Danach:** Bilder und Interaktionen nach den Ergebnissen überarbeiten (nicht mit Text ergänzen) und erneut testen.

## Demo lokal

```bash
DATABASE_URL="file:../data/kids-ui.db" node node_modules/prisma/build/index.js migrate deploy
DATABASE_URL="file:../data/kids-ui.db" node scripts/dev-seed-demo.cjs
PORT=3100 DATABASE_URL='file:../data/kids-ui.db?connection_limit=1' node node_modules/next/dist/bin/next dev -p 3100
```

Das Seed-Skript löscht die Ziel-DB und verweigert alles ausser einer Demo-DB. Die PIN steht im Skript.
