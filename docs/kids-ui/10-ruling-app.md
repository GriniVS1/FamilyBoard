# Ruling: Kinderfreundliche Gestaltung, Übernahme in die Flutter-App

**Stand:** 02.10.2026.

**Quelle:** Wall-Umbau aus PR #144, ausgeliefert als OTA v1.1.36 und v1.1.37 und auf dem Pi bestätigt.

**Zweck:** Die App (`mobile/**`) übernimmt dieselbe Bildsprache und dieselben Interaktionsregeln wie die Wall. Ein Kind soll beide Oberflächen gleich verstehen.

**Verbindlichkeit:**
- **MUSS** ist verbindlich.
- **SOLL** gilt, sofern es auf dem Handy sinnvoll ist. Abweichungen werden begründet.
- Dieses Ruling ist die Kurzfassung. Bei Detailfragen gilt der Wall-Code; die Pfade stehen jeweils dabei.

Hintergrund und Begründungen:
- [03-plan.md](03-plan.md): Entscheidungen E1–E13.
- [02-design-direction.md](02-design-direction.md): Design.
- [08-review-round-4.md](08-review-round-4.md) und [06-review-second-reviewer.md](06-review-second-reviewer.md): Reviews.

## Handoff-Assets (fertig zum Übernehmen)

| Datei | Inhalt |
|---|---|
| `docs/kids-ui/handoff/tokens.json` | Alle 62 Farb-Tokens als Hex und HSL, jeweils hell und dunkel. Generiert aus `src/app/globals.css`. |
| `docs/kids-ui/handoff/pictos/{light,dark}/<name>.svg` | 59 Piktogramme als statische SVGs mit aufgelösten Farben, `viewBox 0 0 64 64`, ohne CSS. Direkt mit `flutter_svg` nutzbar. |
| `docs/kids-ui/handoff/pictos-manifest.json` | Je Motiv: `category`, kanonisches `emoji`, Labels de/en/fr/it, SVG-Pfade. Dazu `emojiToPicto` (245 Emoji, Wert = Liste möglicher Motive). |
| `docs/kids-ui/handoff/resolve-fixtures.json` | 62 Paritätsfälle `(icon, title) → expected` für Aufgaben und Termine. Die Dart-Portierung muss alle exakt treffen. |

Die Assets werden nicht von Hand gepflegt. Ändern sich Motive oder Tokens an der Wall, erzeugt der Wall-Agent sie neu.

---

## R1 Farben und Tokens

- **R1.1 MUSS:** Farben kommen nur aus `tokens.json`, z. B. als `ThemeExtension`. Kein Hex direkt im Widget-Code. Hell und dunkel sind gleichwertig.
- **R1.2 MUSS:** Pro Personenfarbe (`peach mint sun sky lilac rose teal sand`) gibt es drei Stufen:
  - `accent-<c>`: kräftig, für Ring, Fortschritt, Haken und erledigte Karte;
  - `accent-<c>-tint`: weich, für grosse Flächen wie Spalte und Picto-Kachel;
  - `accent-<c>-ink`: Text und Icons auf Tint, Kontrast ≥ 4.5:1.
- **R1.3 MUSS:** Status nie nur über Farbe. Die Personenfarbe zeigt Zugehörigkeit; Form und Symbol zeigen den Status (siehe R4).
- **R1.4 MUSS:** Fehler und Löschen nutzen `danger`, `danger-tint` und `danger-ink`, Erfolg nutzt `success`. Rot bzw. Rose ist für Fehler und Löschen reserviert. Fokus nutzt `focus`. Text auf kräftigem Akzent ist `on-accent`.

Kernwerte (hell / dunkel):

| Token | Basis | Tint | Ink |
|---|---|---|---|
| bg | `#F9F6F1` / `#10121E` | | |
| surface | `#FFFFFF` / `#181B2A` | | |
| ink / muted | `#1B203C` / `#F2EEE9` · `#606876` / `#A5ABB6` | | |
| peach | `#FC895F` / `#F58C66` | `#FFE6DB` / `#472C24` | `#842F15` / `#FFCDB8` |
| mint | `#54C993` / `#63C597` | `#DBF5E8` / `#223A2F` | `#115F40` / `#B6EDD1` |
| sun | `#FFC933` / `#F7C845` | `#FFF2C7` / `#3D341F` | `#7B460A` / `#FFEAA3` |
| sky | `#56B3F0` / `#65B6EC` | `#DDF0FD` / `#223544` | `#134D86` / `#B9E2FD` |
| lilac | `#AA8DEC` / `#B29BE9` | `#EEE8FC` / `#352B4A` | `#4C2E8A` / `#DCCFFC` |
| rose | `#F27DA0` / `#EE8CA9` | `#FDE2EA` / `#482832` | `#8C2145` / `#FECDDC` |
| teal | `#36BFBA` / `#4ABFBB` | `#D7F4F3` / `#1E3838` | `#0A595C` / `#ADEBE7` |
| sand | `#D2AE7F` / `#CAA87D` | `#F5EBDB` / `#3D3429` | `#684527` / `#F0DDC2` |
| success | `#259D59` / `#47C27C` | `#DAF6E6` / `#1E382A` | `#0F5C33` / `#ADEBC8` |
| danger | `#E22834` / `#EF616B` | `#FFE5E7` / `#442224` | `#931A22` / `#FFC2C6` |
| focus · on-accent | `#1952F0` / `#66BFFF` · `#151A32` / `#0F1324` | | |

## R2 Typografie, Formen, Abstände

- **R2.1 MUSS: Kinder-Typoskala.** Geist für Titel, Inter für Text, keine neuen Fonts.

  | Stufe | Grösse / Zeilenhöhe | Gewicht |
  |---|---|---|
  | `kidLabel` | 14/20 | 600 |
  | `kidBody` | 16/24 | 500 |
  | `kidTitle` | 18/24 | 600 |
  | `kidTitleLg` | 20/28 | 600 |
  | `kidHeading` | 28/36 | 600 |
  | `kidNumber` | 24 | 700, tabellarische Ziffern |

  Kinder-Text ist **nie kleiner als 14**.
- **R2.2 MUSS:** Aufgabentitel umbrechen auf **höchstens 2 Zeilen** und werden **nie mit "…" auf ein Wort gekürzt**. Lange Wörter dürfen umbrechen.
- **R2.3 MUSS: Radien.**

  | Element | Radius |
  |---|---|
  | Spalte bzw. Gruppenfläche | 32 |
  | Aufgabenkarte | 24 |
  | Picto-Kachel | 16 |
  | Knöpfe, Chips, Avatare | rund |

  "Drückbar" heisst: 2-px-Kante plus weicher Schatten (`shadow-pop`). Gedrückt: 2 px nach unten, Schatten innen.
- **R2.4 MUSS: Touch-Ziele.** Mindestens **48 dp**, Kinder-Hauptaktionen mindestens **64 dp**, zwischen zwei Zielen mindestens **8 dp**. Kein Bedienelement, das nur unsichtbar oder nur per Long-Press, Wischen bzw. Hover erreichbar ist.

## R3 Piktogramme

- **R3.1 MUSS:** Aufgaben, Termine, Navigation, Tageszeiten und Rückmeldungen zeigen die SVGs aus `handoff/pictos`, keine nackten Emoji und keine Material-Icons. Je nach Theme `light` oder `dark`. Gross genug: Karte 48 (Handy), Navigation 32, Kopf und Leer- bzw. Fehlerzustand 80–120.
- **R3.2 MUSS:** Die Zuordnung portiert `src/components/pictos/resolve.ts`, also `resolveTaskPicto` und `resolveEventPicto`, samt `emoji-map.ts` und `suggest.ts` nach Dart.
  - **Reihenfolge:** expliziter Name (`picto:water` / `water`) → spezifisches Titel-Keyword → Emoji **derselben Kategorie** → schwaches Keyword → `null`.
  - **Rückfall bei `null`:** neutrales Bild, z. B. ein Stern oder das Kalenderblatt in Personenfarbe.
  - **Kategorie:** Aufgabenkarten zeigen nur Motive der Kategorie `task`, Termine nur `event`. Tageszeit- und Nav-Motive erscheinen nie auf Karten.
  - **Pflicht:** Unit-Test gegen alle Fälle in `resolve-fixtures.json`.
- **R3.3 MUSS:** Wer in der App eine Aufgabe anlegt oder ändert, speichert in `icon` das **kanonische Emoji** aus dem Manifest, nie den Motivnamen. Wall und ältere Clients bleiben so kompatibel.
- **R3.4 SOLL:** Die Karte "als Nächstes" spielt ihre Handlung kurz vor, etwa ein leichtes Wippen oder Fallen beim Erscheinen und danach alle ca. 12 s. Bei reduzierter Bewegung entfällt das.

## R4 Aufgaben: Zustände und Darstellung

- **R4.1 MUSS: Drei Zustände**, jeweils mit Form, Symbol und Farbe.

  | Zustand | Form | Symbol | Farbe |
  |---|---|---|---|
  | **offen** | flache Karte, rechts ein leerer Ring mit 3 px Rand | ○, **kein ✓** | surface |
  | **als Nächstes** (höchstens 1 pro Person) | 3-px-Rahmen in Personenfarbe | Picto `next` als Badge oben links | wie offen |
  | **erledigt** (heute) | voll gefüllt, Titel durchgestrichen, Ring gefüllt | ✓ | `accent-<c>`, Text `on-accent` |
  | wird gesendet | Karte leicht gedimmt | Ladebogen; bei reduzierter Bewegung drei Punkte | |
  | Fehler | gestrichelter Rahmen | `oops` + ↻ | `danger-tint` |

- **R4.2 MUSS: Kartenmasse Handy.** Höhe ≥ 80, Picto-Kachel 56 mit Picto 48, Ring 56, Titel `kidTitle`. Alle Karten einer Gruppe sind gleich hoch.
- **R4.3 MUSS:** Die **ganze Karte** ist das Abhak-Ziel. Ein Tipp auf eine erledigte Karte vergibt **nie** erneut Sterne, sondern öffnet den Rückgängig-Toast (R5).
- **R4.4 MUSS: Tageszeiten.**
  - **Phasen** aus der Gerätezeit: `MORNING` 05:00–10:59, `DAY` 11:00–16:59, `EVENING` 17:00–23:59, `NIGHT` 00:00–04:59. Quelle: `src/lib/time-of-day.ts`.
  - **Gruppen:** Morgens (`tod-morning`), Tagsüber (`tod-day`), Abends (`tod-evening`), Jederzeit (`tod-anytime`, für `timeOfDay = null`), in genau dieser Reihenfolge.
  - **Aufklappen:** Die aktuelle Phase und Jederzeit sind offen. Die übrigen Phasen sind zugeklappt, als Chip-Zeile mit Mini-Pictos und ○ bzw. ✓.
  - **Gruppenfortschritt:** eine Segmentleiste, ein Segment pro Aufgabe, gefüllt = erledigt, keine Ziffern.
- **R4.5 MUSS: Regel "als Nächstes".** Zu portieren ist `nextChoreFor` aus `src/lib/chore-state.ts`.
  - Grundmenge: die offenen Aufgaben der Person, in API-Reihenfolge.
  - In der Phase `NIGHT` gibt es keine.
  - Sonst gilt der erste Treffer in dieser Reihenfolge:
    1. die erste mit `timeOfDay` = aktuelle Phase;
    2. die erste ohne `timeOfDay` (jederzeit);
    3. aus früheren Phasen, die jüngste zuerst (Nachholen);
    4. keine.
  - Aufgaben "für alle" sind **nie** "als Nächstes".
  - **Spaltenzustände:** alles erledigt = `celebrate`, nachts = `tod-night`, nur Spätere offen = gedimmtes Phasen-Picto plus `pause`-Badge.
  - Dazu Unit-Tests mit den Fällen aus `src/lib/chore-state.test.ts`.
- **R4.6 MUSS:** Erledigte Karten wandern ans Gruppenende. Ab 2 Erledigten pro Gruppe erscheinen sie als ✓-Streifen aus Mini-Pictos am **Gruppenende**. Ein Tipp auf ein Mini-Picto öffnet den Rückgängig-Toast.

## R5 Rückgängig, Schutz vor Versehen, Rückmeldung

- **R5.1 MUSS:** Rückgängig (↶, Picto `undo`, ≥ 56 dp) gibt es **nur im Toast**, nie auf einer Karte. Beide Wall-Reviewer haben nachgewiesen, dass jedes ↶ auf einer Karte durch einen langsamen zweiten Tipp ausgelöst wird.
- **R5.2 MUSS: Toast auf dem Handy.**
  - Er ist eine opake Leiste über volle Breite, **direkt über der Bottom-Navigation**, Höhe ca. 76.
  - Oben hat er einen **16 dp hohen Streifen, der Tipps schluckt**.
  - ↶ sitzt **links**, nicht unter der Ring-Spalte.
  - Die Liste bekommt unten dauerhaft Polster, damit nichts verdeckt wird.
  - Inhalt: Aufgaben-Picto, Avatar und "+N ⭐".
- **R5.3 MUSS: Fenster.**

  | Auslöser | Dauer |
  |---|---|
  | frisch abgehakt | Toast mit ↶ für **8 s**, mit ablaufendem Countdown-Ring |
  | Tipp auf eine ältere erledigte Karte | **5 s** |

  ↶ erscheint bzw. reagiert erst **600 ms** nach dem Einblenden (`UNDO_ARM_MS`). Kommen zwei Toasts gleichzeitig, behält der ältere den unteren Platz, der neue sitzt darüber, und jeder hat sein eigenes ↶.
- **R5.4 MUSS: Layout bleibt stehen.**
  - Nach einem Abhaken bewegt sich in der Liste nichts unter dem Finger: kein Umsortieren, kein Auf- oder Zuklappen.
  - Erst wenn die Liste **≥ 3 s nicht berührt** wurde **und** das ↶-Fenster zu ist, wird umsortiert.
  - "Als Nächstes" darf sofort springen, aber nur optisch (Rahmen und Badge, ohne Layoutverschiebung).
  - Konstanten: `src/lib/tap-guards.ts`.
- **R5.5 MUSS: Tipp-Sperren.**

  | Situation | Sperre |
  |---|---|
  | andere Karte derselben Liste nach einem Abhaken | **600 ms** |
  | nach einer Kartenbewegung | **600 ms** |
  | nach dem Scrollen | **300 ms** |

  Ein gesperrter Tipp federt kurz ein, löst aber nichts aus. Der Server dedupliziert zusätzlich 5 s; darauf aber nicht verlassen.
- **R5.6 MUSS: Erfolg.**
  - Die Karte füllt sich, ✓ springt herein, Sterne fliegen zum Sternzähler der Person, und ein "+N"-Chip erscheint.
  - Letzte Aufgabe einer Gruppe: `celebrate`.
  - Alles erledigt: grosser Pokal-Zustand.
- **R5.7 MUSS: Fehler.**
  - Die Karte geht zurück auf offen und zeigt ↻.
  - Der Toast zeigt **Aufgaben-Picto + `oops`** und ↻.
  - Darunter steht höchstens eine kurze lokalisierte Zeile für Erwachsene. **Nie rohe Server- oder Exception-Texte.**
- **R5.8 MUSS: Reduzierte Bewegung** (`MediaQuery.disableAnimations`). Keine fliegenden Sterne, kein Konfetti, kein Puls und keine Demo. Zustandswechsel werden zur kurzen Überblendung, der Endzustand ist immer sichtbar.

## R6 Personen, Avatare, Punkte

- **R6.1 MUSS: Avatar.**
  - Emoji bzw. Initiale auf `accent-<c>-tint`, das Emoji füllt **≥ 55 %** des Durchmessers.
  - Ring in Personenfarbe.
  - Optional ein **Tagesfortschritts-Ring** (heute erledigt / heute gesamt).
  - Badge mit der Zahl offener Aufgaben, bei 0 ein ✓ auf `success`.
- **R6.2 MUSS:** Der Sternzähler bei einer Person zeigt den **Punktestand**: alle Punkte seit dem letzten Zurücksetzen durch die Eltern, nicht die Wochenpunkte. Wochenpunkte sind nur Zusatzinfo für Erwachsene. **Abhängigkeit A1** beachten.
- **R6.3 MUSS:** Verwalten ist Admins vorbehalten. Gemeint sind Aufgaben anlegen, bearbeiten und löschen, Wochenzähler und Punkte zurücksetzen. In der App heisst das: nur wenn die Session-Rolle `ADMIN` ist, wie bereits bei `POST /api/mobile/chores`. Kinder-Sessions sehen keine dieser Bedienelemente, auch keine unsichtbaren.
- **R6.4 MUSS: Löschen und Zurücksetzen** laufen immer so:
  - In-App-Bestätigung mit Bild: Picto bzw. Avatar und Badge, z. B. Mülleimer oder ↺;
  - danach, wo technisch möglich, ein Toast mit ↶.
  - Keine System-Dialoge mit reinem Text.

## R7 Navigation und Begriffe

- **R7.1 MUSS: Nav-Pictos und Bereichsfarben.** Inaktiv nur das Picto, aktiv zusätzlich Tint-Pill und Label.

  | Bereich | Picto | Farbe |
  |---|---|---|
  | Heute | `nav-home` | rose |
  | Aufgaben | `nav-tasks` | sun |
  | Kalender | `nav-calendar` | sky |
  | Essen | `nav-meals` | peach |
  | Fotos | `nav-photos` | teal |
  | To-dos | `nav-todos` | mint |
  | Notizen | `nav-notes` | lilac |
  | Einstellungen | `nav-settings` + 🔒-Badge | sand |
  | Mehr | `nav-more` | |

- **R7.2 MUSS:** Kinderbereiche stehen vor Erwachsenenbereichen. **"Aufgaben" steht fest auf Platz 2** nach "Heute". Die Bottom-Navigation hat höchstens 5 Plätze, der Rest liegt hinter "Mehr".
- **R7.3 MUSS: Begriffe wie an der Wall.** "Dashboard" heisst **"Heute"** (Today, Aujourd'hui, Oggi), "Mahlzeiten" heisst in der Navigation **"Essen"** (Food, Repas, Pasti). Picto-Labels kommen aus dem Manifest bzw. aus `src/messages/*.json` → `pictos`.
- **R7.4 MUSS:** Deutsch einheitlich in Schweizer Schreibung: **ss statt ß**.

## R8 Termine

- **R8.1 SOLL:** Jeder Termin zeigt ein Picto aus `resolveEventPicto(null, title)` (Rückfall: Kalenderblatt in Personenfarbe) und den Avatar der Person, ≥ 32.
- **R8.2 SOLL:**
  - Die Heute-Übersicht zeigt **alle** Termine des Tages, gruppiert nach Morgens, Tagsüber und Abends.
  - Vergangene Termine werden abgeschwächt, und zwar über `muted`-Text und eine kleinere Kachel, nicht über `opacity`, damit der Kontrast ≥ 4.5 bleibt.
  - Laufende Termine bekommen Rahmen und Punkt. Ganztägige stehen oben.
- **R8.3 SOLL: Personenfilter.** Tipp auf eine Person zeigt **nur** diese Person; erneuter Tipp oder "Alle" zeigt wieder alle.

## R9 Zustände und Barrierefreiheit

- **R9.1 MUSS: Ladezustand.** Ein Skelett in den Endmassen; niemals "0", "—" oder "Hinzufügen" während des Ladens.
- **R9.2 MUSS: Leer.** Picto `relax` plus ggf. "+" (nur Admin).
- **R9.3 MUSS: Ladefehler.** Picto `oops`, ein grosser ↻ und eine kurze lokalisierte Zeile. Vorhandene Daten bleiben sichtbar.
- **R9.4 MUSS: Semantics.**
  - Jede Karte, jedes ↶ und jeder Avatar hat ein zugängliches Label; Pictos daneben sind dekorativ und ausgeschlossen.
  - Fokus ist sichtbar, mit einem Ring von 3–4 dp in `focus`.
  - Kontrast Text ≥ 4.5:1.

## Abhängigkeiten zur Wall-API (macht der Wall-Agent)

| # | Was | Stand |
|---|---|---|
| A1 | Punktestand in der Mobile-API: `balance` und `since` pro Person (z. B. im Chores-Payload) sowie Übersicht, Zurücksetzen und Rückgängig unter `/api/mobile/points…` (Bearer, Reset nur Admin) | **fehlt**. Die Wall hat es nur unter `/api/points` ohne Mobile-Auth. |
| A2 | `timeOfDay` in `/api/mobile/chores` | ✓ vorhanden (additiv) |
| A3 | Abhaken bzw. Rückgängig für die eigene Person: `POST` / `DELETE /api/mobile/chores/[id]/complete` | ✓ vorhanden. Rückgängig löscht die heutige Erledigung der Session-Person. |
| A4 | "Heute" gilt in Lokalzeit des Boards (Container-TZ seit v1.1.37) | ✓ |

Bis A1 da ist, zeigt die App weiter die Wochenpunkte. Der Sternzähler wechselt zum Punktestand, sobald A1 verfügbar ist.

## Abnahme (wie an der Wall)

- **Textlos-Test:** Screenshots mit ausgeblendeten Texten. Prüfen, ob die fünf Fragen ohne Lesen beantwortbar sind:
  1. Erkennt ein Kind seine eigenen Aufgaben?
  2. Versteht es die Handlung ohne Text?
  3. Sieht es, was als Nächstes kommt?
  4. Kann es abschliessen und versehentliches Abhaken korrigieren?
  5. Bleibt die Ansicht bei vielen Aufgaben übersichtlich?
- **Doppeltipp-Test:** Doppeltipp mit 300 ms und mit 800 ms auf eine Karte ergibt genau **1** Erledigung, kein Rückgängig und keine fremde Aufgabe.
- **Paritäts-Tests:** `resolve-fixtures.json` vollständig grün; Phasen- und "als Nächstes"-Logik getestet.
- **Darstellung:** hell, dunkel und reduzierte Bewegung geprüft; alle Touch-Ziele ≥ 48 (Kinder ≥ 64).
- Keine Aussage "kindgerecht nachgewiesen", solange nicht mit Kindern getestet wurde.
