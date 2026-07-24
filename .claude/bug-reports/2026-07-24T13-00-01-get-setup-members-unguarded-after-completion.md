---
title: "GET /api/setup/members has no completeness guard — enumerates member names/colors/emojis on the LAN forever"
severity: P1
area: backend
owner: backend-developer
status: fixed
slice: wall PR #114 field verification (found by mobile-developer's setup-onboarding work + confirmed live by app-tester)
created: 2026-07-24T13:00:01Z
---

## Reproduction

1. `src/app/api/setup/members/route.ts`'s `POST` calls `assertSetupIncomplete()` (403s once
   `setupComplete`), but the `GET` handler never called any guard at all:
   ```ts
   export const GET = withErrorHandling(async () => {
     const members = await listMembers();
     return ok(members);
   });
   ```
2. Every other `/api/setup/*` mutation route is guarded. This read route was not, despite
   returning member `name`/`color`/`emoji` — enough to fingerprint a family and its kids by name
   to anyone on the same LAN, indefinitely, with no auth.

## Expected

Once setup is complete and normal operation has started, `/api/setup/*` (read or write) should not
be reachable by an unauthenticated LAN client.

## Actual (before fix)

`GET /api/setup/members` returned the full member list unauthenticated, at any time, even years
after setup completed.

## Decision

A naive fix — reuse `assertSetupIncomplete()` (i.e. 403 once `setupComplete`) — breaks the mobile
app-first onboarding flow: `mobile/lib/state/setup_onboarding_controller.dart`'s `submitPin()`
calls `POST /api/setup/pin` and then immediately calls `GET /api/setup/members` (via
`SetupService.fetchMembers`) to populate the "who are you?" step, i.e. it deliberately calls this
route **after** `setupComplete` has already flipped `true` (weather doesn't gate completion, PIN
does, and PIN is the last thing submitted in both wizards now). Gating on `setupComplete` alone
would 403 that call, and `SetupService._guard`/`SetupOnboardingController._run` map any
403/`SETUP_ALREADY_COMPLETE` to `OnboardingPhase.alreadyConfigured` — so the user would get bounced
to "setup already done, go pair normally" one step after successfully setting the PIN, without ever
seeing the who-are-you picker. `mobile/lib/services/setup_service.dart` already carries a comment
anticipating this ("unauthenticated, only answers pre-pairing (see the route's guard)"), i.e. the
mobile side was written assuming a guard keyed on *pairing*, not on setup completion.

Chosen fix: gate `GET /api/setup/members` on whether any phone has ever actually finished pairing
(a `MobileDevice` row only exists once `POST /api/devices/pair` succeeds), not on `setupComplete`:

- Setup incomplete → always allowed (wall wizard's own use, and mobile's earlier steps).
- Setup complete AND no `MobileDevice` row exists yet → still allowed. This is exactly the narrow
  window between "PIN just set" and "first phone finished pairing" that the who-are-you step needs.
- Setup complete AND at least one `MobileDevice` exists → 403 `SETUP_ALREADY_COMPLETE`. Every
  *subsequent* device pairing goes through the PIN-gated Settings-screen QR flow
  (`POST /api/settings/pair-code` + `POST /api/devices/pair`), which never calls this route (grepped
  `mobile/` and `src/`: only `SetupService.fetchMembers` calls `GET /api/setup/members`), so closing
  it for good after the first pairing has no legitimate caller left.

## Fix

- `src/lib/setup-guard.ts`: added `assertMemberListReadable()` — mirrors `assertSetupIncomplete()`
  but additionally allows the "setupComplete but zero paired devices yet" window via
  `db.mobileDevice.count()`.
- `src/app/api/setup/members/route.ts`: `GET` now calls `assertMemberListReadable()` before
  `listMembers()`.

### Verification

On the same scratch-DB dev server used for the companion weather-deadlock fix:

```
# fresh setup, before pin
GET /api/setup/members            -> 200 (setup incomplete)

# after weather + pin (setupComplete: true), before any device paired
GET /api/setup/members            -> 200 (who-are-you window — no MobileDevice row yet)

# after seeding one MobileDevice row directly via Prisma (simulating a completed pairing)
GET /api/setup/members            -> 403 {"error":{"code":"SETUP_ALREADY_COMPLETE", ...}}
```

`node node_modules/typescript/lib/tsc.js --noEmit` clean.
