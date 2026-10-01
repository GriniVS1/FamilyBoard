# Kinderfreundliches UI: Auftrag, Annahmen, Referenz

## Auftrag (Kurzfassung)

Die Wall-App (Next.js, `src/**`) soll farbenfroh, modern und kinderfreundlich werden. Kinder, die noch nicht lesen können, sollen Navigation und Aufgaben verstehen und selbstständig bedienen können. Bestehende Funktionen und Datenflüsse bleiben erhalten, auch die Mobile-API unter `/api/mobile/**` und die Flutter-App.

## Annahmen

- **Zielalter laut Auftrag: 3–99 Jahre.** Die primäre Gestaltungspersona ist **3–7 Jahre**, also Vorschul- und frühes Schulalter: kann nicht oder kaum lesen, kennt Farben, Formen, das eigene Gesicht und den eigenen Avatar.
  - Sekundär: Erwachsene, die Aufgaben einrichten, Einstellungen ändern und Kalender pflegen.
  - Erwachsenen-Abläufe wie Einstellungen, Setup und PIN dürfen weiterhin Text brauchen. Kinder-Abläufe dürfen das nicht.
- **Wichtigste Kinderaufgaben:** Wasser trinken, Aufräumen, Zähne putzen, Anziehen, Bett machen, Tisch decken, Tier füttern und ähnliche Alltagsroutinen.
- **Hauptgerät:** Wand-Touchscreen am Raspberry Pi (Chromium-Kiosk, typisch 1280×800 oder 1920×1080, Touch, keine Maus, kein Hover). Zusätzlich Tablet und Handy im Browser.
- **Emoji-Rendering ist plattformabhängig.** Der Pi nutzt `fonts-noto-color-emoji`, der Mac Apple Color Emoji. Für eine einheitliche Bildsprache nutzen die zentralen Kinderaufgaben daher **eigene SVG-Piktogramme** statt nackter Emoji.
- **Keine echten Tests mit Kindern.** Alle Aussagen zur Verständlichkeit sind heuristisch, etwa über den Test "Texte ausblenden".

## Referenz: Dæly Calendar (daely-shop.com)

Ich habe die Produktbilder am 30.09.2026 im Browser geöffnet und die Displayausschnitte vergrössert angesehen. Ausgewertet wurden die Bilder 1, 3, 4, 5, 7 und 10.

### Beobachtet (tatsächlich auf den Produktbildern sichtbar)

1. **Hintergrund:** helle, fast weisse Oberfläche mit grauen Linien. Farbe tragen die Termine und Aufgaben, nicht der Rahmen.
2. **Kalender (Wochenansicht):** Termine als pastellfarbene Blöcke (Pfirsich, Rosa, Mint, Hellblau, Flieder) in der Farbe der Person. Kleines Emoji neben dem Titel (🎁 Geburtstag, ⚽ Fussball, 🦷 Zahnarzt, 🥨 Bäckerei).
3. **Aufgabenansicht "Teamwork":** **eine Spalte pro Person.** Der ganze Spaltenhintergrund ist in der Personenfarbe getönt (Johanna rosa, Papa mint, Paul hellblau). Eine neutrale graue Spalte "Allgemein" enthält die unzugewiesenen Aufgaben.
4. **Spaltenkopf pro Person:**
   - rundes **Foto-Avatar** mit **farbigem Fortschrittsring**;
   - kleine Zahl-Badge am Avatar, vermutlich offene Aufgaben;
   - Name und Münz- bzw. Punktestand in einer Pill ("12");
   - "+"-Button in der Personenfarbe.
5. **Aufgabenzeilen:**
   - links ein **grosses, farbiges 3D-Emoji bzw. eine Illustration** des Gegenstands (Bett, Teddy, Zahnbürste, Schüssel, Pille, Einkaufstüten, Auto, Katze);
   - daneben der Titel ("Bett machen", "Aufräumen", "Zähne putzen") und eine kleine Metazeile ("1 · Täglich");
   - rechts ein **quadratisches Kontrollkästchen**.
6. **Erledigt-Zustand:**
   - die Zeile wird **kräftiger in der Personenfarbe gefüllt**;
   - das Kontrollkästchen wird zu einem weissen Haken auf gefülltem Quadrat;
   - in der App wird der Titel zusätzlich **durchgestrichen**.
7. **Tageszeit-Gruppen:** Die Aufgaben sind nach Tageszeit gruppiert, mit Icon als Abschnittskopf (☀️ Morgens, 📋 Tagsüber, 🌙 Abends). In der App gibt es entsprechende Tabs "Morgens / Tagsüber / Abends".
8. **Belohnung:** "+2" oder "+5" mit Münze erscheint als schwebende Rückmeldung. Oben stehen Avatare mit Punktzahl-Badge (3, 5, 2).
9. **Navigation:** schmale Icon-Leiste links mit Mini-Labels (Kalender, Schule, Aufgaben, Essen, Listen). Die Kopfzeile zeigt "10:05 | Familie Heine", die Datumsnavigation "‹ Heute ›" und rechts die Familien-Avatare mit Ringen.
10. **Essensplan:** Wochenraster mit **grossen Essensfotos oder -illustrationen** pro Mahlzeit und kurzer Beschriftung. Die Marketingbotschaft lautet: "die Kids sehen selber nach".
11. **Listen:** Checkliste mit Emoji vor jedem Eintrag (🧴 Sonnencreme, 🩳 Badesachen, 🪥 Zahnbürste). Erledigte Einträge werden durchgestrichen und blau abgehakt.
12. **Handy-App:** grüne Aufgaben-Pills, Fortschrittsbalken "2/5" unter dem Namen, grosser runder Haken rechts. Beim Abhaken erscheinen gelbe Strahlen als "Pop".

### Nicht beobachtbar, bzw. Einschränkungen

- Die Bilder sind Marketing-Renderings. Interaktion, Animationen im Detail, Fehlerzustände und Kontrastwerte waren nicht prüfbar.
- Die Displays sind klein und leicht perspektivisch fotografiert. Kleinschrift wie Metazeilen ist nicht vollständig lesbar.

### Eigene Verbesserungsvorschläge über die Referenz hinaus

Das sind bewusst eigene Ideen, die Dæly nicht zeigt:

- **Zustand nicht nur über Farbe:** "offen" als leerer runder Ring, "als Nächstes" mit Pfeil bzw. Puls-Markierung, "erledigt" mit gefülltem Haken und Stempel. Das Muster soll überall gleich sein.
- **Aufgabenbilder zeigen die Handlung,** nicht nur den Gegenstand, etwa Spielzeug fällt in die Kiste oder Wasser fliesst ins Glas. Antippen des Bildes spielt eine kurze Demo-Animation ab.
- **Rückgängig ohne Lesen:** grosser Knopf mit Pfeil zurück (↶) direkt am erledigten Kärtchen und im Erfolgs-Toast.
- **"Nur meine Aufgaben":** Antippen des eigenen Avatars filtert auf die eigene Spalte (Fokus-Modus).
- **Erklärungen per Bild:** Leere Zustände und Fehler zeigen eine freundliche Illustration mit einem grossen Aktionsknopf, keinen Textblock.
