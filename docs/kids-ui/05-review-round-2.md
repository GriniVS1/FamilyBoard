# 05 – Review Runde 2: Nachprüfung R1-01…R1-18 und neue Befunde

Stand 30.09.2026, 22:15–22:50 MESZ, Branch `feat/kid-friendly-ui` (uncommitted), Dev-Server `http://localhost:3100`, Demo-DB neu geseedet (neue IDs).
Gleicher Reviewer wie in Runde 1. Die Fix-Berichte der Entwickler wurden **nicht** als Beleg genommen; jeder Befund ist mit denselben bzw. erweiterten Skripten real nachgeprüft. Alle Aussagen zur Verständlichkeit sind **heuristisch**, getestet wurde nichts mit Kindern.

**Belegpfade:** `R2/` = `/private/tmp/claude-501/-Users-nicolasgrichting-Projects-FamilyBoard/b0cf85df-e1a2-4f90-800d-1766496b03da/scratchpad/review2/`. Die Skripte liegen dort, mit den neuen IDs: `dbl.mjs`, `dbl2.mjs`, `q4c.mjs`, `strip.mjs`, `shrink.mjs`, `mistap.mjs`, `hist.mjs`, `cal2.mjs`, `phonefold.js`, `navorder-check.mjs` und weitere.

**Einschränkungen:**
- Parallel arbeiteten ein zweiter Reviewer und der Funktionstester (`TEST …`-Objekte, z. B. "TEST m1–m3" bei Mama). Deren Daten wurden nicht bewertet.
- Meine Abhak-Tests löschen seit dieser Runde **nur eigene** Completions: Vorher-Schnappschuss der IDs (`lib.mjs: compIds/cleanupNew`), gelöscht werden nur neue IDs der eigenen Chores.
- Endstand: nur die 3 Seed-Completions, Mia 2 und Leo 1 Wochenstern.

---

## Kurzfazit

1. Der Blocker R1-01 ist behoben. Ein Doppeltipp hält die Aufgabe erledigt, bei frischen und älteren Karten und auch im ✓-Streifen. ✓ bleibt im Ring, ↶ ist 600 ms scharfgeschaltet.
2. 13 von 18 Befunden sind behoben, 4 teilweise, einer verschlechtert. Verschlechtert ist R1-16: Der Ring ist an der Wand 1280 jetzt 48 statt 52 px.
3. Die Bildsprache ist jetzt stark: Ich benenne alle 20 Demo-Aufgaben aus dem Bild (2 davon knapp). Das Nav-Bild "Aufgaben" ist eindeutig, Mond, Nacht, Pause und Jederzeit sind sauber getrennt.
4. **Zwei neue S2-Befunde durch die Fixes:**
   - Das Umsortieren nach 8 s schiebt die Karte "als Nächstes" unter dem Finger weg. Ein Tipp bei 8,2 s hakte nachweislich "Zähne putzen" statt "Pyjama anziehen" ab (R2-01).
   - Im Handy-Fokus liegt "als Nächstes" unter der Bottom-Nav, nur 22 px sind sichtbar (R2-03).
5. Abnahme: noch nicht; zuerst R2-01 und R2-03 beheben. Alles Übrige ist S3 oder auf S3 herabgestuft.

---

## 1. Nachprüfung R1-01 … R1-18

| Befund | Schwere R1 | Urteil | Beleg |
|---|---|---|---|
| **R1-01** Doppeltipp = rückgängig | S1 | **behoben** | Siehe unten |
| **R1-02** Wand 1280: Spalten fehlen | S2 | **teilweise** | Siehe unten |
| **R1-03** Pyjama/Hausaufgaben falsches Bild | S2 | **behoben** | Siehe unten |
| **R1-04** Nav "Aufgaben" ≈ "To-dos" | S2 | **behoben** | Siehe unten |
| **R1-05** Mond vierfach, "Zzz" als Text | S3 | **teilweise** | Siehe unten |
| **R1-06** Unklare Handlungsbilder | S3 | **behoben** | Siehe unten |
| **R1-07** Wecker = Jederzeit | S3 | **behoben** | Neuer Kreis aus Tag- und Nachthälfte (`R2/pictos-ref-wallhd-dev-pictos-cat-time-full.png`); in Gruppenkopf, Dashboard "Ganztägig" und Termin-Abschnitt |
| **R1-08** Erledigte Karte verschwindet; ✓-Streifen fehlt | S3 | **behoben** (neues Problem R2-01) | Siehe unten |
| **R1-09** Tablet-Fokus 2-spaltig | S3 | **behoben** | Tablet-Fokus einspaltig: Karte 572 px, `cutCount` 0 (`R2/m-chores.txt`, `R2/audit.txt`) |
| **R1-10** Toast deckt Karten ab | S3 | **teilweise** | Siehe unten |
| **R1-11** Dashboard-Fehler entfernt Avatare; "Für alle" fehlt | S3 | **behoben** | Siehe unten |
| **R1-12** Phasen-Kachel wirkt drückbar; "0/4" | S3 | **behoben** | Phasen-Kachel flach auf Tint ohne Schatten; Gruppenfortschritt als Punkte ✓○○○ (`R2/q4c-wall-t9.png`) |
| **R1-13** Symbol-Inkonsistenzen | S3 | **behoben** | Siehe unten |
| **R1-14** Kalender | S3 | **teilweise** (neues Problem R2-05) | Siehe unten |
| **R1-15** Kontrast vergangener Termine | S3 | **behoben** | `contrast.js`: 0 Unterschreitungen auf `/`, `/chores`, `/calendar` in Hell und Dunkel; tiefster Wert 4,61:1 ("Znacht zusammen", vergangen) |
| **R1-16** Ring < 56 px | S3 | **verschlechtert** (Wand 1280) | Siehe unten |
| **R1-17** `window.confirm` | S3 | **behoben** | `grep` in `src/components` ergibt nur noch einen Kommentar in `kids/confirm-dialog.tsx:21` |
| **R1-18** Kleinkram | S3 | **behoben** | Siehe unten |

Details zu den Zeilen mit "Siehe unten":

- **R1-01 (behoben):**
  - `R2/dbl.mjs`: Zwei Tipps auf die Ringposition mit 300 ms (Wand 1280), 350 ms (Handy) und 250 ms (Wand 1920) Abstand. Unter dem Finger liegt beim 2. Tipp die Karte selbst. Ergebnis: `aria-pressed=true`, 1 Completion, Sterne +2, nicht +4.
  - `R2/dbl2.mjs`: Doppeltipp auf eine > 8 s alte erledigte Karte, im Fokus und in der Übersicht → bleibt erledigt.
  - ✓ bleibt im Ring (`ringHasCheck: true`). ↶ sitzt auf breiten Karten 18 px links vom Ring (`R2/q4c-phonefocus-t2.png`), auf schmalen nur im Toast.
  - `lib/undo-guard.ts`: 600 ms Scharfschaltung.
- **R1-02 (teilweise):**
  - Wand 1280: 4 Spalten à 267 px bei x = 144/423/702/981, alle Köpfe und "als Nächstes" sichtbar (`R2/ref-wall-chores.png`). "Für alle" ist als Chip-Gruppe in der Avatarleiste immer sichtbar; ein Tipp öffnet direkt "Wer war's" (`R2/anyone-wall-after-chip.png`). Dashboard-Kachel "Für alle" ✓.
  - Offen: Tablet 768 zeigt 2 Spalten à 290 px; Mia bei x = 748 (20 px sichtbar), Leo bei x = 1050 (`R2/ref-tablet-chores.png`). Die Kinder brauchen weiter Wischen oder die Avatarleiste.
  - Neu: In der Tagphase wird Leo an der Wand um 13 px abgeschnitten (R2-04).
  - Der verbleibende Tablet-Teil wird auf **S3** herabgestuft, weil der Weg über die Avatarleiste mit 1 Tipp funktioniert.
- **R1-03 (behoben):**
  - "Pyjama anziehen" zeigt ein Kind, das ein gestreiftes Oberteil mit Mond überzieht.
  - "Hausaufgaben" zeigt Heft + Stift.
  - Belege: `R2/clip-tasks-row1b.png`, `R2/clip-tasks-row2.png`, echte Karten in `R2/tz-day-ref-wall-chores.png`.
- **R1-04 (behoben):** `nav-tasks` = gelber Stern mit weissem ✓, ohne Listenzeilen; klar anders als das To-do-Klemmbrett (`R2/clip-rail.png`).
- **R1-05 (teilweise):**
  - `tod-night` (Mond mit Mütze, gezeichnete Z) erscheint in Spalte, Dashboard und Phasen-Kachel (`R2/tz-night-ref-wall-chores.png`, `R2/tz-night-ref-wall-dash.png`).
  - Pause = gedimmter Mond + Sanduhr-Badge (`R2/tz-morning-ref-wall-chores.png`, Papa).
  - Offen: Die Uhr oben rechts zeigt um 01:58 weiter den wachen Abend-Mond (`tod-evening`), obwohl laut Design "Topbar in der Nacht" `tod-night` verlangt.
- **R1-06 (behoben):**
  - `make-bed`: leeres Bett, Decke mit Pfeil. `shoes`: Paar auf Schuhregal. `laundry`: gefalteter Stapel (`R2/clip-tasks-row1a.png`, `R2/clip-tasks-row2.png`).
  - Hinweis: `pajamas` und `get-dressed` haben dieselbe Silhouette (Kind + Oberteil + Pfeile). Das ist unkritisch, weil die Handlung gleich ist ("anziehen") und das Gruppensymbol trennt.
- **R1-08 (behoben, neues Problem R2-01):**
  - Die erledigte Karte bleibt 8 s an ihrer Stelle, danach wandert sie ans Ende.
  - Ab 2 erledigten gibt es den ✓-Streifen mit Mini-Pictos (56 px); ein Tipp zeigt ↶ daneben.
  - Doppeltipp auf ein Mini-Picto macht nichts rückgängig, ↶ danach wirkt (`R2/strip.mjs`, `R2/strip-wall-revealed.png`).
  - Das Umsortieren erzeugt aber R2-01.
- **R1-10 (teilweise):**
  - Wand: Der Toast sitzt mittig im Hauptbereich (x 476–916, Mitte 696 = Mitte `main`).
  - Handy: kein Toast, wenn die Karte sichtbar ist.
  - Der Fehler-Toast zeigt jetzt Aufgabenbild + Wolke + ↻ (`R2/off-wall-1-t2.png`).
  - Aber: Das Polster auf `main` lässt alle Spalten schrumpfen (R2-02).
- **R1-11 (behoben):**
  - Bei `/api/chores` 500 bleiben die 4 Avatare, unter jedem ein Oops-Badge, ↻ 48 px oben rechts (`R2/st-fail-wall-dash.png`).
  - Die Kachel "Für alle" mit Zahl-Badge verlinkt auf `/chores` (`R2/ref-wall-dash.png`).
- **R1-13 (behoben):**
  - Veraltet: Oops-Wolke statt `CloudOff` (`R2/st-stale-wall-chores.png`).
  - Leerzustand: neutraler dunkler ↗ statt grünem ➜ (`R2/st-empty-wall-chores.png`).
  - "Mehr": farbiges 2×2-Picto mit 32 px.
  - Zahnrad mit Schloss-Badge.
- **R1-14 (teilweise, neues Problem R2-05):**
  - Avatar mit 24 px in jedem Termin-Block.
  - Solo-Filter ohne Leerbild (3 Blöcke schon nach 150 ms, `R2/cal2.mjs`).
  - Die Jetzt-Linie ist beim Öffnen sichtbar (`R2/cal-wall-initial.png`).
  - Der Auto-Scroll verschiebt aber die ganze Seite (R2-05).
- **R1-16 (verschlechtert an der Wand 1280):**
  - Karten an der Wand 1280 sind 247 px breit (< `TIGHT_MAX_WIDTH` 290), Ring deshalb 48 px, vorher 52. E1 verlangt 56–64.
  - Handy 56 ✓, Wand 1920 und Fokus 64 ✓ (`R2/m-chores.txt`).
- **R1-18 (behoben):**
  - `de.json` einheitlich "ss", kein "ß" mehr.
  - Wetter-Icons `aria-hidden`, Zustand als `sr-only`.
  - Lizenzbanner: "Aktivieren" 112×48, "Ausblenden" 48×48, Fokusring 4 px; `small` ist überall leer.

---

## 2. Gezielte Prüfung auf Folgefehler

| Prüfpunkt | Ergebnis | Beleg |
|---|---|---|
| ✓-Streifen, Mini-Pictos, ↶ mit 600-ms-Guard, Doppeltipp | in Ordnung | Siehe unten |
| Toast-Zentrierung an der Wand | in Ordnung | Mitte des Toasts = Mitte von `main` |
| Schrumpfende Spalten während des Toasts | **Fehler, R2-02** | Siehe unten |
| Umsortieren nach 8 s | **Fehler, R2-01** | Siehe unten |
| `pushState`/`replaceState` im Fokus-Modus | in Ordnung | Siehe unten |
| Kalender-Avatare in schmalen Spuren | Avatar passt; **Spuren kollidieren, R2-05** | Siehe unten |
| Nav-Reihenfolge innerhalb der Gruppen | **Lücke, R2-06** | Siehe unten |
| Neue Pictos | in Ordnung, eine Lücke (R1-05 Topbar) | Siehe unten |

Details zu den Zeilen mit "Siehe unten":

- **✓-Streifen, Mini-Pictos, ↶-Guard, Doppeltipp:**
  - Zwei erledigt → Streifen mit 2 Mini-Pictos à 56 px.
  - Doppeltipp auf ein Mini-Picto: ↶ erscheint 8 px daneben, API bleibt bei 2.
  - ↶ nach 700 ms: API 1, der Streifen löst sich auf (`R2/strip.mjs`).
  - Kosmetisch: Das eingeschobene ↶ verschiebt die folgenden Mini-Pictos um 64 px.
- **Schrumpfende Spalten (R2-02):** Alle 5 Spalten 469 → 397 px für 8 s, `main` padding-bottom 48 → 120 px (`R2/shrink.mjs`, `R2/q4c-wall-t0.png` vs. `R2/q4c-wall-t9.png`).
- **Umsortieren nach 8 s (R2-01):** Bei t = 8,0 s wechselt das Element unter (835, 670) von "Pyjama anziehen" (als Nächstes) zu "Zähne putzen". Echter Tipp bei 8,2 s hakt "Zähne putzen" ab (`R2/mistap.mjs`).
- **Fokus-Modus und Browser-Verlauf (`R2/hist.mjs`, `R2/idle2.mjs`):**
  - Alle → Mia fügt einen Eintrag hinzu. Mia → Leo ersetzt ihn. Zurück führt auf alle, Vorwärts zurück auf Leo.
  - Doppeltipp auf "Alle" verlässt `/chores` nicht.
  - Idle 120 s führt zurück auf `/chores`, nach einem Push-Einstieg und nach einem Einstieg vom Dashboard.
- **Kalender, schmale Spuren (R2-05):**
  - 3 parallele Termine: Spuren 48 px, Avatar 24 px, darüber das Picto; es gibt keinen Titel, das ist akzeptabel.
  - "Velo flicken" (x 560–608) und "Zahnarzt" (x 602–650) überlappen um 6 px, "Schwimmen" und "Velo" haben 1 px Abstand; `audit.js` meldet `tight` = 2 (`R2/cal-wall-initial.png`).
- **Nav-Reihenfolge (R2-06):**
  - Die Gruppen sind fest, der Standard ist korrekt (Heute, Aufgaben, Kalender, Essen, Fotos | To-dos, Notizen, Einstellungen).
  - Speichert man aber `calendar, meals, photos, chores`, landet "Aufgaben" auf dem Handy im "Mehr"-Sheet (`R2/navorder-check.mjs`).
- **Neue Pictos:**
  - `nav-tasks`, `tod-night`, `pause`, `tod-anytime`, `make-bed`, `pajamas`, `shoes` und `laundry` sind gut lesbar, bei 40 px und 120 px, in Hell und Dunkel (`R2/pictos-*`, `R2/clip-*`).
  - `tod-anytime` in Graustufen: nur eine graue Scheibe. Das ist unkritisch, denn der Gruppenkopf trägt den Status nicht.

### Frage 2 neu: Handlung nur aus dem Bild benannt

Grundlage: `/dev/pictos?view=tasks&text=0` (`R2/pictos-ref-wallhd-dev-pictos-view-tasks-text-0-full.png`, Ausschnitte `R2/clip-tasks-*.png`). Zum Abgleich die echten Karten textlos (`R2/notext-wall-chores.png`, `R2/notext-wall-chores-member-mia.png`, `R2/tz-day-ref-wall-chores.png`).

| # | Aufgabe | Bild | Meine Lesart | Urteil |
|---|---|---|---|---|
| 1 | Wasser trinken | Glas, Tropfen fällt hinein | Wasser trinken | sicher |
| 2 | Zähne putzen (Morgen) | Zahn + Bürste | Zähne putzen | sicher |
| 3 | Anziehen | Kind zieht blaues T-Shirt an, Pfeile | Anziehen | sicher |
| 4 | Bett machen | leeres Bett, Decke mit Umklapp-Pfeil | Bett machen | sicher (knapp: Pfeil ist klein) |
| 5 | Hände waschen | Hahn, Hand, Blasen | Hände waschen | sicher |
| 6 | Tisch decken | Tisch, Teller fällt, Tasse | Tisch decken | sicher |
| 7 | Blumen giessen | Giesskanne + Pflanze | giessen | sicher |
| 8 | Schuhe versorgen | Schuhpaar fällt aufs Regal | Schuhe wegstellen | sicher |
| 9 | Spielzeug aufräumen | Ball + Teddy fallen in die Kiste | aufräumen | sicher |
| 10 | Pyjama anziehen | Kind mit geschlossenen Augen zieht gestreiftes Mond-Oberteil an | Schlafanzug anziehen | sicher |
| 11 | Zähne putzen (Abend) | wie 2, Gruppe Mond | Zähne putzen abends | sicher |
| 12 | Buch anschauen | offenes Buch mit Sternen | lesen | sicher |
| 13 | Bett machen (Leo) | wie 4 | Bett machen | sicher (knapp) |
| 14 | Schultasche packen | Rucksack | Schultasche | sicher |
| 15 | Hund füttern | Hund + Napf, Futter fällt | Hund füttern | sicher |
| 16 | Wasser trinken (Leo) | wie 1 | Wasser trinken | sicher |
| 17 | Hausaufgaben | Heft + Stift | Hausaufgaben / schreiben | sicher |
| 18 | Müll rausbringen | Tonne, Abfall fällt | Müll wegwerfen | sicher |
| 19 | Pflanzen giessen (Mama) | wie 7 | giessen | sicher |
| 20 | Wäsche zusammenlegen | gefalteter Stapel, oberes Shirt mit Umklapp-Pfeil | Wäsche falten | sicher |

Ergebnis: **20/20 sicher**, 2 davon knapp (#4, #13). In Runde 1 waren es 14/20. Das Soll von ≥ 90 % ist erreicht.

---

## 3. Die fünf Review-Fragen × Gerät

Hell und Dunkel ergeben dasselbe Ergebnis (`R2/ref-*-dark.png`); Graustufen: `R2/gray-*.png`, `R2/q4gray-wall-after-tap.png`.

| Frage | Wand 1280×800 | Wand 1920×1080 | Tablet 768×1024 | Handy 390×844 |
|---|---|---|---|---|
| **1** Eigene Aufgaben über Avatar | **Ja** – 4 Spalten + "Für alle"-Chips im 1. Viewport, Avatare 72 px, Emoji 58 % (`R2/ref-wall-chores.png`). Tagphase: Leo 13 px angeschnitten (R2-04) | **Ja** (`R2/ref-wallhd-chores.png`) | **Ja** – Avatarleiste + Chips, Fokus per Tipp; Mia und Leo erst nach Wischen (R1-02 Rest) | **Ja** – Avatarleiste 56 px + Chips im 1. Viewport (`R2/ref-phone-chores.png`) |
| **2** Handlung ohne Lesen | **Ja** – 20/20; Nav eindeutig; `cutCount` 0 | **Ja** | **Ja** – kein "…" mehr im Fokus | **Ja** |
| **3** Was als Nächstes kommt | **Ja** – 09:28 / 14:28 / 22:xx / 01:58 korrekt, Pause mit Sanduhr, Nacht mit Schlafmond (`R2/tz-*-wall-chores.png`) | **Ja** | **Ja** | **Nein** – Fokus-Modus: "als Nächstes" bei y = 739, Bottom-Nav bei 761, also 22 px sichtbar (R2-03, `R2/notext-phone-chores-member-mia.png`) |
| **4** Abschliessen und korrigieren | **Ja¹** – 1 Tipp → erledigt in 119 ms; Doppeltipp sicher; ↶ im Toast (1 Tipp), später 2 Tipps; offline ↻ mit Aufgabenbild; "Wer war's" ✓ | **Ja¹** – ↶ inline neben ✓ | **Ja¹** | **Ja¹** – 97 ms; ↶ inline 18 px neben ✓, kein Toast (`R2/q4c-phonefocus-t2.png`) |
| **5** Übersicht bei vielen Aufgaben | **Ja** – Köpfe und "als Nächstes" ohne Scroll, Karten 96 px, ✓-Streifen, `cutCount` 0; Einschränkung R2-02 und R2-04 | **Ja** | **Ja** – Fokus einspaltig 572 px; Übersicht 2 Spalten | **Nein** – Fokus: die Karten der aktuellen Phase liegen unter der Nav (R2-03) |

¹ Alle beobachtbaren Kriterien der Frage 4 treffen zu. Aber R2-01: Wer ~8 s nach dem letzten Haken die nächste Karte antippt, trifft eine andere Aufgabe. Das ist per ↶ korrigierbar, vom Kind aber kaum zu bemerken.

---

## 4. AK-Tabelle (nur geänderte Zeilen)

| AK | Runde 1 | Runde 2 | Beleg |
|---|---|---|---|
| 2 | teilweise | **erfüllt** | `cutCount` 0 auf Wand, Tablet und Handy inklusive Tablet-Fokus (`R2/audit.txt`) |
| 6 | erfüllt (gegen E1) | **teilweise** | 1 Tipp, 119/97 ms ✓; Ring an der Wand 1280 nur 48 px (E1: 56–64) |
| 8 | teilweise | **erfüllt** (Vorbehalt R2-01) | ↶ 56 px, 1 Tipp in 8 s, danach 2 Tipps; Doppeltipp sicher |
| 15 | nicht erfüllt | **erfüllt** | Wand 1280: 4 Köpfe + "als Nächstes" im 1. Viewport; kosmetisch R2-04 |
| 16 | erfüllt | erfüllt | Jetzt auch mit ✓-Streifen ab 2 Erledigten |
| 25 | teilweise | **erfüllt** (gegen E5) | Jetzt-Linie beim Öffnen sichtbar; Folgeproblem R2-05 |
| 26 | teilweise | **erfüllt** | "Mehr" als farbiges Picto, 32 px |
| 30 | teilweise | **teilweise** (anderer Grund) | Lizenzbanner jetzt ≥ 48 px ✓; neu `tight` = 2 auf `/calendar` (parallele Termine, R2-05) |
| 33 | teilweise | **erfüllt** | Kein `window.confirm`-Aufruf mehr (1 Kommentar-Treffer). 8-s-↶ nach Löschen weiter nicht geprüft |
| 35 | erfüllt (Ausnahme Banner) | **erfüllt** | Auch Lizenzbanner mit 4-px-Fokusring |
| 37 | nicht erfüllt | **nicht erfüllt** | Fragen 3 und 5 auf dem Handy Nein (R2-03) |

---

## 5. Neue Befunde

### R2-01 · S2 · Umsortieren nach 8 s verschiebt "als Nächstes" unter dem Finger → falsche Aufgabe abgehakt

**Ort:**
- `/chores`, alle Geräte
- `src/components/chores/member-column.tsx:93-102` (`settling` endet mit dem ↶-Fenster)
- `chores-view.tsx:231` (nur ein Scroll-Guard, kein Layout-Guard)

**Beobachtung:**
- "Als Nächstes" springt sofort auf die nächste Karte (Pyjama, y ≈ 625). Die erledigte Karte bleibt 8 s darüber stehen und wandert dann ans Ende.
- Dabei rückt Pyjama um 108 px nach oben, und an seine alte Stelle rutscht "Zähne putzen" (`R2/shrink.mjs`: Element unter (835, 670) wechselt bei t = 8,0 s).
- Realer Test (`R2/mistap.mjs`): Tipp auf Spielzeug, dann bei 8,2 s Tipp auf die zuvor gesehene Pyjama-Position.
  - Die API meldet "Spielzeug aufräumen" + **"Zähne putzen"** erledigt, Pyjama bleibt offen.
- Typischer Auslöser: Ein Kind hakt nacheinander mehrere schon erledigte Aufgaben ab und braucht mehr als 8 s für die zweite.

**Erwartet:** Karten bewegen sich nicht unter einem Kind, das gerade tippen will; ein Tipp trifft immer das Bild, das es gesehen hat.

**Lösung:**
1. Nicht nach fester Zeit umsortieren, sondern erst, wenn die Spalte ≥ 3 s nicht berührt wurde **und** das ↶-Fenster zu ist. Bei jeder Berührung in der Spalte den Timer neu starten.
2. Zusätzlich einen Layout-Guard analog zum Scroll-Guard: Taps in den 400 ms nach einer Kartenbewegung verwerfen (`lastLayoutShiftAt`).
3. Einen Test ergänzen: Tipp auf die Position von "als Nächstes" genau zum Umsortier-Zeitpunkt → keine fremde Aufgabe erledigt.

### R2-02 · S3 · Toast-Polster lässt alle Spalten 8 s (Fehler: 15 s) um 72 px schrumpfen

**Ort:** Wand und Tablet; `main` padding-bottom beim Toast (Fix zu R1-10), `use-viewport-fill.ts`.

**Beobachtung:**
- Bei jedem Haken schrumpfen alle 5 Spalten von 469 auf 397 px, nach 8 s wachsen sie zurück (`R2/shrink.mjs`, `R2/q4c-wall-t0.png` vs. `R2/q4c-wall-t9.png`).
- Unterste Karten werden 8 s lang abgeschnitten, und die Spalten springen zweimal.
- Zusammen mit R2-01 bewegen sich nach 8 s gleichzeitig Spaltenhöhe und Kartenreihenfolge.

**Lösung:**
- Den Toast-Platz an der Wand dauerhaft reservieren, also ein festes Bodenpolster von 96 px, das ohne Toast leer ist; oder den Toast über die Spalten legen und ihn schmaler halten.
- Die Spaltenhöhe darf sich während einer Interaktion nicht ändern.

### R2-03 · S2 · Handy-Fokus: "als Nächstes" liegt unter der Bottom-Nav

**Ort:** `/chores?member=…` 390×844; `chores-header.tsx` (neue "Für alle"-Chipzeile), Lizenzbanner.

**Beobachtung:**
- Die neue "Für alle"-Chipzeile (y = 279) und der jetzt 3-zeilige Lizenzbanner (69 px) verlängern den Kopf.
- Mias und Leos Karte "als Nächstes" beginnt bei y = 739, die Bottom-Nav bei 761; sichtbar sind 22 px (`R2/phonefold.js`, `R2/notext-phone-chores-member-mia.png`).
- In Runde 1 lag die Karte bei y = 651.
- Im Fokus-Modus erscheint "Für alle" ausserdem doppelt, als Chipzeile oben und als Streifen unten.

**Erwartet:** UX 2.6 und Frage 3/5: Im Fokus-Modus liegt "als Nächstes" im ersten Viewport.

**Lösung:**
- Im Fokus-Modus die "Für alle"-Chips oben ausblenden; der Streifen unten reicht.
- Die Chips auf dem Handy in dieselbe Zeile wie "Alle" und die Avatare setzen, also horizontal scrollbar.
- Den Fokus-Kopf kompakter machen (Avatar 72 statt 96).
- Optional nach dem Laden zur Karte "als Nächstes" scrollen.

### R2-04 · S3 · Wand 1280, Tagphase: Leos Spalte um 13 px abgeschnitten

**Ort:** `/chores` 1280×800 bei 14:28 (`America/Denver`); `chores-view.tsx` Spaltenbasis.

**Beobachtung:**
- Mias Spalte wächst durch Inhalt (min-content) auf 280 statt 267 px.
- Leo beginnt bei x = 994 und endet bei 1261; der Clip liegt bei 1248.
- Leos Ring und der Rand der Karte "als Nächstes" sind abgeschnitten (`R2/tz-day-ref-wall-chores.png`, `R2/colw.js`).

**Lösung:**
- `min-w-0` bzw. `overflow-hidden` an den Spalten setzen.
- Chip-Zeilen und Punkt-Pill schrumpfbar machen: Anzahl Chips nach verfügbarer Breite, sonst "+N".

### R2-05 · S3 · Kalender: Auto-Scroll versteckt Filter und Kopf; parallele Termine kollidieren

**Ort:** `/calendar`, Wand und Tablet; `calendar-view.tsx` (Scroll auf Jetzt), `event-block.tsx`, `layout-utils.ts`.

**Beobachtung:**
- Beim Öffnen scrollt die **ganze Seite** (scrollY 809 Wand, 645 Tablet).
- Datumsnavigation, Tag/Woche/Monat und die Personen-Avatare für den Solo-Filter liegen damit ausserhalb des Viewports (`R2/cal-wall-initial.png`). Der Solo-Filter (AK-24) braucht zuerst Hochscrollen.
- Parallele Termine: 48-px-Spuren überlappen um 6 px ("Velo" x 560–608, "Zahnarzt" x 602–650), bzw. Abstand 1 px. `audit.js` `tight` = 2; Tippen im Überlappungsstreifen trifft den oberen Block.

**Lösung:**
- Nur den Raster-Container intern scrollen, Kopf und Filter `sticky` bzw. ausserhalb des Scrollbereichs.
- Spuren mit ≥ 8 px Abstand verteilen; ab 3 parallelen Terminen einen Sammelblock "+N" zeigen, der die Tagesansicht öffnet.

### R2-06 · S3 · Nav-Reihenfolge kann "Aufgaben" auf dem Handy hinter "Mehr" schieben

**Ort:** `src/components/shell/nav-order.ts`, `app-shell.tsx:69-79`.

**Beobachtung:** Innerhalb der Kindergruppe ist die Reihenfolge frei. Mit `calendar, meals, photos, chores` ergibt sich auf dem Handy Bottom = Heute, Kalender, Essen, Fotos, und "Aufgaben" steht im "Mehr"-Sheet (`R2/navorder-check.mjs`). Der wichtigste Kinderbereich ist dann 2 Tipps entfernt.

**Lösung:** "Aufgaben" wie "Heute" fest auf Platz 2 halten (nur ausblendbar), oder die Bottom-Slots immer mit Heute + Aufgaben beginnen und erst danach die Reihenfolge anwenden.

### R2-07 · S3 · Demo-PIN im Klartext in einem Bug-Report

**Ort:** `.claude/bug-reports/2026-09-30T19-41-30-nav-config-reorder-has-no-effect.md`, Abschnitt "Fix". Das Verzeichnis ist versioniert (`git ls-files`), das Repo laut `CLAUDE.md` öffentlich.

**Beobachtung:** Die Demo-PIN steht als Zahl im Text. Es ist zwar nur die Seed-PIN, aber `CLAUDE.md` verlangt, PINs nie weiterzugeben.

**Lösung:** Vor dem Commit durch "Demo-PIN (siehe Seed)" ersetzen.

---

## 6. Offen nach Runde 2

| Schwere | Offen |
|---|---|
| S1 | – |
| S2 | R2-01, R2-03 |
| S3 | R1-02 (Rest Tablet, herabgestuft), R1-05 (Topbar nachts), R1-10 → R2-02, R1-14 → R2-05, R1-16 (Ring 48 px an der Wand 1280), R2-04, R2-06, R2-07 |

Abnahme ist aus meiner Sicht **nach Behebung von R2-01 und R2-03** möglich; die S3-Punkte können parallel oder später folgen.

## Wichtigste Screenshots (`R2/`)

- **Übersicht:** `ref-wall-chores.png`, `ref-wallhd-chores.png`, `ref-tablet-chores.png`, `ref-phone-chores.png`, `ref-wall-dash.png`, `ref-wall-chores-dark.png`
- **Tageszeiten:** `tz-morning-ref-wall-chores.png`, `tz-day-ref-wall-chores.png`, `tz-night-ref-wall-chores.png`, `tz-night-ref-wall-dash.png`, `tz-morning-ref-phone-dash.png`
- **Bedienung:** `q4c-wall-t0.png`, `q4c-wall-t9.png`, `q4c-phonefocus-t2.png`, `strip-wall-revealed.png`, `mistap-wall.png`, `anyone-wall-after-chip.png`, `off-wall-1-t2.png`, `q4gray-wall-after-tap.png`
- **Zustände:** `st-fail-wall-dash.png`, `st-stale-wall-chores.png`, `st-empty-wall-chores.png`
- **Bilder:** `pictos-ref-wallhd-dev-pictos-view-tasks-text-0-full.png`, `clip-tasks-row1a.png`, `clip-tasks-row1b.png`, `clip-tasks-row2.png`, `pictos-ref-wallhd-dev-pictos-cat-time-full.png`, `clip-rail.png`
- **Handy-Fokus / Kalender:** `notext-phone-chores-member-mia.png`, `cal-wall-initial.png`
