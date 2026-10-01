# 01 – UX-Analyse: Kinderabläufe der Wall-App

Stand: 30.09.2026, Branch `feat/kid-friendly-ui`. Grundlage: Code in `src/**` (inkl. laufender Backend-Änderung `completionsToday`, `timeOfDay`, Doppeltipp-Dedupe), Vorher-Screenshots, eigene CDP-Screenshots und DOM-Messungen gegen die Demo auf `http://localhost:3100`.

**Gültigkeit:** Alle Aussagen zur Verständlichkeit sind **heuristisch plausibel**. Mit Kindern wurde nichts getestet.

**Belege:**
- `before/…` bezieht sich auf `docs/kids-ui/before/`.
- `ux/…` bezieht sich auf `…/scratchpad/ux/`. Diese Dateien sind temporär. Den Befehl zum Neuerzeugen findest du in Abschnitt 4.
- `datei:zeile` bezieht sich auf den Stand dieses Commits.

**Personas:**
- **K4:** 4-jähriges Kind, kann nicht lesen, kennt den eigenen Avatar (🦄 Mia) und Farben.
- **E:** Elternteil, richtet Aufgaben ein.

**Schwere:**
- **K** = blockiert das Kind oder verursacht Datenverlust
- **H** = hoch
- **M** = mittel
- **N** = niedrig

---

## 1. Ist-Abläufe und Hindernisse

### (a) "Welche Aufgaben habe ich heute?" (K4)

Ist, Wand 1280×800:
1. Dashboard: Das Widget "Aufgaben" zeigt 4 farbige Kacheln mit Avatar und ✓-Knopf. Der Name ist vollständig verdeckt.
2. Das Kind findet den Bereich "Aufgaben" in der Seitenleiste nur über ein Stern-Linien-Icon mit Textlabel.
3. `/chores` zeigt drei Spalten: Mama, Papa, Mia. Leo steht darunter und ist nur durch Scrollen erreichbar.
4. Das Kind sucht die eigene Spalte über einen kleinen Avatar und liest die Karten über Emoji und abgeschnittenen Text.

| ID | Hindernis | Beleg | S |
|---|---|---|---|
| H-01 | Kein Tagesbezug: Es werden immer alle Aufgaben gezeigt, ohne Tageszeit und ohne "heute erledigt". | `chore-row.tsx:54-126`, `before/wall-chores.png` | K |
| H-02 | Eigene Spalte ausserhalb des Bildschirms: Wand: Leo-Kopf bei y = 1422 px (Viewport 800), "Für alle" bei y = 1998. Handy: Mia bei y = 716, Leo bei 1766. Ursache: Raster `xl:grid-cols-3` (`chores-view.tsx:295`), Reihenfolge `createdAt`, Eltern zuerst (`queries.ts:178-180`). | Messung `ux/m-wall-chores.png`, `before/wall-chores.png`, `before/phone-chores.png` | K |
| H-03 | Avatar-Emoji ist nicht mitskaliert: ca. 16 px Emoji im 48-px-Kreis. Das eigene Zeichen ist schwer zu erkennen. | `member-avatar.tsx:36-39`, `before/wall-chores.png` | H |
| H-04 | Titel abgeschnitten: 19 von 20 Titeln an der Wand gekürzt, sichtbare Titelbreite nur **59 px** ("Wass…", "Zähn…"). Ursachen: `truncate` sowie ein unsichtbarer 48-px-Stift, der Platz belegt. | `chore-row.tsx:73`, `:95-106`, `ux/now-full-wall-chores.png` | H |
| H-05 | Zwei Karten "Zähne putzen" (morgens/abends) bei Mia sehen identisch aus, weil Tageszeit im UI fehlt. | `ux/now-full-wall-chores.png` | H |
| H-06 | Leere Eltern-Spalten werden auf Mias Höhe (ca. 1050 px) gestreckt. Grosse leere Farbflächen verdrängen Leo nach unten. | `ux/now-full-wall-chores.png` | M |
| H-07 | Dashboard-Widget: Name und "0/1 Sterne" sind **0 px** breit, ganz vom ✓-Knopf verdeckt. Aufgaben selbst sind nicht sichtbar. | `widget-chores.tsx:179-212`, `before/wall-dashboard.png`, Messung | H |
| H-08 | Fortschritt vergleicht Wochensterne mit einem Tagesziel (Summe der Punkte je einmal): "2/14", Balken bedeutungslos. | `chores-view.tsx:139-147`, `weekly-progress-bar.tsx:21`, `widget-chores.tsx:196-198` | M |

### (b) "Ich habe Wasser getrunken → abhaken" (K4)

Ist:
1. Das Kind findet 💧 in der eigenen Spalte.
2. Es tippt den runden ✓-Knopf (48 px).
3. Fünf Sterne à 20 px fliegen 0,6 s.
4. Die Karte bleibt unverändert, darunter erscheint der Text "1× diese Woche" (umbrochen auf 3 Zeilen).

| ID | Hindernis | Beleg | S |
|---|---|---|---|
| H-09 | **Kein Erledigt-Zustand.** Mia hat "Wasser trinken" heute erledigt (laut `completionsToday`), die Karte sieht aber aus wie offen. | `chore-row.tsx:95-124`, `ux/now-wall-chores.png` | K |
| H-10 | Der Knopf für "offen" zeigt bereits ein ✓. Offen sieht also aus wie erledigt. Bei To-dos ist der offene Ring dagegen leer: inkonsistent. | `chore-row.tsx:123` vs. `todo-row.tsx:87-95` | H |
| H-11 | Erfolg ist klein und kurz: 20-px-Sterne, 0,6 s, keine "+N", kein Flug zum eigenen Zähler, kein Hinweis auf den nächsten Schritt. | `star-burst.tsx:18-20`, `:48`, `:70-72` | M |
| H-12 | Beliebig oft abhakbar. Der Server dedupliziert nur 5 s (`src/lib/chores.ts:4`). Sterne lassen sich "farmen". | Code | H |
| H-13 | Unsichtbarer, aber antippbarer Stift direkt links neben ✓ (opacity 0). **20 unsichtbare Knöpfe** gemessen. Ein Fehltipp öffnet den Textdialog "Aufgabe bearbeiten" mit "Löschen". | `chore-row.tsx:95-106`, Messung | K |
| H-14 | "+" (Aufgabe anlegen, für Eltern) ist genauso gross und gleich gestaltet wie ✓. Im Textlos-Test ununterscheidbar. | `chores-view.tsx:415-426`, `ux/notext2-wall-chores.png` | H |
| H-15 | Pfad über das Dashboard: ✓ öffnet eine lange Textliste "Als erledigt markieren" (Mia: 12+ Einträge, ohne Status). Nach der Wahl gibt es keinen Burst und keine Rückmeldung. Fehler werden still zurückgerollt. | `widget-chores.tsx:239-293`, `:125-127`, `ux/dashpick-wall-dashboard.png` | H |

### (c) Versehentlich abgehakt → korrigieren (K4)

Ist: Es gibt **keinen Weg**. Das Backend hat zwar `DELETE /api/chores/[id]/completions/[completionId]`, aber kein Client nutzt es (`grep completionId src/components` findet nichts).

| ID | Hindernis | Beleg | S |
|---|---|---|---|
| H-16 | Kein Rückgängig in der Wand-UI. Fehlsterne bleiben die ganze Woche. | grep, `chores-view.tsx` | K |
| H-17 | Der Fehler-Toast ist reiner Text, 3 s, kein Symbol. Ein Kind bemerkt ihn nicht. | `chores-view.tsx:149-155`, `:357-365` | M |

### (d) Unzugewiesene Aufgabe "Für alle" erledigen: Wer war's? (K4)

Ist:
1. Das Kind scrollt ans Seitenende (Wand y = 1998, Handy y = 2284).
2. Es tippt ✓.
3. Ein Dialog öffnet: Titel "Wer hat es gemacht?" plus ein Satz.
4. Das Kind tippt eine Kachel (Avatar 40 px + Name).
5. Die Sterne erscheinen hinter dem geschlossenen Dialog, die Karte bleibt offen.

| ID | Hindernis | Beleg | S |
|---|---|---|---|
| H-18 | "Für alle" liegt ganz unten, weit ausserhalb des Viewports. | Messung | H |
| H-19 | Der Dialog ist textlastig, die Aufgabe erscheint nicht als Bild. Avatare nur 40 px. | `chores-view.tsx:575-604`, `ux/who-wall-chores.png`, `ux/who-phone-chores.png` | H |
| H-20 | Der Kopf erklärt nur per Text ("Antippen zum Eintragen — wer bekommt die Sterne?"), das Lucide-Icon `Users` ist generisch. | `chores-view.tsx:480-494` | M |
| H-21 | Nach der Wahl ist nicht sichtbar, wer es gemacht hat. Die Karte bleibt offen, das nächste Kind tippt erneut. | `chores-view.tsx:242-248` | H |

### (e) "Was passiert heute?": Termine (K4)

Ist, Dashboard um 19:xx: Die Karte "Heute" zeigt "Nichts als Nächstes" und "Nichts geplant. Genieße den Tag." Laut `GET /api/events` gibt es heute aber 3 Termine: Kindergarten 08–12, Fussballtraining 14:30–16, Znacht 18–19.

| ID | Hindernis | Beleg | S |
|---|---|---|---|
| H-22 | Beendete Termine werden ausgefiltert, die Leermeldung ist sachlich falsch. | `widget-today.tsx:63-72`, `:80-90`, `:103-107`, `before/wall-dashboard.png` | H |
| H-23 | Der Ladezustand zeigt dieselbe Leermeldung. | `widget-today.tsx:93-96` | M |
| H-24 | Ein Termin besteht nur aus Text, Uhrzeit als Zahl und einem 10-px-Farbpunkt. Kein Bild, kein Avatar. | `widget-today.tsx:112-133` | H |
| H-25 | Kalender: Wochenansicht als Standard an der Wand. Titel 12 px, Zeit und Name 10 px. Auf dem Tablet "Kind erg…", "Za…". | `event-block.tsx:69-82`, `before/tablet-calendar.png` | M |
| H-26 | **Personenfilter invertiert:** Sind alle aktiv und das Kind tippt 🦄 Mia, verschwinden Mias Termine (Kindergarten, Schwimmen). | `member-filter.tsx:20-26`, `ux/filter-mia2-wall-calendar.png` | H |
| H-27 | Tipp in eine leere Stunde öffnet das Formular "Neues Ereignis" (8 Felder). | `view-week.tsx:124-130`, `view-day.tsx:107`, `ux/slot2-wall-calendar.png` | H |
| H-28 | Keine "Jetzt"-Linie im Tages- und Wochenraster. | `view-week.tsx`, `view-day.tsx` | M |

### (f) Zwischen Bereichen navigieren (K4)

| ID | Hindernis | Beleg | S |
|---|---|---|---|
| H-29 | Nur Textlabels und abstrakte Linien-Icons à 20 px (ChefHat, ListTodo, StickyNote, Star). Im Textlos-Test bleiben dünne graue Umrisse. | `nav-icons.tsx:14-21`, `nav-item.tsx:36`, `:56`, `ux/notext-wall-dashboard.png` | H |
| H-30 | Handy: 7 Ziele à 50 px, Abstand 4 px. Labels "Dashboard" (57 px) und "Mahlzeiten" (58 px) sind breiter als ihr Ziel und berühren die Nachbarn (0–2 px). "To-dos" bricht zweizeilig um. | `app-shell.tsx:163-177`, `nav-item.tsx:24-40`, `before/phone-chores.png`, Messung `ux/mnav-phone-chores.png` | H |
| H-30b | Auch an der Wand liegen die Sidebar-Einträge nur **4 px** auseinander (`gap-1`). Das Mess-Snippet meldet 6 Paare. | `app-shell.tsx:105`, Mess-Snippet 4.3 | M |
| H-31 | Kinder- und Erwachsenenbereiche sind gleichrangig gemischt: To-dos, Notizen und Einstellungen neben Aufgaben. | `app-shell.tsx:74-82` | M |
| H-32 | Aktiver Bereich nur als hellgraue Fläche `ink/5`. | `nav-item.tsx:32`, `:50-52` | M |
| H-33 | Fokusring an Nav-Links fehlt ganz. Sonst nur `ring-ink/20`, kaum sichtbar. | `nav-item.tsx:45-55`, `button.tsx:9` | M |
| H-34 | Theme-Umschalter doppelt (Topbar und Sidebar), für Kinder ohne Nutzen, lädt zum Spielen ein. | `app-shell.tsx:125-128`, `:146-149` | N |
| H-35 | Lizenz-Banner: 60 px Text auf jeder Seite, das sind 7,5 % der Wandhöhe. Die Ziele "Aktivieren" (99×36) und "Ausblenden" (36×36) sind kleiner als 48 px. | `app-shell.tsx:154-156`, `before/wall-*.png` | N |

### (g) Eltern legen eine neue Aufgabe an (E)

Ist:
1. Tipp auf "Neue Aufgabe".
2. **Titel** tippen (Pflichtfeld, Bildschirmtastatur).
3. Person wählen.
4. Symbol aus 12 Emoji wählen, Standard ist "Keines".
5. Sterne über einen Schieberegler 1–10 setzen.
6. Speichern.

| ID | Hindernis | Beleg | S |
|---|---|---|---|
| H-36 | Text steht zuerst und ist Pflicht, obwohl das Bild die Bedeutung trägt. Tippen an der Wand heisst Bildschirmtastatur. | `chore-dialog.tsx:90-93`, `:136-153` | H |
| H-37 | Nur 12 Emoji, Standard "Keines". Die Karte zeigt dann ✨. Emoji der Demo-Aufgaben (💧🪥🧸👟) sind nicht wählbar. | `types.ts:66-79`, `chore-dialog.tsx:208-222`, `chore-row.tsx:68` | H |
| H-38 | Keine Tageszeit wählbar (API-Feld `timeOfDay` ist neu), `rrule` ist immer `null`. | `chore-dialog.tsx:97-103` | H |
| H-39 | Der Schieberegler 1–10 hat eine 2-px-Spur und ist auf Touch ungenau. | `chore-dialog.tsx:251-260` | M |
| H-40 | Platzhalter auf Englisch: "e.g. Empty the dishwasher". | `chore-dialog.tsx:143`, `ux/new-wall-chores.png` | N |
| H-41 | Löschen über `window.confirm` (nativ, reiner Text). Gleiches Muster in `event-dialog.tsx:338`, `note-dialog.tsx:119`, `notes-view.tsx:171`, `photos-view.tsx:146`, `recipe-dialog.tsx:150`. | `chore-dialog.tsx:115` | M |
| H-42 | Keine Vorschau, wie das Kind die Karte sieht. | – | N |

### (h) Viele Aufgaben: Mia mit 12, Leo mit 5 (K4)

| ID | Hindernis | Beleg | S |
|---|---|---|---|
| H-43 | Keine Gruppierung, keine Sortierung nach Tageszeit oder Status, Reihenfolge nur `createdAt`. Mias Spalte ist ca. 1050 px hoch. | `chores-view.tsx:441-453`, `ux/now-full-wall-chores.png` | H |
| H-44 | Ungleiche Kartenhöhen (74 px vs. 102 px), weil "1× diese Woche" umbricht. | `chore-row.tsx:87-91`, Messung | M |
| H-45 | Der Dashboard-Picker listet alle Aufgaben einer Person plus "Für alle" als scrollende Textliste. | `widget-chores.tsx:142-146`, `:256-287` | M |

### (i) Laden, leer, Fehler (K4 + E)

Die Fehlerbelege entstanden echt: Um 19:22 lieferte `/api/chores` HTTP 500, weil die Backend-Änderung noch lief.

| ID | Hindernis | Beleg | S |
|---|---|---|---|
| H-46 | **Laden sieht aus wie "keine Aufgaben"**: leere Spalten mit "Aufgabe hinzufügen" und "—". Bei einem Fehler bleibt das über die 3 Retries (ca. 7 s) stehen. | `chores-view.tsx:258`, `:292-327`, `:431-439`, `ux/err-wall-chores.png` | H |
| H-47 | Die rohe Prisma-Fehlermeldung erscheint auf Englisch im UI, ohne ↻. Darunter stehen trotzdem leere Spalten und "0 diese Woche". | `chores-view.tsx:40-53`, `:283-290`, `ux/err12-wall-chores.png` | H |
| H-48 | Dashboard-Fehler: rosa Text, kein ↻. | `widget-chores.tsx:164-167`, `ux/err12-wall-dashboard.png` | M |
| H-49 | Leerzustand textlastig. Die Dashboard-Leermeldung verweist auf den nicht existierenden Pfad "/aufgaben". | `chores-view.tsx:530-553`, `de.json:190` | M |
| H-50 | Globale Fehlerseite auf Englisch ("Something went sideways"). | `src/app/error.tsx:19-28` | M |
| H-51 | Kein `prefers-reduced-motion`: Die Suche nach `reduced` oder `MotionConfig` in `src` bleibt ohne Treffer. | `globals.css`, `star-burst.tsx` | M |

### Querschnitt: Erwachsenen-Funktionen, die Kinder unbeabsichtigt auslösen

| ID | Hindernis | Beleg | S |
|---|---|---|---|
| H-52 | **To-do löschen:** In jeder Zeile rechts sitzt ein unsichtbarer, antippbarer Mülleimer. Er löscht sofort, ohne Nachfrage, ohne Rückgängig. | `todo-row.tsx:214-226`, `todos-view.tsx:192-194`, `before/wall-todos.png` (leerer Bereich rechts) | K |
| H-53 | Foto löschen: Knopf oben rechts unsichtbar (mit `confirm`). | `photos-view.tsx:258-268`, `:146` | H |
| H-54 | Notizen: Pin und Menü unsichtbar. Das Pin-Symbol überdeckt den Text ("mo📌gen"). | `note-card.tsx:73-107`, `before/wall-notes.png` | M |
| H-55 | Dialog-Schliessen-Knopf nur 40×40 px, `aria-label="Close"` auf Englisch. | `dialog.tsx:51-58` | M |
| H-56 | Kein Schutz beim Anlegen, Ändern oder Löschen von Aufgaben, To-dos, Terminen, Notizen und Fotos. `requireAdminPin` gilt nur für settings, members und system. | grep `src/app/api` | H |

**Nebenbefunde (Erwachsene, nicht kinderkritisch):**
- Mahlzeiten zeigen "MON/TUE" und "28 Sep – 4 Oct" in der deutschen UI (`week-plan.tsx:89`, `:117`, `before/wall-meals.png`).
- To-do zeigt "Oct 2" (`todo-row.tsx:61`).
- Tablet: Die Uhr stösst an den Kartenrand, die Wetter-Tageszeile überlappt (`before/tablet-dashboard.png`), die Ganztags-Zeile im Kalender ist verschoben (`before/tablet-calendar.png`).
- Die Woche beginnt in UTC (`queries.ts:16-35`), "heute" dagegen in Lokalzeit (`getTodayRange`). Montag 00:00–02:00 zählt dadurch zur Vorwoche.

---

## 2. Vereinfachte Soll-Abläufe

### 2.0 Soll je Ablauf (Tipps ab Startbildschirm)

| Ablauf | Soll | Tipps |
|---|---|---|
| (a) | Wand, `/chores`: Alle Personen stehen nebeneinander, die Karte "als Nächstes" ist oben sichtbar. Vom Dashboard: Tipp auf den eigenen Avatar öffnet den Fokus-Modus. | 0 bzw. 1 |
| (b) | Tipp auf den Ring: erledigt, Sterne fliegen, die Markierung springt weiter. | 1 |
| (c) | ↶ an der Karte oder im Toast (innerhalb 10 s). Danach: Karte antippen, dann ↶. | 1 bzw. 2 |
| (d) | Ring auf der "Für alle"-Karte tippen, dann im Bilddialog den eigenen Avatar. Die Karte zeigt danach den Avatar-Stempel. | 2 |
| (e) | Dashboard-Zeitleiste "Heute" ohne Tippen. Im Kalender: eigener Avatar zeigt nur meine Termine. | 0 bzw. 1 |
| (f) | Gegenständliche, farbige Kachel; Kinderbereiche oben bzw. zuerst. | 1 |
| (g) | "Bearbeiten 🔒", PIN, "+", dann Bild → Person → Tageszeit → Sterne → Speichern. Der Titel wird vorbefüllt. | 5 + PIN |
| (h) | Tageszeit-Gruppen, erledigte ans Ende, Fokus-Modus. | 0 bzw. 1 |
| (i) | Laden: Skelett. Fehler: Bild plus ↻. | 1 für ↻ |

### 2.1 Zustandsmodell pro Aufgabe

**Zustände:**
- `offen`
- `als Nächstes` (höchstens eine Karte pro Person)
- `erledigt` (für heute)

**Definitionen:**
- **Heute:** Wie der Server es liefert, `today.start` bis `today.end` in Lokalzeit.
- **erledigt(c):** `completionsToday.some(x => x.choreId === c.id)`. Das gilt für zugewiesene und "Für alle"-Aufgaben. Bei "Für alle" zeigt `x.memberId` den Stempel.
- **Phase aus der Wand-Uhr** (Konstanten zentral in `src/lib/time-of-day.ts`; später konfigurierbar, siehe P2):

| Phase | Zeit | Symbol |
|---|---|---|
| MORNING | 05:00–10:59 | Sonnenaufgang |
| DAY | 11:00–16:59 | Sonne |
| EVENING | 17:00–23:59 | Mond |
| NIGHT | 00:00–04:59 | Mond mit Zzz; keine Markierung "als Nächstes" |

**Regel "als Nächstes"** (pure Funktion `nextChoreFor(member, chores, completionsToday, now)`, mit Unit-Tests):

```
offen = Aufgaben der Person (memberId == person), nicht erledigt, Reihenfolge = API (createdAt asc)
phase = phaseOf(now)
wenn phase == NIGHT          → next = null            (Zustand "Schlafenszeit")
next = erste offene mit timeOfDay == phase
    ?? erste offene mit timeOfDay == null            ("jederzeit")
    ?? erste offene aus früheren Phasen, jüngste zuerst (DAY vor MORNING)   (nachholen)
    ?? null
wenn next == null und offen nicht leer → Zustand "Pause" (Symbol der nächsten Phase, gedimmt)
wenn offen leer                        → Zustand "Alles geschafft"
```

**Weitere Regeln:**
- "Für alle"-Aufgaben werden **nie** als Nächstes markiert, damit Geschwister nicht darum konkurrieren.
- Neu berechnen jede Minute (Tick wie `topbar-clock.tsx`), bei jedem Daten-Update und nach Abschliessen oder Rückgängig.

### 2.2 Abschliessen mit einem Tipp, geschützt vor Versehen

**Karte, drei Zonen:**
- Piktogramm links: Tipp spielt die Demo-Animation.
- Titel in der Mitte: ohne Aktion.
- **Ring rechts, ≥ 64 px:** einzige Abschluss-Aktion.

**Schutz vor Versehen:**
- **Trennung:** Anlegen und Bearbeiten sind im Kinder-Modus nicht vorhanden (2.12). Neben dem Ring gibt es kein anderes Ziel.
- **Scroll-Toleranz:** Nur `click` zählt, also nur ein Tipp ohne Wischen. Wird innerhalb von 300 ms nach einem Scroll getippt, passiert nichts.
- **Idempotenz:** Tipp auf eine erledigte Karte vergibt keine Sterne mehr, sondern zeigt ↶ (2.3). Zusätzlich greift das Server-Dedupe von 5 s.
- **Rückgängig immer möglich** (2.3). Deshalb braucht es weder langes Drücken noch einen Bestätigungsdialog.

**Optimistisch:** Der Zustandswechsel erfolgt in ≤ 150 ms. Die Completion-ID aus der POST-Antwort (`completion.id`) wird für Rückgängig gespeichert.

### 2.3 Rückgängig ohne Lesen

- **0–10 s nach dem Abschliessen:**
  - An der Karte erscheint neben dem gefüllten ✓ ein runder **↶-Knopf** (≥ 56 px) mit einem schrumpfenden Ring als Countdown. Bei reduzierter Bewegung ist der Ring statisch.
  - Gleichzeitig erscheint ein Toast **unten mittig** mit Avatar, Piktogramm, "+N ⭐" und ↶. Unten ist die Position für Kinder erreichbar.
  - **1 Tipp** macht den Abschluss rückgängig.
- **Danach bis Tagesende:** Tipp auf die erledigte Karte, dann erscheint ↶ für 5 s. Also 2 Tipps. Das schützt vor versehentlichem Rückgängig, etwa durch Geschwister.
- **Wirkung:** `DELETE /api/chores/[id]/completions/[completionId]`. Die Karte wird wieder offen, die Sterne fliegen zurück bzw. der Zähler zählt herunter. Kein Tadel-Symbol.
- Ältere Tage sind nur im Eltern-Modus korrigierbar (später).

### 2.4 Erfolgsrückmeldung und nächster Schritt

1. Der Ring füllt sich in der Personenfarbe mit einem weissen ✓. Die Karte wird in der Personenfarbe getönt (/50), das Piktogramm bekommt ein ✓-Badge.
2. **Sterne fliegen vom Ring zum Sternzähler am Avatar** der Person, dazu "+N" als grosser Stern mit Zahl. Der Zähler "pulst" einmal.
3. Nach ≤ 1 s rutscht die Karte ans Gruppenende. Die Markierung "als Nächstes" springt auf die nächste Karte, mit Pfeil, der zweimal pulsiert.
4. Letzte Karte der Phase erledigt: Der Gruppenkopf zeigt "geschafft" (Pokal plus Phasensymbol).
5. Letzte Karte des Tages erledigt: grosse Karte "Alles geschafft" mit Avatar, Tagessternen und Konfetti. Bei reduzierter Bewegung erscheint alles statisch.
6. Ton: optional, standardmässig aus (P2).

### 2.5 Fehlerrückmeldung: freundlich und wiederholbar

- **Abschliessen schlägt fehl:**
  - Die Karte geht zurück auf offen, am Ring erscheint ein Wolken-/Stecker-Badge und **↻** (≥ 56 px).
  - Der Toast zeigt Piktogramm, Wolke und ↻, bleibt stehen bis zum Tipp und höchstens 15 s.
  - ↻ wiederholt denselben POST.
  - Darunter steht eine kleine, lokalisierte Erwachsenenzeile ("Keine Verbindung"). **Nie die rohe Servermeldung.**
- **Laden schlägt fehl:**
  - Illustration (Stecker oder Wolke) mit einem grossen ↻ (≥ 64 px) und einer Zeile Erwachsenentext.
  - Sind letzte Daten vorhanden, bleiben sie sichtbar und bekommen ein Wolken-Badge im Kopf.
  - Keine leeren Spalten, kein "0", kein "Aufgabe hinzufügen".
- **Laden:** Skelett-Karten in den Endmassen, pulsieren nur ohne reduzierte Bewegung. Avatare sind sofort da, weil sie serverseitig als `initialMembers` kommen.

### 2.6 "Nur meine Aufgaben": Fokus-Modus über den Avatar

- **Einstieg:** Tipp auf einen Avatar in der Avatarleiste (Kopf von `/chores`) oder im Dashboard führt zu `/chores?member=<id>`.
- **Darstellung:**
  - Nur diese Person: grosser Avatar (96 px) mit Fortschrittsring (heute erledigt/gesamt) und Sternzähler.
  - Karten ≥ 112 px, an der Wand 2 Spalten.
  - Offene "Für alle"-Aufgaben stehen als kleine Gruppe am Ende.
- **Die anderen Avatare bleiben** klein und gedimmt in der Leiste. Ein Tipp wechselt die Person.
- **Zurück** auf vier Wegen:
  1. Knopf **"Alle"** (Gruppen-Symbol mit drei Köpfen, ≥ 64 px) links in der Avatarleiste, immer im ersten Viewport.
  2. Den eigenen Avatar erneut tippen.
  3. Automatisch nach 120 s ohne Berührung sowie beim Bildschirmschoner.
  4. Browser-Zurück (dank URL).

### 2.7 Übersicht bei vielen Aufgaben

- **Wand-Layout:**
  - Alle Personen **nebeneinander**, Spalten ≥ 260 px, jede Spalte scrollt intern, der Kopf ist sticky.
  - Bei mehr als 4 Personen: horizontales Snap-Scrollen, die Avatarleiste zeigt immer alle.
  - Personen ohne Aufgaben heute erscheinen als schmale Avatar-Spalte.
  - Keine Höhenstreckung der Raster-Zeilen.
- **Gruppen pro Person:**
  - Reihenfolge fix: Morgen, Tag, Abend, Jederzeit (Symbol: halbe Sonne/halber Mond).
  - Aufgeklappt sind die aktuelle Phase und "Jederzeit". Andere Phasen sind eingeklappt als Chip-Zeile (Mini-Piktogramme mit ○/✓), ein Tipp klappt sie auf.
- **Innerhalb einer Gruppe:**
  - "Als Nächstes" oben, dann die offenen, dann die erledigten.
  - Ab 2 erledigten fallen diese zu einem "✓-Streifen" aus Mini-Piktogrammen zusammen. Die Mini-Piktogramme bleiben antippbar für ↶.
- **Feste Kartengrössen:**
  - Wand: Höhe 96 px, Piktogramm 56 px, Titel 18 px, max. 2 Zeilen (`line-clamp-2`).
  - Handy: 80 px, Piktogramm 48 px.
  - Wochenzähler ("1× diese Woche") nur im Eltern-Modus.
- **Zähler als Punkte** (●●○) statt Zahlen im Gruppenkopf.

### 2.8 Navigation

- **Kinderbereiche:** Heute, Aufgaben, Kalender, Essen, Fotos.
- **Erwachsenenbereiche:** To-dos, Notizen, Einstellungen (unten bzw. hinter "Mehr").

| Bereich | Motiv (gegenständlich, farbig) | statt |
|---|---|---|
| Heute (Dashboard) | Haus mit Sonne | Lucide `Home` |
| Aufgaben | gefüllter gelber Stern mit ✓, wie die Belohnung | `Star`-Umriss |
| Kalender | Kalenderblatt mit **heutiger Tageszahl** (dynamisch) | `Calendar` |
| Essen | Teller mit Gabel und Löffel | `ChefHat` |
| Fotos | Polaroid mit Sonne und Berg (P2: echtes Familienfoto) | `Image` |
| To-dos | Klemmbrett mit Liste (Erwachsene) | `ListTodo` |
| Notizen | gelber Zettel mit Pin | `StickyNote` |
| Einstellungen | Zahnrad mit Schloss-Badge | `Settings` |

**Grösse und Position je Gerät:**
- **Wand 1280×800:**
  - Icon-Leiste links, 104 px breit, statt Sidebar mit 240 px. Das spart 136 px für Spalten.
  - Kinder-Kacheln 88×80 px mit Piktogramm 44 px und Label 13 px (1 Zeile).
  - Aktiver Bereich: gefüllte Kachel in Bereichsfarbe plus 4-px-Balken links.
  - Erwachsenenbereiche unter einem Trenner, 64 px, einfarbig.
- **Tablet 768:** gleiche Leiste, 96 px.
- **Handy 390:**
  - Bottom-Nav mit **5 Plätzen**: Heute, Aufgaben, Kalender, Essen, **Mehr** (4-Kachel-Symbol).
  - Je ≥ 64 px breit und ≥ 64 px hoch, Piktogramm 28 px, Label 12 px, einzeilig.
  - "Mehr" öffnet ein Sheet mit 2×2 Kacheln à 96 px: Fotos, To-dos, Notizen, Einstellungen.
- **Theme-Umschalter** nur noch in den Einstellungen. Die Topbar zeigt Uhr plus aktuelles Phasensymbol.
- Die Nav-Konfiguration (Bereiche ausblenden) bleibt. Die Reihenfolge Kinder vor Erwachsenen ist fix.

### 2.9 Dashboard als "Heute"-Übersicht

1. **Zeile 1, immer im ersten Viewport: Avatarleiste**
   - Pro Person: Avatar 88 px an der Wand (Handy 64 px) mit **Fortschrittsring heute**.
   - Darunter das Piktogramm "als Nächstes" (48 px) bzw. Pokal oder Mond.
   - **Ein Tipp** führt zum Fokus-Modus. Die eigenen Aufgaben sind so mit einem Tipp erreichbar.
2. **Zeile 2:** Zeitleiste "Heute" (2.10), "Essen heute" als Bild, Wetter (bestehende Icons). Die Uhr wird kleiner.
3. **Darunter, für Erwachsene:** To-dos, Notizen.
4. Den heutigen Text-Picker "✓ → Liste" (`widget-chores.tsx:239-293`) **entfernen**. P2: Ein Tipp auf das "als Nächstes"-Piktogramm schliesst direkt ab, mit ↶-Toast.

### 2.10 Termine heute

**Piktogramm aus dem Titel:**
- Beginnt der Titel mit einem Emoji, gewinnt das Emoji. Ist dafür ein Piktogramm gemappt, wird dieses gezeigt.
- Sonst Schlüsselwortsuche: Wortanfang, ohne Gross-/Kleinschreibung, ohne Akzente, in de/fr/it/en.
- Ohne Treffer: Kalenderblatt in Personenfarbe.

| Schlüsselwörter (Auszug) | Piktogramm |
|---|---|
| Kindergarten, Kita, Chindsgi, Schule, école, scuola, school | Schulhaus bzw. Rucksack |
| Schwimm*, natation, nuoto, swim | Schwimmer/Wellen |
| Fussball, Training, foot, calcio, soccer | Ball |
| Zahnarzt, dentiste, dentista, dentist | Zahn |
| Arzt, Kinderarzt, médecin, medico, doctor | Stethoskop |
| Geburtstag, anniversaire, compleanno, birthday | Torte |
| Znacht, Zmittag, Zmorge, Essen, dîner, cena, dinner | Teller |
| Turnen, Sport, Tanz, Ballett | Turnschuh bzw. Tänzerin |
| Musik, Klavier, Gitarre, Flöte | Note |
| Oma, Opa, Grosi, Nonna | Haus mit Herz |
| Einkaufen, courses, spesa | Einkaufstasche |
| Ferien, Reise, vacances, vacanze | Koffer |

**Darstellung als vertikale Zeitleiste:**
- 3 Bänder: Morgen, Tag, Abend, mit Phasensymbol und einer "Jetzt"-Linie.
- Pro Termin: Piktogramm ≥ 40 px, Avatar ≥ 32 px, Titel und Uhrzeit (für Erwachsene).
- **Läuft gerade:** Rahmen plus pulsierender Punkt.
- **Vorbei:** blass und kleiner, bleibt aber sichtbar.
- Ganztägig: Symbol "den ganzen Tag" oben.

**Weitere Regeln:**
- "Nichts geplant" nur bei 0 Terminen heute. Beim Laden erscheint ein Skelett.
- **Kalender:** Tipp auf einen Avatar zeigt **nur** diese Person (Solo). Ein zweiter Tipp oder "Alle" stellt alles wieder her.
- Tipp auf eine leere Stunde tut ausserhalb des Eltern-Modus nichts. Das "+" bleibt sichtbar.
- An der Wand erscheint die "Jetzt"-Linie.

### 2.11 Eltern-Anlegeablauf (ein Dialog, Abschnitte in dieser Reihenfolge)

1. **Bild** (Pflicht)
   - Piktogrammraster, Kacheln 72 px mit Label, gruppiert: Körper & Bad, Anziehen, Aufräumen, Essen & Tisch, Tiere & Pflanzen, Schule & Lernen, Helfen.
   - Dazu "Eigenes Emoji" als Rückfall.
   - Jedes Piktogramm bringt `defaultTitle` (i18n), `defaultTimeOfDay` und `defaultPoints` mit.
2. **Person**
   - Avatare 64 px plus "Für alle" (Gruppensymbol).
   - Vorbelegt aus der Spalte bzw. dem Fokus-Modus. Mehrfachauswahl (eine Aufgabe pro Person): P2.
3. **Tageszeit**
   - 4 Kacheln: Morgen, Tag, Abend, Jederzeit.
   - Vorbelegt aus dem Piktogramm, sonst die zuletzt gewählte.
4. **Sterne**
   - 5 Stern-Knöpfe à 48 px (Tipp auf den n-ten Stern ergibt n). "Mehr…" öffnet einen Stepper bis 10.
   - Das API erlaubt bis 50.
5. **Titel**
   - Automatisch aus dem Bild vorbefüllt, editierbar.
   - Nach einer manuellen Änderung überschreibt ein Bildwechsel den Titel nicht mehr.

**Zusätzlich:**
- Oben eine **Live-Vorschau der Kinderkarte**.
- Speichern ist aktiv, sobald ein Bild gewählt ist. Minimal also: Bild → Speichern, mit Vorbelegungen.
- Löschen (nur beim Bearbeiten): In-App-Dialog mit Mülleimer, "Löschen" und "Abbrechen" statt `window.confirm`.

### 2.12 Erwachsenen-Funktionen: nicht versehentlich, aber nicht versteckt

**Eltern-Modus einschalten:**
- Sichtbarer Knopf **"Bearbeiten 🔒"** oben rechts im Seitenkopf (48 px, sekundär).
- Oben liegt er, weil kleine Kinder an einer Wand vermutlich eher den unteren Bereich erreichen. Das ist heuristisch, keine Garantie.
- Tipp öffnet die PIN: Wiederverwendung von `PinKeypad`/`PinGate` (`src/components/settings/pin-keypad.tsx`, `pin-gate.tsx`) und der bestehenden Admin-PIN.

**Eltern-Modus aktiv:**
- Banner "Eltern-Modus · Fertig" mit Restzeit.
- Endet nach 5 min, nach 120 s ohne Berührung, beim Bildschirmschoner oder über "Fertig".

**Nur im Eltern-Modus sichtbar**, jeweils sichtbare 48-px-Knöpfe, **nichts mit opacity 0**:
- "+" je Spalte und "Neue Aufgabe"
- ✏️ je Karte
- Wochenzähler
- To-do löschen, Foto löschen, Notiz-Menü
- Termin anlegen per Stunden-Tipp
- Rückgängig für ältere Tage

**Kinder-Modus (Standard):** keine dieser Bedienelemente, auch keine unsichtbaren.

**Weitere Regeln:**
- Löschen immer mit In-App-Bestätigung und zusätzlich 10 s ↶-Toast.
- Einstellungen bleiben wie heute hinter der PIN.
- Server-seitiger PIN-Schutz für Web-Schreibrouten: bewusst **nicht** in diesem Umbau. Die Mobile-API bleibt unverändert, `/api/**` wird eventuell von der Web-App genutzt.

---

## 3. Konsistenzregeln

1. **Status wird nie nur über Farbe gezeigt.** Die Personenfarbe zeigt Zugehörigkeit, Form und Symbol zeigen den Status.
2. Ein Symbol hat überall genau eine Bedeutung. Keine zwei Symbole für dieselbe Bedeutung.
3. Kinder-Hauptaktion pro Karte: genau ein Ziel (der Ring), ≥ 64 px, immer rechts.
4. Erwachsenen-Aktionen (+, ✏️, 🗑) erscheinen nie im Kinder-Modus und nie im Stil der Kinder-Aktion.
5. Rückmeldungen stehen **an der Stelle der Handlung** (Karte) und zusätzlich im Toast unten mittig. Nie nur Text.
6. Rot bzw. Rose ist für Fehler und Löschen reserviert.
7. Animationen nur als Bestätigung. Unter `prefers-reduced-motion` gibt es keine.

| Symbol | Bedeutung | Wo verwendet |
|---|---|---|
| ○ leerer Ring, dicker Rand in Personenfarbe | offen, antippen zum Erledigen | Aufgabenkarte rechts, Chip-Zeilen, To-do-Zeile |
| ▶ Pfeil bzw. Puls-Rahmen, 3-px-Rand in Personenfarbe | als Nächstes | genau eine Karte pro Person; Piktogramm im Dashboard-Avatar |
| ● gefüllter Ring mit weissem ✓, Karte getönt, ✓-Badge am Piktogramm | erledigt (heute) | Aufgabenkarte, ✓-Streifen, To-do erledigt |
| ↶ Pfeil zurück im runden Knopf | Rückgängig | erledigte Karte (10 s direkt, danach nach Antippen), Erfolgs-Toast, Lösch-Toast |
| ↻ Kreispfeil | nochmal versuchen | Fehler an der Karte, Fehler-Toast, Ladefehler-Panel |
| Wolke bzw. Stecker | Verbindung fehlt | Fehler-Badge, Ladefehler |
| ⭐ gefüllter gelber Stern + Zahl | Sterne (Belohnung) | Kartenwert, Zähler am Avatar, "+N"-Flug, Nav "Aufgaben" |
| Sonnenaufgang / Sonne / Mond | Morgen / Tag / Abend | Gruppenköpfe, Tageszeit-Wahl im Dialog, Termine, Topbar |
| halbe Sonne + halber Mond | jederzeit bzw. ganztägig | Gruppe "Jederzeit", ganztägige Termine |
| Mond mit Zzz | Schlafenszeit, nichts zu tun | Spalte bzw. Avatar nachts |
| gedimmtes Symbol der nächsten Phase | Pause, kommt später | Spalte, wenn nur spätere Phasen offen sind |
| Pokal (+ Konfetti) | alles geschafft (Phase bzw. Tag) | Gruppenkopf, Spalte, Dashboard-Avatar |
| Avatar: Emoji im Kreis in Personenfarbe, Emoji ≥ 55 % | Person | überall: Spaltenkopf, Dashboard, Termine, Wer-war's, Stempel |
| Fortschrittsring um den Avatar | heute erledigt/gesamt | Dashboard, Spaltenkopf, Fokus-Kopf |
| Gruppe (drei Köpfe) | Für alle bzw. alle Personen bzw. zurück zu allen | "Für alle"-Spalte, "Alle"-Knopf, Kalender "Alle" |
| 🔒 Schloss | Eltern-Bereich (PIN) | "Bearbeiten 🔒", Einstellungen-Badge |
| ✏️ Stift / 🗑 Mülleimer / + | bearbeiten / löschen / neu | nur im Eltern-Modus |
| pulsierender Punkt | läuft gerade | laufender Termin |

---

## 4. Heuristisches Testprotokoll "ohne Text"

### 4.1 Werkzeug und Stolperfallen

Kurzform `SP=/private/tmp/claude-501/-Users-nicolasgrichting-Projects-FamilyBoard/b0cf85df-e1a2-4f90-800d-1766496b03da/scratchpad`.

1. **`cdp-shot.mjs` schneidet `--eval` am ersten `=` ab** (Zeile 8: `split("=")`) und gibt das Ergebnis nicht aus. Deshalb gilt:
   - Snippets für den Original-Treiber enthalten **kein `=` und kein `'`** (Prüfung: `grep -c "=" datei` muss 0 ergeben).
   - Übergabe mit `--eval="$(cat datei)"`.
   - Eine korrigierte Kopie mit Ausgabe des eval-Ergebnisses liegt in `$SP/ux/shot2.mjs` (gleiche Parameter). Sie wird für die Mess-Snippets benötigt.
2. **CSS-Ellipsen bleiben im Textlos-Screenshot sichtbar**, weil sie in der Farbe des Elternelements gezeichnet werden. Ein sichtbares "…" bedeutet also einen abgeschnittenen Titel. Das ist gewollt und dient als Befund.
3. `--full` rendert fixierte Elemente (Bottom-Nav) mitten ins Bild. Die Navigation deshalb nur im Viewport prüfen.
4. Die Uhrzeit bzw. Phase lässt sich über den Treiber nur mit einer Erweiterung testen: vor der Navigation `Emulation.setTimezoneOverride`.
   - Beispiel um 19:30 MESZ: `America/New_York` ergibt 13:30 (Tag), `Pacific/Honolulu` ergibt 07:30 (Morgen).
   - Zusätzlich die pure Funktion aus 2.1 per Unit-Test prüfen.
5. Fehlerzustände: Erweiterung `Network.emulateNetworkConditions({offline:true})` nach dem Laden. Klicks, die Daten schreiben (Erledigen, ↶), nur mit Freigabe des Koordinators.

### 4.2 Textlos-Snippet (exakt, ohne `=`)

Datei `$SP/ux/notext.js`. Das Snippet blendet Buchstaben, Ziffern und Satzzeichen aus. Emoji, SVG und Bilder bleiben, das Layout bleibt identisch.

```js
(function(){document.head.append(Object.assign(document.createElement("style"),{textContent:"x-t{color:transparent!important;text-shadow:none!important}input,textarea,select{color:transparent!important}::placeholder{color:transparent!important}"}));function hide(c,parts){if(parts.length>1){c.replaceWith.apply(c,parts.map(function(p,i){return i%2?Object.assign(document.createElement("x-t"),{textContent:p}):p}))}}function walk(el){Array.from(el.childNodes).forEach(function(c){if(c.nodeType>2&&c.nodeType<4){hide(c,c.data.split(/([\p{L}\p{N}\p{P}]+)/u))}else if(c.nodeType<2&&!["SCRIPT","STYLE","NOSCRIPT","X-T"].includes(c.nodeName)){walk(c)}})}walk(document.body)})()
```

**Varianten:**
- **Graustufen** (Status nicht nur über Farbe): Im `textContent` des Styles `html{filter:grayscale(1)!important}` ergänzen.
- **Ziffern behalten** (Kinder kennen kleine Zahlen): `\p{N}` entfernen.

Hinweis: Das Snippet ersetzt Textknoten. Danach nicht weiter bedienen, sondern die Seite neu laden.

**Dialog öffnen und textlos machen** (Beispiel "Wer war's", ohne `=`; schreibt nichts, weil eine "Für alle"-Aufgabe erst den Dialog öffnet):

```js
new Promise(function(r){setTimeout(r,1500)}).then(function(){Array.from(document.querySelectorAll("button")).find(function(b){return (b.getAttribute("aria-label")||"").includes("Wäsche")}).click();return new Promise(function(r){setTimeout(r,1000)})}).then(function(){/* hier notext.js einfügen */})
```

**Befehle:**

```bash
cd "$SP"
# Referenz mit Text, dann textlos, dann textlos + grau (Graustufen-Variante als notext-gray.js)
node cdp-shot.mjs ux --pages=/,/chores,/calendar --sizes=wall,tablet,phone --prefix=ref --wait=5000
node cdp-shot.mjs ux --pages=/,/chores,/calendar --sizes=wall,tablet,phone --prefix=notext --wait=5000 --eval="$(cat ux/notext.js)"
node cdp-shot.mjs ux --pages=/chores --sizes=wall,phone --prefix=notext --dark --wait=5000 --eval="$(cat ux/notext.js)"
# Fokus-Modus (id per GET /api/members)
node cdp-shot.mjs ux --pages=/chores?member=<MIA_ID> --sizes=wall,phone --prefix=focus --wait=5000 --eval="$(cat ux/notext.js)"
# Reduzierte Bewegung
node cdp-shot.mjs ux --pages=/chores --sizes=wall --prefix=reduced --reduced --wait=5000
```

### 4.3 Mess-Snippet für die Abnahmekriterien (nur mit `shot2.mjs`)

Das Snippet prüft Touch-Ziele < 48 px, Abstände < 8 px, unsichtbare Knöpfe, abgeschnittene Texte, horizontalen Scroll und die y-Position der Personenköpfe.

```js
new Promise(r => setTimeout(r, 1500)).then(() => {
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
  // nur Ziele im Viewport, die nicht von fixierten Leisten verdeckt sind
  const onTop = e => { const r = e.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return false; const h = document.elementFromPoint(x, y); return !!h && (e === h || e.contains(h) || h.contains(e)); };
  const t = [...document.querySelectorAll('button,a[href],[role=button],input,select')].filter(e => vis(e) && onTop(e)).map(e => [e, e.getBoundingClientRect()]);
  const name = e => (e.getAttribute('aria-label') || e.textContent.trim()).slice(0, 24);
  const small = t.filter(([, r]) => r.width < 48 || r.height < 48).map(([e, r]) => `${name(e)} ${Math.round(r.width)}x${Math.round(r.height)}`);
  const tight = [];
  for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) {
    const [a, ra] = t[i], [b, rb] = t[j]; if (a.contains(b) || b.contains(a)) continue;
    const dx = Math.max(0, Math.max(ra.left, rb.left) - Math.min(ra.right, rb.right));
    const dy = Math.max(0, Math.max(ra.top, rb.top) - Math.min(ra.bottom, rb.bottom));
    if (Math.max(dx, dy) < 8) tight.push(`${name(a)} | ${name(b)}`);
  }
  const invisible = [...document.querySelectorAll('button,a[href],[role=button]')].filter(e => vis(e) && getComputedStyle(e).opacity === '0' && getComputedStyle(e).pointerEvents !== 'none').map(name);
  const cut = [...document.querySelectorAll('main *, [role=dialog] *')].filter(e => { if (e.children.length || !/\p{L}/u.test(e.textContent) || !e.getBoundingClientRect().height) return false; const s = getComputedStyle(e); return e.scrollWidth > e.clientWidth + 1 || (s.webkitLineClamp !== 'none' && e.scrollHeight > e.clientHeight + 1); }).map(e => e.textContent.trim().slice(0, 24));
  return { vw: innerWidth, hScroll: document.documentElement.scrollWidth > innerWidth, small, tight: tight.slice(0, 20), tightCount: tight.length, invisible, cut, cutCount: cut.length };
});
```

Aufruf: `node ux/shot2.mjs ux --pages=/chores --sizes=wall,phone --prefix=audit --wait=5000 --eval="$(cat ux/audit.js)" | grep EVAL`

### 4.4 Die fünf Review-Fragen

Jede Frage gilt für Wand, Tablet und Handy sowie für Hell und Dunkel. Ein **Ja** gilt nur, wenn alle genannten Beobachtungen zutreffen. Zwei Reviewer beurteilen unabhängig; bei Uneinigkeit gilt Nein.

**1. Erkennt ein Kind seine eigenen Aufgaben anhand von Avatar und visueller Zuordnung?**

Im Screenshot beobachtbar:
- Jeder Personenkopf zeigt einen Avatar ≥ 56 px (Wand), dessen Emoji ≥ 55 % des Kreises füllt.
- Alle Personenköpfe liegen an der Wand im ersten Viewport (y < 800). Auf dem Handy liegt die Avatarleiste mit allen Personen im ersten Viewport.
- Jede Karte trägt die Personenfarbe (Tönung oder Rand), und keine zwei Personen haben dieselbe Farbe.
- Die "Für alle"-Gruppe ist durch das Gruppensymbol und neutrales Sand klar abgesetzt.

Bei echter Bedienung beobachtbar:
- Tipp auf 🦄 zeigt nur Mias Aufgaben.
- Der "Alle"-Knopf ist sichtbar, ein Tipp darauf zeigt wieder alle.

**2. Ist die erforderliche Handlung ohne Lesen verständlich?**

Im Textlos-Screenshot beobachtbar:
- Jede Kinderkarte hat ein Handlungs-Piktogramm ≥ 56 px.
- Reviewer benennen für ≥ 90 % der Demo-Aufgaben die Handlung nur aus dem Bild.
- Gleiche Handlung zu verschiedenen Tageszeiten ist durch das Gruppensymbol unterscheidbar.
- Pro Karte gibt es genau **ein** hervorgehobenes Bedienelement (Ring).
- Kein "+", "✏️" oder "🗑" ist sichtbar.
- Kein "…" erscheint (siehe 4.1, Punkt 2).
- Navigation: Jede Kachel ist ohne Label einem Bereich zuordenbar (Haus, Stern, Kalenderblatt mit Tageszahl, Teller, Foto).

**3. Ist klar, welche Aufgabe als Nächstes ansteht?**

Im Screenshot beobachtbar:
- Pro Person genau eine Karte mit dem Muster "als Nächstes" (Pfeil plus Rand), oder der Zustand Pause, Geschafft bzw. Schlafenszeit.
- Diese Karte liegt im ersten Viewport der Spalte und gehört laut Regel 2.1 zur aktuellen Phase.
- Das aktuelle Phasensymbol ist in Topbar und Gruppenkopf hervorgehoben.

Bei Uhrzeiten 07:30, 13:30 und 19:30 (Zeitzonen-Override, 4.1 Punkt 4) wandert die Markierung entsprechend. Das Dashboard zeigt dasselbe Piktogramm unter dem Avatar.

**4. Kann das Kind eine Aufgabe einfach abschliessen und eine versehentliche Aktion korrigieren?**

Nur mit Schreibfreigabe auf Demo-Daten; sonst Code-Review plus Zustands-Screenshots.

Bei echter Bedienung beobachtbar:
- **1 Tipp** auf den Ring: Innerhalb von 150 ms wechselt der Zustand zu "erledigt" (Form, Symbol, Farbe). Sterne fliegen zum Avatar-Zähler, "+N" erscheint, ↶ ist sichtbar (≥ 56 px).
- **1 Tipp** auf ↶: Die Karte ist wieder offen, der Sternzähler steht wie vorher, `GET /api/chores` enthält die Completion nicht mehr.
- Erneuter Tipp auf eine erledigte Karte: keine zusätzlichen Sterne.
- Offline: Die Karte kehrt zurück, ↻ ist sichtbar, ↻ nach dem Reconnect gelingt.
- "Für alle": Der Dialog zeigt das Aufgabenbild und Avatare ≥ 72 px, danach trägt die Karte den Avatar-Stempel.

Textlos-Screenshots vor dem Tipp, nach dem Tipp und nach ↶ müssen sich eindeutig unterscheiden, in Graustufen ebenfalls.

**5. Bleibt die Ansicht auch bei vielen Aufgaben übersichtlich?**

Demo: Mia mit 12 Aufgaben. Beobachtbar:
- Wand: alle Personenköpfe plus die Karte "als Nächstes" jeder Person ohne Seitenscroll.
- Aufgaben nach Morgen, Tag, Abend und Jederzeit gruppiert; nur die aktuelle Phase und Jederzeit sind aufgeklappt.
- Erledigte stehen am Ende bzw. als ✓-Streifen.
- Mess-Snippet: alle Karten gleich hoch, `cutCount` = 0 in Karten, `hScroll` = false bei 390 px.
- Handy im Fokus-Modus: Die Karten der aktuellen Phase stehen zuerst, keine Karte ist schmaler als 300 px.

**Protokoll-Ausgabe pro Frage:** Ja oder Nein, Belegdatei(en), Liste der Abweichungen mit AK-Nummer.

---

## 5. Priorisierter Verbesserungsplan

Aufwand: S ≤ ½ Tag, M ≤ 2 Tage, L > 2 Tage. Die Spalte "Löst" verweist auf die Hindernisse aus Abschnitt 1.

### P0 – muss

| # | Massnahme | Datei / Komponente | Aufwand | Löst |
|---|---|---|---|---|
| P0-1 | Pure Logik Zustand und "als Nächstes" plus Phasen, mit Unit-Tests | neu `src/lib/time-of-day.ts`, neu `src/components/chores/chore-state.ts` | M | H-01, H-05 |
| P0-2 | Aufgabenkarte neu: 3 Zustände, Piktogramm (Mapping Emoji → SVG vom Design-Agent), feste Grösse, Titel 2 Zeilen, Ring 64 px, offen ohne ✓, keine Wochenzähler im Kinder-Modus | `chore-row.tsx`, `types.ts` | L | H-04, H-09, H-10, H-44 |
| P0-3 | Rückgängig inline plus Toast (↶), Completion-ID aus POST bzw. `completionsToday`; Idempotenz im UI | `chores-view.tsx`, neu `chores/undo-toast.tsx` | M | H-12, H-16, H-17 |
| P0-4 | Layout Wand: alle Personen nebeneinander, interne Spalten-Scrolls, Tageszeit-Gruppen, Erledigte ans Ende; Avatar-Emoji skalieren | `chores-view.tsx`, `member-avatar.tsx` | M | H-02, H-03, H-06, H-18, H-43 |
| P0-5 | Fokus-Modus `?member=` mit "Alle"-Knopf, Auto-Rückkehr nach 120 s bzw. beim Bildschirmschoner | `chores-view.tsx`, `src/app/chores/page.tsx`, `shell/idle-screensaver.tsx` | M | (a) |
| P0-6 | Eltern-Modus (Kontext plus PIN), kein opacity-0-Bedienelement mehr; +/✏️/🗑 nur im Eltern-Modus; `window.confirm` durch In-App-Dialog ersetzen | neu `shell/parent-mode.tsx`, `settings/pin-keypad.tsx` (reuse), `chore-row.tsx`, `chores-view.tsx`, `todo-row.tsx`, `photos-view.tsx`, `note-card.tsx`, `chore-dialog.tsx` | L | H-13, H-14, H-41, H-52–H-54, H-56 |
| P0-7 | Laden, Leer, Fehler: Skelett, nie "hinzufügen"/"0" beim Laden, freundlicher Fehler mit ↻, keine Rohmeldungen | `chores-view.tsx`, `widget-chores.tsx`, `widget-today.tsx`, `src/app/error.tsx` | M | H-23, H-46–H-50 |
| P0-8 | Navigation: gegenständliche Piktogramme, Kinder vor Erwachsenen, Icon-Leiste Wand/Tablet, Handy 5 Plätze plus "Mehr", aktiver Zustand mit Form | `app-shell.tsx`, `nav-item.tsx`, `shared/nav-icons.tsx` | M | H-29–H-32, H-30b |
| P0-9 | Dashboard "Heute": Avatarleiste mit Tagesring und "als Nächstes", Tipp öffnet Fokus-Modus; Text-Picker entfernen | `widget-chores.tsx`, `src/app/page.tsx` | M | H-07, H-08, H-15, H-45 |
| P0-10 | `prefers-reduced-motion` global (`MotionConfig reducedMotion="user"` plus CSS), sichtbarer Fokusring inkl. Nav-Links | `providers/*`, `globals.css`, `button.tsx`, `nav-item.tsx` | S | H-33, H-51 |

### P1 – soll

| # | Massnahme | Datei / Komponente | Aufwand | Löst |
|---|---|---|---|---|
| P1-1 | Heute-Zeitleiste: alle Termine inkl. vergangener, Piktogramm aus dem Titel, Avatar, Phasensymbol | `widget-today.tsx`, neu `src/lib/event-pictogram.ts` | M | H-22, H-24 |
| P1-2 | ChoreDialog: Bild → Person → Tageszeit → Sterne-Knöpfe → Titel vorbefüllt, Vorschau, `timeOfDay` senden | `chore-dialog.tsx`, `types.ts` | M | H-36–H-40, H-42 |
| P1-3 | "Wer war's" als Bilddialog (Piktogramm 72 px, Avatare ≥ 72 px) plus Avatar-Stempel auf der Karte | `chores-view.tsx` (PickMemberDialog) | S | H-19–H-21 |
| P1-4 | Erfolgsrückmeldung: Flug zum Zähler, "+N", Sprung "als Nächstes", Zustände Geschafft/Pause | `star-burst.tsx`, `chores-view.tsx` | M | H-11 |
| P1-5 | Kalender: Solo-Filter, kein Stunden-Tipp ausserhalb des Eltern-Modus, "Jetzt"-Linie, Avatar und Piktogramm im Block | `member-filter.tsx`, `view-week.tsx`, `view-day.tsx`, `event-block.tsx` | M | H-25–H-28 |
| P1-6 | Tagesfortschritt (erledigt/gesamt heute) statt Wochensterne gegen Tagesziel | `weekly-progress-bar.tsx` → Ring-Komponente | S | H-08 |
| P1-7 | Dialog-Schliessen 48 px, lokalisierte aria-labels | `shared/dialog.tsx`, `theme-toggle.tsx` | S | H-55 |
| P1-8 | i18n-Drift: Platzhalter, Wochentage und Datumsformat, Fehlerseite | `chore-dialog.tsx:143`, `week-plan.tsx:89,117`, `todo-row.tsx:61`, `error.tsx` | S | H-40, H-50 |
| P1-9 | Bildhafte Leerzustände (Aufgaben, To-dos, Fotos) mit einem Aktionsknopf | `chores-view.tsx`, `todos-view.tsx`, `photos-view.tsx` | S | H-49 |
| P1-10 | Theme-Umschalter nur in den Einstellungen, Phasensymbol in der Topbar | `app-shell.tsx`, `topbar-clock.tsx` | S | H-34 |

### P2 – kann

| # | Massnahme | Datei / Komponente | Aufwand |
|---|---|---|---|
| P2-1 | Tipp aufs Piktogramm spielt eine Demo-Animation | Piktogramm-Komponente (Design) | M |
| P2-2 | "Essen heute" als grosses Bild auf dem Dashboard und in der Kinderansicht der Mahlzeiten | neu `widget-meal-today.tsx`, `meals-view.tsx` | M |
| P2-3 | Phasenzeiten und Personen-Reihenfolge konfigurierbar | Einstellungen und Backend | M |
| P2-4 | Wiederholbare Aufgaben mit Tagesziel (z. B. Wasser 3×) | Backend und `chore-state.ts` | L |
| P2-5 | Direkt-Abschliessen "als Nächstes" vom Dashboard-Avatar (mit ↶) | `widget-chores.tsx` | S |
| P2-6 | Ton-Rückmeldung (opt-in), Foto-Avatare | diverse | M/L |
| P2-7 | Lizenz-Banner nur auf Einstellungen bzw. Dashboard | `app-shell.tsx`, `license-banner.tsx` | S |
| P2-8 | Wochenbeginn in Lokalzeit statt UTC | `src/lib/queries.ts:16-35` (Backend) | S |
| P2-9 | Tablet: Uhr-Clipping, Wetterzeile, Ganztags-Versatz | `widget-clock.tsx`, `widget-weather.tsx`, `view-week.tsx` | S |
| P2-10 | Screenshot-Treiber: eval-Parsing, `--tz`, `--offline` (nur Scratchpad) | `$SP/cdp-shot.mjs` | S |

---

## 6. Abnahmekriterien

Alle Kriterien gelten für Hell und Dunkel. Wand = 1280×800, Tablet = 768×1024, Handy = 390×844. Geprüft wird mit der Demo-Familie (Mia hat 12 Aufgaben).

### Aufgabenkarte und Zustände

- **AK-1:** Kartengrösse Wand ≥ 96 px hoch mit Piktogramm ≥ 56×56 px; Handy ≥ 80 px mit Piktogramm ≥ 48 px. Alle Karten einer Spalte sind gleich hoch (Differenz 0 px).
- **AK-2:** Titel sind nie abgeschnitten, sondern höchstens 2 Zeilen umbrochen. Mess-Snippet 4.3: `cutCount` = 0 innerhalb von Karten; im Textlos-Screenshot erscheint kein "…".
- **AK-3:** Offen, als Nächstes und erledigt unterscheiden sich durch **Form + Symbol + Farbe**. Im Graustufen-Textlos-Screenshot ordnen 2 Reviewer alle Karten korrekt zu.
- **AK-4:** Der offene Zustand enthält kein ✓-Symbol.
- **AK-5:** Pro Person sind 0 oder 1 Karte als Nächstes markiert. Die Regel aus 2.1 ist per Unit-Test mit ≥ 8 Fällen abgedeckt: Morgen, Tag, Abend, Nacht, jederzeit, nachholen, nur spätere offen, alles erledigt.
- **AK-6:** Abschliessen braucht 1 Tipp auf den Ring (≥ 64×64 px Wand, ≥ 56 px Handy). Der Zustandswechsel erfolgt in ≤ 150 ms (optimistisch).
- **AK-7:** Ein erneuter Tipp auf eine erledigte Karte erhöht den Sternzähler nicht (UI). Das Server-Dedupe von 5 s bleibt aktiv.
- **AK-8:** Rückgängig braucht innerhalb von 10 s nach dem Abschliessen **≤ 1 Tipp** (↶ ≥ 56 px an der Karte und im Toast), danach bis Tagesende ≤ 2 Tipps. Das ↶-Symbol ist überall identisch und ohne Text verständlich (Frage 4 = Ja).
- **AK-9:** Nach ↶ ist die Karte offen, der Sternzähler steht wieder auf dem Wert vorher, und `GET /api/chores` → `completionsToday` enthält die ID nicht mehr.
- **AK-10:** Erfolg: Die Sterne fliegen zum Zähler der Person, "+N" erscheint. Die Markierung "als Nächstes" steht ≤ 1 s später auf der nächsten Karte. Nach der letzten Karte erscheint der Zustand "Geschafft".
- **AK-11:** Abschliessen offline: Die Karte ist wieder offen und zeigt Fehler-Symbol plus ↻ (≥ 56 px). ↻ sendet denselben Request. Im DOM steht kein roher Server- oder Prisma-Text.
- **AK-12:** Laden: nur Skelett-Karten in den Endmassen. Solange `isLoading` gilt, gibt es 0 Elemente "Aufgabe hinzufügen" und keine "0"/"—"-Zähler.
- **AK-13:** Ladefehler: Illustration plus ↻ (≥ 64 px) plus eine lokalisierte Zeile. Vorhandene Daten bleiben sichtbar.
- **AK-14:** Der Dialog "Wer war's" zeigt das Aufgaben-Piktogramm ≥ 72 px und Avatare ≥ 72 px. Nach der Wahl trägt die "Für alle"-Karte den Avatar-Stempel der Person.

### Übersicht, Layout, Fokus

- **AK-15:** Wand: Alle Personenköpfe und die Karte "als Nächstes" jeder Person liegen bei y < 800 px, ohne Seitenscroll.
- **AK-16:** Gruppen stehen in fester Reihenfolge Morgen, Tag, Abend, Jederzeit. Nur die aktuelle Phase und Jederzeit sind aufgeklappt. Erledigte stehen am Ende der Gruppe bzw. als ✓-Streifen.
- **AK-17:** Handy: `scrollWidth` ≤ 390 auf allen Kinderseiten, also keine horizontale Scrollbar. Die Avatarleiste mit allen Personen liegt im ersten Viewport.
- **AK-18:** Ein Tipp auf den Avatar führt zu einer URL mit `member=` und zeigt nur diese Person. Der "Alle"-Knopf (≥ 64 px) liegt im ersten Viewport. Rückkehr gelingt per "Alle", per erneutem Avatar-Tipp und automatisch nach 120 s ohne Berührung.
- **AK-19:** Dashboard: Die eigenen Aufgaben sind in **1 Tipp** erreichbar. Die Avatare (≥ 72 px Wand, ≥ 56 px Handy) liegen im ersten Viewport und haben einen Tagesring.
- **AK-20:** Der Fortschritt zeigt "heute erledigt / heute gesamt", nicht Wochensterne.
- **AK-21:** Das Avatar-Emoji füllt ≥ 55 % des Kreisdurchmessers, in allen Grössen.

### Termine

- **AK-22:** Das Heute-Widget zeigt alle Termine des Tages; vergangene sind abgeschwächt, aber sichtbar. Die Leermeldung erscheint nur bei 0 Terminen. Der Ladezustand zeigt nie die Leermeldung.
- **AK-23:** Jeder Termin hat ein Piktogramm ≥ 40 px (aus dem Titel oder als Rückfall), einen Avatar ≥ 32 px und ein Tageszeit-Symbol. Ein laufender Termin ist markiert.
- **AK-24:** Kalender: Ein Tipp auf einen Avatar bei "alle aktiv" zeigt **nur** diese Person.
- **AK-25:** Ein Tipp auf eine leere Kalenderstunde öffnet ausserhalb des Eltern-Modus keinen Dialog. An der Wand ist die "Jetzt"-Linie sichtbar.

### Navigation

- **AK-26:** Jeder Nav-Eintrag hat ein gegenständliches, farbiges Piktogramm: ≥ 40 px an Wand und Tablet, ≥ 28 px auf dem Handy. Das Label ist einzeilig, nie breiter als sein Ziel und überlappt nicht.
- **AK-27:** Die Handy-Bottom-Nav hat ≤ 5 Einträge, jedes Ziel ist ≥ 64×64 px gross.
- **AK-28:** Der aktive Bereich ist auch im Graustufen-Screenshot erkennbar, weil er zusätzlich eine Form trägt (gefüllte Kachel bzw. Balken).
- **AK-29:** Kinderbereiche stehen vor den Erwachsenenbereichen. To-dos, Notizen und Einstellungen stehen getrennt unten bzw. hinter "Mehr".

### Allgemein

- **AK-30:** Alle Touch-Ziele sind ≥ 48×48 px und haben ≥ 8 px Abstand zueinander. Mess-Snippet: `small` und `tight` sind leer auf `/`, `/chores` und `/calendar`. Kinder-Hauptaktionen sind ≥ 64 px.
- **AK-31:** Keine Aktion nur per Hover: `invisible` ist leer, es gibt also kein Bedienelement mit opacity 0 und aktiven Pointer-Events.
- **AK-32:** Anlegen, Bearbeiten und Löschen von Aufgaben, To-dos, Fotos, Notizen und Terminen ist nur im Eltern-Modus sichtbar. Der Eltern-Modus braucht den sichtbaren Knopf "Bearbeiten 🔒" plus die PIN und endet nach 5 min bzw. nach 120 s Inaktivität.
- **AK-33:** `grep -rn "window.confirm" src/components` ergibt 0 Treffer. Bestätigungen sind In-App-Dialoge mit Symbol; nach dem Löschen gibt es 10 s ↶.
- **AK-34:** Mit `prefers-reduced-motion: reduce` sind dekorative Animationen aus (Burst, Puls, Konfetti, Shake, Federn), Zustandswechsel erfolgen sofort. Prüfung: Screenshot mit `--reduced` direkt nach der Aktion zeigt den Endzustand ohne Burst-Ebene.
- **AK-35:** Bei `:focus-visible` hat jedes fokussierbare Element (inkl. Nav-Links) einen Ring ≥ 2 px mit Kontrast ≥ 3:1 zum Hintergrund.
- **AK-36:** Auf den Kinderseiten in `de` stehen keine englischen Strings: keine Platzhalter, keine Wochentage oder Monatsnamen, keine aria-labels, keine Fehlerseite auf Englisch.
- **AK-37:** Der Textlos-Test nach Abschnitt 4.4 liefert für alle 5 Fragen **Ja** auf Wand, Tablet und Handy.
- **AK-38:** Eltern-Anlegen: Die Reihenfolge ist Bild → Person → Tageszeit → Sterne → Titel (vorbefüllt). Speichern ist nach der Bildwahl ohne Tastatur möglich, mit ≤ 5 Tipps inklusive Speichern.
- **AK-39:** Die Sterne-Auswahl erfolgt über diskrete Knöpfe ≥ 48 px, nicht über einen Schieberegler.

---

## 7. Offene Punkte

- **Mehrfachaufgaben pro Tag** ("Wasser trinken" 3×): Das Modell hier sagt "1× pro Tag = erledigt". Siehe P2-4.
- **Kinder und Erwachsene unterscheiden:** Es gibt kein Kind/Erwachsen-Flag (`role` ist ADMIN/MEMBER). Die Spaltenreihenfolge bleibt deshalb `createdAt`. Weil künftig alle Spalten nebeneinander stehen, ist die Reihenfolge weniger kritisch.
- **Emoji-Abhängigkeit:** Avatare bleiben Emoji und damit plattformabhängig. Auf dem Mac erscheint Papa 🧔 anders als auf dem Pi.
- **Zeitzone für die Tagesphase:** Die Phase kommt aus der Client-Uhr, "heute" aus der Server-Lokalzeit. Am Kiosk ist das dieselbe Maschine. Auf Handy oder Tablet in einer anderen Zeitzone können die beiden auseinanderlaufen.
