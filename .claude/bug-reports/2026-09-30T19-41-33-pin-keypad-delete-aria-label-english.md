---
title: PIN keypad backspace has hard-coded English aria-label "Delete" (shown on /chores in parent mode)
severity: P3
area: frontend
owner: frontend-developer
status: verified
slice: kid-friendly-ui
created: 2026-09-30T19:41:33Z
---

## Reproduction

1. Locale `de`. Open `/chores` (wall) and tap "Bearbeiten 🔒" to open the parent PIN dialog.
2. List the dialog buttons: `[...document.querySelectorAll('[role=dialog] button')].map(e => e.getAttribute('aria-label') || e.textContent.trim())`.

## Expected

All accessible names on kid pages are localized (AK-36: no English aria-labels on the kid pages in `de`; same for fr/it).

## Actual

The backspace key has `aria-label="Delete"` in every locale. All other dialog labels are German ("Schließen", digits).

## Evidence

```text
dialog btns: ["1","2","3","4","5","6","7","8","9","0","Delete","Schließen"]

src/components/settings/pin-keypad.tsx:72   aria-label="Delete"
```

## Notes

`pin-keypad.tsx` is unchanged versus HEAD (it lived on the PIN-gated Settings page before), but the parent-mode dialog in `src/components/kids/parent-mode.tsx` now reuses it on the kid page `/chores`. Add a message key (e.g. `common.delete` / `parentMode.backspace`) in de/en/fr/it and use `useTranslations` in `PinKeypad`. Related, same component family: the PIN-error banner is fine (`parentMode.wrongPin` = "Falscher PIN. Bitte nochmal versuchen.").

## Fix

New message `common.backspace` ("Letzte Ziffer löschen" / "Delete last digit" / "Effacer le dernier chiffre" / "Cancella l'ultima cifra"), used by all four keypads: `settings/pin-keypad.tsx`, `pin-gate.tsx`, `pin-change-dialog.tsx`, `devices-row.tsx`. Same round: `aria-label="Dismiss"` in `microsoft-callback-banner.tsx` now `common.close` (48 px target), placeholder "The Smith Family" in `family-editor.tsx` now `settings.familyNamePlaceholder` (4 languages), and `ß` unified to `ss` in `de.json` for the non-kid namespaces.

Verified: on `/settings` the keypad button is labelled "Letzte Ziffer löschen".

## Verification

Round 2, locale forced per browser via `fb_locale` cookie (DB untouched). Backspace key label in the parent-mode PIN dialog on `/chores` and in the `/settings` PIN gate:

- de "Letzte Ziffer löschen", en "Delete last digit", fr "Effacer le dernier chiffre", it "Cancella l'ultima cifra".
- The dialog's close button is localized too ("Schliessen" / "Close" / "Fermer" / "Chiudi"). `grep -rn 'aria-label="Delete"' src` has no hits.
