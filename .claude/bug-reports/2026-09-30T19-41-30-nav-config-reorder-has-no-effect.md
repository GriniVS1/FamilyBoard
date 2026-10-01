---
title: Settings "Navigation" card still offers move up/down but the new shell ignores the order
severity: P2
area: frontend
owner: frontend-developer
status: verified
slice: kid-friendly-ui
created: 2026-09-30T19:41:30Z
---

## Reproduction

1. Open `/settings`, enter the admin PIN, scroll to the "Navigation" card (list order: Kalender, Essen, Aufgaben, To-dos, Notizen, Fotos).
2. Tap the up chevron of "Notizen" ("Notizen nach oben verschieben").
3. `curl -s localhost:3100/api/settings/nav | jq -c '.items|map(.key)'` -> order now `calendar, meals, chores, notes, todos, photos` (saved).
4. Reload `/` and read the wall rail (`aside nav a`).
5. Move "Notizen" back down to restore.

## Expected

Either the saved order changes the nav order, or the card no longer shows move buttons and its description no longer promises a sequence.

## Actual

The API order changes, but the rail is unchanged: `["Heute","Aufgaben","Kalender","Essen","Fotos","To-dos","Notizen","Einstellungen"]` (To-dos still before Notizen). The card description still reads "Wähle, welche Funktionen im Menü erscheinen und in welcher Reihenfolge." and the hint "Dashboard und Einstellungen sind immer sichtbar." uses the old name (nav now says "Heute"). The card's own list order (Kalender, Essen, Aufgaben, …) also differs from the real nav order (Aufgaben, Kalender, Essen, Fotos, To-dos, Notizen). Hiding an area still works (verified: Notizen disappears from rail and from the phone "Mehr" sheet; `/notes` stays reachable by URL).

## Evidence

```text
api after move       ["calendar:1","meals:1","chores:1","notes:1","todos:1","photos:1"]
rail after move      ["Heute","Aufgaben","30 Kalender","Essen","Fotos","To-dos","Notizen","Einstellungen"]

src/components/shell/app-shell.tsx: navConfig is only used to build `hidden`;
  kidKeys = KID_NAV_ORDER.filter(isVisible); adultKeys = ADULT_NAV_ORDER.filter(isVisible)
```

## Notes

UX doc 2.8 / plan E6: "Die Nav-Konfiguration (Bereiche ausblenden) bleibt. Die Reihenfolge Kinder vor Erwachsenen ist fix." So the intended fix is in `src/components/settings/nav-config-card.tsx` (remove the two chevron buttons and the "in welcher Reihenfolge" part of `settings.navConfig.description` in de/en/fr/it, change "Dashboard" to "Heute" in `alwaysVisibleHint`, and show the items in the real nav order). The `moveUp`/`moveDown` strings and the `move()` mutation become dead code afterwards.

## Fix

Decision: the saved order is honoured **inside** each group; which group an area belongs to stays fixed (children's areas first, "Heute" always first, "Einstellungen" always last).

- `src/components/shell/nav-order.ts` (new): `resolveNavOrder` splits the saved config into kids (Aufgaben, Kalender, Essen, Fotos) and adults (To-dos, Notizen) and keeps the saved order per group. The untouched legacy default (`calendar,meals,chores,todos,notes,photos`) is treated as "no preference" so fresh installs still show Heute, Aufgaben, Kalender, Essen, Fotos.
- `src/components/shell/app-shell.tsx`: rail, bottom nav and "Mehr" sheet use it.
- `src/components/settings/nav-config-card.tsx`: two sections (Kinderbereiche / Erwachsenenbereiche), move up/down only inside a section, list order equals the real nav order. Rows wrap on 390 px, so names are no longer truncated.
- `settings.navConfig.{description,alwaysVisibleHint,groupKids,groupAdults}` in de/en/fr/it ("Heute" instead of "Dashboard", group hint).

Verified (demo server, demo admin PIN from the seed script): saving `calendar, chores, meals(off), photos, notes, todos` gives rail `Heute, Kalender, Aufgaben, Fotos | Notizen, To-dos, Einstellungen`; phone: 4 direct slots + "Mehr" = Notizen, To-dos, Einstellungen. Tapping "Aufgaben nach oben verschieben" saves `chores, calendar, ...`. Config restored to the default afterwards. Screenshots: `scratchpad/fe-shell/navcard-wall-settings.png`, `navcard-phone-settings.png`.

## Verification

Round 2, 2026-09-30 ~22:30 CEST, real UI clicks on `/settings` (PIN) -> "Navigation".

- Card now has two sections (Kinderbereiche: Aufgaben, Kalender, Essen, Fotos / Erwachsenenbereiche: To-dos, Notizen); up/down is disabled at each group's edge (Aufgaben up=false, Fotos down=false, To-dos up=false, Notizen down=false). Description: "...Reihenfolge. Kinderbereiche stehen immer vor den Erwachsenenbereichen."
- "Notizen nach oben verschieben" -> API `chores,calendar,meals,photos,notes,todos`; rail after reload: `Heute, Aufgaben, Kalender, Essen, Fotos | Notizen, To-dos, Einstellungen`.
- "Fotos nach oben" + "Essen" off -> rail `Heute, Aufgaben, Kalender, Fotos | Notizen, To-dos, Einstellungen`; phone bottom nav `Heute Aufgaben Kalender Fotos Mehr`, "Mehr" sheet `Notizen, To-dos, Einstellungen`.
- Restored through the UI (rail back to default) and then PATCHed the exact original item list: `GET /api/settings/nav` is byte-identical to the round-1 snapshot (`calendar,meals,chores,todos,notes,photos`, all enabled).
