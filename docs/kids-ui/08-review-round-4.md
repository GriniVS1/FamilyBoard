# 08 – Review Runde 4 (kurz)

Stand 01.10.2026, 01:15–01:40 MESZ, Demo-DB neu geseedet. Reviewer A.
Die Browser-Tests laufen mit Client-Zeitzone `America/New_York` (Abend). Für die anderen Phasen: Tag über `Pacific/Pago_Pago`, 23:24 Uhr über `Etc/UTC`.
Belege: `R4/` = `…/scratchpad/review4/`. Die Skripte stammen aus `review3/` (neue IDs), neu sind `cover.mjs`, `undoover.mjs`, `undomis.mjs`, `hold2.mjs`, `bounce.mjs`, `nowline.js`. Aufräumen löscht nur eigene Completions.

## 1. R3-01 … R3-06

| Befund | Urteil | Beleg |
|---|---|---|
| **R3-01** ↶ im Bild | **behoben** | Siehe unten |
| **R3-02** Toast-Band / Karte angeschnitten | **behoben** | Spalten 425 px (Runde 3: 397); "als Nächstes" auf Wand, Wand 1920, Tablet und Handy mit `clipBottom 0` (`R4/cover.mjs`); Streifen am Gruppenende, Wand-Kopf 64 px (`R4/tz-day-ref-wall-chores.png`) |
| **R3-03** "Aufgaben" fest | **behoben** | `resolveNavOrder` pinnt `chores` für Leiste und Handy: auch bei `calendar, meals, photos, chores` steht "Aufgaben" zuerst (`R4/navorder-check2.mjs`) |
| **R3-04** Kalender | **teilweise** | Siehe unten |
| **R3-05** Label unter der Pill | **behoben** | Tagphase: "Tagsüber" 106/106 bzw. 140/140 px sichtbar, kein Überlappen (`R4/pillover.js`, `R4/tz-day-ref-wall-chores.png`) |
| **R3-06** stummer Tipp | **behoben** | Verworfener Tipp auf die 2. Karte derselben Spalte (300 ms) → Karte federt auf `scale(0.97)`, auch bei reduzierter Bewegung (`R4/bounce.mjs`) |
| Layout-Sperre pro Spalte | **wirkt** | Siehe unten |

Details zu den Zeilen mit "Siehe unten":

- **R3-01 (behoben):**
  - Bild zweimal getippt mit 300, 700 und 1000 ms Abstand (Wand) bzw. 800 ms (Handy-Fokus): bleibt erledigt, unter dem Finger liegt die Karte (`R4/pic2.mjs`).
  - Die Karte zeigt nie ↶ (`q4c.mjs`: `cardUndo` immer null). Ring-Doppeltipp und ältere Karte sind sicher (`dbl.mjs`, `dbl2.mjs`).
- **R3-04 (teilweise):**
  - Jetzt-Linie um 23:24 beim Öffnen 199 px (Wand) bzw. 169 px (Handy) über dem Rasterrand, sichtbar (`R4/nowline.js`).
  - Offen, kosmetisch: 7 px statt 8 px zwischen "Schwimmen" (x 659–725) und "+2 weitere" (x 732) (`R4/calscroll.mjs`).
- **Layout-Sperre pro Spalte:** Tipp auf Leos Karte bei 8,15 s, während Mias Spalte umsortiert, hakt Leos Aufgabe ab (`R4/lock8.mjs`). Gleiche Spalte nach 300 ms: gesperrt; andere Spalte nach 300 ms: erledigt (`R4/lock.mjs`).

## 2. Nebenwirkungen

- **Bewegung während der Interaktion:**
  - Spaltenhöhe mit und ohne Toast konstant 425 px (`R4/shrink.mjs`).
  - Die erledigte Karte wandert erst nach ≥ 3 s ohne Berührung und geschlossenem Toast: ohne Berührung bei 8,1 s, mit Berührung bei 7,1 s erst bei 10,5 s (`R4/hold2.mjs`).
  - Ein Tipp in die Bewegung wird verworfen und federt ein (`R4/mistap.mjs` bei 8,2 s: keine fremde Aufgabe).
  - Sonst bewegt sich nur Dekoration: Sterne, "+N", Demo-Animation.
- **"als Nächstes" verdeckt?** Nirgends. Kein Überlappen mit Toast oder Nav auf Wand, Wand 1920, Tablet (Übersicht und Fokus) und Handy (Übersicht und Fokus) (`R4/cover.mjs`).
- **Aber auf dem Handy liegt der Toast über den folgenden Karten → R4-01.**

## 3. Fünf Fragen × Gerät

| Frage | Wand 1280 | Wand 1920 | Tablet | Handy |
|---|---|---|---|---|
| 1 Eigene Aufgaben | Ja | Ja | Ja (Kinder-Spalten per Avatar, R1-02 akzeptiert) | Ja |
| 2 Handlung ohne Lesen | Ja (20/20, Runde 3; Motive unverändert) | Ja | Ja | Ja |
| 3 Als Nächstes | Ja | Ja | Ja | Ja |
| 4 Abschliessen / korrigieren (E13) | **Ja** | **Ja** | **Ja** | **Nein** – R4-01 |
| 5 Übersicht | Ja | Ja | Ja | Ja |

**Frage 4 unter E13, "↶ unten mittig":**

- **Verständlich ohne Text (heuristisch): ja.**
  - Der Toast wiederholt das Bild der eben erledigten Aufgabe, den Avatar und "+2 ⭐". Das ↶ steht daneben mit schrumpfendem Countdown-Ring (`R4/q4c-wall-t0.png`).
  - Tipp auf eine ältere Karte → derselbe Toast 5 s (`R4/q4c-wall-retap.png`). Die Verbindung Karte ↔ Toast läuft über das gleiche Bild.
  - Schwäche: An der Wand 1920 liegen Karte und Toast bis ~700 px auseinander. Das Kind muss den Blick nach unten wenden.
- **Erreichbar: ja.**
  - ↶ 56 px; Wand 1280 bei y 714–770 unter allen Spalten, Wand 1920 bei y 980–1064, Tablet bei 924–1008, Handy bei 648–732 über der Nav.
  - 1 Tipp in 8 s bzw. 2 Tipps später; Undo funktioniert (`q4c.mjs`: Sterne 4 → 2, API 0).

## 4. AK-Endtabelle (Kurzform)

| AK | Status | Kurzbeleg |
|---|---|---|
| 1–5 | erfüllt | Kartenmasse, keine "…", 3 Zustände in Graustufen, offen ohne ✓, 51/51 Tests (Runde 3) |
| 6 | teilweise | 1 Tipp ≤ 150 ms ✓; Ring an der Wand 1280 52 px statt 56–64 (R1-16, `q4c.mjs`) |
| 7 | erfüllt | Erneuter Tipp ohne Extra-Sterne (`dbl.mjs`, `dbl2.mjs`) |
| 8 | erfüllt **gegen E13** | ↶ 56 px nur im Toast (E13 weicht bewusst von "an der Karte" ab); 1 Tipp in 8 s, danach 2 Tipps; ↶ überall gleich. Handy-Risiko R4-01 |
| 9–14 | erfüllt | Undo stellt Zustand und Sterne her; Erfolg und "Geschafft"; offline ↻; Skelett; Fehlerbild; "Wer war's" (Runde 2/3, `q4c.mjs`) |
| 15–21 | erfüllt | Wand 1280 alle Köpfe und "als Nächstes" voll sichtbar (`cover.mjs`); Gruppen und Streifen; Handy ohne Querscroll; Fokus inklusive Rückkehr; Dashboard 1 Tipp; Tagesring; Emoji 58 % |
| 22–24 | erfüllt | Heute-Zeitleiste; Picto, Avatar und Phase; Solo-Filter sofort |
| 25 | erfüllt (gegen E5) | Jetzt-Linie auch um 23:24 sichtbar (`nowline.js`) |
| 26–29 | erfüllt | Nav-Pictos 44/32; 5 Handy-Plätze à 68×66; aktiv mit Form; Kinder zuerst, "Aufgaben" fest auf Platz 2 |
| 30 | erfüllt | `small`/`tight`/`invisible` leer auf `/` und `/chores` (Runde 3); Rest 7 px im Kalender (R3-04) |
| 31–36 | erfüllt | Keine unsichtbaren Knöpfe; Eltern-Modus nur mit PIN (Pad schliesst nach 2 Fehlversuchen); kein `window.confirm`; reduzierte Bewegung; Fokusring; keine englischen Texte |
| 37 | **nicht erfüllt** (nur Handy) | Frage 4 auf dem Handy Nein (R4-01) |
| 38–39 | erfüllt | Anlege-Reihenfolge, 2 Tipps bis Speichern; Stern-Knöpfe |

## 5. Neue Befunde

### R4-01 · S2 · Handy: Toast liegt über den folgenden Karten, sein ↶ sitzt in der Ring-Spalte → versehentliches Rückgängig

**Ort:** Handy 390×844, `/chores` und Fokus; `kids/kid-toast.tsx` (fixed `bottom-28`, auf dem Handy kein reservierter Raum).

**Beobachtung:**
- Nach einem Haken liegt der Toast 8 s bei y 648–732 über dem Kartenstapel. Er verdeckt die untere Hälfte von "Zähne putzen" (y 590–686) und die obere von "Buch anschauen" (y 698–794) (`R4/undoover.mjs`, `R4/cover-phone-focus.png`).
- ↶ (x 304–360, y 662–718) liegt genau in der Spalte der Ringe; der Ring von "Zähne putzen" endet bei y 666.
- Realer Test (`R4/undomis.mjs`): Spielzeug abhaken, nach 2 s auf den **unteren Rand des Rings** von "Zähne putzen" (328, 660) tippen.
  - Ergebnis: **Spielzeug ist rückgängig**, "Zähne putzen" nicht erledigt. Reproduziert 2 × 2.
  - Kontrolle: Tipp auf die Ringmitte (328, 638) hakt "Zähne putzen" ab, Spielzeug bleibt (`R4/undomis2.mjs`).
  - Vermutlich greift die Touch-Zielkorrektur von Chrome zum nahen ↶.
- Der 600-ms-Guard schützt hier nicht, weil das ↶ schon 2 s sichtbar ist.

**Erwartet:** Kein Kinder-Tippziel liegt unter oder direkt neben dem ↶. Ein Tipp auf eine Karte verändert nie eine andere Aufgabe.

**Lösung:**
1. Auf dem Handy wie an der Wand Platz reservieren: `main` padding-bottom = Toast-Höhe + Abstand, solange der Toast sichtbar ist. Dann scrollt der Stapel darüber, es gibt keinen Layout-Sprung, weil nur der Scrollbereich wächst.
2. Oder: ↶ im Handy-Toast **links** vom Aufgabenbild anordnen, weg von der Ring-Spalte, und den Toast als undurchlässige Fläche mit ≥ 12 px Abstand zu jedem Ring halten.
3. Einen Test ergänzen: Tipp auf den Rand eines Rings unter bzw. neben dem Toast → keine fremde Aufgabe ändert sich.

### R4-02 · S3 · Gruppenfortschritt ab 6 Aufgaben wieder als Zahl

**Ort:** `time-of-day-header.tsx`; sichtbar mit Testdaten (Mama, Jederzeit, 6 Aufgaben).

**Beobachtung:** Die Pill zeigt "0/6" bzw. "1/6" statt Punkten (`R4/tz-day-ref-wall-chores.png`, `R4/q4c-wall-retap.png`). Die Demo-Familie hat höchstens 4 pro Gruppe und ist nicht betroffen.

**Lösung:** Ab 6 Aufgaben z. B. 5 Punkte + "+N" oder ein Balken statt Bruch.

## 6. Offen und Abnahme

| Schwere | Offen |
|---|---|
| S1 | – |
| S2 | **R4-01** (nur Handy) |
| S3 | R1-02 Tablet (akzeptiert), R1-16 (Ring 52 px), R3-04 Rest (7 px), R4-02 |

**Abnahme:** Wand und Tablet sind aus meiner Sicht **abnahmefähig**. Für die Gesamtabnahme muss **R4-01 auf dem Handy** behoben sein.

---

## Schlussprüfung

Stand 01.10.2026, 02:20–02:35 MESZ, Demo-DB neu geseedet. Belege: `R5/` = `…/scratchpad/review5/`.
Die Demo-Daten sind wie vorgefunden: 3 Seed-Completions mit identischen IDs, 25 Chores. Drei temporäre `REVIEW s1–s3` habe ich angelegt und wieder gelöscht.

| Punkt | Urteil | Beleg |
|---|---|---|
| **R4-01** Handy: Toast über den Karten | **behoben** | Siehe unten |
| **R4-02** "0/6" | **behoben** | Mit 7 Aufgaben (Mama, Jederzeit, 3 temporäre) zeigt die Pill 7 Segmente ohne Ziffern (`R5/seg.js`, `R5/clip-seg-mama.png`). Kosmetisch: die schmalen Kapseln erinnern vergrössert an "0000000" |
| **R3-04** Spurabstand | **behoben** | "Schwimmen" (x 659–724) → "+2 weitere" (x 733): 9 px (`R5/calscroll.mjs`) |
| Zwei Kinder innerhalb 8 s | **wirkt** | Siehe unten |
| Pyjama eigene Pose | **wirkt** | Kind im rosa Streifen-Pyjama, Arme hoch, vor dem Bett; klar anders als "Anziehen" (blaues T-Shirt) und "Bett machen" (leeres Bett) (`R5/clip-pajamas.png`) |

Details zu den Zeilen mit "Siehe unten":

- **R4-01 (behoben):**
  - Toast = volle, opake Leiste (x 0–390, y 687–761) direkt über der Nav; ↶ links (x 12–68); `main` padding-bottom 204 px (`R5/toastfind.mjs`).
  - 7 echte Tipps 2 s nach dem Haken, jeweils auf die Karte direkt über dem Toast, Fokus und Übersicht (`R5/edge.mjs`). **Kein einziges Mal rückgängig.**
    - Ringrand (328, 660): hakt "Zähne putzen" ab.
    - Kartenunterkante und Pufferzone (328/40/200, 683–686): treffen den Puffer, ohne Wirkung.
  - `R5/undomis.mjs` (Ringrand, der in Runde 4 rückgängig machte): jetzt "Zähne putzen" erledigt, Spielzeug bleibt.
- **Zwei Kinder innerhalb 8 s (`R5/two.mjs`):**
  - Mia "Spielzeug", dann 1,5 s später Leo "Wasser trinken" → ein Toast mit zwei Abschnitten: ↶ + Bild + Avatar je Kind (`R5/two-phone.png`). Wand 1920: ↶ bei x 834 / 1052; Handy: x 40 / 231.
  - ↶ "Wasser trinken" → nur Leos Aufgabe offen, Mias bleibt; danach ↶ "Spielzeug" → beide offen. Gleich auf Wand 1920 und Handy.

### Fünf Fragen – Handy (Endstand)

| Frage | Handy 390×844 | Beleg |
|---|---|---|
| 1 Eigene Aufgaben | Ja | Avatarleiste + "Für alle"-Chip im 1. Viewport; Fokus per Tipp |
| 2 Handlung ohne Lesen | Ja | 20/20 (Runde 3), Pyjama jetzt mit eigener Pose; `cutCount` 0 (`R5/audit` Handy) |
| 3 Als Nächstes | Ja | Fokus Mia/Leo: "als Nächstes" y 611–707, Nav bei 761 (`R5/phonefold.js`); Übersicht y 515–595 |
| 4 Abschliessen / korrigieren | **Ja** | 1 Tipp; ↶ nur im Toast, links, 56 px; kein versehentliches Rückgängig über dem Toast (R4-01); zwei Kinder getrennt korrigierbar |
| 5 Übersicht | Ja | Fokus-Karten 338 px, Gruppen, Streifen, `hScroll` false |

**AK-37 (Endstand): erfüllt.** Die Textlos-Fragen 1–5 sind Ja auf Wand, Tablet und Handy (heuristisch, 1 Reviewer).

### Offen nach der Schlussprüfung

| Schwere | Offen |
|---|---|
| S1 | – |
| S2 | – |
| S3 | R1-02 (Tablet, bewusst akzeptiert), R1-16 (Ring an der Wand 1280 52 px statt 56–64; AK-6 teilweise) |

**Abnahme: ja**, mit den zwei S3-Punkten als bekannten Restpunkten.
