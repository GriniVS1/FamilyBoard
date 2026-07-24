---
title: "Wall wizard submits PIN before weather — weather step permanently 403s once setup completes"
severity: P1
area: backend
owner: backend-developer
status: fixed
slice: wall PR #114 field verification (found by mobile-developer's setup-onboarding work + confirmed live by app-tester)
created: 2026-07-24T13:00:00Z
---

## Reproduction

1. `src/lib/queries.ts` `getSetupStatus()`: `setupComplete = familyCreated && memberCount >= 1 && pinSet`
   (`weatherSet` is deliberately NOT part of this — see the mobile-side comment in
   `mobile/lib/state/setup_onboarding_controller.dart` that already documents this exact trap).
2. `src/lib/setup-guard.ts` `assertSetupIncomplete()` is called first by every `/api/setup/*`
   mutation, including `POST /api/setup/weather`, and 403s (`SETUP_ALREADY_COMPLETE`) once
   `setupComplete` is `true`.
3. The wall's own fallback wizard (`src/app/setup/wizard.tsx`, `STEP_ORDER`) drove steps in the
   order `family → members → pin → weather → done`. The moment `POST /api/setup/pin` succeeds,
   `setupComplete` flips to `true` (weather isn't required) — so the very next step, `StepWeather`'s
   save-and-finish submit, always hits `POST /api/setup/weather` after the guard is already closed
   and 403s.
4. The mobile app-first wizard was built with the opposite order (`family → members → weather →
   pin`) specifically to avoid this — confirmed by reading
   `mobile/lib/state/setup_onboarding_controller.dart`'s `WizardStep` enum and its doc comment,
   which already calls out the wall's ordering as the trap. The wall itself never got the same
   fix.

## Expected

Finishing the wall wizard (including actually saving a weather location, not just skipping it)
completes without a 403.

## Actual

Every fresh wall-only setup that reaches the PIN step and then tries to save weather (rather than
tapping "skip for now") gets `SETUP_ALREADY_COMPLETE` from `POST /api/setup/weather`. Skipping
weather masks the bug because `StepWeather.onSkip` never calls the API — so it was easy to not
notice in casual testing, but any real device with an actual weather widget requirement in v1 hits
this on every wall-only setup.

## Decision

Two ways to close this were on the table:

- **(a)** Include `weatherSet` in `setupComplete`. Rejected: this delays every other consumer of
  `setupComplete` (e.g. `requireAdminPin`'s no-op-until-complete gate, the license
  trial-window semantics implicitly keyed off first real use) until weather is set, and it breaks
  the mobile flow's "skip weather" path — `resolveInitialStep`/`getSetupStatus` on the mobile side
  already assume `weatherSet` does NOT gate completion (`skipWeather()` just advances local wizard
  state without calling any API, matching the wall's own skip behavior) — a skipped install would
  never flip `setupComplete` at all.
- **(b) (chosen)** Reorder the wall wizard to match the mobile wizard: `family → members → weather
  → pin → done`. `setupComplete`'s semantics are untouched, so nothing else in the codebase needs
  re-auditing. Weather is fully writable both before AND (via skip) is simply bypassed, same as
  today. The wall and mobile wizards are now step-order-consistent, which also makes
  `nextMissingStep` (wall) and `resolveInitialStep` (mobile) resume to the same step given the
  same `/api/setup/status` snapshot.

## Fix

`src/app/setup/wizard.tsx`:
- `STEP_ORDER`: swapped `weather` and `pin` (now `..., "family", "members", "weather", "pin",
  "done"`).
- `nextMissingStep()`: checks `!status.weatherSet` before `!status.pinSet`, matching the new order
  (and mirroring mobile's `resolveInitialStep`).
- Step transition wiring: `StepMembers.onComplete` → `weather`; `StepWeather.onComplete`/`onSkip`
  → `pin`; `StepPin.onComplete` → `done`; `StepPin.onBack` → `weather`; `StepWeather.onBack` →
  `members`.

No changes to `src/lib/queries.ts` or `src/lib/setup-guard.ts` for this bug — see the companion
report for the `GET /api/setup/members` guard fix, which is a separate concern that had to be
resolved together (the mobile who-are-you step calls that route right after `POST /api/setup/pin`,
i.e. after `setupComplete` flips, which is exactly the scenario a naive "just gate on
setupComplete" fix for that route would have broken).

### Verification

Ran the app on a scratch SQLite DB (`prisma migrate deploy` from empty), started `next dev`, and
drove the wall-order sequence over HTTP:

```
POST /api/setup/family   -> 200
POST /api/setup/members  -> 200
POST /api/setup/weather  -> 200   (previously would have been reached only after pin -> 403)
GET  /api/setup/status   -> setupComplete: false (weatherSet: true, pinSet: false)
POST /api/setup/pin      -> 200
GET  /api/setup/status   -> setupComplete: true
```

Also drove the mobile order (`family → members → weather → pin`) end to end — same result, no
403 anywhere, confirming the two wizards are now compatible with the same `setupComplete`
semantics.

`node node_modules/typescript/lib/tsc.js --noEmit` clean.
