---
title: Pair QR scanner view still overflows by 4-20px on iPhone landscape (caption reserve too small)
severity: P3
area: frontend
owner: mobile-developer
status: fixed
slice: iOS 27 + iPhone Duo fitness (mobile 0.2.0)
created: 2026-09-30T18:28:38Z
---

## Reproduction

1. In a scratch copy of mobile/ (not the worktree), pump `PairScreen` inside MaterialApp with the app localizations, set `tester.view.devicePixelRatio = 1` and `physicalSize` to 844x390 (iPhone landscape; Info.plist allows landscape on iPhone).
2. Tap the "scan QR" chooser button (`Icons.qr_code_scanner`) so `_PairMode.scanner` renders `QrScannerView`.
3. `tester.takeException()` reports a RenderFlex overflow.

## Expected

The scanner mode fits without overflow at common iPhone landscape sizes; the viewfinder shrinks (down to _minSide) so the localized caption fits.

## Actual

Overflow in the Column at `qr_scanner_view.dart:153` (viewfinder + 16pt gap + caption). Measured in a scratch copy (mobile_scanner not mocked; ordinary sizes otherwise clean):

```text
en/de 844x390 @1.0   : overflow 5px
fr/it 844x390 @1.0   : overflow (2 exceptions)
fr/it 932x430 @1.0   : overflow 4px
en    667x375 @1.0   : overflow 20px (Column at qr_scanner_view.dart:153)
de/fr/it 667x375     : overflow (2 exceptions; also pair_screen.dart:153 by 2px in de)
en    844x390 @1.3 text scale: overflow
OK: en/de 932x430, all locales 890x626 and 626x890, en/de/fr/it 393x852
```

Baseline (HEAD, before this change) overflowed by 491-703px at landscape sizes, so this is a large improvement, not a regression. In release builds the excess caption text paints over the "enter manually" button / gets clipped.

## Evidence

```text
A RenderFlex overflowed by 20 pixels on the bottom.
  Column  qr_scanner_view.dart:153:16
```

## Notes

`_captionReserve = 72` assumes a 1-2 line caption at 1.0 text scale. `pairScanInstruction` is 2-3 lines in de/fr/it, and more with Dynamic Type. When `fitsHeight < _minSide` the viewfinder is pinned to 120 and the Column overflows anyway. Options: measure the caption (e.g. put it in a Flexible/scrollable), raise the reserve, or make the scanner mode body scrollable. No existing test covers PairScreen scanner mode at landscape sizes.

## Fix

Root cause: the viewfinder was sized as `maxHeight - 72` (a fixed caption reserve) inside a non-scrolling Column, so any caption or title taller than the guess overflowed, and the 120pt minimum pinned the square anyway. The chooser (same screen, `Spacer` column) had the same flaw at 667x375.

Approach: stop reserving space for text that varies by locale and text scale; let the body scroll instead.
- `pair_screen.dart`: new private `_ScrollWithFooter` (LayoutBuilder + SingleChildScrollView + `ConstrainedBox(minHeight)` + `Column(spaceBetween)`). The footer buttons stay pinned to the bottom when there is room; when content is taller than the body it scrolls as one column. Used by both the scanner mode and the chooser.
- `qr_scanner_view.dart`: the LayoutBuilder height logic and `_captionReserve` are gone. The viewfinder is `min(width, maxSide)`, where the host passes `QrScannerView.sideForHeight(availableHeight)` (clamped 120..360, same cap and min as before). The estimate only tunes the square's size; it can no longer cause overflow.

Verification: `test/pair_scanner_layout_test.dart` pumps the chooser and scanner mode and asserts no exception at 667x375, 844x390, 932x430, 393x852, 466x678, 626x890 and 890x626 in en/de/fr/it, plus 844x390 at 1.3x text scale in all four locales, plus a check that the "enter manually" button stays reachable at 667x375 de. All green; `flutter analyze` clean; full suite 124 tests pass.
