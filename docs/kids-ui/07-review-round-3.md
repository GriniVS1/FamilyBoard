# 07 – Review Runde 3: Nachprüfung der offenen Punkte, Nebenwirkungen, Abschluss-AK

Stand 30.09.2026, 23:30–23:55 MESZ, Branch `feat/kid-friendly-ui` (uncommitted), Dev-Server `http://localhost:3100`, Demo-DB neu geseedet.
Reviewer A, derselbe wie in Runde 1 und 2. Fix-Meldungen gelten nicht als Beleg; alles ist real nachgeprüft. Die Aussagen sind **heuristisch**, getestet wurde nichts mit Kindern.

**Belegpfade:** `R3/` = `/private/tmp/claude-501/-Users-nicolasgrichting-Projects-FamilyBoard/b0cf85df-e1a2-4f90-800d-1766496b03da/scratchpad/review3/`. Die Skripte sind die aus Runde 2 mit neuen IDs, dazu neu: `lock.mjs`, `pic2.mjs`, `hold.mjs`, `nextvis.js`, `pillover.js`, `calscroll.mjs`, `pinwrong.mjs`, `pinfast.mjs`.

**Methodik:**
- Weil um 24:00 der Server-Tag wechselt, laufen alle Browser-Tests mit Client-Zeitzone `America/New_York` (Abendphase, ca. 17:30–17:50).
- Andere Phasen wurden per Override geprüft: `Pacific/Pago_Pago` = Morgen, `America/Denver` = Tag, `Asia/Kolkata` = Nacht. Der Kalender lief in Lokalzeit.

**Vorfall:**
- Um 23:44 traf `q4c.mjs` versehentlich eine fremde Completion ("Spielzeug aufräumen", von Reviewer B oder vom Funktionstester) und machte sie über den Toast rückgängig.
- Um 23:46 habe ich sie per `POST /api/chores/<id>/complete` für Mia wiederhergestellt. Die ID ist jetzt neu: `cmuomxdnf0089106u5l2bq5p4`. Bitte an B und den Funktionstester weitergeben.
- Meine übrigen Tests löschen nur eigene Completions.

---

## Kurzfazit

1. Alle zehn offenen Punkte aus Runde 2 sind real nachgeprüft: 7 behoben, 3 teilweise; R1-02 davon bewusst akzeptiert.
   - R2-01: Tipps während des Umsortierens werden verworfen, nie mehr eine falsche Aufgabe.
   - R2-03: Im Handy-Fokus ist "als Nächstes" ganz sichtbar.
2. Die fünf Fragen sind auf allen Geräten Ja. Frage 2 ergibt 20/20, auch mit den neuen Motiven `set-table`, `backpack` und `pajamas`.
3. **Ein neuer S2-Befund (R3-01):** Das ↶ ersetzt nach 600 ms das Bild. Ein zweiter Tipp aufs Bild nach 0,7–1 s macht die Aufgabe wieder rückgängig (Wand und Handy). Das ist ein langsamer Doppeltipp, genau dort, wo Kinder am ehesten tippen.
4. Fünf neue S3-Befunde:
   - dauerhaftes Toast-Band kostet 72 px;
   - "Aufgaben" nur auf dem Handy fest auf Platz 2;
   - Kalender-Randfall kurz vor Mitternacht;
   - Label unter der Punkt-Pill;
   - stumm verworfene Tipps.
5. Abnahme: **nach Behebung von R3-01 ja**. Alles andere ist S3.

---

## 1. Offene Punkte aus Runde 2

| Punkt | Schwere | Urteil | Beleg |
|---|---|---|---|
| **R2-01** Umsortieren verschiebt "als Nächstes" | S2 | **behoben** | Siehe unten |
| **R2-03** Handy-Fokus: "als Nächstes" unter der Nav | S2 | **behoben** | "als Nächstes" y 611–707, Nav bei 761; "Für alle"-Chips im Fokus ausgeblendet; Banner 57 px (`R3/phonefold.js`) |
| **R1-02** Rest Tablet | S3 | **teilweise, bewusst akzeptiert** | Layout unverändert: Mia bei x = 748, Leo bei 1050 (`R3/ref-tablet-chores.png`). Weg über die Avatarleiste mit 1 Tipp funktioniert |
| **R1-05** Topbar nachts | S3 | **behoben** | Um 03:10 zeigt die Topbar den Schlafmond mit Mütze und Z (`R3/clip-topbar-night.png`); Spalten und Phasen-Kachel ebenso (`R3/tz-night-ref-wall-chores.png`) |
| **R1-10 → R2-02** Spalten schrumpfen beim Toast | S3 | **behoben** (Nebenwirkung R3-02) | Siehe unten |
| **R1-14 → R2-05** Kalender scrollt die Seite; Spuren kollidieren | S3 | **behoben** (Rest R3-04) | Siehe unten |
| **R1-16** Ring < 56 px | S3 | **teilweise** | Siehe unten |
| **R2-04** Leo in der Tagphase abgeschnitten | S3 | **behoben** | Alle Spalten 267 px in Morgen, Tag und Abend, `min-width: 0` (`R3/colw.js`, `R3/tz-day-ref-wall-chores.png`) |
| **R2-06** "Aufgaben" hinter "Mehr" | S3 | **behoben** (Handy), Rest R3-03 | Handy: `phoneKidKeys` stellt `chores` fest auf Platz 2 (`app-shell.tsx:77-85`) |
| **R2-07** Demo-PIN im Bug-Report | S3 | **behoben** | Siehe unten |

Details zu den Zeilen mit "Siehe unten":

- **R2-01 (behoben):**
  - `R3/mistap.mjs`, Tipp bei 8,2 s auf die alte Position von "als Nächstes": Es wird **nichts** abgehakt, die Layout-Sperre verwirft den Tipp. Vorher traf er "Zähne putzen".
  - Bei 12 s trifft ein Tipp die Karte, die dort seit 4 s sichtbar liegt. Das ist korrekt, kein Fehltipp.
  - Gehaltenes Layout: Berührung der Spalte bei 7 s, dann bleibt die Karte bei 9,5 s stehen und wandert erst bei ~10–11 s in den ✓-Streifen (`R3/hold.mjs`).
- **R1-10 → R2-02 (behoben, Nebenwirkung R3-02):** Spaltenhöhe über 11 s konstant 397 px mit und ohne Toast, `main` padding-bottom konstant 48 px (`R3/shrink.mjs`).
- **R1-14 → R2-05 (behoben, Rest R3-04):**
  - Seite `scrollY` 0; nur das Raster scrollt intern, Datumsnavigation und Personenfilter bleiben sichtbar (`R3/cal-ref-wall-calendar.png`, `R3/cal-ref-phone-calendar.png`).
  - Ab 3 parallelen Terminen erscheint "+2 weitere", ein Tipp öffnet die Tagesansicht mit breiten Spuren (`R3/calscroll-wall-afterplus.png`).
  - Solo-Filter sofort (4 Blöcke nach 150 ms).
- **R1-16 (teilweise):** Wand 1280 wieder 52 px (Runde 2: 48), Wand 1920 56, Fokus 64, Handy 56 (`R3/m-chores.txt`). E1 verlangt 56–64; an der Hauptgrösse fehlen 4 px.
- **R2-07 (behoben):**
  - Die PIN steht nicht mehr im Nav-Bug-Report.
  - Zwei weitere Treffer der Ziffernfolge sind zufällige Teilstrings: das Token-Alphabet in `mobile-tokens.ts` und ein Secret-Platzhalter in einem alten Bug-Report. Beides ist kein PIN-Leck.

---

## 2. Neue Verhaltensweisen: Nebenwirkungen

| Verhalten | Ergebnis | Beleg |
|---|---|---|
| Gehaltenes Layout: Umsortieren erst nach ≥ 3 s ohne Berührung und geschlossenem ↶-Fenster | wirkt | Siehe unten |
| Tipp-Sperre 600 ms für andere Karten derselben Spalte | nicht zu restriktiv; Rückmeldung fehlt (R3-06) | Siehe unten |
| Layout-Sperre 600 ms | wirkt; stumm (R3-06) | Tipp bei 8,2 s während der Bewegung wird verworfen (`R3/mistap.mjs`) |
| ↶ ersetzt nach 600 ms das Bild der erledigten Karte | **Fehler, R3-01** | Siehe unten |
| 72 px dauerhaft reservierter Toast-Raum | kein Springen mehr; kostet Platz (R3-02) | Siehe unten |
| Kalender scrollt nur das Raster | wirkt; Randfall spätabends (R3-04) | Siehe unten |
| "+N"-Sammelblock | wirkt | "+2 weitere" → Tagesansicht; Abstand zum Nachbarblock 7 px (R3-04) |
| Lizenzbanner einzeilig | wirkt | Wand eine Zeile, Handy "Testzeitraum: noch 6 Tage · Aktivieren", 57 px |
| Nav "Aufgaben" fest auf Platz 2 | nur auf dem Handy (R3-03) | Die Leiste an Wand und Tablet folgt weiter der gespeicherten Reihenfolge (`app-shell.tsx:114`) |
| PIN-Pad schliesst nach 2 Fehlversuchen | wirkt | Siehe unten |

Details zu den Zeilen mit "Siehe unten":

- **Gehaltenes Layout:**
  - Ohne Berührung wandert die erledigte Karte bei 8,0 s, nach dem Ende des ↶-Fensters.
  - Mit Berührung bei 7 s bleibt sie bis ~10–11 s stehen (`R3/shrink.mjs`, `R3/hold.mjs`).
- **Tipp-Sperre (`R3/lock.mjs`):**
  - Zweite Karte derselben Spalte nach 300 ms: verworfen. Nach 550, 700 und 1200 ms: erledigt.
  - Andere Spalte nach 300 ms: erledigt.
  - Zwei *verschiedene* Aufgaben innerhalb einer halben Sekunde sind für ein Kind kaum absichtlich, deshalb ist die Sperre nicht zu restriktiv. Der verworfene Tipp bleibt aber ohne jede Rückmeldung (R3-06).
- **↶ im Bild (R3-01):**
  - Tipp aufs Bild, zweiter Tipp aufs Bild nach 300 ms: bleibt erledigt.
  - Nach 700 bzw. 1000 ms (Wand) und 800 ms (Handy): unter dem Finger liegt "Rückgängig", die Aufgabe ist **rückgängig** (`R3/pic2.mjs`).
  - Doppeltipp auf den Ring bleibt sicher (`R3/dbl.mjs`, `R3/dbl2.mjs`).
- **Toast-Raum (R3-02):**
  - Spalten konstant 397 px, vorher 469 px ohne Toast.
  - Unter den Spalten liegen immer 120 px leer (`R3/nextvis.js`), Mias und Leos "als Nächstes" sind unten um 11 px abgeschnitten.
- **Kalender (R3-04):**
  - Kopf und Filter sind immer sichtbar.
  - Um 23:42 steht die Jetzt-Linie beim Öffnen am unteren Rand, nur ~4 px des Zeit-Chips sind sichtbar (`R3/cal-ref-wall-calendar.png`); nach Scrollen ist sie klar zu sehen (`R3/calscroll-wall-afterplus.png`).
- **PIN-Pad (`R3/pinwrong.mjs`):**
  - 1. Fehlversuch: Hinweis "Falscher PIN", Pad offen. 2. Fehlversuch: Pad schliesst.
  - Richtige PIN mit 150 ms pro Ziffer: alle 6 Ziffern registriert, Eltern-Modus aktiv (`R3/pinfast.mjs`).
  - Hinweis: Der Server-Limiter erlaubt 5 Versuche pro Minute und IP, und alle lokalen Agenten teilen sich 127.0.0.1.

### Frage 2: alle 20 Demo-Aufgaben nur aus dem Bild

Grundlage: `R3/clip-tasks-all.png`, `R3/clip-tasks-row1a.png`, `R3/clip-tasks-row1b.png`, `R3/clip-tasks-row2.png`. Nur die neuen bzw. geänderten Motive sind hier ausführlich beschrieben; die übrigen wie in Runde 2.

| # | Aufgabe | Bild | Lesart | Urteil |
|---|---|---|---|---|
| 1 | Wasser trinken | Glas, Tropfen fällt | Wasser trinken | sicher |
| 2 | Zähne putzen (Morgen) | Zahn + Bürste | Zähne putzen | sicher |
| 3 | Anziehen | Kind zieht **blaues T-Shirt** an, Pfeile | Anziehen | sicher |
| 4 | Bett machen | leeres Bett, Decke mit Pfeil | Bett machen | sicher (knapp) |
| 5 | Hände waschen | Hahn, Hand, Blasen | Hände waschen | sicher |
| 6 | Tisch decken (**neu**) | grünes Tischset mit Gabel und Messer, Teller fällt mit Pfeil auf den gestrichelten Platz | Tisch decken | sicher |
| 7 | Blumen giessen | Giesskanne + Pflanze | giessen | sicher |
| 8 | Schuhe versorgen | Schuhpaar fällt aufs Regal | Schuhe wegstellen | sicher |
| 9 | Spielzeug aufräumen | Ball + Teddy in die Kiste | aufräumen | sicher |
| 10 | Pyjama anziehen (**neu**) | Kind mit geschlossenen Augen, **rosa Pyjama mit Knöpfen und Mond**, Pfeile | Pyjama anziehen, klar anders als #3 | sicher |
| 11 | Zähne putzen (Abend) | wie 2, Gruppe Mond | Zähne putzen abends | sicher |
| 12 | Buch anschauen | offenes Buch mit Sternen | lesen | sicher |
| 13 | Bett machen (Leo) | wie 4 | Bett machen | sicher (knapp) |
| 14 | Schultasche packen (**neu**) | Rucksack, ein Heft wird oben hineingesteckt | Schultasche packen | sicher |
| 15 | Hund füttern | Hund + Napf | Hund füttern | sicher |
| 16 | Wasser trinken (Leo) | wie 1 | Wasser trinken | sicher |
| 17 | Hausaufgaben | Heft + Stift | Hausaufgaben | sicher |
| 18 | Müll rausbringen | Tonne, Abfall fällt | Müll wegwerfen | sicher |
| 19 | Pflanzen giessen (Mama) | wie 7 | giessen | sicher |
| 20 | Wäsche zusammenlegen | gefalteter Stapel, Shirt wird umgeklappt | Wäsche falten | sicher |

Ergebnis: **20/20 sicher**, 2 knapp. Die neuen Motive zeigen jetzt die Handlung (Teller aufs Set, Heft in den Rucksack) statt nur den Gegenstand. `pajamas` und `get-dressed` sind durch Farbe, Knöpfe und Mond klar getrennt.

---

## 3. Die fünf Review-Fragen × Gerät (letzte Runde)

| Frage | Wand 1280×800 | Wand 1920×1080 | Tablet 768×1024 | Handy 390×844 |
|---|---|---|---|---|
| **1** Eigene Aufgaben über Avatar | **Ja** – 4 Spalten + "Für alle"-Chip im 1. Viewport, in allen Phasen (`R3/ref-wall-chores.png`, `R3/colw.js`) | **Ja** – 5 Spalten inklusive "Für alle" (`R3/m-chores.txt`) | **Ja** – Avatarleiste + Chips, Kinder per 1 Tipp im Fokus (R1-02 akzeptiert) | **Ja** – Avatarleiste 56 px + Chips im 1. Viewport |
| **2** Handlung ohne Lesen | **Ja** – 20/20; Nav eindeutig; `cutCount` 0 in Karten (`R3/audit.txt`) | **Ja** | **Ja** | **Ja** |
| **3** Was als Nächstes kommt | **Ja** – Morgen, Tag, Abend und Nacht korrekt, Pause mit Sanduhr, Schlafmond auch in der Topbar (`R3/tz-*`); Karte 89 % sichtbar (R3-02) | **Ja** | **Ja** | **Ja** – Fokus: "als Nächstes" y 611–707 ganz sichtbar (`R3/phonefold.js`) |
| **4** Abschliessen und korrigieren | **Ja¹** – Doppeltipp auf den Ring sicher; Fehltipp beim Umsortieren verworfen; ↶ im Toast; offline ↻ (Runde 2) | **Ja¹** | **Ja¹** | **Ja¹** |
| **5** Übersicht bei vielen Aufgaben | **Ja** – Gruppen, ✓-Streifen, gleiche Kartenhöhen 96 px, kein Springen (Einschränkung R3-02, R3-05) | **Ja** | **Ja** – Fokus einspaltig | **Ja** – Fokus: aktuelle Phase im 1. Viewport, Karten 338 px |

¹ Alle beobachtbaren Kriterien treffen zu. Aber R3-01: Ein zweiter Tipp aufs Bild nach ≥ 0,6 s macht die Aufgabe rückgängig. Das ist korrigierbar (erneut tippen), passiert aber ungewollt.

---

## 4. Abschliessende AK-Tabelle AK-1 … AK-39

| AK | Status | Beleg |
|---|---|---|
| 1 | erfüllt | Wand 96 px, Kachel 64, Picto 56 (tight) bzw. 64; Handy 80/56/48; Karten je Spalte gleich hoch (`R3/m-chores.txt`) |
| 2 | erfüllt | `cutCount` 0 in Karten auf Wand, Tablet und Handy inklusive Fokus (`R3/audit.txt`). Gruppen-Label siehe R3-05 |
| 3 | erfüllt (1 Reviewer) | Graustufen textlos: offen / ➜ + Rand / gefüllt + ✓ + Strich (Runde 2, `review2/q4gray-wall-after-tap.png`) |
| 4 | erfüllt | Offener Ring ohne ✓ |
| 5 | erfüllt | `node --test`: 51/51 grün; alle 8 geforderten Fälle vorhanden |
| 6 | teilweise | 1 Tipp, 119 ms (Wand) bzw. 97 ms (Handy) (Runde 2, `lat.mjs`); Ring an der Wand 1280 nur 52 px statt 56–64 (R1-16) |
| 7 | erfüllt | Erneuter Tipp auf erledigte Karte: Sterne unverändert, API 1 Completion (`R3/dbl.mjs`, `R3/dbl2.mjs`) |
| 8 | erfüllt (Vorbehalt R3-01) | ↶ 56 px im Toast bzw. im Bild, 1 Tipp in 8 s; danach 2 Tipps; ↶ überall gleich |
| 9 | erfüllt | Nach ↶: offen, Sterne zurück, Completion weg (`R3/pic2.mjs`: 0 Completions; Runde 2 `q4c.mjs`) |
| 10 | erfüllt | Sterne, "+N"; "als Nächstes" springt sofort; "Alles geschafft!" (Runde 2 `alldone.mjs`) |
| 11 | erfüllt | Offline: Karte offen, gestrichelt, Oops + ↻; Toast mit Aufgabenbild; ↻ sendet erneut, kein Rohtext (Runde 2 `off-wall-1-t2.png`) |
| 12 | erfüllt | Skelett in Endform, keine "0" und kein "hinzufügen" (Runde 2 `st-delay`) |
| 13 | erfüllt | Oops + ↻ 64 px + eine Zeile; veraltete Daten sichtbar; Dashboard behält Avatare (Runde 2 `st-*`) |
| 14 | erfüllt | "Wer war's": Picto 72, Avatare 72, Stempel 40 px (Runde 2 `who.mjs`); zusätzlich direkt über den "Für alle"-Chip erreichbar |
| 15 | erfüllt | Wand 1280: 4 Köpfe + 4 × "als Nächstes" im 1. Viewport, alle Phasen (R3-02: 11 px unten angeschnitten) |
| 16 | erfüllt | Feste Reihenfolge, aktuelle Phase + Jederzeit offen, ✓-Streifen ab 2 |
| 17 | erfüllt | `hScroll` false auf allen Handy-Seiten; Avatarleiste im 1. Viewport |
| 18 | erfüllt | `?member=`, "Alle" 106×64, Avatar erneut, Browser-Zurück (Push), Idle 120 s aus beiden Einstiegen (Runde 2 `hist.mjs`, `idle2.mjs`) |
| 19 | erfüllt | Dashboard-Avatar 1 Tipp → Fokus; 96 px (Wand) / 72×164-Link (Handy) mit Tagesring; "Für alle"-Kachel |
| 20 | erfüllt | Ring = heute erledigt/gesamt, Wochensterne nur im Pill |
| 21 | erfüllt | Emoji 58 % (42/72, 56/96, 32/56) |
| 22 | erfüllt | Alle Termine, vergangene abgeschwächt ≥ 4,5:1, Skelett beim Laden (Runde 2) |
| 23 | erfüllt | Picto 40–46, Avatar 40, Phasen-Abschnitt, laufend markiert |
| 24 | erfüllt | Solo sofort (4 Blöcke nach 150 ms), zweiter Tipp → alle (`R3/cal2.mjs`) |
| 25 | erfüllt (gegen E5) | Stunden-Tipp öffnet Dialog (E5); Jetzt-Linie sichtbar, Randfall spätabends (R3-04) |
| 26 | erfüllt | Nav-Picto 44 (Leiste) / 32 (Handy, auch "Mehr"), Labels einzeilig |
| 27 | erfüllt | 5 Einträge à 68×66 |
| 28 | erfüllt | Aktiv = Tint + Schatten + Balken, auch in Graustufen |
| 29 | erfüllt | Kinder vor Erwachsenen; Handy: "Aufgaben" fest auf Platz 2 |
| 30 | erfüllt | `small` leer überall, `tight` 0 auf `/` und `/chores`. Die gemeldeten Paare im Fokus- und Kalender-Scroll sind Messartefakte: geclippte Elemente, `elementFromPoint` trifft sie nicht (`R3/efp.js`). Rest: 7-px-Lücke im Kalender (R3-04) |
| 31 | erfüllt | `invisible` leer |
| 32 | erfüllt (gegen E5) | Kinder-Modus ohne + und ✏️; "Bearbeiten 🔒" → PIN → +, ✏️, Banner; Pad schliesst nach 2 Fehlversuchen; 5 min / 120 s per Code |
| 33 | erfüllt | Kein `window.confirm`-Aufruf (1 Kommentar-Treffer); In-App-Dialog (Runde 2 `e5.mjs`) |
| 34 | erfüllt | `--reduced`: 0 laufende Animationen auf `/` und `/chores` (`R3/anim.js`); Tick ohne Burst (Runde 2) |
| 35 | erfüllt | Fokusring 4 px `#1952f0` an allen Bedienelementen inklusive Lizenzbanner (Runde 2 `tab.mjs`) |
| 36 | erfüllt | Keine englischen Texte oder Labels auf Kinderseiten (Runde 2 `en.js`); einheitlich "ss" |
| 37 | erfüllt (Vorbehalt R3-01) | Alle 5 Fragen Ja auf Wand, Tablet und Handy |
| 38 | erfüllt | Bild → Wer? → Wann? → Sterne → Titel; nach Bildwahl Speichern aktiv, Titel vorbefüllt (Runde 2 `parent.mjs`) |
| 39 | erfüllt | Stern-Knöpfe 56×56, kein Schieberegler |

---

## 5. Neue Befunde

### R3-01 · S2 · Zweiter Tipp aufs Bild nach ≥ 0,6 s macht das Abhaken rückgängig

**Ort:** `src/components/chores/task-card.tsx:73-76`, `:246-262` (↶ `size="fill"` über der Bildkachel); `kids/undo-button.tsx:49-60` (sichtbar = sofort scharf).

**Beobachtung:**
- Nach dem Abhaken wird das Bild nach 600 ms zu ↶, und dieses ↶ ist ab dem Erscheinen sofort scharf.
- Real getestet (`R3/pic2.mjs`): zweiter Tipp auf dieselbe Bildstelle nach 700 ms und 1000 ms (Wand) sowie 800 ms (Handy-Fokus).
  - `elementFromPoint` liefert "Rückgängig", die Completion ist weg.
  - Bei 300 ms bleibt die Aufgabe erledigt.
- Das Bild ist das auffälligste Ziel der Karte; die "als Nächstes"-Demo lenkt den Blick zusätzlich darauf.
- Kinder tippen oft zweimal im Abstand von 0,5–1 s, etwa weil sich das Bild gerade verwandelt hat. Das ist dieselbe Fehlerklasse wie R1-01, nur langsamer und am Bild statt am Ring.

**Erwartet:** Ein zweiter Tipp auf die Stelle des ersten Tipps macht innerhalb von ~1,5 s nie rückgängig; ↶ erscheint nicht unter dem Finger.

**Lösung:**
1. Bei frischen Haken ↶ **nur im Toast** zeigen, unten mittig und weg vom Tipp-Ort. Die Karte behält Bild + ✓. Das ↶ im Bild bleibt dem 2-Tipp-Weg für ältere Karten vorbehalten.
2. Alternativ: ↶ erst scharf schalten, wenn nach dem Erscheinen ein **neuer** `pointerdown` beginnt, der ≥ 800 ms nach dem Abhak-Tipp liegt, und den Tipp-Ort merken; liegt ↶ darunter, weitere 1 s sperren.
3. Einen Test ergänzen: Bild zweimal mit 700 ms und 1000 ms Abstand tippen → bleibt erledigt.

### R3-02 · S3 · Dauerhaftes Toast-Band kostet 72 px auf der Hauptgrösse

**Ort:** Wand 1280 `/chores`; reservierter Toast-Raum (Fix zu R2-02).

**Beobachtung:**
- Spalten sind immer 397 statt 469 px hoch, unter ihnen liegen stets 120 px leer (`R3/nextvis.js`, `R3/ref-wall-chores.png`).
- Mias und Leos Karte "als Nächstes" ist unten um 11 px abgeschnitten (89 % sichtbar); pro Spalte passen ~0,7 Karten weniger.

**Lösung:**
- Toast an der Wand in die freie Kopfzeile rechts neben die Avatarleiste setzen (dort ist Platz), das Bodenband entfernen.
- Oder das Band auf 56 px verkleinern und den Toast halb über den Spaltenrand legen.

### R3-03 · S3 · "Aufgaben" nur auf dem Handy fest auf Platz 2

**Ort:** `src/components/shell/app-shell.tsx:77-85` (nur `phoneKidKeys`), `:114` (Leiste nutzt `kidKeys`).

**Beobachtung:** Mit einer gespeicherten Reihenfolge wie `calendar, meals, photos, chores` steht "Aufgaben" auf dem Handy auf Platz 2, in der Wandleiste aber auf Platz 5. Auf dem Hauptgerät gilt die Pinnung nicht, und die Reihenfolge weicht zwischen den Geräten ab.

**Lösung:** Dieselbe Pinnung (`dashboard`, `chores`, Rest) auch für die Leiste verwenden; in den Einstellungen "Aufgaben" als fixiert zeigen.

### R3-04 · S3 · Kalender: Jetzt-Linie spätabends am unteren Rand; 7 px zwischen parallelen Blöcken

**Ort:** `calendar-view.tsx` (Scrollziel), `layout-utils.ts` (Spuren).

**Beobachtung:**
- Um 23:42 liegt die Jetzt-Linie nach dem Öffnen am unteren Rand des Rasters; vom Zeit-Chip sind ~4 px sichtbar (`R3/cal-ref-wall-calendar.png`). Grund ist das Scrollziel "jetzt − x h" bei begrenzter Rasterhöhe (Wand: 457 px).
- Woche: "Schwimmen" (x 511–577) und "+2 weitere" (x 584) liegen 7 px auseinander (`R3/calscroll.mjs`).

**Lösung:**
- Das Scrollziel so klemmen, dass die Linie im oberen Drittel liegt; bei Ende des Tages auf `scrollHeight - clientHeight` begrenzen und die Linie mindestens 48 px über dem Rand halten.
- Spurabstand 8 px.

### R3-05 · S3 · Gruppen-Label unter der Punkt-Pill abgeschnitten

**Ort:** Wand 1280, Mias Spalte, Tagphase; `time-of-day-header.tsx`.

**Beobachtung:** "Tagsüber" braucht 76 px, sichtbar sind 63 px; der Rest liegt unter der 4-Punkte-Pill (`R3/pillover.js`, `R3/tz-day-ref-wall-chores.png`: "Tagsübe○○○○"). Es gibt keine Auslassungspunkte, der Text wird einfach abgeschnitten.

**Lösung:** Punkte in schmalen Spalten auf 3 + "+N" begrenzen oder das Label `truncate` machen; für Kinder trägt das Phasensymbol die Bedeutung.

### R3-06 · S3 · Gesperrte Tipps verschwinden ohne Rückmeldung

**Ort:** Tipp-Sperre und Layout-Sperre in `chores-view.tsx` (`handlePress`).

**Beobachtung:** Ein Tipp auf eine andere Karte derselben Spalte innerhalb von ~0,5 s oder während einer Kartenbewegung wird verworfen, ohne sichtbare Reaktion (`R3/lock.mjs` 300 ms, `R3/mistap.mjs` 8,2 s). Ein Kind weiss nicht, dass es nochmals tippen soll.

**Lösung:** Beim verworfenen Tipp die Karte kurz "einfedern" lassen (`scale .97`, 120 ms, auch bei reduzierter Bewegung als Überblendung), ohne Zustandswechsel.

---

## 6. Offen nach Runde 3

| Schwere | Offen |
|---|---|
| S1 | – |
| S2 | **R3-01** |
| S3 | R1-02 Tablet (akzeptiert), R1-16 (Ring 52 px an der Wand 1280), R3-02, R3-03, R3-04, R3-05, R3-06 |

**Abnahme:** aus meiner Sicht möglich, **sobald R3-01 behoben ist**, zum Beispiel ↶ bei frischen Haken nur im Toast. Die S3-Punkte blockieren die Abnahme nicht.

## Wichtigste Screenshots (`R3/`)

- **Übersicht:** `ref-wall-chores.png`, `ref-tablet-chores.png`, `tz-day-ref-wall-chores.png`, `tz-night-ref-wall-chores.png`, `clip-topbar-night.png`
- **Fokus:** `ft-wall-chores-member-cmuomclm10008mon.png`
- **Bilder:** `clip-tasks-all.png`, `clip-tasks-row1a.png`, `clip-tasks-row1b.png`, `clip-tasks-row2.png`
- **Kalender:** `cal-ref-wall-calendar.png`, `cal-ref-phone-calendar.png`, `calscroll-wall-afterplus.png`
- **PIN:** `pin-after-2nd-wrong.png`
