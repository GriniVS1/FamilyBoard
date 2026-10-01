---
title: Chore delete confirmation says "stars are kept" but deleting a chore removes its stars
severity: P2
area: frontend
owner: frontend-developer
status: verified
slice: kid-friendly-ui
created: 2026-09-30T19:41:29Z
---

## Reproduction

1. On the demo server (http://localhost:3100, `data/kids-ui.db`) create a chore and complete it for Leo:
   `C=$(curl -s -X POST localhost:3100/api/chores -H 'content-type: application/json' -d '{"title":"TEST cascade","points":7}' | jq -r .id)`
   `curl -s -X POST localhost:3100/api/chores/$C/complete -H 'content-type: application/json' -d '{"memberId":"<LEO_ID>"}'`
2. Read Leo's weekly stars: `curl -s localhost:3100/api/chores | jq '.weeklyByMember["<LEO_ID>"]'` -> `{"points":8,"completions":2}`.
3. In the UI: `/chores` -> "Bearbeiten" + PIN -> pencil on the chore -> "Löschen". The in-app confirm shows "Aufgabe löschen? Bisherige Sterne bleiben erhalten." (equivalent via `DELETE /api/chores/$C` for step 3).
4. Re-read Leo's weekly stars.

## Expected

The confirm text is true: stars already earned stay (Leo keeps 8 stars for the week). At minimum the dialog must not promise something the system does not do.

## Actual

After the delete Leo is back at `{"points":1,"completions":1}`. The 7 stars earned from the deleted chore are gone. `ChoreCompletion.chore` is `onDelete: Cascade` and weekly points are computed by joining each completion to `chore.points`, so deleting the chore removes the completions and their points.

## Evidence

```text
leo before:               {"points":1,"completions":1}
leo after complete:       {"points":8,"completions":2}
DELETE /api/chores/$C  -> {"ok":true}
leo after chore delete:   {"points":1,"completions":1}

src/messages/de.json:411  "deleteTitle": "Aufgabe löschen? Bisherige Sterne bleiben erhalten."
(en/fr/it carry the same promise)
prisma/schema.prisma:181  chore  Chore  @relation(fields: [choreId], references: [id], onDelete: Cascade)
```

## Notes

The copy was carried over from the old `chores.dialog.deleteConfirm` ("Diese Aufgabe löschen? Bisherige Sterne bleiben erhalten.") and is now shown by the new in-app `ConfirmDialog` in `src/components/chores/chore-dialog.tsx`. Pre-existing behaviour, but the redesign re-publishes the false promise in all four locales. Smallest fix is copy (frontend): say that stars from this chore are removed, or drop the sentence. If the product really wants stars kept, that needs a backend change (soft-delete/archive the chore, or store points on the completion) — then route this to backend-developer.

## Fix

Frontend only, as suggested: `chores.dialog.deleteTitle` now tells the truth in all four locales (de: "Aufgabe löschen? Die damit verdienten Sterne werden ebenfalls entfernt." and the en/fr/it equivalents). No backend change; the cascade behaviour is unchanged. Files: `src/messages/{de,en,fr,it}.json`.

## Verification

Round 2, 2026-09-30 ~22:55 CEST, demo server :3100 after restart.

- Copy in all four locales now states the truth (`src/messages/*.json`, `chores.dialog.deleteTitle`):
  de "Aufgabe löschen? Die damit verdienten Sterne werden ebenfalls entfernt." / en "...The stars earned with it are removed as well." / fr "...sont aussi supprimées." / it "...vengono rimosse."
- UI: `/chores` -> "Bearbeiten" + PIN -> pencil on a TEST chore -> "Löschen" shows exactly that de text in the in-app ConfirmDialog; "Abbrechen" keeps the chore (DB row still present, `window.confirm` called 0 times).
- Behaviour unchanged (cascade, verified in round 1: 8 -> 1 stars), so the text now matches reality.
