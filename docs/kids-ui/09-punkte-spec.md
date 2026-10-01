# 09 – Punktestand und Eltern-Übersicht

Auftrag des Users vom 01.10.2026:
- Eine Übersicht für die Eltern, wer wie viele Punkte gesammelt hat.
- Die Eltern können die Punkte zurücksetzen.
- Bei den Aufgaben steht die aktuelle Punktzahl.

## Modell (Koordinator-Entscheidung)

- **Punktestand** (balance) ist die Summe der `chore.points` aller Erledigungen einer Person **seit ihrem letzten Zurücksetzen**, bzw. seit Beginn, wenn nie zurückgesetzt wurde. Er sammelt sich also über Wochen an, bis die Eltern ihn auf 0 setzen, z. B. wenn ein Kind Sterne gegen eine Belohnung eintauscht.
- Zurücksetzen löscht **keine** Erledigungen. Es legt einen `PointReset`-Eintrag an mit Zeitpunkt und gelöschtem Stand, damit Verlauf und Rückgängig möglich sind.
- Die Wochenwerte (`weeklyByMember`) bleiben unverändert, die Mobile-App nutzt sie.
- Punkte werden wie bisher über `chore.points` zum Abfragezeitpunkt berechnet. Ändert jemand die Punkte einer Aufgabe, ändert sich auch der Stand rückwirkend. Löscht man eine Aufgabe, verschwinden ihre Punkte (Cascade, wie heute).
- Zurücksetzen ist wie die übrige Aufgabenverwaltung serverseitig nicht PIN-geschützt. Die Wand schützt es über den Eltern-Modus (Entscheidung E4).

## Datenmodell

```prisma
model PointReset {
  id       String   @id @default(cuid())
  memberId String
  member   Member   @relation(fields: [memberId], references: [id], onDelete: Cascade)
  points   Int
  resetAt  DateTime @default(now())

  @@index([memberId, resetAt])
}
```

Die Migration ist additiv (neue Tabelle) und damit OTA-sicher.

## API (Typen in `src/components/chores/types.ts`)

| Route | Antwort |
|---|---|
| `GET /api/chores` | wie bisher, **zusätzlich** `balanceByMember: Record<memberId, { balance, since }>` |
| `GET /api/points` | `PointsOverview`: alle Personen der Familie (auch mit 0), Reihenfolge `createdAt asc`. Je Person `balance`, `since`, `weekly` (aktuelle Woche wie `weeklyByMember`), `allTime`, `history` (neueste zuerst, max. 10) |
| `POST /api/points/reset` `{ memberIds: string[] }` (min. 1, alle aus der Familie) | `PointResetResponse`. Personen mit Stand 0 bekommen keinen Eintrag und fehlen in `resets`. |
| `DELETE /api/points/reset/[id]` | `PointResetUndoResponse`. Nur der **jeweils neueste** Reset einer Person ist löschbar, sonst 409 `RESET_NOT_LATEST`; unbekannt → 404 |

Regel: Erledigungen mit `completedAt > resetAt` zählen zum neuen Stand (strikt grösser).

## UI

- **Stern-Pill im Spaltenkopf** (`/chores`) zeigt den **Punktestand** statt der Wochenpunkte. Die fliegenden Sterne landen dort. Optimistisch: Abhaken +points, Rückgängig −points.
- **Dashboard-Avatarleiste:** ⭐ + Punktestand unter jedem Namen.
- **Eltern-Übersicht "Punkte"**, nur im Eltern-Modus erreichbar:
  - Ein Knopf (⭐ + "Punkte") im Kopf von `/chores` öffnet die Übersicht.
  - Je Person eine Zeile:
    - Avatar und Name;
    - **grosser Punktestand**;
    - "diese Woche +N", "insgesamt N", "seit TT.MM." bzw. "seit Beginn";
    - aufklappbarer Verlauf ("01.10. · 12 ⭐ zurückgesetzt");
    - Knopf **"Zurücksetzen"** (↺, ≥ 48 px, deaktiviert bei 0).
  - Unten: **"Alle zurücksetzen"**.
  - Jedes Zurücksetzen läuft so ab: In-App-Bestätigung (mit Avatar und Stand) → danach Toast mit ↶ (8 s, 600 ms Aktivierung) → `DELETE`.
  - Lade-, Leer- und Fehlerzustände mit den vorhandenen `state-views`.
- i18n in de/en/fr/it (Namespace `points`), Schweizer "ss".
