# Kinderfreundliches UI: Design-Richtung

Stand 30.09.2026. Gilt für die Wall-App (`src/**`). Tokens: `src/app/globals.css` und `tailwind.config.ts`. Piktogramme: `src/components/pictos/`. Vorschau: `/dev/pictos` (nur Dev), Kategorien über `?cat=task|nav|time|feedback|event`, Theme über `?theme=light|dark`, alle Demos über `?demo=1`.

> **Wichtig für die Umsetzung:** Der laufende Dev-Server lädt `tailwind.config.ts` nicht neu. Node 26 lädt die TS-Config per `require(esm)`, und Tailwinds `require.cache`-Invalidierung greift dort nicht. Neue Klassen wie `bg-accent-peach-tint`, `text-on-accent` oder `shadow-pop` entstehen erst nach einem **Neustart des Dev-Servers**. CSS-Variablen und `globals.css` laden per HMR.

## 1. Gestaltungsprinzipien

### a) Aus der Referenz (Dæly) beobachtet und übertragen

| # | Beobachtung | Übertragung in FamilyBoard |
|---|---|---|
| 1 | Helle, fast weisse Fläche; Farbe tragen die Inhalte | `bg` und `surface` bleiben hell und neutral. Farbe kommt nur über Personen, Piktogramme und Zustände. |
| 2 | Eine Spalte pro Person, ganze Spalte in Personenfarbe getönt | `MemberColumn` auf `bg-accent-{c}-tint`. Unzugewiesene Aufgaben liegen in einer neutralen Spalte auf `bg-surface` mit gestricheltem Rand. |
| 3 | Foto-Avatar mit farbigem Fortschrittsring und Zahl-Badge | `MemberAvatar` mit Ring in `accent-{c}`, Fortschritt als SVG-Kreisbogen und Badge mit der Zahl offener Aufgaben. |
| 4 | Grosse Illustration links in jeder Aufgabenzeile | Picto mit 64 px (Wall) auf einer Kachel in `accent-{c}-tint`. |
| 5 | Erledigt: kräftiger gefüllt, Haken, Titel durchgestrichen | Karte `bg-accent-{c}`, Haken in einem gefüllten Kreis, `.strike-done`. |
| 6 | Gruppen nach Tageszeit mit Icon-Kopf | `TimeOfDayHeader` mit `tod-morning`, `tod-day`, `tod-evening` und `tod-anytime`. |
| 7 | „+2“ mit Münze schwebt auf | `Celebration`: Chip „+N ⭐“ steigt auf, dazu fliegen Sterne weg. |
| 8 | Schmale Icon-Leiste mit Mini-Labels | `NavTile` mit farbigem, konkretem Picto und Label ≥ 14 px. |

### b) Eigene Ergänzungen

| # | Prinzip | Warum |
|---|---|---|
| 1 | **Zustand nie nur über Farbe:** immer Form, Symbol und Farbe | Farbfehlsichtigkeit; kleine Kinder lesen Formen schneller als Farbnuancen |
| 2 | Picto zeigt die **Handlung**; Antippen spielt eine kurze Demo | Nichtleser verstehen die Handlung, nicht den Gegenstand |
| 3 | Rückgängig ohne Lesen: ↶ mit Countdown-Ring | Versehentliches Abhaken ist der häufigste Kinderfehler |
| 4 | Genau **eine** Aufgabe pro Spalte ist „Als Nächstes“ | Kinder brauchen einen Einstieg, keine Liste |
| 5 | Leere Zustände und Fehler als Bild mit grossem Knopf | Kein Textblock, den niemand liest |
| 6 | Eigene SVG-Pictos statt Emoji | Einheitlich auf Pi (Noto) und Mac (Apple), animierbar |
| 7 | Zwei Tap-Ebenen: Kinder ≥ 64 px, Erwachsene ≥ 48 px; Erwachsenen-Aktionen (Bearbeiten) ≥ 16 px entfernt oder per Long-Press | Kein versehentliches Bearbeiten |
| 8 | Avatar antippen startet den Fokus-Modus „nur meine Spalte“ | Reduziert die Reizmenge |

## 2. Farbpalette

Die Namen der Member-Farben bleiben (`MEMBER_COLORS`, DB-Werte unverändert). Jede Farbe hat drei Stufen:

| Stufe | Token / Klasse | Verwendung |
|---|---|---|
| Tint | `--accent-{c}-tint` · `bg-accent-{c}-tint` | grosse weiche Flächen: Spalte, Picto-Kachel, Avatar-Grund |
| Akzent | `--accent-{c}` · `bg-accent-{c}` (DEFAULT, auch `/30`) | Orientierung und Aktion: Ring, Fortschritt, Erledigt-Füllung, Primärknopf |
| Ink | `--accent-{c}-ink` · `text-accent-{c}-ink` | Text und Icons auf Tint oder Surface (≥ 4.5:1) |
| On-Accent | `--on-accent` · `text-on-accent` | Text und Icons **auf** einer Akzent-Füllung (eine dunkle Farbe für alle) |

Semantische Tokens haben dasselbe Muster: `success`, `danger`, `warning` jeweils als DEFAULT, `-tint` und `-ink`. Dazu kommen `focus`, `shadow` (Schattenfarbe) und die Picto-Palette `--picto-*`. `bg`, `surface`, `ink` und `border` bleiben. `muted` ist in Light etwas dunkler geworden (5.6:1 statt 4.8:1).

**Nicht-Text-Kontrast:** Akzent gegen Surface liegt in Light bei 1.5–2.7:1. Das ist Absicht, denn die Akzente bleiben freundlich-pastellig. Deshalb trägt der Akzent **nie allein** Information: Haken und Symbole liegen in `on-accent` darauf (≥ 6.3:1), Ringe haben zusätzlich Badge oder Symbol.

**Migration:** Es gibt heute rund 76 Stellen mit `text-accent-rose` für Fehlertext (≈ 2.6:1) und `text-accent-mint` für Erfolgstext. Diese sollen auf `text-danger-ink` bzw. `text-success-ink` umgestellt werden.

### Kontraste (WCAG 2.x, berechnet aus den echten Werten in `globals.css`)

Soll: Text ≥ 4.5, UI/Fokus ≥ 3. Alle Paare bestehen.

#### Light

| Farbe | tint | accent | ink | ink/tint | ink/surface | ink(Basis)/tint | muted/tint | on-accent/accent | focus/tint | accent/surface |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| peach | `#ffe6db` | `#fc895f` | `#842f15` | 7.34 ✓ | 8.76 ✓ | 13.34 ✓ | 4.71 ✓ | 7.25 ✓ | 5.02 ✓ | 2.36 |
| mint | `#dbf5e8` | `#54c993` | `#115f40` | 6.67 ✓ | 7.68 ✓ | 13.83 ✓ | 4.88 ✓ | 8.28 ✓ | 5.20 ✓ | 2.07 |
| sun | `#fff2c7` | `#ffc933` | `#7b460a` | 6.90 ✓ | 7.71 ✓ | 14.24 ✓ | 5.02 ✓ | 11.14 ✓ | 5.36 ✓ | 1.54 |
| sky | `#ddf0fd` | `#56b3f0` | `#134d86` | 7.38 ✓ | 8.63 ✓ | 13.62 ✓ | 4.80 ✓ | 7.43 ✓ | 5.12 ✓ | 2.31 |
| lilac | `#eee8fc` | `#aa8dec` | `#4c2e8a` | 8.51 ✓ | 10.17 ✓ | 13.34 ✓ | 4.70 ✓ | 6.31 ✓ | 5.01 ✓ | 2.72 |
| rose | `#fde2ea` | `#f27da0` | `#8c2145` | 7.13 ✓ | 8.68 ✓ | 13.08 ✓ | 4.61 ✓ | 6.70 ✓ | 4.92 ✓ | 2.56 |
| teal | `#d7f4f3` | `#36bfba` | `#0a595c` | 6.98 ✓ | 8.09 ✓ | 13.75 ✓ | 4.85 ✓ | 7.60 ✓ | 5.17 ✓ | 2.25 |
| sand | `#f5ebdb` | `#d2ae7f` | `#684527` | 7.20 ✓ | 8.50 ✓ | 13.49 ✓ | 4.76 ✓ | 8.24 ✓ | 5.07 ✓ | 2.08 |

| Semantik | tint | DEFAULT | ink | ink/tint | ink/surface | DEFAULT/surface | DEFAULT/tint |
|---|---|---|---|---:|---:|---:|---:|
| success | `#daf6e6` | `#259d59` | `#0f5c33` | 7.04 ✓ | 8.08 ✓ | 3.47 ✓ | 3.03 ✓ |
| danger | `#ffe5e7` | `#e22834` | `#931a22` | 7.30 ✓ | 8.71 ✓ | 4.58 ✓ | 3.84 ✓ |
| warning | `#fff3d1` | `#c66c06` | `#7b3f0a` | 7.43 ✓ | 8.21 ✓ | 3.78 ✓ | 3.42 ✓ |

Basis: ink/bg 14.78 · ink/surface 15.93 · muted/surface 5.62 · muted/bg 5.21 · focus (`#1952f0`)/bg 5.56 · focus/surface 5.99.

#### Dark

| Farbe | tint | accent | ink | ink/tint | ink/surface | ink(Basis)/tint | muted/tint | on-accent/accent | focus/tint | accent/surface |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| peach | `#472c24` | `#f58c66` | `#ffcdb8` | 8.88 ✓ | 11.94 ✓ | 10.99 ✓ | 5.50 ✓ | 7.75 ✓ | 6.33 ✓ | 7.18 |
| mint | `#223a2f` | `#63c597` | `#b6edd1` | 9.35 ✓ | 13.04 ✓ | 10.61 ✓ | 5.31 ✓ | 8.75 ✓ | 6.10 ✓ | 8.11 |
| sun | `#3d341f` | `#f7c845` | `#ffeaa3` | 10.27 ✓ | 14.28 ✓ | 10.64 ✓ | 5.32 ✓ | 11.68 ✓ | 6.12 ✓ | 10.82 |
| sky | `#223544` | `#65b6ec` | `#b9e2fd` | 9.25 ✓ | 12.50 ✓ | 10.95 ✓ | 5.48 ✓ | 8.30 ✓ | 6.30 ✓ | 7.69 |
| lilac | `#352b4a` | `#b29be9` | `#dccffc` | 9.01 ✓ | 11.70 ✓ | 11.39 ✓ | 5.70 ✓ | 7.69 ✓ | 6.56 ✓ | 7.13 |
| rose | `#482832` | `#ee8ca9` | `#fecddc` | 9.22 ✓ | 12.19 ✓ | 11.19 ✓ | 5.60 ✓ | 7.87 ✓ | 6.44 ✓ | 7.29 |
| teal | `#1e3838` | `#4abfbb` | `#adebe7` | 9.42 ✓ | 12.87 ✓ | 10.84 ✓ | 5.42 ✓ | 8.31 ✓ | 6.23 ✓ | 7.70 |
| sand | `#3d3429` | `#caa87d` | `#f0ddc2` | 9.19 ✓ | 12.88 ✓ | 10.56 ✓ | 5.29 ✓ | 8.26 ✓ | 6.08 ✓ | 7.66 |

| Semantik | tint | DEFAULT | ink | ink/tint | ink/surface | DEFAULT/surface | DEFAULT/tint |
|---|---|---|---|---:|---:|---:|---:|
| success | `#1e382a` | `#47c27c` | `#adebc8` | 9.37 ✓ | 12.61 ✓ | 7.55 ✓ | 5.61 ✓ |
| danger | `#442224` | `#ef616b` | `#ffc2c6` | 9.19 ✓ | 11.22 ✓ | 5.36 ✓ | 4.39 ✓ |
| warning | `#3b301c` | `#f9b52f` | `#ffe099` | 10.07 ✓ | 13.32 ✓ | 9.50 ✓ | 7.18 ✓ |

Basis: ink/bg 16.13 · ink/surface 14.79 · muted/surface 7.40 · muted/bg 8.07 · focus (`#66bfff`)/bg 9.28 · focus/surface 8.51.

In Dark ist `ink` hell, also Text auf dem dunklen Tint. `on-accent` bleibt dunkel, weil die Akzente in Dark hell sind.

## 3. Typografie

Die Fonts bleiben Geist (Display) und Inter (Text); es gibt keine neuen Downloads. Die Kinder-Skala liegt als Komponentenklassen vor. Absichtlich heissen sie **nicht** `text-*`, weil `tailwind-merge` sie sonst als Textfarbe liest und eine echte Farbklasse verwirft.

| Klasse | Grösse / Zeile | Gewicht | Font | Verwendung |
|---|---|---|---|---|
| `kid-label` | 14 / 20 | 600 | Inter | Nav-Label, Chips, Metazeile. **Minimum für Kinder** |
| `kid-body` | 16 / 24 | 500 | Inter | Toast, kurze Hinweise |
| `kid-title` | 18 / 24 | 600 | Geist | Aufgabentitel (Tablet, Handy) |
| `kid-title-lg` | 20 / 28 | 600 | Geist | Aufgabentitel Wall, Spaltenname |
| `kid-heading` | 28 / 36 | 600 | Geist | Seitentitel |
| `kid-number` | 24 / 1 | 700, tabular | Geist | Sternzähler, Belohnungs-Chip |

Titel werden auf höchstens 2 Zeilen umbrochen (`line-clamp-2`) und nie mit „…“ auf ein Wort gekürzt; heute steht dort „Wass…“. Durchgestrichen: `.strike-done`, 2 px, `on-accent/55`.

## 4. Formen, Radien, Schatten, Abstände

| Element | Radius | Schatten | Innenabstand |
|---|---|---|---|
| Spalte `MemberColumn` | `rounded-4xl` (32) | keiner | 16 (Wall 20) |
| `TaskCard` | `rounded-3xl` (24) | `shadow-pop` (offen) / keiner (erledigt) | 12 |
| Picto-Kachel in der Karte | `rounded-2xl` (16) | keiner | 4 |
| Knöpfe, Chips, Avatar | `rounded-full` | `shadow-pop` (kid), `shadow-soft` (adult) | – |
| Toast, Dialog | `rounded-3xl` | `shadow-lift` | 12/16 |

- `shadow-pop` hat eine 2-px-„Kante“ plus weichen Schatten und signalisiert „drückbar“. Gedrückt wird `translate-y-0.5 shadow-press` verwendet. Die Schattenfarbe kommt aus `--shadow` und funktioniert damit auch in Dark.
- Raster 4 px. Karten stehen ≥ 12 px auseinander, zwei beliebige Touch-Ziele ≥ 8 px.
- **Touch:** Kinder-Primäraktion ≥ 64 × 64 (`tap-target-kid`), sonst ≥ 48 × 48 (`tap-target`).

## 5. Komponenten-Spezifikation

Masse gelten für die Wall (1280 × 800); in Klammern stehen die Werte für Handy (< 768 px). `{c}` ist die Member-Farbe; unbekannte Werte fallen auf `sand` zurück.

### TaskCard

Aufbau: `[Picto-Kachel 72 (56)] [Titel + Metazeile] [CheckButton 64]`, `min-h-[88px]`, `gap-3`, `p-3`.

- Picto 64 px (48) auf `bg-accent-{c}-tint`. Die Kachel ist ein eigener Tap-Bereich: `PictoDemo` spielt die Demo und hakt **nicht** ab.
- Titel `kid-title-lg` (`kid-title`), `line-clamp-2`. Metazeile: Stern-Picto 20 + `kid-label` „+N“.
- Bearbeiten (Erwachsene) nur per Long-Press ≥ 600 ms oder im Menü, **nicht** neben dem CheckButton.

| Zustand | Form | Symbol | Farbe | Bewegung |
|---|---|---|---|---|
| **offen** | flache Karte, CheckButton als leerer Kreis mit 3-px-Rand `border-muted` | ○ | `bg-surface`, `shadow-pop` | – |
| **als Nächstes** (max. 1 pro Spalte) | 3-px-Rahmen `ring-[3px] ring-accent-{c}`, Picto-Kachel 8 px grösser | Badge `next` (👉) 28 px an der oberen linken Ecke | wie offen, Titel `font-bold` | `animate-next-pulse` am CheckButton |
| **erledigt** | Karte vollflächig gefüllt, Titel durchgestrichen, CheckButton als gefüllter Kreis | ✓ (4 px) in `accent-{c}-ink` auf `bg-surface`-Kreis; daneben `UndoButton` | `bg-accent-{c}`, Text `text-on-accent` | `animate-check-pop` + `Celebration` |
| **pending** | Karte `opacity-80`, CheckButton mit rotierendem Bogen (270°) | Spinner-Bogen; bei reduced motion ein statisches „…“ aus drei Punkten | `border-muted` | `motion-safe:animate-spin` |
| **Fehler** | 2 px **gestrichelter** Rahmen, CheckButton zeigt ↻ | Badge `oops` 28 px + ↻ | `bg-danger-tint`, Rahmen `border-danger`, Text `text-danger-ink` | `animate-shake-soft` einmal |

CheckButton: 64 × 64 `rounded-full tap-target-kid focus-ring-kid`, `aria-pressed` für erledigt, `aria-label="{Titel} erledigt"`, `aria-busy` bei pending.

### MemberAvatar

| Grösse | Ø | Ring | Fortschritt | Badge |
|---|---|---|---|---|
| sm | 40 | 2 px | – | – |
| md | 56 | 3 px | 4 px | 22 |
| lg (Spaltenkopf) | 72 | 3 px | 5 px | 28 |
| xl (Fokus-Modus) | 96 | 4 px | 6 px | 32 |

- Innen liegt Foto oder Emoji auf `bg-accent-{c}-tint`; die Initiale steht in `text-accent-{c}-ink` (`kid-title`).
- Farbring `accent-{c}`, 2 px Abstand in `surface` zum Inhalt.
- Fortschritt: SVG-Kreis um den Avatar. Die Spur ist `accent-{c}-tint` (auf Surface) bzw. `surface/70` (auf der Spalte), der Bogen `accent-{c}` mit `stroke-linecap: round`, Start bei 12 Uhr. Animiert wird `stroke-dashoffset` (Spring 220/30).
- Badge oben rechts, `bg-ink text-bg kid-label tabular`, 2 px Rand `surface`. Es zeigt die Zahl **offener** Aufgaben. Bei 0 wird es `bg-success` mit ✓ (Form + Symbol).
- Angetippt (Fokus-Modus): Ring 6 px, `scale-105`, die anderen Spalten `opacity-40`.

### MemberColumn-Kopf

`h-24`, `flex items-center gap-3`, auf `bg-accent-{c}-tint`.

- Avatar lg mit Fortschritt und Badge.
- Name in `kid-title-lg text-accent-{c}-ink`.
- Stern-Pill `bg-surface rounded-full px-3 h-10`: Picto `star` 24 und `kid-number` (Wochenpunkte).
- „+“: 56 px Kreis `bg-surface text-accent-{c}-ink shadow-pop`. Das ist eine Erwachsenen-Aktion und steht deshalb rechts, abgesetzt.

### NavTile

| Variante | Mass | Picto | Label | aktiv | inaktiv |
|---|---|---|---|---|---|
| Sidebar (Wall) | `h-[72px]`, volle Breite, `rounded-3xl`, `px-3` | 48 | `text-base font-semibold` (16 px) | `bg-accent-{navColor}-tint` + `shadow-pop` + 4-px-Balken links `bg-accent-{navColor}`; Picto `bounce` einmal | transparent, Label `text-ink` |
| Bottom-Nav (Handy/Tablet) | ≥ 64 × 64, gleich breit | 36 | nur beim aktiven Tile, `kid-label` 14 px | Tint-Pill hinter dem Picto | nur Picto |

Farben pro Bereich: home `rose`, calendar `sky`, meals `peach`, chores `sun`, todos `mint`, notes `lilac`, photos `teal`, settings `sand`.

Die Pictos sind `nav-*`. Immer `aria-current="page"` setzen; in der Bottom-Nav zusätzlich `aria-label`, da das Label fehlt.

### BigButton

Kinder-Höhe 64 (`h-16 px-7`, `kid-title`, Picto 32 links), Erwachsenen-Höhe 48. Immer `rounded-full`, `focus-ring-kid`; gedrückt `translate-y-0.5 shadow-press`, disabled `opacity-50 shadow-none`.

| Variante | Fläche | Text | Rand | Symbol |
|---|---|---|---|---|
| primär | `bg-accent-{c}` (ohne Member-Kontext `sky`) | `text-on-accent` | – | Picto / Lucide 28 |
| sekundär | `bg-surface` | `text-ink` | 2 px `border-border` | optional |
| Gefahr | `bg-danger-tint` | `text-danger-ink` | 2 px `border-danger` | **Pflicht** (🗑 / ×); Kinder sehen keine Gefahr-Knöpfe |

### UndoButton

56 × 56 Kreis, `bg-surface`, 2 px `border-muted`, Picto `undo` 32, `aria-label="Rückgängig"`.

Er erscheint 8 s lang nach dem Abhaken auf der Karte (rechts neben dem CheckButton, 8 px Abstand) und im Erfolgs-Toast. Ein Countdown-Ring aus 3 px `accent-{c}` läuft um den Knopf ab (`stroke-dashoffset` linear 8 s) und zeigt so ohne Text, wie lange es noch geht. Bei reduced motion bleibt der Ring statisch, und der Knopf verschwindet nach 8 s.

### Celebration

| Auslöser | Effekt | Dauer | reduced motion |
|---|---|---|---|
| Aufgabe erledigt | 6 Stern-Pictos (24) fliegen radial aus dem CheckButton (`animate-star-fly`, `--fly-x/y/r` pro Stern) | 700 ms | aus |
| „+N ⭐“ | Chip `bg-accent-sun text-on-accent rounded-full h-10 px-4` mit Picto `star` 24 + `kid-number`, steigt auf (`animate-reward-rise`) | 1100 ms | an Ort ein- und ausblenden |
| Spalte komplett | 24 Konfetti-Rechtecke 6 × 10 in den 8 Akzenten (`animate-confetti`) + Picto `celebrate` 120 `animate-pop-in` über der Spalte + Avatar-Ring voll | 1600 ms | Picto statisch 1.6 s, kein Konfetti |

Das Overlay ist `pointer-events-none` und `aria-hidden`. Den Text „Geschafft!“ gibt es nur für Screenreader, über `aria-live`.

### Toast

Unten mittig (Wall `bottom-8`, Handy über der Bottom-Nav), `max-w-[420px] min-h-[72px] rounded-3xl p-3 pr-4 shadow-lift`, 2 px Rand, `animate-toast-in`.

Aufbau: `[Picto 48] [kid-body, optional] [UndoButton | Retry]`.

| Art | Fläche / Rand / Text | Picto | Rolle | Dauer |
|---|---|---|---|---|
| Erfolg | `bg-success-tint` / `border-success` / `text-success-ink` | `celebrate` oder `star` | `role="status"` | 4 s (mit Undo: 8 s) |
| Fehler | `bg-danger-tint` / `border-danger` / `text-danger-ink` | `oops` | `role="alert"` | bis zur Aktion; ↻ als BigButton 48 |

### EmptyState, ErrorState, Skeleton

| | Aufbau | Farben |
|---|---|---|
| EmptyState | zentriert: Picto `relax` 120 (96), optional `kid-title`, darunter BigButton primär „+“ (nur wenn Erwachsene anlegen können) | `rounded-3xl border-2 border-dashed border-border bg-surface/60 p-8` |
| ErrorState | Picto `oops` 120, BigButton primär ↻ (icon-only mit `aria-label` erlaubt), Detailtext klein in `text-danger-ink` für Erwachsene | wie EmptyState, Rand `border-danger/40` |
| Skeleton | exakt die Form des Ziels (TaskCard: 72er-Quadrat, zwei Balken 60 % / 30 %, 64er-Kreis) | `bg-ink/5` (Dark `bg-ink/10`), Glanz mit `animate-shimmer` (reduced: statisch) |

### TimeOfDayHeader

Die Zeile hat `h-12 gap-2`: Picto `tod-*` 40 (Wall 48) + `kid-title` („Morgens“, „Tagsüber“, „Abends“, „Jederzeit“) + rechts eine Fortschritts-Pill „2/4“ (`kid-label`, `bg-surface/70`).

- Aktuelle Tageszeit: Pill `bg-surface shadow-pop`; das Picto hüpft einmal (`bounce`), wenn die Tageszeit beginnt.
- Vergangene Tageszeiten: zugeklappt auf den Kopf, sofern alles erledigt ist; das Symbol ✓ ersetzt dann die Pill.
- Zukünftige Tageszeiten: `opacity-70`, bleiben aber bedienbar.

### Fokusring

`focus-ring-kid`: 4 px `outline` in `focus`, Offset 3 px. Es ist eine Outline, damit er Radius und `overflow-hidden` übersteht. In abgeschnittenen Containern gibt es `focus-ring-kid-inset`. Er erscheint nur bei `:focus-visible`, also nicht bei Touch. Kontrast ≥ 4.9:1 auf jedem Tint.

## 6. Motion

| Was | Dauer | Easing / Feder | reduced motion |
|---|---|---|---|
| Knopf drücken | 100 ms, `scale .96` | `ease-snappy` | bleibt (Rückmeldung, keine Bewegung im Raum) |
| Karten-Zustandswechsel (Farbe, Rahmen) | 200 ms (`duration-kid`) | ease-out | 120 ms Überblendung |
| Haken erscheint | 260 ms | `ease-pop` (Overshoot) | Überblendung 120 ms |
| Fortschrittsring | Spring stiffness 220, damping 30 | – | sofort |
| Tap-Feder (framer) | stiffness 400, damping 30 | – | sofort |
| Sterne fliegen | 700 ms | `ease-snappy` | aus |
| „+N“ steigt | 1100 ms | `ease-snappy` | an Ort ein- und ausblenden |
| Konfetti | 1200 ms | `cubic-bezier(.25,.6,.4,1)` | aus |
| Als-Nächstes-Puls | 2400 ms, endlos | ease-in-out | aus, der statische Rahmen bleibt |
| Fehler-Wackeln | 360 ms, einmal | ease-in-out | aus, der gestrichelte Rahmen bleibt |
| Toast | 220 ms | `ease-snappy` | Überblendung |
| Picto-Demo | 420–1300 ms, einmal | je nach Typ (siehe §7) | aus |

Die Regel für `@media (prefers-reduced-motion: reduce)` steht in `globals.css`: Dekoratives (`animate-wiggle`, `-next-pulse`, `-confetti`, `-star-fly`, `-shake-soft`, `-shimmer`, alle `.picto-motion`) ist aus. Zustandsanimationen (`-pop-in`, `-check-pop`, `-reward-rise`, `-toast-in`) werden zu einer 120-ms-Überblendung. Der neue Zustand bleibt also immer sichtbar. Für framer-motion gilt `useReducedMotion()` und bei `true` die Transition `{ duration: 0 }`.

## 7. Piktogramm-Stilguide

| Regel | Wert |
|---|---|
| Raster | `viewBox="0 0 64 64"`, 3 Einheiten Rand; das Motiv füllt ≈ 80 % |
| Kontur | `--picto-line`, 2.75 (Details 1.75–2.25), `stroke-linecap/linejoin="round"` |
| Flächen | 3–5 Farben aus `--picto-*`, **nur** über `C.*` aus `palette.ts`, kein Hex |
| Glanzlicht | genau eines (`<Shine>`), weiss, oben links auf der Hauptform |
| Freie Striche | Bewegungslinien, Dampf und Schnurrhaare über `<Lines>` in `--picto-motion` (in Dark hell) |
| Strukturteile | Griffe, Stiele, Reifen und Henkel nie als nackte Linie, sondern als `<Tube>` (Kontur + Farbe). Sonst verschwinden sie in Dark |
| Handlung | Objekt + Ziel + Bewegung: Tropfen fällt ins Glas, Ball fällt in die Kiste, Bürste mit Schaum am Zahn, Schuh mit Schnürsenkel und Speed-Lines |
| Ebenen | `back` (Szene) · `move` (animiert, `.picto-motion`) · `front` (verdeckt `move`, z. B. die Kistenwand) |
| Verboten | Text, Ziffern, Masken, `id`s oder `<defs>` (mehrfach pro Seite sicher), Fotos, externe Assets |
| Prüfung | 40 px **und** 120 px, auf Surface und allen 8 Tints, Light und Dark, in `/dev/pictos?cat=…` |

Palette: `line`, `motion`, `dark` (Reifen, Räder), `shine`, `white`, `cream`, `red`, `orange`, `yellow`, `green`, `leaf`, `blue`, `water`, `purple`, `pink`, `brown`, `wood`, `skin`, `gray`, `steel`. In Dark sind die Flächen eine Stufe gedimmt, die Kontur bleibt dunkel (Sticker-Look).

Bewegungstypen (nur mit `data-picto-demo="true"` an einem Vorfahren):

| Typ | Bewegung | Dauer |
|---|---|---|
| `drop` | fällt 9 Einheiten ein, federt nach | 620 ms × 2 |
| `pour` | kippt −18° um `origin` (Giesskanne) | 1300 ms |
| `scrub` | ±3 Einheiten hin und her | 420 ms × 3 |
| `wiggle` | ±9° um `origin` (Pin, Griff) | 760 ms |
| `bounce` | Squash, hoch 7, landen | 800 ms |
| `spin` | 360° um `origin` (Zahnrad, Strahlen, Zeiger) | 1000 ms |
| `float` | 5 Einheiten hoch und blasser (Dampf, Sterne) | 1200 ms |

### API

```tsx
import { Picto, PictoDemo, usePictoDemo, resolveTaskPicto, resolveEventPicto, PICTO_META } from "@/components/pictos";

<Picto name="water" size={64} />                 // dekorativ → aria-hidden
<Picto name="water" size={64} label="Wasser trinken" />  // role="img"
<PictoDemo label={chore.title}><Picto name={p} size={64} /></PictoDemo>  // Antippen = Demo
const { play, demoProps } = usePictoDemo();      // eigene Tap-Fläche: {...demoProps} + onClick={play}
const p = resolveTaskPicto(chore.icon, chore.title);  // Aufgabenkarte, Dialog, Toast → nur task-Motive
const e = resolveEventPicto(null, event.title);       // Kalender → nur event-Motive
```

- **`resolveTaskPicto` / `resolveEventPicto`** liefern nur Motive der eigenen Kategorie, sonst `null`. Sie prüfen in dieser Reihenfolge:
  1. Ein expliziter Picto-Name in `icon` (`"water"` / `"picto:water"`) derselben Kategorie.
  2. Ein **spezifisches Titel-Schlüsselwort** derselben Kategorie. Es schlägt das Emoji, weil gespeicherte Emoji oft generisch sind: „Hausaufgaben“ + 📚 → `homework`, „Pyjama anziehen“ + 🌙 → `pajamas`.
  3. Das Emoji aus `icon`, aber nur, wenn es auf ein Motiv derselben Kategorie zeigt. Zeigt es auf `tod-*`, `nav-*` oder ein Rückmeldungs-Motiv (🌙 → `tod-evening`), gilt es als kein Treffer.
  4. Ein schwaches Titel-Schlüsselwort (`~wort`, etwa „füttern“). Ein schwaches Wort überstimmt nie ein passendes Emoji: „Tiere füttern“ + 🐱 → `feed-cat`.
- Emoji werden normalisiert (VS16, Hauttöne, Gender-ZWJ). Ein Emoji darf mehreren Motiven verschiedener Kategorien zugeordnet sein; die Reihenfolge der Tabellenzeilen ist die Priorität. Beispiele: 🦷 ist `teeth` bei Aufgaben und `event-doctor` bei Terminen, 🍽 ist `set-table` bzw. `event-dinner`, 🎹 ist `music` bzw. `event-music`.
- Neu entschiedene Emoji:

  | Emoji | Aufgabe | Grund |
  |---|---|---|
  | 📚 | `homework` (Termine: `event-school`) | Bücherstapel = Schule; das Lese-Motiv hat 📖 |
  | 📖 📕 📗 📘 📙 | `read` | offenes bzw. einzelnes Buch = lesen |
  | 🧺 | `laundry` (Wäsche **zusammenlegen**) | Korb mit fertiger Wäsche |
  | 🫧 | `wash-clothes` (Wäsche **waschen**) | Seifenblasen; kanonisches Emoji der Waschmaschine |
- `resolvePicto(icon, title)` bleibt als Kompatibilitätsfunktion: jede Kategorie, Emoji vor Titel. Für Inhalte nicht mehr verwenden.
- `matchTitle(title, categories?)` liefert `{ name, weak }` für eigene Heuristiken; `suggestPicto(title)` ist die Kurzform ohne Filter.
- **Speichern:** Wird ein Motiv gewählt, wird `PICTO_META[name].emoji` in `icon` geschrieben, damit die Flutter-App (nur Emoji) weiter etwas Passendes zeigt. Alle Emoji aus `CHORE_ICONS` sind gemappt.
- `suggest.ts` deckt de, de-CH (Ämtli, Zmorge, Zmittag, Znacht, Velo, Chindsgi, Badi, Poschte, Ufzgi, Ghüder, Büsi …), en, fr und it ab.
  - Regeln: `=wort` exakt; ≤ 4 Buchstaben am Wortanfang; ≥ 5 Buchstaben auch mitten im Kompositum; `~wort` ist schwach.
  - Das längste Schlüsselwort gewinnt, so wird „Zahnarzt“ zu `event-doctor` und nicht zu `teeth`, und „Wäsche waschen“ zu `wash-clothes` statt `laundry`.
  - Das Testset ist grün: 116 Titel, alle `CHORE_ICONS`, Emoji-Varianten, 27 Task-Fälle (darunter alle 20 Demo-Aufgaben, das sind 17 verschiedene Titel-Emoji-Paare) und 10 Termin-Fälle.
- `suggest` liefert nur Aufgaben- und Termin-Motive. Navigation, Tageszeit und Rückmeldung kommen nie aus einem Titel.
- Die Labels für die Vorbefüllung stehen im i18n-Namespace `pictos` (de, en, fr, it), z. B. `t("pictos.water")` = „Wasser trinken“.
- Textlos-Prüfung: `/dev/pictos?view=tasks&text=0` zeigt die 20 Demo-Aufgaben so, wie `resolveTaskPicto` sie auflöst.

### Tageszeit-Symbole

Jedes Symbol hat genau eine Bedeutung; der Mond ist nicht mehr mehrfach belegt.

| Motiv | Bild | Bedeutung | Einsatz |
|---|---|---|---|
| `tod-morning` 🌅 | aufgehende Sonne über grünem Hügel | Morgens | Gruppenkopf, Topbar |
| `tod-day` ☀️ | lachende Sonne mit Strahlen | Tagsüber | Gruppenkopf, Topbar |
| `tod-evening` 🌙 | **wache** Mondsichel (offenes Auge, Lächeln) + Sterne | Abends | Gruppenkopf, Topbar |
| `tod-night` 🌛 | **schlafender** Mond: geschlossenes Auge, blaue Schlafmütze mit Bommel, zwei Z-Formen | Nacht / Schlafenszeit | Spalte, Dashboard und Topbar in der Nacht |
| `tod-anytime` 🌗 | Kreis mit hellblauer Tageshälfte (Sonne) links oben und violetter Nachthälfte (Mond + Stern) rechts unten | Jederzeit / Ganztägig | Gruppenkopf, Termin-Abschnitt, Dialog „Wann?“ |
| `pause` ⏳ | Sanduhr | „kommt später“ | kleines Badge auf dem gedimmten Symbol der nächsten Phase (≥ 20 px) |

- Die **Z-Formen** in `tod-night` sind gezeichnete Pfade (`<Lines>`), keine Buchstaben. Das Stilguide-Verbot „kein Text“ gilt auch hier. In Dark werden sie hell.
- `tod-anytime` ersetzt den Wecker. Ein Wecker bedeutet für Kinder „aufstehen“ bzw. „zu einer bestimmten Uhrzeit“, also eher das Gegenteil von „jederzeit“.
- **Warum eine S-Trennung statt einer geraden Diagonale:** Ein Kreis mit geradem Schrägstrich und dunkler Kontur ist das Verbotszeichen 🚫, und bei 40 px liest man ihn so. Die S-Kurve ist punktsymmetrisch um die Mitte, beide Hälften sind also gleich gross, und wirkt wie Tag/Nacht bzw. Yin-Yang. Die Sonnenstrahlen liegen als dünne Linien **innerhalb** des Kreises; aussen angesetzte Strahlen sahen bei 40 px aus wie Käferbeine.
- Pause unterscheidet sich damit nicht mehr nur über die Deckkraft: gedimmtes Phasensymbol **plus** Sanduhr-Badge.

### Motive (59)

| Kategorie | Motive (kanonisches Emoji) |
|---|---|
| Aufgaben (27) | `water` 💧 · `teeth` 🪥 · `tidy-toys` 🧸 · `get-dressed` 👕 · `make-bed` 🛏️ · `set-table` 🍽️ · `feed-dog` 🐶 · `feed-cat` 🐱 · `trash` 🚮 · `water-plants` 🌱 · `homework` ✏️ · `read` 📖 · `laundry` 🧺 · `wash-clothes` 🫧 · `dishes` 🧽 · `wash-hands` 🧼 · `bath` 🛁 · `pajamas` 🛌 · `backpack` 🎒 · `sweep` 🧹 · `vacuum` 🌪️ · `breakfast` 🥣 · `medicine` 💊 · `music` 🎹 · `tidy-room` 🗄️ · `shoes` 👟 · `shopping` 🛒 |
| Navigation (9) | `nav-home` 🏠 · `nav-calendar` 📅 · `nav-meals` 🍴 · `nav-tasks` ✅ · `nav-todos` 📋 · `nav-notes` 🗒️ · `nav-photos` 🖼️ · `nav-settings` ⚙️ · `nav-more` 🔲 |
| Tageszeit (5) | `tod-morning` 🌅 · `tod-day` ☀️ · `tod-evening` 🌙 · `tod-night` 🌛 · `tod-anytime` 🌗 |
| Rückmeldung (7) | `celebrate` 🏆 · `oops` 🩹 · `relax` 🏖️ · `star` ⭐ · `undo` ↩️ · `next` 👉 · `pause` ⏳ |
| Termine (11) | `event-school` 🏫 · `event-kindergarten` 🖍️ · `event-soccer` ⚽ · `event-swim` 🏊 · `event-doctor` 🩺 · `event-birthday` 🎂 · `event-dinner` 🍲 · `event-music` 🎸 · `event-play` 🪣 · `event-trip` 🚗 · `event-bike` 🚲 |

`shopping` (Poschte) und `event-bike` (Velo) gehen über die Mindestliste hinaus, weil beide Schlüsselwörter im Auftrag vorkommen.

Überarbeitet in Review-Runde 1:

| Motiv | Jetzt | Vorher |
|---|---|---|
| `make-bed` | leeres Bett, Deckenecke umgeschlagen, Pfeil „hochziehen“ | Bett mit Funkeln, verwechselbar mit schlafen |
| `pajamas` | Kind zieht ein gestreiftes Pyjama-Oberteil mit Mond über, Augen zu | schlafendes Kind im Bett |
| `shoes` | Paar hoher Turnschuhe fällt aufs Schuhregal (`drop`) | einzelner Schuh mit Speed-Lines, las sich wie „rennen“ |
| `laundry` | gefalteter Stapel, oberes T-Shirt wird umgeklappt (`pour` um die Falzkante) | Waschmaschine, jetzt `wash-clothes` |
| `nav-tasks` | grosser gelber Belohnungsstern mit weissem ✓, ohne Listenzeilen | Blatt mit Häkchen, verwechselbar mit `nav-todos` |
| `nav-more` | 2 × 2 abgerundete Kacheln in Blau, Orange, Gelb, Grün (Kalender, Essen, Aufgaben, To-dos) | neu (vorher Lucide-Icon) |

### Neues Motiv hinzufügen

1. Den Namen in `registry.ts` eintragen (`PICTO_NAMES` + `PICTO_META`).
2. Das Motiv in der passenden `motifs/*.tsx` zeichnen. `MOTIFS` ist `Record<PictoName, Motif>`, fehlt es, meldet der Typecheck einen Fehler.
3. Emoji in `emoji-map.ts` und Schlüsselwörter in `suggest.ts` ergänzen, das Label in allen 4 `messages/*.json` unter `pictos`.
4. In `/dev/pictos?cat=…` bei 40 px auf allen Tints prüfen, in Light und Dark.
