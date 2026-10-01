# 06 – Review zweiter, unabhängiger Reviewer

Stand 30.09.2026, 22:15–22:55 MESZ, Branch `feat/kid-friendly-ui`, Dev-Server `localhost:3100`, Demo-Familie.
`04-review-round-1.md` und `05-*` habe ich nicht gelesen, und ich habe keinen Quellcode geändert.
Alle Aussagen sind heuristisch. Sie ersetzen keinen Test mit Kindern.

Belegordner (Kurzform `RB`): `/private/tmp/claude-501/-Users-nicolasgrichting-Projects-FamilyBoard/b0cf85df-e1a2-4f90-800d-1766496b03da/scratchpad/review-b/`

## Kurzfazit

Der Umbau ist sichtbar gelungen. Die meisten Kriterien sind erfüllt:
- **Zuordnung:** Avatar, Spaltentönung und Personenfarbe tragen die Zuordnung, auch in Dunkel und in Graustufen.
- **Zustände:** Offen, als Nächstes und erledigt sind über Form und Symbol unterscheidbar.
- **Tageszeiten:** Die Phasenlogik stimmt für Morgen, Tag, Abend und Nacht.
- **Fehler und Einstellungen:** Der Offline-Fehler ist bildhaft, der Fokus-Modus inklusive 120-s-Rückkehr funktioniert.
- **Messwerte:** Mess- und Namens-Audits der Kinderseiten sind sauber, und es gibt keine Konsolenfehler.

**Blockierend ist ein Interaktionsfehler (B-01).** Ein Doppeltipp (300 ms) auf dieselbe Stelle schliesst zwei verschiedene Aufgaben ab, und zwar an Wand, Tablet und Handy in der Gesamtansicht. Nach dem ersten Tipp klappt oberhalb eine frühere Tageszeit-Gruppe auf, sodass eine andere offene Karte unter den Finger rutscht.

Wesentlich sind ausserdem drei Punkte:
- An der Wand fehlt ↶ an der Karte (B-02).
- Auf dem Handy liegt die Karte "als Nächstes" im Fokus-Modus am Abend nicht im ersten Viewport (B-03).
- Der Kalender scrollt beim Laden die ganze Seite zur Jetzt-Linie, sodass Wochentage und Personenfilter verschwinden (B-04).

**Abnahme aus meiner Sicht: nein**, weil AK-37 an Frage 4 (alle Geräte) und Frage 3 (Handy) scheitert.

Einschränkungen des Reviews:
1. **Titel vorab bekannt.** Die Titel der 20 Aufgaben kannte ich aus `GET /api/chores`, bevor ich die Bilder benannt habe. Die Benennung "nur aus dem Bild" ist deshalb optimistisch.
2. **Andere Emoji als am Pi.** Headless Chrome auf dem Mac rendert Apple-Emoji, der Pi Noto-Emoji.
3. **Emulierte Touch-Eingabe.** Die Touch-Tipps kommen über CDP `Input.dispatchTouchEvent` und nicht von echter Hardware.
4. **Fremde Testdaten.** Die Spalte von Mama enthielt `TEST …`-Objekte des Funktionstesters, die ich ignoriert habe.
5. **Zwei falsche PIN-Eingaben.** Ich habe den Admin-PIN zweimal absichtlich falsch eingegeben (Rate-Limit 10/min).

Alle meine Abhakungen sind zurückgesetzt, `completionsToday` enthält wieder nur die drei Seed-Einträge.

## Fünf Fragen × Gerät

Light und Dark liefern bei allen Fragen dasselbe Ergebnis, daher je eine Spalte pro Gerät. Die Graustufen-Variante wurde ebenfalls geprüft.

| Frage | Wand 1280×800 (+1920) | Tablet 768 | Handy 390 |
|---|---|---|---|
| 1 Eigene Aufgaben erkennen | **Ja** | **Ja** | **Ja** |
| 2 Handlung ohne Lesen | **Ja** (knapp) | **Ja** (knapp) | **Ja** (knapp) |
| 3 Was ist als Nächstes? | **Ja** | **Ja** | **Nein** (B-03) |
| 4 Abschliessen und korrigieren | **Nein** (B-01, B-02) | **Nein** (B-01, B-02) | **Nein** (B-01) |
| 5 Übersicht bei vielen Aufgaben | **Ja** | **Ja** | **Ja** |

### Frage 1 – eigene Aufgaben erkennen: Ja

- **Avatargrössen:** Personenköpfe haben an der Wand 72 px (Fokus 96 px), auf dem Handy 64 px. Die Emoji-Skalierung beträgt 0,58 (`member-avatar.tsx`), also ≥ 55 %.
- **Lage an der Wand:** Alle Köpfe liegen bei y = 300 und die Avatarleiste bei y = 153 (`RB/measure.txt`).
- **Farben:** Die vier Personen haben vier verschiedene Farben (rose, sky, lilac, mint). "Für alle" ist gestrichelt und in Sand gehalten, mit Gruppensymbol.
- **Graustufen:** Die Zuordnung bleibt über den Avatar im Spaltenkopf erhalten (`RB/a-gray-wall-chores.png`).
- **Echte Tipps:**
  - 🦄 führt zu `?member=…` und zeigt nur Mia und "Für alle".
  - Ein erneuter Tipp auf 🦄 oder auf "Alle" führt zurück zu allen.
  - Nach 120 s ohne Berührung kehrt die Ansicht automatisch zurück (`RB/idle.txt`).
- **Einschränkung:** Auf dem Tablet sind in der Gesamtansicht nur Mama und Papa sichtbar. Mia und Leo liegen rechts ausserhalb und sind nur über Wischen oder den Avatar erreichbar (`RB/a-notext-tablet-chores.png`).

### Frage 2 – Handlung ohne Lesen: Ja, knapp

Die Tabelle zeigt meine Benennung aus dem Bild (`RB/gallery.png`, gemischte Reihenfolge, textlos, 2,2-fach) und danach den Abgleich mit dem Titel.

| # | Nur aus dem Bild | Titel | Treffer |
|---|---|---|---|
| 1, 6 | Glas mit Tropfen → Wasser trinken | Wasser trinken (Mia, Leo) | ja |
| 2, 5 | Bett, Decke mit Bogenpfeil → Bett machen | Bett machen (Mia, Leo) | ja |
| 3, 7 | Pflanze und Giesskanne → Blumen giessen | Blumen giessen / Pflanzen giessen | ja |
| 4 | Kind im Streifen-Pyjama mit Mond, Pfeile nach unten → Pyjama anziehen | Pyjama anziehen | ja (verwechselbar mit #15) |
| 8, 11 | Zahn mit Zahnbürste → Zähne putzen | Zähne putzen (Morgen/Abend) | ja, über Gruppensymbol unterscheidbar |
| 9 | Wasserhahn, Hand mit Seifenblasen → Hände waschen | Hände waschen | ja |
| 10 | Schuhe auf Bank/Regal, Pfeile nach unten → Schuhe hinstellen | Schuhe versorgen | ja |
| 12 | Roter Rucksack → "Rucksack" (Gegenstand, keine Handlung) | Schultasche packen | teilweise |
| 13 | Heft mit Stift → schreiben/malen | Hausaufgaben | ja |
| 14 | Kleiderstapel mit Bogenpfeil → Wäsche falten | Wäsche zusammenlegen | ja |
| 15 | Kind mit T-Shirt, Pfeile nach unten → anziehen | Anziehen | ja (verwechselbar mit #4) |
| 16 | Tisch mit Teller und dampfender Tasse → "essen" | Tisch decken | **nein** |
| 17 | Ball und Teddy fallen in eine Kiste → aufräumen | Spielzeug aufräumen | ja |
| 18 | Offenes Buch mit Sternen → Buch anschauen | Buch anschauen | ja |
| 19 | Hund und Napf mit fallendem Futter → Hund füttern | Hund füttern | ja |
| 20 | Grüne Tonne, Papier fällt hinein → Müll wegwerfen | Müll rausbringen | ja (sinngemäss) |

Ergebnis: 18 von 20 Handlungen erkannt, 1 teilweise (#12), 1 falsch (#16). Das sind 90 % und damit genau die Schwelle. Wegen Einschränkung 1 werte ich das als knappes Ja.

Weitere Beobachtungen:
- **Piktogrammgrössen:** Wand 56 px, Fokus 72 px, Handy 48 px. Die 48 px entsprechen AK-1, liegen aber unter den ≥ 56 px aus 4.4.
- **Bedienelemente:** Pro Karte ist genau ein Ziel hervorgehoben. Auf `/chores` gibt es weder "+" noch 🗑. Der Knopf "Bearbeiten 🔒" zeigt aber einen Stift, siehe B-09.
- **Titel:** Kein "…" im Textlos-Screenshot.
- **Navigation:** Alle Kacheln sind ohne Label zuordenbar (Haus, Stern mit Haken, Kalenderblatt, Teller, Foto; Klemmbrett, Zettel, Zahnrad mit Schloss). In der Textlos-Variante fehlt die Tageszahl, weil das Snippet Ziffern ausblendet.

### Frage 3 – was ist als Nächstes: Wand und Tablet Ja, Handy Nein

Zeitzonen-Override (`RB/tz-*.png`):

| Zeit | Topbar | Mia | Leo | Papa | Mama |
|---|---|---|---|---|---|
| 09:30 Pago Pago | Sonnenaufgang | Zähne putzen | Schultasche | Pause (Mond + Sanduhr) | Jederzeit: Pflanzen giessen |
| 14:30 Denver | Sonne | Hände waschen | Hund füttern | Pause | Pflanzen giessen |
| 22:15 Zürich | Mond | Spielzeug aufräumen | Jederzeit: Wasser trinken | Müll rausbringen | – |
| 02:00 Kolkata | Mond mit Zzz | Schlafenszeit | Schlafenszeit | Schlafenszeit | Schlafenszeit |

Die Werte entsprechen Regel 2.1. Das Dashboard zeigt jeweils dasselbe Piktogramm unter dem Avatar (nachts Mond mit Zzz).

An der Wand liegen alle Karten "als Nächstes" bei y ≤ 683. Auf dem Handy liegt die Karte im Fokus-Modus am Abend bei y = 739, die Bottom-Nav beginnt bei y = 770. Es sind also nur etwa 30 px der Karte sichtbar (B-03). Morgens und tagsüber ist sie sichtbar.

### Frage 4 – abschliessen und korrigieren: Nein auf allen Geräten

Getestet mit echten Touch-Events (`RB/touch-wall.mjs`, Logs unten):

| Test | Wand (Gesamt) | Handy (Fokus Mia) | Tablet / Handy (Gesamt) |
|---|---|---|---|
| Einzeltipp | erledigt, Latenz inkl. CDP und 60 ms Halten 142–179 ms. Sterne fliegen, Toast mit ↶. **Kein ↶ an der Karte**, die Karte rutscht aus dem Blick. | erledigt, ↶ an der Karte (56 px), kein Toast | wie Wand bzw. ↶ an der Karte |
| ↶ nach etwa 300 ms | **wirkungslos** (UNDO_ARM_MS 600), ohne sichtbares Zeichen | wirkungslos | – |
| ↶ nach 1 s | rückgängig, Sterne zurück, API ohne Completion | rückgängig | – |
| Doppeltipp 300 ms, gleiche Stelle | **zweite Aufgabe "Hausaufgaben" (+3) mit erledigt**, Sterne 1 → 5 | nur eine Completion (Karte bleibt stehen) | **Tablet und Handy: ebenfalls zwei Completions** |
| Tipp auf ältere erledigte Karte (nach 9,5 s), dann ↶ | ↶ nur im Toast unten mittig (2 Tipps) | ↶ an der Karte (2 Tipps) | – |
| Offline | Karte gestrichelt rot, Wolke, ↻; Toast mit ↻; "Keine Verbindung"; ↻ nach Reconnect erfolgreich | – | – |
| "Für alle" | Bilddialog mit Piktogramm 72 px, Avatar-Kacheln 129×132, ✕ 48 px, Tipp daneben schliesst. Stempel 🦄 auf der Karte, ↶ im Toast wirkt. | – | – |

Die Textlos-Screenshots vor dem Tipp, nach dem Tipp und nach ↶ sind klar unterscheidbar, auch in Graustufen.

### Frage 5 – Übersicht: Ja

- **Gruppen:** Die feste Reihenfolge Morgen, Tag, Abend, Jederzeit stimmt. Nur die aktuelle Phase und Jederzeit sind aufgeklappt, die übrigen erscheinen als Chip-Zeilen mit ○ oder ✓.
- **Erledigte:** Sie stehen am Gruppenende.
- **Kartenhöhen:** In jeder Spalte sind alle Karten gleich hoch (Wand 96, Fokus 112, Handy 80).
- **Mess-Snippet:**
  - `cutCount` = 0 in Karten. Die Treffer auf `/` sind `sr-only`-Texte und damit Fehlalarme.
  - `hScroll` = false bei 390 px auf allen neun Seiten.
- **Handy im Fokus:** Die Karten sind 342 px breit, die ersten Karten gehören zur aktuellen Phase.
- **Einschränkung:** Die "Für alle"-Spalte liegt an der Wand 1280 ausserhalb des Bildes (B-06).

## Stichprobe Abnahmekriterien

| AK | Ergebnis | Beleg |
|---|---|---|
| AK-1 | ✓ Wand 96 px / Piktogramm 56, Handy 80 / 48, Fokus 112 / 72. Differenz innerhalb einer Spalte 0 px. | `RB/measure.txt` |
| AK-2 | ✓ `cutCount` 0 in Karten, kein "…"; "Hausaufga-ben" wird getrennt, nicht abgeschnitten | `RB/audit.txt`, `a-notext-*` |
| AK-3 | ✓ Offen = dünner grauer Ring, als Nächstes = Pfeil-Badge und dicker Rahmen, erledigt = gefüllt, ✓ und durchgestrichen. In Graustufen eindeutig. | `RB/a-gray-wall-chores.png` |
| AK-6 | ✓ mit E1: 1 Tipp, die ganze Karte ist das Ziel (Wand 251×92). Zustandswechsel < 150 ms nach dem Loslassen. | Touch-Log C1 |
| AK-8 | ✗ An der Wand und auf dem Tablet (Gesamtansicht) fehlt ↶ an der Karte, weil die Karten < 330 px breit sind. Auf dem Handy fehlt der Toast. Nach dem Fenster: 2 Tipps ✓. | B-02 |
| AK-11 | ✓ Fehler-Symbol, ↻ (Toast 56 px, Ring an der Wand 48 px bei E1-Karte), gleicher POST, kein Rohtext | `RB/offline-wall-2-failed-notext.png`, Offline-Log |
| AK-15 | ✓ Wand 1280 und 1920: Köpfe bei y = 300, "als Nächstes" bei y ≤ 683 | `RB/measure.txt` |
| AK-17 | ✓ `scrollWidth` = 390 auf allen Seiten; die Avatarleiste liegt im ersten Viewport | `names`-Lauf, `a-ref-phone-chores.png` |
| AK-18 | ✓ `member=`, "Alle" 106×64 (Wand) bzw. 64×64 (Handy), erneuter Tipp, Rückkehr nach 120 s | `focusmode.mjs`, `RB/idle.txt` |
| AK-19 | ✓ 1 Tipp auf den Dashboard-Avatar führt zu `/chores?member=`. Avatare 80 px (Wand) bzw. 56 px (Handy) mit Tagesring im ersten Viewport. | `a-ref-*-dashboard.png` |
| AK-26 | ✓ Wand/Tablet: Piktogramm 44 px, Label einzeilig; Handy 32 px | `RB/measure.txt` |
| AK-27 | ✓ 5 Einträge à 68×66 | `RB/measure.txt` |
| AK-30 | ✓ `/` und `/chores`: `small`/`tight` leer. ✗ `/calendar` Wand: 2 enge Paare überlappender Termine. | `RB/audit.txt`, B-07 |
| AK-31 | ✓ `invisible` überall leer | `RB/audit.txt` |
| AK-34 | ✓ Unter `reduce` kein Sternenflug, statisches "+1", sofortiger Zustandswechsel | `RB/reduced-wall-after-tap.png` |
| AK-35 | ✓ Fokusreihenfolge logisch (Nav → Banner → Alle → Avatare → Für-alle-Chips → Bearbeiten → Spalten). 4-px-Outline #1952F0 (≈ 6:1 auf Weiss) bzw. #66BFFF in Dunkel (≈ 9:1). | `focus.mjs`-Log |
| AK-37 | ✗ Frage 4 Nein (alle Geräte), Frage 3 Nein (Handy) | oben |

Technische Stichprobe:
- **Konsole:** 0 Fehler und 0 Exceptions auf 9 Seiten × 2 Grössen, plus Touch-, Offline- und Dialog-Läufe. Nur der React-DevTools-Hinweis erscheint.
- **Namenlose Bedienelemente:** Auf den Kinderseiten keine. Ausserhalb gibt es einen Treffer, siehe B-15.

## Befunde

### B-01 · S1 · Doppeltipp schliesst eine zweite, fremde Aufgabe ab

- **Ort:** `/chores` Gesamtansicht auf Wand, Tablet und Handy (Stack). Die Ursache liegt in `member-column.tsx`: `expandedByDefault` wird aus dem *echten* `summary.next` berechnet, nicht aus dem während des ↶-Fensters eingefrorenen `orderNextId`.
- **Beobachtung:**
  1. Tipp auf Leos "Wasser trinken" (Jederzeit, abends).
  2. Die Markierung springt per Nachhol-Regel auf "Hund füttern" (Tagsüber), und die Gruppe "Tagsüber" klappt **oberhalb** auf.
  3. Die getippte Karte rutscht etwa 200 px nach unten, aus dem sichtbaren Spaltenbereich.
  4. Nach 300 ms liegt "Hausaufgaben" unter dem Finger, und der zweite Tipp schliesst sie ab (+3).
  5. Der Toast zeigt nur noch ↶ für "Hausaufgaben". Das ↶ für die erste Aufgabe ist aus dem Toast verschwunden.
- **Belege:**
  - Log C3 Wand: `newComps: ["Wasser trinken", "Hausaufgaben"]`, Sterne 1 → 5.
  - Tablet (`tt-*`) und Handy (`tph-*`) identisch.
  - Screenshots `RB/tw-1-tap-400ms.png` (erster Lauf), `RB/tw-3-at-300ms.png` ("Hausaufgaben" liegt unter der Tippstelle), `RB/tw-3-after-doubletap.png`, `RB/tph-3-after-doubletap.png`.
- **Erwartet:** Ein zweiter Tipp an derselben Stelle kurz nach dem Abschliessen bewirkt nichts (2.2 "Schutz vor Versehen"). Unter dem Finger bleibt die gerade abgehakte Karte stehen.
- **Lösung:**
  1. Während des frischen ↶-Fensters auch das Auf- und Zuklappen der Gruppen aus `orderingCompletions` bzw. `orderNextId` ableiten, also kein Layout-Sprung oberhalb der Karte.
  2. Zusätzlich eine Tipp-Sperre von 600 ms für die ganze Spalte nach einem Abschluss (analog `UNDO_ARM_MS`).
  3. Regressionstest: Leo abends, Doppeltipp auf "Wasser trinken" ergibt genau eine Completion.

### B-02 · S2 · ↶ fehlt an der Karte (Wand, Tablet), Rückmeldung nicht am Ort der Handlung

- **Ort:** `task-card.tsx` / `card-metrics.ts` (`INLINE_UNDO_MIN_WIDTH = 330`), Wand 1280 und Tablet. Die Karten sind 251 bzw. 274 px breit.
- **Beobachtung:**
  - ↶ erscheint nur im Toast unten mittig. Bei Leos Spalte am rechten Rand liegt der Toast etwa 340 px entfernt.
  - Die Karte selbst ist nach dem Tipp oft nicht mehr im Blick (B-01).
  - Nach dem Tipp auf eine ältere erledigte Karte erscheint ebenfalls nur der Toast, und die Karte ist teils vom verkleinerten Spaltenbereich abgeschnitten.
  - Belege: `RB/tw-1-tap-400ms.png`, `RB/tw-4-revealed.png`, Log `cardUndo: null`.
  - Auf dem Handy ist es umgekehrt: nur ↶ an der Karte, kein Toast.
- **Erwartet:** E3 und AK-8 verlangen ↶ ≥ 56 px an der Karte **und** im Toast. Konsistenzregel 5 verlangt die Rückmeldung an der Stelle der Handlung.
- **Lösung:** Während des ↶-Fensters auf schmalen Karten die Sternzeile oder den Titel ausblenden und das ↶ (56 px) links neben den Ring setzen. Der Titel ist für die Kinderpersona in diesen 8 s entbehrlich. Alternativ überdeckt ↶ die Bildkachel (64 px). Auf dem Handy den Toast zusätzlich zeigen.

### B-03 · S2 · Handy, Fokus-Modus: "als Nächstes" nicht im ersten Viewport

- **Ort:** `/chores?member=<Mia>` auf 390×844, abends.
- **Beobachtung:**
  - Vor der Karte stehen: Lizenzbanner (3 Zeilen), Avatarleiste, "Für alle"-Chipzeile, eine eigene Zeile "Bearbeiten 🔒", der grosse Kopf und zwei Chip-Zeilen (Morgen, Tag).
  - Die Karte beginnt bei y = 739, die Bottom-Nav bei 770. Von der Karte ist nur der Pfeil zu sehen.
  - Belege: `RB/a-notext-phone-chores-focus.png`, `RB/measure.txt`.
- **Erwartet:** 4.4 Frage 3: Die Karte liegt im ersten Viewport. 2.6: Das Kind sieht nach einem Tipp seine nächste Aufgabe.
- **Lösung:**
  1. Im Fokus-Modus des Handys die eingeklappten früheren Phasen als **eine** Chip-Zeile **unter** die aktuelle Phase setzen.
  2. "Bearbeiten 🔒" als 48-px-Schloss-Icon in die Avatarzeile verschieben.
  3. Die "Für alle"-Chipzeile im Fokus-Modus weglassen, weil der Streifen am Ende existiert.
  4. Beim Betreten die Karte per `scrollIntoView` ins Bild holen.

### B-04 · S2 · Kalender: Seiten-Scroll zur Jetzt-Linie versteckt Wochentage, Filter und Navigation

- **Ort:** `/calendar`, alle Grössen.
- **Beobachtung:**
  - Beim Laden steht `window.scrollY` bei 809 (Wand) bzw. 937 (Handy).
  - Im ersten Viewport fehlen Wochentage und Datum, die Personenavatare (Solo-Filter) sowie "Heute", Tag/Woche/Monat. Zu sehen sind nur Raster, kleine Piktogramme und die Jetzt-Linie. Ohne Text ist nicht erkennbar, welcher Tag welche Spalte ist.
  - Vorher (`docs/kids-ui/before/wall-calendar.png`) blieb der Kopf sichtbar.
  - Belege: `RB/a-ref-wall-calendar.png`, `RB/a-notext-wall-calendar.png`, `RB/a-notextdark-phone-calendar.png` und zum Vergleich `RB/b-cal-top-wall.png`.
- **Erwartet:** Tagesköpfe und Avatar-Filter (2.10, AK-24) sind im ersten Viewport erreichbar.
- **Lösung:** Nur den Raster-Container scrollen (interner Scroll wie vorher) und den Tageskopf `sticky` machen. Alternativ zur Jetzt-Linie minus Kopf- und Filterhöhe scrollen, nicht die Seite.

### B-05 · S3 · ↶ reagiert in den ersten 600 ms nicht, ohne sichtbares Zeichen

- **Ort:** `undo-button.tsx` / `undo-guard.ts`.
- **Beobachtung:** Ein Tipp auf ↶ etwa 300 ms nach dem Erscheinen bleibt wirkungslos, und der Knopf sieht dabei normal aus (Log C1 Wand und Handy). Der Schutz ist sinnvoll, wirkt für ein Kind aber wie "kaputt".
- **Erwartet:** Ein sichtbarer Knopf ist bedienbar, oder er ist sichtbar noch nicht bereit.
- **Lösung:** ↶ erst nach 600 ms einblenden (Scale oder Fade) statt eines inerten, voll sichtbaren Knopfs. Bei reduzierter Bewegung verzögert, aber ohne Animation.

### B-06 · S3 · "Für alle" an der Wand ausserhalb des Bildes; Stempel nicht sichtbar

- **Ort:** `/chores` Wand 1280. Die Spalte beginnt bei x = 1260.
- **Beobachtung:**
  - Nach "Wer war's" verschwindet der Chip im Kopf, und der Avatar-Stempel steht auf der unsichtbaren Karte. Das gestrichelte Gruppensymbol im Kopf ist `aria-hidden` und kein Knopf. Nur ab mehr als 4 offenen Chips gibt es "+N".
  - Belege: `RB/who-wall-2-after-pick.png` und nach Scroll `RB/who-wall-3-anyone-column.png`.
- **Erwartet:** Das Kind sieht, dass "seine" Für-alle-Aufgabe mit seinem Gesicht markiert ist (AK-14, Ablauf d).
- **Lösung:** Das Gruppensymbol zu einem 56-px-Knopf machen, der zur Spalte scrollt. Erledigte Für-alle-Aufgaben bleiben im Kopf als Chip mit Avatar-Stempel und ✓ stehen.

### B-07 · S3 · Kalenderblöcke: kurze Termine ohne Piktogramm, überlappende zu eng

- **Ort:** `/calendar` Woche.
- **Beobachtung:**
  - "Zahnarzt" am Freitag 09:30–10:15 zeigt nur den Avatar, kein Piktogramm.
  - Drei überlappende Termine gegen 22 Uhr sind schmale Streifen ohne Titel, mit < 8 px Abstand (Audit `tight`: 2 Paare).
  - Belege: `RB/b-cal-top-wall.png`, `RB/a-ref-wall-calendar.png`, `RB/audit.txt`.
- **Erwartet:** Das Piktogramm trägt die Kinderinformation (P1-5), AK-30.
- **Lösung:** Bei geringer Höhe das Piktogramm statt des Avatars zeigen und den Avatar als Mini-Badge darauf setzen. Überlappende Termine mit Mindestbreite oder gestapelt und mit 8 px Abstand.

### B-08 · S3 · ✓ bedeutet bei Terminen "vorbei"

- **Ort:** Heute-Widget (Kindergarten mit grünem ✓-Badge) und Kalenderblöcke ("✓ 08:00–12:00").
- **Beobachtung:** Das ✓ ist sonst für "Aufgabe erledigt" reserviert. Belege: `RB/a-notext-wall-dashboard.png`, `RB/a-ref-wall-calendar.png`.
- **Erwartet:** Regel 3.2: ein Symbol, eine Bedeutung. 2.10 sieht für vergangene Termine "blass und kleiner" vor.
- **Lösung:** Vergangene Termine nur abschwächen, ohne ✓.

### B-09 · S3 · Stift-Symbol im Kinder-Modus sichtbar

- **Ort:** Knopf "Bearbeiten 🔒" (Stift und Schloss) auf `/chores`, ebenso im Leerzustand (Pfeil, Stift, Schloss).
- **Beobachtung:** Der ✏️ gehört laut Symboltabelle nur in den Eltern-Modus. Für ein Kind lädt ein Stift zum Tippen ein ("malen"). Beleg: `RB/a-notext-wall-chores.png`.
- **Lösung:** Im Kinder-Modus nur 🔒 mit Label zeigen, den Stift erst nach dem Entsperren.

### B-10 · S3 · PIN-Pad: Kinder können die Eltern aussperren

- **Ort:** PIN-Dialog von "Bearbeiten 🔒", `admin-pin.ts:16` (10 Versuche pro Minute und IP; am Kiosk teilen sich alle eine IP).
- **Beobachtung:**
  - Das Zahlenfeld mit 10 grossen Tasten lädt zum Tippen ein. Ein falscher PIN wird nur als Text gemeldet.
  - Ausgänge gibt es: ✕ 48 px und Tipp daneben.
  - Beleg: `RB/pin-wall-3-wrong-notext.png`.
- **Lösung:** Nach 2 falschen Eingaben das Pad mit Schüttel-Animation schliessen und in die Kinderansicht zurückkehren. Schloss-Wackeln statt nur Text.

### B-11 · S3 · Leere Kalenderstunde öffnet den Erwachsenen-Dialog mit Tastatur

E5 hat das bewusst so entschieden. Hier geht es nur um das Restrisiko aus Kindersicht.

- **Ort:** `/calendar`.
- **Beobachtung:**
  - Ein Tipp in eine leere Stunde öffnet "Neues Ereignis" mit On-Screen-Tastatur, 8 Feldern und "Speichern". Das ist der am leichtesten erreichbare Erwachsenen-Dialog auf einer Kinderseite.
  - Ein Kind kann Buchstaben tippen und speichern. Der Termin würde dann zu Google gespiegelt.
  - Beleg: `RB/cal-wall-emptyhour.png`.
- **Lösung (E5-kompatibel):** "Speichern" erst ab einem Titel mit ≥ 2 Zeichen und nach aktiver Personenwahl freigeben. Das ✕ auf ≥ 56 px vergrössern.

### B-12 · S3 · "Essen" ist als Kinderkachel verlinkt, zeigt aber nur "+ Hinzufügen"

- **Ort:** `/meals`.
- **Beobachtung:**
  - Das Raster zeigt 28× "+ Hinzufügen" als Text, keine Bilder.
  - Jeder Tipp öffnet den Dialog "Mahlzeit hinzufügen". Das "+" ist im Kinder-Modus sichtbar, entgegen Regel 3.4.
  - Das Mahlzeit-Bild gehört laut E12 bzw. P2-2 nicht zum Umfang. Der Befund betrifft daher nur Navigation und Sichtbarkeit.
  - Belege: `RB/k-ref-wall-meals.png`, `RB/meal-wall-add-dialog.png`.
- **Lösung:** Leere Zellen im Kinder-Modus als neutrales Teller-Piktogramm ohne "+" zeigen. "Hinzufügen" als ruhiger Erwachsenen-Knopf pro Tag oder hinter dem Eltern-Modus.

### B-13 · S3 · Mini-Piktogramme der Chip-Zeilen teilweise verdeckt

- **Ort:** Eingeklappte Gruppen (26-px-Piktogramme mit 16-px-Badge ○/✓), vor allem in Dunkel.
- **Beobachtung:** Das Badge überdeckt etwa ein Viertel des Motivs, etwa Zahnbürste und Bettende. Beleg: `RB/z-dark-chips.png`.
- **Lösung:** Chips auf 32 px vergrössern oder das Badge ausserhalb des Kreises versetzen.

### B-14 · S3 · Drei Piktogramme zeigen Gegenstand statt Handlung bzw. sind verwechselbar

- **Ort:** Pictos der Aufgaben "Tisch decken", "Schultasche packen", "Anziehen" und "Pyjama anziehen".
- **Beobachtung:** Beleg `RB/gallery.png` (#16, #12, #15/#4).
  - "Tisch decken": Der gedeckte Tisch mit dampfender Tasse liest sich als "essen".
  - "Schultasche packen": Es ist nur der Rucksack zu sehen.
  - "Anziehen" und "Pyjama anziehen": Die beiden unterscheiden sich nur über Muster und Mond.
- **Lösung:**
  - Tisch decken: Hand bzw. Pfeil setzt einen Teller auf den leeren Tisch.
  - Schultasche: Heft fällt mit Pfeil in den offenen Rucksack.
  - Pyjama: Bett oder Nachthimmel als Hintergrund, klar anderer Schnitt.

### B-15 · S3 · Erwachsenenbereich, vorbestehend: namenloser Knopf in den Einstellungen

- **Ort:** `/settings` auf dem Handy, `devices-row.tsx`, "Neues Gerät verknüpfen".
- **Beobachtung:** Das Label ist `hidden sm:inline`, und es fehlt ein `aria-label`. Die Zeile wurde in diesem Branch nicht geändert.
- **Lösung:** `aria-label` ergänzen.

**Nebenbefund ausserhalb des Umfangs:** `GET /api/members` liefert unter anderem die Felder `googleRefreshTokenEnc`, `googleAccessToken`, `caldavPasswordEnc` und `microsoftRefreshTokenEnc` an jeden Client aus. Das sollte separat geprüft werden (Backend, nicht Teil des UI-Umbaus).

## Wichtigste Screenshot-Pfade (alle unter `RB/`)

- Referenz und textlos:
  - `a-ref-{wall,tablet,phone}-{dashboard,chores,chores-focus,calendar}.png`
  - `a-notext-…`, `a-notextdark-…`, `a-gray-…`, `a-refdark-…`
- Piktogramme: `gallery.png` (20 Demo-Aufgaben, textlos, gemischt), `z-dark-chips.png`
- Tageszeiten: `tz-Pacific_Pago_Pago-*`, `tz-America_Denver-*`, `tz-Asia_Kolkata-*` (Wand /, /chores und Handy Fokus)
- Touch-Tests:
  - Wand: `tw-1-tap-150ms`, `tw-1-tap-400ms`, `tw-3-at-300ms`, `tw-3-after-doubletap`, `tw-4-revealed`
  - Handy Fokus: `tp-1-after-tap`, `tp-4-older-done`
  - Handy Gesamt: `tph-3-after-doubletap`
- Offline, "Für alle", PIN, reduzierte Bewegung:
  - `offline-wall-2-failed-notext`
  - `who-wall-{2-after-pick,3-anyone-column,5-dialog-notext}`
  - `pin-wall-3-wrong-notext`
  - `reduced-wall-after-tap`
- Kalender und weitere Seiten: `b-cal-top-wall`, `cal-wall-emptyhour`, `cal-wall-solo-mia`, `k-ref-wall-meals`, `meal-wall-add-dialog`, `banner-aktivieren`
- Logs: `audit.txt`, `measure.txt`, `idle.txt`, `*-console.json`
- Skripte: `lib.mjs`, `shots.mjs`, `touch-wall.mjs`, `who.mjs`, `offline.mjs`, `focus.mjs`, `reduced.mjs`

---

## Runde 3

Stand 30.09.2026, 23:31–23:57 MESZ. Server frisch gestartet, Demo-DB neu geseedet mit neuen IDs (Mia `cmuomclm10008mondm065qje8`, Leo `cmuomclm1000amondvom5h2a6`).
04, 05 und 07 habe ich nicht gelesen, und ich habe keinen Code geändert.

Methode:
- **Tageszeiten per Zeitzonen-Override:** Morgen `Etc/GMT+12` (09:3x), Tag `America/Denver` (15:3x), Abend `Europe/London` (22:3x), Nacht `Asia/Kolkata` (03:1x).
- **Echte Touch-Events mit DB-Zählung:** Skript `RB/touch3.mjs`, Logs `RB/r3-*.txt` bzw. Terminalausgabe.
- **Aufräumen:** Jeder Zyklus löscht nur Completions der geprüften Person, die nach Skriptstart entstanden sind. Jede Löschung entsprach genau der eigenen Anzahl.

Nach meinen Läufen enthält `completionsToday` die 3 Seed-Einträge plus "Pyjama anziehen" und "Spielzeug aufräumen" (Mia). Beide stammen nicht aus meinen Skripten, Spielzeug ist laut Koordinator die wiederhergestellte Completion des anderen Reviewers.

### Kurzfazit Runde 3

**12 der 15 Befunde sind behoben, B-02 und B-14 nur teilweise.** B-11 und B-12 sind bewusst offen, zu deren Begründung siehe unten. Der Doppeltipp-Fehler B-01 ist auf allen Geräten, Ansichten und Tageszeiten behoben.

**Neu sind zwei wesentliche Befunde:**
- **B-16:** Das ↶ liegt jetzt auf dem Bild. Ein langsamer zweiter Tipp auf das Bild (ab 600 ms) macht die gerade abgehakte Aufgabe wieder rückgängig.
- **B-17:** An der Wand 1280×800 verschwindet die Karte "als Nächstes" bei Mia fast ganz aus der Spalte (5 px sichtbar), sobald 2 Abendaufgaben erledigt sind. Grund: Der ✓-Streifen steht oben in der Gruppe, und die Spalten reservieren dauerhaft 72 px für den Toast.

**Abnahme aus meiner Sicht: noch nein**, weil AK-37 an Frage 3 und 5 (Wand 1280) und an Frage 4 (B-16) scheitert. Beide Korrekturen sind klein.

### Nachprüfung B-01 … B-15

| Befund | Urteil | Beleg |
|---|---|---|
| B-01 Doppeltipp | **behoben** | Siehe Tabelle Doppeltipp: 9 Konstellationen (Gerät, Ansicht, Tageszeit) × 2 Abstände mit Tipp auf den Ring ergeben je genau 1 Completion. Die Karte bleibt stehen, die Gruppen klappen erst nach Ruhe um (`use-held-layout.ts`, `tap-guards.ts`). |
| B-02 ↶ an der Karte | **teilweise** (Wand und Tablet behoben) | Wand und Tablet: ↶ 64 px auf dem Bild und im Toast (56 px). Handy: ↶ 56 px an der Karte, dafür kein Toast. `RB/r3w-1b-undo-visible.png` |
| B-03 Handy-Fokus | **behoben** | Karte "als Nächstes" bei y = 475 (Morgen), 543 (Tag), 610 bzw. 636 (Abend). Keine Für-alle-Chips oben, Kopf-Avatar 72 px. `RB/c-ref-phone-chores-focus.png`, `RB/tz3.txt` |
| B-04 Kalender-Scroll | **behoben** | `window.scrollY` = 0. Nur das Raster scrollt intern (scrollTop 797). Kopf, Filter und Wochentage bleiben sichtbar. `RB/c-ref-wall-calendar.png` |
| B-05 ↶ inert | **behoben** | ↶ ist 0–600 ms `aria-hidden` und `pointer-events-none`, danach sichtbar. Log C1: "hidden" bei +60 ms, sichtbar bei +850 ms. |
| B-06 Für alle | **behoben** | Knopf "Zu den Aufgaben für alle" (56 px) scrollt zur Spalte. Die erledigte Aufgabe bleibt als Chip mit ✓ in Mias Farbe im Kopf. `RB/who3-wall-2-after-window.png`, `-3-after-group-button.png` |
| B-07 Kalenderblöcke | **behoben** | "Zahnarzt" (45 min) zeigt Piktogramm und Avatar. Überlappungen erscheinen als "+2", ein Tipp öffnet die Tagesansicht mit allen Terminen. `RB/cal3-wall-morning.png`, `RB/cal3-wall-more2.png` |
| B-08 ✓ bei Terminen | **behoben** | Kindergarten ist blass, ohne ✓, im Heute-Widget und im Kalender. `RB/c-ref-wall-dashboard.png` |
| B-09 Stift | **behoben** | "Bearbeiten" zeigt nur das Schloss, `lucide-pencil` fehlt im Knopf. |
| B-10 PIN-Pad | **behoben** | Nach 2 falschen Eingaben schliesst der Dialog, zurück in die Kinderansicht. `RB/pin3-attempt1.png`. Die Schüttel-Animation ist im Screenshot nicht prüfbar. |
| B-11 Leere Kalenderstunde | **nicht behoben** (bewusst) | Siehe Begründung unten. |
| B-12 Essen "+" | **nicht behoben** (bewusst) | Siehe Begründung unten. |
| B-13 Chip-Piktogramme | **behoben** | Chips etwa 40 px, Badge an den Rand versetzt, Motiv frei. `RB/z3-dark-chips.png`. Folge siehe B-18. |
| B-14 Piktogramme | **teilweise** (Pyjama nur verbessert) | Tisch decken: Teller mit Pfeil auf das Tischset. Schultasche: Heft fällt in den Rucksack. Pyjama: rosa Knopf-Pyjama, schlafendes Gesicht, Mond. `RB/gallery3.png` #16, #12, #4. "Anziehen" (#15) und "Pyjama" (#4) haben weiterhin dieselbe Pose mit Pfeilen. |
| B-15 Namenloser Knopf | **behoben** | Namens-Audit `/settings` Handy: kein namenloser Knopf mehr. Nur `<input>` mit `<label for>` bleibt, ein Fehlalarm des Snippets. |

**Doppeltipp-Matrix (B-01, Tipp auf den Ring, DB-Zählung nach 1,3 s):**

| Gerät · Ansicht · Zeit | Aufgabe | 300 ms | 800 ms |
|---|---|---|---|
| Wand · Gesamt · Abend | Leo Wasser trinken (löste in Runde 2 den Sprung aus) | 1 | 1 |
| Wand · Gesamt · Tag | Leo Hund füttern | 1 | 1 |
| Wand · Gesamt · Morgen | Mia Zähne putzen | 1 | 1 |
| Wand · Fokus Leo · Abend | Leo Wasser trinken | 1 | 1 |
| Tablet · Gesamt · Abend | Leo Wasser trinken | 1 | 1 |
| Tablet · Fokus Mia · Tag | Mia Hände waschen | 1 | 1 |
| Handy · Gesamt · Abend | Leo Wasser trinken | 1 | 1 |
| Handy · Fokus Leo · Abend | Leo Wasser trinken | 1 | 1 |
| Handy · Fokus Mia · Tag | Mia Hände waschen | 1 | 1 |
| **Wand · Gesamt · Abend, Tipp auf das Bild** | Leo Wasser trinken | 1 | **0 (↶ ausgelöst)** |
| **Handy · Gesamt · Abend, Tipp auf das Bild** | Leo Wasser trinken | – | **0 (↶ ausgelöst)** |

Einzeltipp: Latenz 131–150 ms inklusive CDP und 60 ms Halten. ↶ nach 1 s: rückgängig, Sterne zurück, API ohne Completion (alle Geräte). Ein Tipp auf eine ältere erledigte Karte (nach 13 s) zeigt ↶ an der Karte, und ↶ wirkt. Das sind 2 Tipps.

**Zur Begründung für B-11 und B-12 ("ein Tipp mehr für Erwachsene"):** Die Begründung trifft nur auf einen Teil der Vorschläge zu.
- **B-11:**
  - Die Pflicht zur Personenwahl kostet tatsächlich einen Tipp. Dieser Teil kann entfallen.
  - Das ✕ auf 56 px zu vergrössern und "Speichern" erst ab einem Titel mit 2 oder mehr Zeichen freizugeben, kostet Erwachsene **keinen** Tipp. Beides verhindert, dass ein Kind mit einem Tipp auf die Tastatur einen Müll-Termin nach Google speichert.
  - Nebenbei: Der Dialog belegt die Person heute mit "Mama" vor. Ein Kind speichert also auch falsch zugeordnet.
- **B-12:** Die Begründung gilt für die Variante "hinter dem Eltern-Modus". Meine erste Variante kostet keinen Tipp: Leere Zellen zeigen im Kinder-Modus ein neutrales Teller-Piktogramm ohne "+", sind aber weiterhin antippbar.
- **Fazit:** Beide bleiben S3 und blockieren die Abnahme nicht. Die tippfreien Teile würde ich trotzdem umsetzen.

### Fünf Fragen × Gerät (Runde 3)

Light, Dark und Graustufen liefern dasselbe Ergebnis (`RB/c-{ref,notext,notextdark,gray}-*.png`).

| Frage | Wand 1280×800 | Wand 1920 | Tablet 768 | Handy 390 |
|---|---|---|---|---|
| 1 Eigene Aufgaben erkennen | **Ja** | **Ja** | **Ja** | **Ja** |
| 2 Handlung ohne Lesen | **Ja** (20/20) | **Ja** | **Ja** | **Ja** |
| 3 Was ist als Nächstes? | **Nein** (B-17) | **Ja** | **Ja** | **Ja** |
| 4 Abschliessen und korrigieren | **Nein**, knapp (B-16) | **Nein**, knapp (B-16) | **Nein**, knapp (B-16) | **Nein**, knapp (B-16) |
| 5 Übersicht bei vielen Aufgaben | **Nein** (B-17) | **Ja** | **Ja** | **Ja** |

**Frage 1:** Wie in Runde 2. Avatar-Tipp, erneuter Tipp, "Alle" und 120-s-Rückkehr funktionieren alle (`RB/focusmode3.mjs`, `RB/idle3.txt`). Die Personenfarben sind eindeutig, "Für alle" ist neutral mit Gruppensymbol.

**Frage 2 – zuerst nur aus dem Bild benannt** (`RB/gallery3.png`, textlos, gemischt):
1. Glas mit Tropfen: Wasser trinken
2. Bett mit Bogenpfeil: Bett machen
3. Pflanze und Giesskanne: Blumen giessen
4. Kind im rosa Knopf-Pyjama mit Mond, schlafend, Pfeile: Pyjama anziehen
5. Bett: Bett machen
6. Glas: Wasser trinken
7. Pflanze und Kanne: Pflanzen giessen
8. Zahn und Bürste: Zähne putzen
9. Hahn und Hand mit Seife: Hände waschen
10. Schuhe auf Bank: Schuhe hinstellen
11. Zahn und Bürste: Zähne putzen
12. Heft fällt in Rucksack: Schultasche packen
13. Heft und Stift: schreiben / Hausaufgaben
14. Kleiderstapel mit Pfeil: Wäsche falten
15. Kind mit T-Shirt, Pfeile: anziehen
16. Teller wird mit Pfeil auf das Tischset gelegt: Tisch decken
17. Ball und Teddy fallen in eine Kiste: aufräumen
18. Buch mit Sternen: Buch anschauen
19. Hund und Futter fällt in Napf: Hund füttern
20. Papier fällt in Tonne: Müll wegwerfen

Abgleich mit den Titeln: 20/20 im Sinn, #20 sinngemäss ("rausbringen"). Einschränkung wie in Runde 2: Die Titel waren mir bekannt, und die Reihenfolge der Galerie ist dieselbe. Zu #4 und #15 siehe B-14.

**Frage 3:**

| Zeit | Mia | Leo | Papa | Mama |
|---|---|---|---|---|
| 09:47 | Zähne putzen | Schultasche | Pause (Mond + Sanduhr) | Pflanzen giessen |
| 15:3x | Hände waschen | Hund füttern | – | – |
| 22:3x | Zähne putzen | Wasser trinken | Müll | – |
| 03:17 | Schlafenszeit | Schlafenszeit | Schlafenszeit | Schlafenszeit |

Topbar und Kopf-Symbol passen jeweils zur Tageszeit. Wand 1280: Mias Karte "als Nächstes" hat 5 px sichtbare Höhe, siehe B-17. Wand 1920 und Tablet zeigen jeweils 96 px.

**Frage 4:** Alle Beobachtungen aus 4.4 treffen zu:
- 1 Tipp schliesst ab, ↶ wird sichtbar, 1 Tipp auf ↶ macht rückgängig.
- Ein Tipp auf eine erledigte Karte bringt keine Sterne.
- Offline zeigt ↻, die Wiederholung nach dem Reconnect gelingt (`RB/offline3-wall-2-failed-notext.png`).
- "Für alle" zeigt Bilddialog und Stempel.

Das "Nein, knapp" kommt allein von B-16: Die Schutzmassnahme ↶ wird selbst zur Quelle einer versehentlichen Aktion.

**Frage 5:** An der Wand 1280 ist die Karte "als Nächstes" nicht für jede Person ohne Scroll sichtbar (B-17). Sonst gilt:
- Gruppen und Chip-Zeilen sind korrekt.
- `cutCount` = 0 in Karten.
- `hScroll` = false bei 390 px.
- Die Karten sind in jeder Spalte gleich hoch.

### AK-Stichprobe (Runde 3)

| AK | Ergebnis | Beleg |
|---|---|---|
| AK-1 | ✓ Wand 96/56, Fokus 112/72, Handy 80/48, Handy-Fokus 96/56; gleiche Höhen | `RB/measure3.txt` |
| AK-2 | ✓ `cutCount` 0 in Karten (Treffer auf `/` sind `sr-only`) | `RB/audit3.txt` |
| AK-3 | ✓ Graustufen eindeutig | `RB/c-gray-wall-chores.png` |
| AK-6 | ✓ 1 Tipp, Karte als Ziel, 131–150 ms inklusive CDP | Touch-Logs |
| AK-8 | **teilweise:** ↶ an der Karte 64 px (Wand, Tablet) bzw. 56 px (Handy), im Toast 56 px, nach dem Fenster 2 Tipps ✓. "Frage 4 = Ja" ✗ wegen B-16; auf dem Handy kein Toast. | `RB/r3w-1b-undo-visible.png` |
| AK-11 | ✓ | `RB/offline3-*`, Log "Keine Verbindung", ↻ 56×56, Retry → Completion |
| AK-15 | **✗ Wand 1280** (Mia 5 px sichtbar), ✓ 1920 | `RB/r3-wall-mia-next.png` |
| AK-17 | ✓ `scrollWidth` = 390 auf 8 Seiten | `names3`-Lauf |
| AK-18 | ✓ `member=`, "Alle" 106×64 / 64×64, erneuter Tipp, 120 s | `focusmode3`, `RB/idle3.txt` |
| AK-19 | ✓ 1 Tipp, Dashboard-Avatare 112×204 (Wand) / 72×164 (Handy) im ersten Viewport | Probe `/` |
| AK-26 / AK-27 | ✓ 44 px (Wand) / 32 px (Handy); 5 Einträge à 68×66 | `RB/measure3.txt` |
| AK-30 | ✓ `/`, `/chores`, `/calendar` (Wand und Tablet leer). Handy-Kalender und Wand-Fokus melden `tight`, aber als Fehlalarm: ausserhalb des Scrollbereichs liegende Elemente; siehe B-19. | `RB/audit3.txt` |
| AK-31 | ✓ `invisible` leer; das verborgene ↶ hat `pointer-events: none` | `RB/audit3.txt` |
| AK-34 | ✓ Kein Sternenflug, statisches "+1" | `RB/reduced3-wall-after-tap.png` |
| AK-35 | ✓ Reihenfolge Nav → Banner → Alle → Avatare → Für-alle-Knopf → Chips → Bearbeiten → Spalten; 4 px #1952F0 | `focus.mjs`-Log |
| AK-37 | **✗** Frage 3 und 5 an der Wand 1280 (B-17), Frage 4 (B-16) | oben |

Technisch: 0 Konsolenfehler und 0 Exceptions auf 8 Seiten × 2 Grössen und in allen Touch-, Offline-, PIN- und Dialog-Läufen.

### Neue Befunde

#### B-16 · S2 · Langsamer zweiter Tipp auf das Bild macht das Abhaken rückgängig

- **Ort:** `task-card.tsx`. Das ↶ (`size="fill"`) liegt über der Bildkachel, `appearAfterMs = UNDO_ARM_MS` (600 ms). Die Bildkachel ist Teil des Abhak-Ziels (E1).
- **Beobachtung:**
  1. Das Kind tippt auf das Bild (die animierte "als Nächstes"-Demo lädt genau dazu ein), und die Karte ist erledigt.
  2. Ab 600 ms und bis 8 s liegt unter demselben Finger ↶.
  3. Ein zweiter Tipp nach 800 ms ergibt `under finger = UNDO`, `db = []`. Die Aufgabe ist wieder offen, die Sterne sind weg. Wand und Handy sind identisch.
  - Ein dritter Tipp würde erneut abhaken.
  - Beim Tipp auf den Ring bleibt es bei 1 Completion.
  - Belege: Log "picto spot wall Leo" und "r3ppic", `RB/r3w-1b-undo-visible.png`.
- **Erwartet:** 2.2 "Schutz vor Versehen". Ein wiederholter Tipp an derselben Stelle ändert das Ergebnis nicht. ↶ steht dort, wohin der erste Finger nicht gezielt hat (so war es in Runde 2 bewusst gelöst: "16 px clear of the ring").
- **Lösung:** Eine räumlich-zeitliche Sperre für ↶: Tipps innerhalb von 1,5 s nach dem Abhaken, die weniger als 48 px vom Abhak-Punkt entfernt landen, ignorieren. Der Abhak-Punkt ist bereits in `origins` bzw. `lastCompletion` bekannt. Alternativ ↶ auf der dem Tipp abgewandten Kartenseite einblenden: Tipp links, dann ↶ rechts über dem Ring, und umgekehrt. Regressionstest: Tipp auf das Bild, zweiter Tipp nach 800 ms ergibt 1 Completion.

#### B-17 · S2 · Wand 1280: Karte "als Nächstes" in der Spalte verdeckt

- **Ort:** `member-column.tsx` (der `DoneStrip` wird **vor** den offenen Karten gerendert) und `chores-view.tsx` (`useViewportFill(…, TOAST_ROOM)`: die Spalte endet dauerhaft 72 px vor dem Rand, bei y = 672–680 statt etwa 752).
- **Beobachtung:**
  - Mia hat abends 2 erledigte und 2 offene Aufgaben. Der ✓-Streifen steht zwischen dem Kopf "Abends" und der Karte "Zähne putzen".
  - Die Karte beginnt bei y = 667, der Scrollbereich endet bei 672, sichtbar sind 5 px. Nur ein Stück des Pfeil-Badges ist zu sehen.
  - Unter den Spalten bleibt ein leerer Streifen von etwa 120 px.
  - Wand 1920 und Tablet sind nicht betroffen (96 px sichtbar).
  - Belege: `RB/r3-wall-mia-next.png`, Messung `scroller [387, 672]`, `next [667, 763]`.
- **Erwartet:**
  - AK-15 und 4.4 Frage 3 bzw. 5: Die Karte "als Nächstes" jeder Person ist ohne Scroll sichtbar.
  - 2.7: "'Als Nächstes' oben, dann die offenen, dann die erledigten".
- **Lösung:**
  1. Den `DoneStrip` ans Ende der Gruppe setzen, nach der `<ul>`.
  2. Die Toast-Reserve nur während eines offenen Toasts abziehen und die Spalte dabei nicht verkürzen. Stattdessen den Toast über den leeren Bereich unter kurzen Spalten legen oder ihn transparent über die Spalte schweben lassen, da seine Position fest ist.
  3. Zusätzlich die Spalte beim Laden und nach Phasenwechsel so scrollen, dass die Karte "als Nächstes" sichtbar ist. Im Handy-Fokus gibt es das bereits.

#### B-18 · S3 · Eingeklappte Gruppen zeigen an der Wand nur 2 Bilder plus "+2"

- **Ort:** `time-of-day-header.tsx` (TimeOfDayChips), Wand-Spalte 251 px.
- **Beobachtung:** Seit den grösseren Chips (B-13) zeigt Mias Gruppe "Tagsüber" nur "Hände waschen" und "Tisch decken" plus die Ziffer "+2". Schuhe und Blumen sind unsichtbar. Belege: `RB/r3-wall-mia-next.png`, `RB/z3-dark-chips.png`.
- **Erwartet:** Die Chip-Zeile zeigt ohne Lesen, was später kommt. "+2" ist eine Zahl.
- **Lösung:** In schmalen Spalten die Chips überlappend stapeln (−8 px) oder auf zwei Zeilen umbrechen. Statt "+2" gestapelte, leicht versetzte Kärtchen zeigen.

#### B-19 · S3 · Wand-Fokus scrollt den Personenkopf weg; Chip-Zeile als schmaler Streifen unter der Avatarleiste

- **Ort:** `chores-view.tsx` (Scroll zur Karte "als Nächstes" auch an der Wand).
- **Beobachtung:**
  - An der Wand im Fokus-Modus liegen der grosse Avatar und der Sternzähler bei y = 69, verdeckt.
  - Von der Chip-Zeile "Tagsüber" ist nur ein etwa 24 px hoher, antippbarer Streifen direkt unter der Avatarleiste zu sehen. Das Mess-Snippet meldet deshalb `tight`.
  - Die Sterne fliegen dann zum kleinen Avatar statt zum Zähler.
  - Beleg: `RB/audit3-ref-wall-chores-focus.png`.
- **Lösung:** An der Wand nur scrollen, wenn die Karte ausserhalb liegt, und auf ganze Gruppen einrasten, also den Scroll-Offset auf die Oberkante der aktuellen Gruppe setzen. Den Kopf mit Stern-Pill im Fokus `sticky` halten.

### Offen nach Runde 3

- **S1:** keiner.
- **S2:** B-16, B-17.
- **S3:** B-02 (Handy ohne Toast), B-11, B-12, B-14 (Pyjama/Anziehen-Pose), B-18, B-19.

**Abnahme möglich, sobald B-16 und B-17 behoben und nachgeprüft sind.**

Screenshots Runde 3 (unter `RB/`):
- Seiten und Galerie: `c-*`, `gallery3.png`, `tz3-*`
- Touch-Tests: `r3w-*`, `r3wf-*`, `r3wd-*`, `r3t-*`, `r3p-*`, `r3pf-*`, `r3pfd-*`, `r3tfd-*`, `r3wm-*`, `r3wpic-*`, `r3ppic-*`
- Für alle, Kalender, PIN, Chips: `who3-*`, `cal3-*`, `pin3-*`, `z3-dark-chips.png`, `r3-wall-mia-next.png`
- Messungen: `audit3.txt`, `measure3.txt`, `idle3.txt`

---

## Runde 4

Stand 01.10.2026, 01:14–01:23 MESZ. Server frisch, Demo-DB neu geseedet (Mia `cmuoq1shb0008ysw5pbp77p27`, Leo `cmuoq1shb000aysw5v9p6ofoc`).
04, 05, 07 und 08 habe ich nicht gelesen, und ich habe keinen Code geändert. Tageszeiten per Zeitzonen-Override: Morgen `Asia/Tokyo`, Tag `Pacific/Kiritimati`, Abend `Etc/UTC`.

**Vorfall beim Aufräumen, bitte an den Funktionstester weitergeben:**
- **Was passiert ist:** In den ersten B-16-Läufen (01:15–01:18) hat mein Cleanup alle neuen Completions **Leos** gelöscht. Dabei entfernte es 6 Completions von `TEST leo1`, die parallel entstanden waren und nicht von mir stammten.
- **Stand jetzt:** Danach habe ich das Skript auf die 20 Demo-Aufgaben beschränkt. `completionsToday` enthält jetzt wieder genau die 3 Seed-Einträge.

### Nachprüfung

**B-16: behoben.** Echte Touch-Events, DB-Zählung nur für Demo-Aufgaben:

| Gerät · Ansicht | Ziel | 300 ms | 800 ms |
|---|---|---|---|
| Wand · Gesamt | Bild | 1 | 1 |
| Handy · Gesamt | Bild | 1 | 1 |
| Handy · Fokus | Bild | – | 1 |
| Tablet · Gesamt | Ring | 1 | 1 |

Weitere Prüfungen:
- **Unter dem Finger:** Beim zweiten Tipp liegt dort immer die erledigte Karte, nie ein ↶.
- **↶-Platzierung:** Auf keiner Karte gibt es ein ↶ (`cardUndo: null`). Es steht nur im Toast unten mittig (56 px) und ist ab 600 ms aktiv.
- **Einzeltipp:** Latenz 157 ms inklusive CDP und 60 ms Halten; ↶ im Toast nach 1 s wirkt.
- **Ältere erledigte Karte:** Ein Tipp nach 13 s öffnet den Toast, und ↶ wirkt. Das sind 2 Tipps.
- Belege: `RB/r4w-*`, `RB/r4p-*`, `RB/r4t-*`, `RB/r4pf-*`.

**B-17: behoben.** Wand 1280×800, sichtbare Höhe der Karte "als Nächstes" innerhalb des Spalten-Scrollbereichs (`RB/b17.mjs`, `RB/r4-b17-*.png`):

| Phase | Mia erledigt (Phase) | Mia "als Nächstes" | sichtbar | Mama / Papa / Leo |
|---|---|---|---|---|
| Morgen 08:18 | 1 (Seed) / 2 / 3 = alle | Zähne putzen / Bett machen / Pause | 96/96 / 96/96 / – | 96/96 / Pause / 96/96 |
| Tag 13:18 | 0 / 2 / 4 = alle | Hände waschen / Blumen giessen / Zähne putzen (nachholen) | 96/96 jeweils | 96/96 / Pause / 96/96 |
| Abend 23:18 | 0 / 2 / 4 = alle | Spielzeug / Zähne putzen / Hände waschen (nachholen) | 96/96 jeweils | 96/96 jeweils |

Morgens hat Mia nur 3 Aufgaben, 1 davon ist bereits per Seed erledigt. Die Stufe "0" gibt es morgens deshalb nicht; ich habe 1/2/3 geprüft.

Der ✓-Streifen steht jetzt am Gruppenende. Die Köpfe liegen bei y = 292 und die Karten "als Nächstes" bei y ≤ 555 (Wand 1280), also bei y + 96 ≤ 651.

**Weitere:**
- **B-11 ✕:** 56×56 ✓. Die Titel-Mindestlänge ist nicht umgesetzt. Das ist akzeptiert, S3 bleibt als Hinweis.
- **B-12:** Leere Essens-Zellen zeigen ein neutrales Teller-Symbol, "Hinzufügen" erscheint nur noch als `aria-label` (`RB/r4-meals.png`). Behoben.
- **B-19:** Im Wand-Fokus bleibt der Personenkopf sichtbar (y = 177, als Nächstes bei y = 484). Behoben, als Nebenbeobachtung.

### Abwägung "↶ nur im Toast" gegenüber meinem B-02

Die Entscheidung ist **tragfähig**. Ich schliesse B-02 damit als "durch Entscheidung ersetzt, akzeptiert".

Dafür spricht:
- **Kein ↶ unter dem Finger.** Das löst B-16 strukturell, nicht nur über Zeitfenster.
- **Ein einziger, fester Ort.** Konsistenzregel 2 bleibt gewahrt.
- **Unten mittig.** Das ist für kleine Kinder erreichbar.
- **Erkennbarer Bezug.** Der Toast zeigt Bild, Avatar und "+N" derselben Aufgabe, dadurch bleibt der Bezug ohne Lesen erkennbar.

Dagegen spricht:
- **Nicht am Ort der Handlung.** Regel 3.5 verlangt die Rückmeldung an der Karte **und** im Toast. Die Karte zeigt aber den Zustand, gefüllt mit ✓ und ohne Sprung, und das ist die eigentliche Rückmeldung.
- **Nur ein Toast-Platz.** Das ist der einzige echte Nachteil, siehe B-20.

### Fünf Fragen × Gerät (Runde 4)

| Frage | Wand 1280 | Wand 1920 | Tablet | Handy |
|---|---|---|---|---|
| 1 Eigene Aufgaben erkennen | Ja | Ja | Ja | Ja |
| 2 Handlung ohne Lesen | Ja | Ja | Ja | Ja |
| 3 Was ist als Nächstes? | Ja | Ja | Ja | Ja |
| 4 Abschliessen und korrigieren | Ja | Ja | Ja | Ja |
| 5 Übersicht bei vielen Aufgaben | Ja | Ja | Ja | Ja |

Belege je Frage:
- **Frage 1:** Kopf-Avatar an der Wand jetzt 56 px, genau am Minimum. Handy 72, Fokus 96.
- **Frage 2:** Galerie aus Runde 3 mit 20/20 Treffern, Bilder unverändert. `RB/d-notext-*` und `RB/d-gray-*` zeigen die Zustände auch in Graustufen eindeutig.
- **Frage 3:** B-17-Tabelle; Handy-Fokus: Karte bei y = 611.
- **Frage 4:** B-16-Tabelle, Offline wie in Runde 3.
- **Frage 5:** `cutCount` 0 in Karten; `small`, `tight` und `invisible` leer auf `/`, `/chores` und `/calendar` (Wand und Handy); `hScroll` false. Keine Konsolenfehler.

### AK-8, AK-15, AK-37

| AK | Ergebnis |
|---|---|
| AK-8 | ✓ mit Einschränkung. ↶ 56 px im Toast, 1 Tipp innerhalb 8 s, danach 2 Tipps (Karte oder Mini-Bild, dann ↶), symbolgleich, Frage 4 = Ja. Die Forderung "an der Karte" ist per Koordinator-Entscheidung entfallen. Einschränkung: Haken zwei Kinder innerhalb von 8 s ab, braucht das erste 2 Tipps (B-20). |
| AK-15 | ✓ Wand 1280 und 1920: Köpfe bei y = 292, alle Karten "als Nächstes" vollständig im Spalten-Scrollbereich, in 3 Phasen × 3 Erledigt-Stufen |
| AK-37 | ✓ Alle 5 Fragen Ja auf Wand, Tablet und Handy |

### Neue Befunde

#### B-20 · S3 · Nur ein Toast-Platz: das erste von zwei Kindern verliert sein 1-Tipp-↶

- **Ort:** `chores-view.tsx`, `KidToast` ("one toast at a time").
- **Beobachtung:** Leo hakt "Wasser trinken" ab, 1,2 s später hakt Papa "Müll" ab. Der Toast zeigt nur noch 🧔 "+2" mit ↶. Leo braucht jetzt 2 Tipps (Karte, dann ↶). Beleg: `RB/r4-two-kids.png`, Log `two.mjs`.
- **Erwartet:** AK-8, innerhalb von 10 s höchstens 1 Tipp für jedes Kind.
- **Lösung:** Bis zu 2 Toasts gestapelt zeigen, den jüngsten unten. Oder ein Toast mit je einem ↶ pro Avatar, jeweils mit eigenem Countdown-Ring.

#### B-21 · S3 · Fortschritts-Pill fällt ab 5 Aufgaben pro Gruppe auf Ziffern zurück

- **Ort:** `time-of-day-header.tsx`, `MAX_DOTS = 4`.
- **Beobachtung:** Eine Gruppe mit 5 oder mehr Aufgaben zeigt "0/6" statt Punkten. Textlos ist der Pill dann leer (`RB/d-gray-wall-chores.png`, Mama/Jederzeit; ausgelöst durch TEST-Objekte). Die Demo-Kinder haben höchstens 4 pro Gruppe.
- **Lösung:** Bis 8 Punkte kleiner zeichnen oder als Balken mit Segmenten. Die Zahl nur zusätzlich für Erwachsene zeigen.

### Offen nach Runde 4

- **S1:** keiner.
- **S2:** keiner.
- **S3:** B-11 (Titel-Mindestlänge), B-14 (Pose Anziehen/Pyjama), B-18 (Chip-Zeile "+2"), B-20, B-21.

**Abnahme aus meiner Sicht: ja.** Das ist heuristisch, ohne Test mit Kindern. Die S3-Befunde können nach der Abnahme folgen.
