---
title: Chore card is not dimmed while the request is sending (R4.1 row "wird gesendet")
severity: P3
area: frontend
owner: frontend-developer
status: fixed
slice: mobile kids-UI screens (Aufgaben, Heute) 0.3.0
created: 2026-10-02T10:12:11Z
---

## Reproduction

1. Open Aufgaben, tick a chore while the request is still in flight (slow link).
2. Observe the card during the in-flight phase.

## Expected

R4.1: state "wird gesendet" = card slightly dimmed, with a load arc in the ring (three dots under reduced motion).

## Actual

The card is drawn fully opaque in its done colours with the spinner (or dots) inside the ring. Only the ring glyph differs; no dimming of the card.

## Evidence

`KidChoreCard.build` in mobile/lib/kids/kid_chore_card.dart uses `view.sending` only inside `_StatusRing`; the only opacity wrapper is the `_blocked && reduced` tap-guard feedback (0.7).

## Notes

Low impact because the optimistic fill is arguably better feedback, but it deviates from the contract table. Either dim (for example opacity 0.85 on the card) or record the deviation in the ruling.

## Fix

`mobile/lib/kids/kid_chore_card.dart`: while `view.sending` the card gets a dimming layer (`kKidCardSendingDimKey`, `tokens.bg` at 40 % alpha, card radius, `IgnorePointer`). It is token-based, so it dims toward the page background in light and dark. The ring spinner / three dots stay.

Tests in `mobile/test/kids_screens_test.dart` (light and dark): no dim before the tap; during a gated request exactly one dim layer whose colour is the theme's `bg` token with 0 < alpha < 1; gone once the request completes.
