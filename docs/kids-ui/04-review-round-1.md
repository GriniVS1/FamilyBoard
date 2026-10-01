# 04 – Review Runde 1: Kinder-UI der Wall-App

Stand 30.09.2026, 21:00–21:40 MESZ, Branch `feat/kid-friendly-ui` (uncommitted Stand), Dev-Server `http://localhost:3100` mit Demo-DB.
Unabhängiger Review. Ich habe am Umbau nicht mitgearbeitet. Alle Aussagen zur Verständlichkeit sind **heuristisch**. Mit Kindern wurde nichts getestet, und es gibt keine Aussage, dass die UI "für Kinder geeignet" ist.

**Belegpfade:** `R/` steht für `/private/tmp/claude-501/-Users-nicolasgrichting-Projects-FamilyBoard/b0cf85df-e1a2-4f90-800d-1766496b03da/scratchpad/review1/`. Die Dateien dort sind temporär; die Skripte, die sie erzeugen, liegen im selben Ordner (`lib.mjs`, `shoot.mjs`, `q4b.mjs`, `dbl.mjs` usw.).

**Einschränkungen:**
- Es gab nur einen Reviewer. Das Protokoll in UX 4.4 verlangt zwei.
- Ein Funktionstester hat parallel `TEST …`-Objekte angelegt, etwa "TEST Mama evening" und "TEST Fuer alle". Sie erscheinen in manchen Screenshots und wurden nicht bewertet.
- Der Zeitzonen-Override verschiebt nur die Client-Uhr. "Heute" kommt weiterhin vom Server.
- Alle Abhak-Tests wurden zurückgesetzt. Am Ende standen in `completionsToday` wieder die 3 Seed-Einträge, Mia hatte 2 und Leo 1 Wochenstern. Der Test-Chore mit langem Titel wurde gelöscht.

---

## Kurzfazit

1. Gegenüber `before/` ist das ein grosser Sprung. Es gibt Handlungs-Piktogramme, drei klar unterscheidbare Zustände (auch in Graustufen), ↶ an Karte und Toast, Fokus-Modus, Skelett, Fehlerbild mit ↻ und eine gegenständliche Navigation.
2. **Ein Blocker:** ↶ erscheint exakt an der Stelle des Rings. Ein **Doppeltipp** hakt deshalb ab und macht es sofort wieder rückgängig, bei frisch und bei älteren erledigten Karten (R1-01). Das hebelt auch den 2-Tipp-Schutz aus E3 aus.
3. Auf der Wand mit 1280 px ist Leo nur angeschnitten und "Für alle" gar nicht sichtbar (AK-15 nicht erfüllt, R1-02). Auf 1920 px passt alles.
4. Die Bildsprache ist bei 14 von 20 Demo-Aufgaben eindeutig (70 %, Soll ≥ 90 %).
   - "Pyjama anziehen" zeigt das Abend-Symbol, "Hausaufgaben" zeigt dasselbe Buch wie "Buch anschauen" (R1-03).
   - Das Nav-Bild "Aufgaben" gleicht dem Bild "To-dos" (R1-04).
5. Logik, Barrierefreiheit und Zustände sind solide.
   - "Als Nächstes" wandert korrekt über drei Tageszeiten und die Nacht; 36 Unit-Tests sind grün.
   - Tastatur, Namen, Kontrast auf Tints und reduzierte Bewegung sind in Ordnung.
   - Abnahme ist erst nach R1-01 bis R1-04 sinnvoll.

---

## Die fünf Review-Fragen × Gerät

Hell und Dunkel ergeben pro Gerät dasselbe Ergebnis; die Dunkel-Screenshots zeigen dieselbe Anordnung. Graustufen wurden für den Zustandsvergleich genutzt.

| Frage | Wand 1280×800 | Wand 1920×1080 | Tablet 768×1024 | Handy 390×844 |
|---|---|---|---|---|
| **1** Eigene Aufgaben über Avatar erkennbar | **Nein** – Leo-Spalte bei x = 1170, nur 78 px sichtbar; "Für alle" bei x = 1512 ausserhalb (`R/ref-wall-chores.png`, `R/m-chores.txt`). Avatarleiste 72 px, Emoji 42 px = 58 % ✓, alle Farben verschieden ✓, Tipp 🦄 → nur Mia ✓, "Alle" 106×64 ✓ (`focus.mjs`) | **Ja** – alle 4 Köpfe und "Für alle" mit Gruppensymbol sichtbar (`R/ref-wallhd-chores.png`) | **Ja** – Avatarleiste mit allen im 1. Viewport, Fokus per Tipp. Einschränkung: nur Mamas Spalte ganz sichtbar (`R/ref-tablet-chores-dark.png`) | **Ja** – Avatarleiste 56 px im 1. Viewport, Spalten gestapelt, Fokus funktioniert (`R/ref-phone-chores.png`, `R/ref-phone-chores-member-mia.png`) |
| **2** Handlung ohne Lesen verständlich | **Nein** – 14/20 Aufgaben sicher benannt (Tabelle unten); Nav "Aufgaben" ≈ "To-dos" (`R/clip-rail.png`) | **Nein** – dieselben Bilder | **Nein** – dazu "…" im Fokus-Modus ("Wäsche zusammenlegen", `R/audit.txt`) | **Nein** – dieselben Bilder |
| **3** Klar, was als Nächstes kommt | **Ja** – je Person genau 1 Karte mit ➜-Badge + 3-px-Rand; 09:10 / 15:10 / 21:xx / 04:10 korrekt (`R/tz-*-wallhd-chores.png`) | **Ja** | **Ja** | **Ja** – Dashboard-Picto folgt (`R/tz-morning-ref-phone-dash.png`: Mia 🦷, Leo 🎒) |
| **4** Einfach abschliessen und korrigieren | **Nein** – 1 Tipp → erledigt in 124 ms ✓, ↶ ✓, kein Doppel-Stern ✓; aber Doppeltipp (300 ms) = sofort rückgängig (`dbl.mjs`, R1-01) | **Nein** (gleicher Code) | **Nein** (gleicher Code) | **Nein** – Doppeltipp (350 ms) = rückgängig (`dbl.mjs phone`) |
| **5** Übersicht bei vielen Aufgaben | **Nein** – Leos "als Nächstes" angeschnitten, "Für alle" unsichtbar; erledigte Karte rutscht aus dem sichtbaren Spaltenbereich (`R/q4-wall-3-t9.png`) | **Ja** – Gruppen, Chips, gleiche Kartenhöhen 96 px, `cutCount` 0 | **Nein** – 1 Spalte + Anriss; Fokus 2-spaltig mit 106 px Titelbreite (`R/long-tablet-chores-member-cmuogy6o6000am7a.png`) | **Ja** – Fokus: Karten 338 px breit, "als Nächstes" bei y = 651, `hScroll` false |

### Frage 2 im Detail: Handlung aus dem Bild benannt

Grundlage: Textlos-Screenshots `R/notext-*` und die Galerie `R/crop-task-0.png`, `R/crop-task-1.png`, `R/crop-task-2.png`. Zuerst habe ich die Handlung nur aus dem Bild benannt, erst danach den echten Titel verglichen.

| # | Person | Aufgabe (Titel) | Bild zeigt | Meine Lesart ohne Text | Urteil |
|---|---|---|---|---|---|
| 1 | Mia | Wasser trinken | Glas, Tropfen fällt hinein | Wasser trinken | sicher |
| 2 | Mia | Zähne putzen (Morgen) | Zahn + Zahnbürste | Zähne putzen | sicher |
| 3 | Mia | Anziehen | Kind zieht T-Shirt an, Pfeile | Anziehen | sicher |
| 4 | Mia | Bett machen | Bett mit Decke und Funkeln | Bett machen **oder** schlafen gehen | **unsicher** |
| 5 | Mia | Hände waschen | Hahn, Hand, Seifenblasen | Hände waschen | sicher |
| 6 | Mia | Tisch decken | Tisch, Teller fällt, Tasse | Tisch decken | sicher |
| 7 | Mia | Blumen giessen | Giesskanne + Pflanze | giessen | sicher |
| 8 | Mia | Schuhe versorgen | Turnschuh mit Speed-Lines | rennen / Schuhe anziehen | **unsicher** |
| 9 | Mia | Spielzeug aufräumen | Kiste, Ball und Teddy fallen hinein | aufräumen | sicher |
| 10 | Mia | Pyjama anziehen | **Mondsichel mit Sternen** (= Symbol "Abends") | Abend / schlafen | **falsch** |
| 11 | Mia | Zähne putzen (Abend) | wie 2, Gruppe Mond | Zähne putzen (abends) | sicher |
| 12 | Mia | Buch anschauen | offenes Buch | lesen | sicher |
| 13 | Leo | Bett machen | wie 4 | wie 4 | **unsicher** |
| 14 | Leo | Schultasche packen | Rucksack | Rucksack packen | sicher |
| 15 | Leo | Hund füttern | Hund + Napf, Futter fällt | Hund füttern | sicher |
| 16 | Leo | Wasser trinken | wie 1 | Wasser trinken | sicher |
| 17 | Leo | Hausaufgaben | **offenes Buch** (wie 12) | Buch anschauen | **falsch** |
| 18 | Papa | Müll rausbringen | Tonne, Deckel, Abfall fällt | Müll wegwerfen | sicher |
| 19 | Mama | Pflanzen giessen | wie 7 | giessen | sicher |
| 20 | Für alle | Wäsche zusammenlegen | **Waschmaschine** | Wäsche waschen | **unsicher** |

Ergebnis: 14 sicher (70 %), 4 unsicher (#4, #8, #13, #20), 2 falsch (#10, #17). Das Soll ist ≥ 90 %.

Positiv:
- Gleiche Handlung zu verschiedenen Tageszeiten (#2 und #11) ist durch das Gruppensymbol unterscheidbar.
- Pro Karte gibt es genau ein hervorgehobenes Element, den Ring.
- Im Kinder-Modus sind kein "+", kein ✏️ und kein 🗑 sichtbar (`parent.mjs`: 0 Treffer).

---

## AK-Check (AK-1 … AK-39)

| AK | Status | Beleg |
|---|---|---|
| 1 | erfüllt | Wand: Karte 96 px, Kachel 72, Picto 64; Handy: 80 px, Picto 48; alle Karten je Spalte gleich hoch (`R/m-chores.txt`) |
| 2 | teilweise | Wand und Handy: `cutCount` 0. Tablet-Fokus: "Wäsche zusammenlegen" geclampt, Titelbreite 106 px (`R/audit.txt`, R1-09) |
| 3 | erfüllt (1 Reviewer) | Graustufen textlos: offen = leerer Ring; als Nächstes = ➜-Badge + dunklerer Rand; erledigt = gefüllte Karte + Strich + ✓ bzw. ↶ (`R/gray-wall-chores.png`, `R/q4gray-wall-after-tap.png`) |
| 4 | erfüllt | Offener Ring ohne ✓ (`R/ref-wall-chores.png`) |
| 5 | erfüllt | `node --test`: 36/36 grün; alle 8 geforderten Fälle vorhanden (`src/lib/chore-state.test.ts:38-153`) |
| 6 | erfüllt (gegen E1) | 1 Tipp, 124 ms bis `aria-pressed=true` (`q4.mjs`). Ziel = ganze Karte 302×92. Ring nur 52 px statt 56–64 (R1-16) |
| 7 | erfüllt | Tipp auf erledigte Karte: Sterne 4 → 4, API weiter 1 Completion (`q4b.mjs`) |
| 8 | teilweise | ↶ 56 px an Karte und Toast, 1 Tipp in 8 s ✓; danach 2 Tipps ✓ (↶ 5 s). Aber Frage 4 = Nein (R1-01), und die erledigte Karte liegt an der Wand oft ausserhalb des sichtbaren Spaltenbereichs (R1-08) |
| 9 | erfüllt | Nach ↶: offen, Sterne 4 → 2, `completionsToday` ohne ID (Karte und Toast, Wand und Handy) |
| 10 | erfüllt | Sterne fliegen, "+2"-Chip; "als Nächstes" nach 0,9 s auf "Pyjama"; Papa → "Alles geschafft!" + Pokal (`R/q4-wall-2-t2.png`, `R/alldone-t2.png`) |
| 11 | erfüllt | Offline: Karte offen, gestrichelt, Oops-Badge + ↻, Toast "Keine Verbindung" + ↻ 56 px, kein Rohtext; Karte erneut tippen → Erfolg (`R/off-wall-1-t2.png`) |
| 12 | erfüllt | Verzögertes `/api/chores`: Skelett in Endform, Avatare sofort, 0 × "hinzufügen", keine "0" (`R/st-delay-wall-chores-loading.png`) |
| 13 | erfüllt | Fehler: Wolke + ↻ 64 px + eine Zeile, kein Prisma-Text; veraltete Daten bleiben sichtbar mit Wolken-Knopf (`R/st-fail-wall-chores.png`, `R/st-stale-wall-chores.png`). Dashboard siehe R1-11 |
| 14 | erfüllt | Dialog: Picto 72, Avatare 72, Kacheln 129×132; danach Leo-Stempel 40 px auf der Karte, Sterne an Leo (`R/who-wallhd-dialog.png`, `R/who-wallhd-stamped.png`) |
| 15 | **nicht erfüllt** | 1280: Leo angeschnitten, "Für alle" unsichtbar. 1920 erfüllt (R1-02) |
| 16 | erfüllt | Reihenfolge Morgen/Tag/Abend/Jederzeit; aktuelle Phase + Jederzeit offen, andere als Chip-Zeile; erledigte am Ende. ✓-Streifen fehlt (optional, R1-08) |
| 17 | erfüllt | `scrollWidth` 390 auf `/`, `/chores`, `/calendar`; Avatarleiste im 1. Viewport |
| 18 | erfüllt | `?member=`, nur diese Person, "Alle" 106×64 bei y = 178; Rückkehr per "Alle", Avatar erneut und nach 120 s (`idle.mjs`: t100 Fokus, t127 alle) |
| 19 | erfüllt | Dashboard-Avatar → `/chores?member=…` in 1 Tipp; Wand 96 px, Handy 56 px, mit Tagesring |
| 20 | erfüllt | Ring = heute erledigt/gesamt (Mia 2/12), Wochensterne nur im Stern-Pill |
| 21 | erfüllt | 58 % in allen Grössen (42/72, 56/96, 32/56) |
| 22 | erfüllt | Alle 6 Termine inklusive vergangener (opacity 0,6); Ladezustand = Skelett (`widget-today.tsx:128,218`) |
| 23 | erfüllt | Picto 40–46, Avatar 40, Phasen-Abschnitt, laufender Termin mit Rahmen + Punkt + "Jetzt" (`R/full-ref-wall-dash-full.png`) |
| 24 | erfüllt | Tipp Mia bei "alle aktiv" → nur Mias 3 Termine; zweiter Tipp → alle. Aber ~1 s leeres Raster (R1-14) |
| 25 | teilweise (gegen E5) | Stunden-Tipp öffnet "Neues Ereignis", laut E5 gewollt. "Jetzt"-Linie existiert, liegt an der Wand aber nicht im 1. Viewport, kein Auto-Scroll (`R/calfull-crop.png`) |
| 26 | teilweise | Rail-Picto 44, Handy 32, Labels einzeilig ohne Überlauf; "Mehr" ist ein Lucide-Icon mit 18 px, kein farbiges Picto (R1-13) |
| 27 | erfüllt | 5 Einträge à 68×66 |
| 28 | erfüllt | Aktiv = Tint-Fläche + Schatten + Balken, auch in Graustufen (`R/gray-wall-chores.png`) |
| 29 | erfüllt | Kinderbereiche oben, Trenner, Erwachsene unten bzw. hinter "Mehr" |
| 30 | teilweise | `small` und `tight` leer, **ausser** Lizenzbanner "Aktivieren" 99×36 und "Ausblenden" 36×36 (E12). Kinderaktionen ≥ 92 px |
| 31 | erfüllt | `invisible` leer auf allen Seiten inklusive `/todos`, `/notes`, `/photos` |
| 32 | erfüllt (gegen E5) | Kinder-Modus ohne + und ✏️; "Bearbeiten 🔒" → PIN → 6 × "+" 56 px, 11 × ✏️ 48 px, Banner mit Restzeit. 5 min / 120 s nur per Code geprüft (`parent-mode.tsx:20-21`). To-dos/Notizen: sichtbarer Lösch-Knopf 48 px → In-App-Dialog |
| 33 | teilweise | 3 × `window.confirm` in `settings/` (R1-17). Aufgaben, To-dos, Notizen, Fotos: In-App-Dialog ✓. 8-s-↶ nach Löschen nicht geprüft (keine Demo-Daten gelöscht) |
| 34 | erfüllt | `--reduced`: 0 laufende Animationen, `next-pulse` = none, kein Burst, "+2" statisch, Endzustand sofort (`R/reduced-on-t015.png`) |
| 35 | erfüllt | Fokusring 4 px `#1952f0` (5,56:1 auf bg) an allen Nav-Links und Knöpfen; nur Lizenzbanner mit schwachem Ring (E12) |
| 36 | erfüllt | DOM-Scan auf `/`, `/chores`, `/calendar`: keine englischen Texte oder aria-labels; `error.tsx` lokalisiert |
| 37 | **nicht erfüllt** | Frage 2 und 4 überall Nein; Frage 1 und 5 an der Wand 1280 Nein |
| 38 | erfüllt | Abschnitte Bild → Wer? → Wann? → Sterne → Titel; nach Bildwahl ist Speichern aktiv, Titel vorbefüllt ("Zähne putzen"), also 2 Tipps (`R/parent-wall-picked.png`) |
| 39 | erfüllt | Stern-Knöpfe 56×56, kein `input[type=range]` |

---

## Befundliste

### R1-01 · S1 · Doppeltipp macht Abhaken sofort rückgängig; ↶ verdrängt ✓

**Ort:** `/chores` und Fokus-Modus, alle Geräte; `src/components/chores/task-card.tsx:197-230`, `src/components/chores/chores-view.tsx:206-209`.

**Beobachtung:**
- Nach dem Tipp wird der Ring ausgeblendet (`!(done && undo)`). Genau an seiner Stelle erscheint ↶, beide Mittelpunkte liegen bei (1108, 643).
- Echter Test:
  - Zwei Touch-Tipps im Abstand von 300 ms (Wand) bzw. 350 ms (Handy) auf die Ringposition.
  - Der zweite Tipp trifft laut `elementFromPoint` den Knopf "Rückgängig".
  - Ergebnis: `aria-pressed=false`, 0 Completions, Sterne unverändert (`dbl.mjs`).
- Dasselbe bei einer älteren erledigten Karte (> 8 s): Tipp 1 zeigt ↶ an der Ringstelle, Tipp 2 macht rückgängig (`dbl2.mjs`). Der Schutz "2 Tipps gegen versehentliches Rückgängig" aus E3 greift bei einem Doppeltipp also nicht.
- In den ersten 8 s zeigt die Karte ↶ statt ✓ (`R/q4gray-wall-after-tap.png`). Das auffälligste Element der gerade erledigten Karte ist damit "zurück", nicht "geschafft".

**Erwartet:** UX 2.3 und Design: "neben dem gefüllten ✓ ein ↶". Ein Doppeltipp eines Kindes darf nicht rückgängig machen.

**Lösung:**
1. Den gefüllten ✓-Ring an seiner Stelle lassen. ↶ **daneben** (≥ 16 px Abstand) oder links unter das Piktogramm setzen, nie auf die Ringposition. Auf schmalen Karten ↶ nur im Toast zeigen.
2. ↶ an Karte und Toast erst **≥ 600 ms nach dem Erscheinen** scharf schalten (`pointer-events` bzw. Zeitstempel-Guard). Dasselbe gilt für das per Tipp enthüllte ↶ auf älteren Karten.
3. Einen Test ergänzen: Doppeltipp → Karte bleibt erledigt.

### R1-02 · S2 · Wand 1280: Leo angeschnitten, "Für alle" unsichtbar; Tablet: Kinder erst nach Wischen

**Ort:** `/chores` Wand 1280×800 und Tablet; `src/components/chores/chores-view.tsx:240-243` (`min-[848px]:[--col-w:330px]`).

**Beobachtung:**
- Nutzbare Breite 1104 px (x 144–1248). Spalten sind 330 px breit, also passen 3.
- Leo beginnt bei x = 1170 (78 px sichtbar, Name nicht lesbar), "Für alle" bei x = 1512 (`R/m-chores.txt`, `R/ref-wall-chores.png`).
- Leos Karte "als Nächstes" ist nur als Streifen zu sehen.
- Tablet: Spalten 420 px, nur Mama ist ganz sichtbar; Mia und Leo stehen auf Position 3 und 4 (`R/ref-tablet-chores-dark.png`).
- Auf 1920 passt alles (`R/ref-wallhd-chores.png`).

**Erwartet:** AK-15 und E7: Spalten ≥ 260 px, alle Personenköpfe und die Karte "als Nächstes" im 1. Viewport. 4 × 260 + 3 × 12 = 1076 px < 1104 px, das würde passen.

**Lösung:**
- Die Spaltenbreite aus der Personenzahl berechnen: `--col-w: max(260px, (100% - (n-1)*12px) / n)`. Nur "Für alle" darf in den Snap-Scroll fallen.
- Auf Tablet-Portrait (768) 2 Spalten à ~290 px statt einer à 420 px.
- Die "Für alle"-Aufgaben zusätzlich als kompakte Chip-Zeile unter der Avatarleiste zeigen, damit sie ohne Wischen auffindbar sind.
- Optional: Kinder vor Eltern sortieren, dafür eine Rolle oder Reihenfolge in den Einstellungen (UX §7).

### R1-03 · S2 · Zwei Demo-Aufgaben zeigen ein falsches bzw. doppelt belegtes Bild

**Ort:** `/chores`, Dashboard, alle Geräte.
- `src/components/pictos/emoji-map.ts:38` (`🌙 → tod-evening`), `:21` (`📚 → read`)
- `src/components/pictos/resolve.ts:17-21` (Emoji schlägt Titel)

**Beobachtung:**
- "Pyjama anziehen" (🌙) zeigt exakt das Abend-Phasensymbol. Es steht zudem in der Gruppe "Abends" direkt unter demselben Symbol (`R/ref-wall-chores-member-mia.png`). Ohne Text lese ich "Abend", nicht "Pyjama".
- "Hausaufgaben" (📚) zeigt das Lese-Buch, identisch mit "Buch anschauen" (`R/tz-day-ref-wallhd-chores.png`), obwohl das Motiv `homework` (Heft + Stift) existiert.
- Beides ist ein Verstoss gegen UX §3, Regel 2 ("ein Symbol, eine Bedeutung").

**Erwartet:** Aufgabenkarten zeigen nur Aufgaben-Motive. Tageszeit-Motive kommen nie auf eine Karte (Design §7: "suggest liefert nur Aufgaben- und Termin-Motive").

**Lösung:**
1. In `resolvePicto` für Aufgaben nur Motive der Kategorie `task` zulassen. Ein Emoji, das auf `tod-*`, `nav-*` oder `feedback` zeigt, gilt als "kein Treffer", dann greift der Titel (`suggest`): "Pyjama" → `pajamas`, "Hausaufgaben" → `homework`.
2. `📚` in der Emoji-Tabelle neu entscheiden: entweder `homework` oder Mehrdeutigkeit zulassen und den Titel entscheiden lassen, wenn das Titel-Keyword ein anderes Aufgaben-Motiv trifft.
3. Das Motiv `pajamas` zeigt heute ein schlafendes Kind im Bett. Für "Pyjama anziehen" besser ein Kind, das ein gestreiftes Pyjama-Oberteil überzieht (analog `get-dressed`, mit Mond-Muster).

### R1-04 · S2 · Nav-Bild "Aufgaben" ist dem Bild "To-dos" zum Verwechseln ähnlich

**Ort:** Icon-Leiste und Bottom-Nav; `src/components/pictos/motifs/nav.tsx:146` (`nav-tasks`).

**Beobachtung:** Beide Bilder sind ein Blatt bzw. Klemmbrett mit drei grünen Häkchen-Zeilen. "Aufgaben" hat zusätzlich einen kleinen Stern unten rechts (`R/clip-rail.png`). Textlos unterscheiden sich der Kinderbereich und der Erwachsenenbereich (mit Löschknöpfen) nur durch diesen Stern.

**Erwartet:** UX 2.8: Aufgaben = "gefüllter gelber Stern mit ✓, wie die Belohnung"; jede Kachel ohne Label zuordenbar.

**Lösung:** `nav-tasks` neu zeichnen, und zwar als grossen gelben Belohnungsstern (identisch mit `star`) mit weissem ✓ darin, **ohne** Listenzeilen. `nav-todos` behält das Klemmbrett. Damit trägt die Kinder-Kachel dasselbe Symbol wie die Sterne auf Karte und Avatar.

### R1-05 · S3 · Mond vierfach belegt; "Zzz" ist Text; Nacht und Pause auf dem Dashboard kaum unterscheidbar

**Ort:**
- `src/components/chores/member-column.tsx:386-405`
- `src/components/dashboard/widget-chores.tsx:34-49`
- `src/components/chores/chores-header.tsx:43`

**Beobachtung:** Die Mondsichel bedeutet "Abends" (Gruppe, Topbar), "Nacht/Schlafenszeit", "Pause bis abends" (gedimmt) und über R1-03 "Pyjama".
- In der Spalte steht bei Nacht "Zzz" als Buchstaben-Label. Im Textlos-Test verschwindet es, und laut Picto-Stilguide ist Text im Picto verboten.
- Auf dem Dashboard zeigt die Nacht einen normalen Mond (`R/tz-night-ref-wallhd-dash.png`), die Pause einen gedimmten Mond (`R/tz-morning-ref-phone-dash.png`, Papa). Der Unterschied liegt nur in der Deckkraft.

**Erwartet:** UX §3: "Mond mit Zzz = Schlafenszeit" als eigenes Symbol; Pause = gedimmtes Symbol der nächsten Phase.

**Lösung:**
- Ein eigenes Motiv `tod-night` zeichnen, etwa einen schlafenden Mond mit geschlossenen Augen, Schlafmütze und gezeichneten Z-Formen als Pfade statt Buchstaben. Es gilt für Spalte, Dashboard und Topbar in der Nacht.
- Für "Pause" das gedimmte Symbol plus ein kleines Sanduhr- oder Uhr-Badge, damit es sich nicht nur über die Deckkraft unterscheidet.

### R1-06 · S3 · Unklare Handlungsbilder (Frage 2)

**Ort:** `src/components/pictos/motifs/tasks.tsx`.

| Aufgabe | Heute | Problem | Das Bild müsste zeigen |
|---|---|---|---|
| Bett machen (`make-bed`) | Bett mit Decke + Funkeln | Liest sich wie "schlafen gehen"; ähnelt `pajamas` (Bett + Kind) | Hände, die die Decke glatt ziehen, oder eine halb aufgeschlagene Decke mit Pfeil "zudecken", ohne Person im Bett |
| Schuhe versorgen/wegräumen (`shoes`) | Turnschuh mit Speed-Lines | Liest sich wie "rennen" oder "Schuhe anziehen" | Schuhpaar, das auf ein Schuhregal bzw. eine Matte fällt (Bewegungstyp `drop`) |
| Wäsche zusammenlegen (`laundry`) | Waschmaschine | Zeigt "waschen", nicht "zusammenlegen" | Gefalteter T-Shirt-Stapel, oberstes Teil wird umgeklappt; Waschmaschine als eigenes Motiv "Wäsche waschen" |

### R1-07 · S3 · "Jederzeit" und "Ganztägig" als Wecker

**Ort:**
- `src/components/pictos/motifs/time-feedback.tsx:204` (`tod-anytime`)
- Gruppenkopf "Jederzeit", Dashboard "Ganztägig"

**Beobachtung:** Ein Wecker mit Zeigern (`R/crop-time.png`). Kinder verbinden einen Wecker mit "aufstehen" oder "zu einer bestimmten Uhrzeit", also eher mit dem Gegenteil von "jederzeit". Er steht in jeder Kinder-Spalte, weil "Wasser trinken" jederzeit ist.

**Erwartet:** UX §3: halbe Sonne + halber Mond = jederzeit bzw. ganztägig.

**Lösung:** Einen Kreis zeichnen, links Sonne, rechts Mond, getrennt durch eine Diagonale. Er ersetzt den Wecker in Gruppenkopf, Termin-Abschnitt und Dialog "Wann?".

### R1-08 · S3 · Erledigte Karte verschwindet aus dem Blick; ✓-Streifen fehlt

**Ort:**
- `/chores` Wand, lange Spalten
- `src/components/chores/member-column.tsx:58` (`SETTLE_MS`), `groupByPhase`

**Beobachtung:**
- Nach 0,9 s rutscht Mias erledigte Karte ans Gruppenende, bei y = 919 unterhalb des Spaltenrands (752). Mit ihr verschwindet das ↶ an der Karte (`R/q4-wall-2-t2.png`, `R/q4-wall-3-t9.png`).
- Wer später korrigieren will, muss zuerst in der Spalte scrollen.
- Ab 2 erledigten Karten bleiben alle in voller Grösse; es gibt keinen ✓-Streifen (UX 2.7).

**Lösung:**
- Die Karte erst nach Ablauf des ↶-Fensters (8 s) umsortieren.
- Erledigte Karten einer Gruppe ab 2 Stück zu einer Mini-Picto-Zeile mit ✓ zusammenfassen, direkt unter dem Gruppenkopf, damit sie sichtbar bleibt. Ein Tipp auf ein Mini-Picto zeigt ↶.

### R1-09 · S3 · Tablet-Fokus: zweispaltig mit 106 px Titelbreite

**Ort:** `/chores?member=…` 768×1024; `src/components/chores/member-column.tsx:180` (`md:grid-cols-2`).

**Beobachtung:** Karten 274 px breit, der Titel bekommt 106 px. "Wasser trinken" bricht auf 2 Zeilen, "Wäsche zusammenlegen" wird mit "…" gekürzt (`R/audit.txt`, `R/long-tablet-chores-member-cmuogy6o6000am7a.png`).

**Erwartet:** UX 2.6: 2 Spalten nur an der Wand; AK-2.

**Lösung:** Das Raster erst ab ~1000 px Inhaltsbreite zweispaltig machen (`min-[1100px]:grid-cols-2` oder Container-Query), darunter einspaltig.

### R1-10 · S3 · Toast deckt Karten ab; Fehler-Toast ohne Aufgabenbild

**Ort:** `src/components/kids/kid-toast.tsx:58`, `src/components/chores/chores-view.tsx:431-436`.

**Beobachtung:**
- Wand: Der Toast (y 686–768) liegt 8 s lang über Mamas Karte "Pflanzen giessen" (`R/q4-wall-1-t0.png`).
- Handy: Der Toast liegt über der nächsten Karte und direkt über der erledigten Karte, zwei ↶ im Abstand von 55 px (`R/q4b-phonefocus-toast.png`).
- Der Fehler-Toast zeigt Wolke + Text + ↻, aber nicht das Piktogramm der betroffenen Aufgabe (UX 2.5).

**Lösung:**
- Den Toast an der Wand im Hauptbereich zentrieren und `main` während der Anzeige unten um die Toast-Höhe polstern.
- Auf dem Handy den Toast nur zeigen, wenn die Karte ausserhalb des Viewports liegt, sonst reicht das ↶ an der Karte.
- Im Fehler-Toast `picto={toastPicto}` plus Oops-Badge verwenden.

### R1-11 · S3 · Dashboard: Ladefehler entfernt die Avatare; "Für alle" fehlt

**Ort:** `src/components/dashboard/widget-chores.tsx:77-80`.

**Beobachtung:**
- Schlägt `/api/chores` fehl, ersetzt der ErrorState die ganze Avatarzeile (`R/st-fail-wall-dash.png`). Der 1-Tipp-Weg zu "meinen Aufgaben" fehlt dann, obwohl die Personen serverseitig bekannt sind.
- Unzugewiesene Aufgaben erscheinen auf dem Dashboard nirgends.

**Lösung:**
- Die Avatare immer rendern (Links funktionieren auch ohne Daten) und unter jedem ein kleines Oops-Badge setzen; ↻ einmal rechts im Kopf.
- Ein fünftes, neutrales Gruppensymbol "Für alle" mit Zahl-Badge ergänzen, das zu `/chores` bzw. zur Für-alle-Spalte springt.

### R1-12 · S3 · Wirkt drückbar, tut nichts; Zähler als Zahl statt Punkte

**Ort:**
- `src/components/chores/chores-header.tsx:120-127` (Phasen-Kachel mit `shadow-pop`)
- `src/components/chores/time-of-day-header.tsx:55-67` ("0/4")

**Beobachtung:**
- Die Phasen-Kachel oben rechts (56 px, weisser Grund, `shadow-pop`) sieht aus wie ein Knopf, ist aber `role="img"`. `shadow-pop` bedeutet laut Design "drückbar".
- Gruppenköpfe zeigen "0/4" und "1/3" als Bruch, für Nichtleser ohne Bedeutung. UX 2.7 wollte Punkte (●●○).

**Lösung:**
- Die Phasen-Kachel flach ohne Schatten darstellen, etwa nur Picto auf Tint.
- Den Gruppenfortschritt als Punkte bis 6 zeigen (● erledigt in Personenfarbe mit ✓-Form, ○ offen), darüber als Zahl.

### R1-13 · S3 · Symbol-Inkonsistenzen

**Ort:** diverse.
- **Verbindung fehlt:** einmal Lucide `CloudOff` (`chores-header.tsx:117`), sonst das Picto `oops` (Wolke mit Pflaster). → Überall `oops` klein verwenden.
- **Leerzustand:** Der grüne ➜ ("als Nächstes") dient als Zeigepfeil auf "Bearbeiten" (`chores-view.tsx:314`, `R/st-empty-wall-chores.png`). → Einen neutralen Zeigefinger bzw. gestrichelten Pfeil in `ink` verwenden, nicht das Status-Symbol.
- **"Mehr":** Lucide `LayoutGrid` mit 18 px in einer grauen Box (`shell/more-sheet.tsx:46`), als einziger Nav-Eintrag ohne farbiges Picto. → Ein Picto mit 4 kleinen farbigen Kacheln in den Bereichsfarben, 32 px.
- **Einstellungen:** Zahnrad ohne Schloss-Badge (UX 2.8). → Ein kleines 🔒-Badge wie beim Knopf "Bearbeiten".

### R1-14 · S3 · Kalender: Person nur über Farbe; leeres Raster beim Filtern; Jetzt-Linie nicht sichtbar

**Ort:**
- `src/components/calendar/event-block.tsx:68-72`
- `src/components/calendar/calendar-view.tsx:89-90`, `:221-228`
- `view-week.tsx:156`

**Beobachtung:**
- Termin-Blöcke zeigen ein Picto mit 22–26 px und einen Farbstreifen, aber keinen Avatar. Die Zuordnung zur Person läuft nur über die Farbe (`R/ref-wall-calendar.png`).
- Nach einem Tipp auf 🦄 ist das Raster ~1 s leer, oben steht "Wird geladen…" als Text, weil der Query-Key neu ist und es keine `placeholderData` gibt (`R/cal-wall-solo-mia.png`).
- Die "Jetzt"-Linie existiert (`R/calfull-crop.png`). Die Wochenansicht startet aber bei 06:00, um 21:24 liegt die Linie erst nach Scrollen im Bild.

**Lösung:**
- Einen Avatar mit 24–28 px in jeden Block setzen, in kompakten Blöcken statt des Titels.
- `placeholderData: keepPreviousData` setzen und clientseitig vorfiltern.
- Beim Öffnen und bei "Heute" zur aktuellen Stunde minus 1 h scrollen.

### R1-15 · S3 · Kontrast vergangener Termine

**Ort:** `src/components/dashboard/widget-today.tsx:156` (`opacity-60`), Kalenderblöcke.

**Beobachtung (WCAG-Formel, `contrast.js`):**
- Hell: Uhrzeit "08:00 – 12:00" 2,45:1 (Dashboard) bzw. 2,3:1 (Kalender); Titel "Kindergarten" 4,25:1 bzw. 4,03:1.
- Dunkel: 3,59:1 bzw. 3,04:1.
- Wetter-Label "JETZT" 4,17:1 auf Sky-Tint.
- Alle Texte auf `/chores` bestehen (tiefster Wert 6,67:1, Leo-Name auf Mint-Tint; erledigte Karte 6,31:1 hell und 7,69:1 dunkel).

**Lösung:** Vergangenes nicht über `opacity`, sondern über `text-muted` (≥ 4,5:1) plus das bestehende ✓-Badge und eine kleinere Kachel abschwächen.

### R1-16 · S3 · Ring kleiner als in E1 festgelegt

**Ort:** `src/components/chores/task-card.tsx:203`.

**Beobachtung:** Ring 48 px (Handy) bzw. 52 px (ab md); E1 verlangt 56–64 px Zustandsanzeige. Die Tippfläche ist dank E1 die ganze Karte; es geht um die Sichtbarkeit des Zustands.

**Lösung:** `size-14 md:size-16`. Den Platz dafür aus dem Innenabstand nehmen, nicht aus der Titelbreite.

### R1-17 · S3 · `window.confirm` in den Einstellungen (AK-33)

**Ort:**
- `src/components/settings/caldav-row.tsx:128`
- `member-editor-dialog.tsx:129`
- `microsoft-row.tsx:135`

**Beobachtung:** `grep -rn "window.confirm" src/components` findet 3 Treffer, das AK verlangt 0. Das ist ein Erwachsenenbereich hinter der PIN, betrifft Kinder also nicht.

**Lösung:** Auf `kids/confirm-dialog.tsx` umstellen.

### R1-18 · S3 · Kleinkram

- **ß/ss gemischt:** `common.close` = "Schließen" (More-Sheet, `src/messages/de.json:7`) und `kids.dismiss` = "Schließen" (`:742`), aber `chores.….close` = "Schliessen" (Wer-war's-Dialog, `:365`). → Einheitlich "ss" (de-CH).
- **Wetter-Icons ohne Textalternative:** Die Stunden-Icons im Wetter-Widget haben weder `aria-hidden` noch ein Label (9 SVGs, `svg.js`). → Den Zustand als `aria-label` am Stundenblock angeben.
- **Lizenzbanner:** 60 px hoch, Ziele 99×36 und 36×36, schwacher Fokusring. Das ist laut E12 bewusst ausserhalb des Umbaus, bleibt aber der einzige `small`-Befund.

---

## Barrierefreiheit (Zusammenfassung)

- **Tastatur (`tab.mjs`):**
  - Reihenfolge `/chores`: Nav (8) → Lizenzbanner (2) → "Alle" → 4 Avatare → "Bearbeiten" → je Spalte Kopf-Avatar, Gruppenköpfe, Karten → "Für alle".
  - `/`: Nav → Banner → 4 Avatar-Links → To-do-Ringe.
  - Die Reihenfolge ist sinnvoll. Der Fokus ist überall als 4-px-Outline `#1952f0` sichtbar (`R/tab-wall-chores-12.png`).
- **Zugängliche Namen:**
  - Auf `/`, `/chores`, `/calendar` hat kein Bedienelement einen leeren Namen.
  - Karten heissen "Spielzeug aufräumen, 2 Sterne", im Fehlerfall "…: nochmal versuchen".
  - Avatare heissen "Nur Mia anzeigen" bzw. "Mia: 10 Aufgaben offen".
- **Pictos:** standardmässig `aria-hidden`, mit Label `role="img"`. Einzige Ausnahme sind die Wetter-Icons (R1-18).
- **Verschachtelung:** 0 Fälle von button-in-button bzw. Link-in-Button. ↶ ist ein Geschwister des Karten-Buttons, nicht verschachtelt.
- **Kontrast:** Kinderseiten bestehen durchgehend; die einzigen Unterschreitungen betreffen vergangene Termine (R1-15).
- **Touch-Ziele (`audit.js`):**
  - `small` enthält nur das Lizenzbanner, `tight` = 0, `invisible` = 0 auf `/`, `/chores`, `/calendar`, `/todos`, `/notes`, `/photos`.
  - Kinderaktionen: Karte ≥ 302×92, ↶ 56, ↻ 56–64, "Alle" 106×64.
- **Reduzierte Bewegung:** 0 laufende Animationen, keine Picto-Demo, statischer Countdown-Ring, Endzustand sofort sichtbar (`demo.mjs`, `reduced.mjs`).

## Darstellung (Zusammenfassung)

- **Horizontales Scrollen:** `hScroll` = false auf allen geprüften Seiten und Grössen.
- **Überlappungen:**
  - Toast über Karten (R1-10).
  - Die Jetzt-Linie im Kalender läuft über die Uhrzeit des laufenden Termins (kosmetisch).
  - Pokal und "+N" überdecken 1,6 s lang Titel bzw. ↶, `pointer-events-none` (kosmetisch).
- **Abgeschnittene Texte:** nur im Tablet-Fokus (R1-09).
- **Langer Titel (100 Zeichen, per API für Leo angelegt und wieder gelöscht):** 2 Zeilen mit Silbentrennung und "…", Kartenhöhe bleibt gleich, kein Layoutbruch auf Wand, Tablet und Handy (`R/long-*`).
- **Dark Mode:** keine Fehler gefunden. Tints, Karten, Badges, Dialoge und Nav sind lesbar (`R/ref-*-dark.png`, `R/notext-*-dark.png`).
- **Zustände:**
  - Laden: Skelett (`R/st-delay-wall-chores-loading.png`, `R/st-delay-phone-dash-loading.png`).
  - Leer: Liegestuhl + Hinweis (`R/st-empty-wall-chores.png`).
  - Fehler: Wolke + ↻ (`R/st-fail-wall-chores.png`).
  - Veraltet: Daten bleiben, Wolken-Knopf (`R/st-stale-wall-chores.png`).
  - Offline beim Abhaken: `R/off-wall-1-t2.png`.

## Vorher / Nachher

**Vorher** (`before/wall-chores.png`, `before/wall-dashboard.png`):
- Titel auf "Wass…" gekürzt, 16-px-Emoji im Avatar, ✓ schon im offenen Zustand.
- Leo unterhalb des Viewports, kein Erledigt-Zustand, kein Rückgängig.
- Dashboard "Nichts geplant" trotz 3 Terminen, Text-Navigation.

**Nachher:**
- Grosse Handlungsbilder, Avatar-Emoji 58 %, drei eindeutig unterscheidbare Zustände.
- ↶ an Karte und Toast, "als Nächstes" je Person, Tageszeit-Gruppen.
- Dashboard als Avatarleiste mit Ring und nächstem Bild, Zeitleiste mit allen Terminen.
- Bildhafte Navigation, Eltern-Modus mit PIN, freundliche Lade-, Leer- und Fehlerzustände.

**Grösste verbleibende Schwächen**, nach Wirkung:
1. Doppeltipp = Rückgängig (R1-01).
2. Auf der Hauptgrösse 1280 passen nicht alle Kinder-Spalten (R1-02).
3. Einzelne Bilder zeigen die falsche Handlung bzw. doppeln Symbole (R1-03, R1-05, R1-06, R1-07).
4. Kinder- und Erwachsenen-Kachel "Aufgaben" vs. "To-dos" sind verwechselbar (R1-04).
5. Rückmeldung und Korrektur verlieren sich in langen Spalten (R1-08).

## Wichtigste Screenshots (`R/` = Scratchpad `review1/`)

- **Übersicht:** `ref-wall-chores.png`, `ref-wallhd-chores.png`, `ref-tablet-chores-dark.png`, `ref-phone-chores.png`, `ref-wall-dash.png`, `full-ref-wall-dash-full.png`
- **Fokus:** `ref-wall-chores-member-mia.png`, `ref-phone-chores-member-mia.png`, `long-tablet-chores-member-cmuogy6o6000am7a.png`
- **Textlos / Graustufen:** `notext-wall-chores.png`, `notext-wall-chores-member-mia.png`, `notext-phone-chores-member-mia-dark.png`, `gray-wall-chores.png`, `gray-phone-chores-member-mia.png`, `q4gray-wall-after-tap.png`, `q4gray-phone-after-tap.png`
- **Tageszeiten:** `tz-morning-ref-wallhd-chores.png`, `tz-day-ref-wallhd-chores.png`, `tz-night-ref-wallhd-chores.png`, `tz-night-ref-wallhd-dash.png`, `tz-morning-ref-phone-dash.png`
- **Bedienung:** `q4-wall-1-t0.png`, `q4-wall-2-t2.png`, `q4-wall-3-t9.png`, `q4b-wall-retap.png`, `q4b-phonefocus-toast.png`, `who-wallhd-dialog.png`, `who-wallhd-stamped.png`, `alldone-t035.png`, `alldone-t2.png`
- **Fehler / Zustände:** `off-wall-1-t2.png`, `st-delay-wall-chores-loading.png`, `st-fail-wall-chores.png`, `st-fail-wall-dash.png`, `st-empty-wall-chores.png`, `st-stale-wall-chores.png`
- **A11y / Motion:** `tab-wall-chores-12.png`, `reduced-on-t015.png`
- **Bilder / Nav:** `clip-rail.png`, `crop-task-0.png`, `crop-task-1.png`, `crop-task-2.png`, `crop-time.png`, `crop-feedback.png`, `nav-phone-more.png`
- **Kalender / Eltern:** `cal-wall-solo-mia.png`, `calfull-crop.png`, `parent-wall-active.png`, `parent-wall-picked.png`
