---
title: AK-33 not met: window.confirm still used in three settings components
severity: P3
area: frontend
owner: frontend-developer
status: verified
slice: kid-friendly-ui
created: 2026-09-30T19:41:34Z
---

## Reproduction

1. `cd /Users/nicolasgrichting/Projects/FamilyBoard && grep -rn "window.confirm" src/components`
2. Optionally open `/settings` (PIN), then "Apple / CalDAV" or "Microsoft" -> disconnect, or edit a member and save with a changed color.

## Expected

AK-33: `grep -rn "window.confirm" src/components` has 0 hits; confirmations are in-app dialogs with a symbol (`ConfirmDialog` from `src/components/kids/confirm-dialog.tsx`).

## Actual

Three hits remain, all under Settings (adult, PIN-gated):

## Evidence

```text
src/components/settings/caldav-row.tsx:128:          if (window.confirm(t("disconnectConfirm"))) {
src/components/settings/microsoft-row.tsx:135:         if (window.confirm(t("disconnect") + "?")) {
src/components/settings/member-editor-dialog.tsx:129: !window.confirm(
```

All other `window.confirm` uses named in H-41 (chore, event, note, photo, recipe dialogs) are gone. Verified at runtime: deleting a chore, to-do, note and calendar event shows the in-app dialog and `window.confirm` was called 0 times (stubbed and counted in the page).

## Notes

Plan section "Zuständigkeiten" limits the shell agent's settings work to the theme toggle and colour sweep, so this may have been skipped on purpose. If Settings is intentionally out of scope, relax AK-33 to "src/components except settings" and close this as won't-fix; otherwise swap the three calls for `ConfirmDialog`. Low risk either way: the PIN gate already protects these screens, but the native browser dialog is unreadable for the Chromium kiosk on a touchscreen.

## Fix

All three calls replaced with `ConfirmDialog` (`src/components/kids/confirm-dialog.tsx`):

- `settings/caldav-row.tsx`, `settings/microsoft-row.tsx`: disconnect opens the dialog (`disconnectConfirm`, new `settings.microsoft.disconnectConfirm`), confirm runs the existing mutation; the disconnect button is now the `danger` Button variant.
- `settings/member-editor-dialog.tsx`: remove-member opens a dialog with the member's avatar and the new `settings.members.deleteConfirm`; errors are localized instead of raw server text.

`grep -rn "window.confirm" src` now only finds the comment in `kids/confirm-dialog.tsx`. Verified: editing "Mama" and tapping "Löschen" shows "„Mama“ entfernen?" with the avatar (`scratchpad/fe-shell/memdel-wall-settings.png`); nothing was deleted.

## Verification

Round 2:

- `grep -rn "window.confirm" src` -> only the doc comment in `src/components/kids/confirm-dialog.tsx`.
- `/settings` (PIN), with `caldav-status`/`microsoft-status` stubbed as connected and every non-GET to `/api/members/*` blocked: CalDAV disconnect opens the in-app dialog "Diesen CalDAV-Kalender trennen?" (Abbrechen / Trennen); Outlook disconnect opens "Dieses Outlook-Konto trennen?". "Abbrechen" closes both, no request was sent, nothing disconnected.
- Member editor (Papa) -> "Löschen" opens a ConfirmDialog with the avatar and "„Papa“ entfernen?"; "Abbrechen" keeps the member (Member count 4 -> 4, no DELETE sent). `window.confirm` called 0 times.
