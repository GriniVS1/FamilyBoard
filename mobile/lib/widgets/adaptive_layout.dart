import 'package:flutter/widgets.dart';

/// Width-based layout tiers shared by the app shell and every screen.
///
/// iPhone Duo (iOS 27) logical widths: 466pt cover display, 626pt inner
/// display unfolded in portrait, 890pt unfolded in landscape. Fold / unfold
/// resizes the app live, so always resolve these from `MediaQuery.sizeOf`
/// (or `LayoutBuilder`) inside `build` — never cache a size in `initState`.
///
/// Accepted boundary: Flutter does not populate `MediaQuery.displayFeatures`
/// on iOS (upstream PR still open), so there is no hinge / fold awareness.
/// Layout adapts to width only — no hinge-aware two-pane split. Revisit when
/// `displayFeatures` lands on iOS.
abstract final class AdaptiveLayout {
  /// At or above this width the bottom NavigationBar becomes a left
  /// NavigationRail. Sits between the Duo cover display (466) and its
  /// portrait inner display (626); standard phones (<= 440) and Pro Max
  /// sizes stay on the bottom bar.
  static const double railBreakpoint = 600;

  /// Widest a single-column screen body grows before it is centred with
  /// side gutters. Keeps cards and list rows readable at 890pt landscape.
  static const double contentMaxWidth = 700;

  /// Cap for grid screens (photos) that may use more width than a column of
  /// cards but should not sprawl across a tablet.
  static const double gridMaxWidth = 1100;

  static bool useRail(BuildContext context) =>
      MediaQuery.sizeOf(context).width >= railBreakpoint;

  /// Column count for the photo grid: 2 on phones and the Duo cover, 3 on
  /// the inner display in portrait, 4 once it is landscape-wide. [width] is
  /// the width the grid itself gets (rail already subtracted).
  static int photoColumns(double width) {
    if (width >= 720) {
      return 4;
    }
    if (width >= 520) {
      return 3;
    }
    return 2;
  }
}

/// Centres [child] and caps it at [AdaptiveLayout.contentMaxWidth].
///
/// Narrow screens are untouched (the constraint is looser than the
/// available width). Wrap a screen's scrollable body with this so pull to
/// refresh and scrolling work in the centred column and the page background
/// shows in the gutters.
class ConstrainedContent extends StatelessWidget {
  const ConstrainedContent({
    super.key,
    required this.child,
    this.maxWidth = AdaptiveLayout.contentMaxWidth,
  });

  final Widget child;
  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        // Tight width (and height when bounded) so children keep the same
        // "fill the body" behaviour they have on a phone.
        final double width = constraints.maxWidth < maxWidth
            ? constraints.maxWidth
            : maxWidth;
        return Align(
          alignment: Alignment.topCenter,
          child: SizedBox(
            width: width,
            height: constraints.hasBoundedHeight ? constraints.maxHeight : null,
            child: child,
          ),
        );
      },
    );
  }
}
