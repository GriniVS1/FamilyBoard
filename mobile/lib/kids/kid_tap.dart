/// Tap target with press state, visible focus ring (R9.4) and one accessible
/// label. Every kid-facing button (card, ↶, ↻, avatar) goes through it.
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'kid_theme.dart';

/// Width of the focus ring (R9.4 asks for 3-4 dp).
const double kKidFocusRing = 3;

class KidTapState {
  const KidTapState({required this.pressed, required this.focused});

  final bool pressed;
  final bool focused;
}

class KidTap extends StatefulWidget {
  const KidTap({
    required this.builder,
    required this.semanticLabel,
    this.onTap,
    this.semanticValue,
    this.checked,
    this.borderRadius = KidRadius.cardBorder,
    this.shape = BoxShape.rectangle,
    super.key,
  });

  /// Null disables the target: no ripple, no semantics action.
  final VoidCallback? onTap;
  final Widget Function(BuildContext context, KidTapState state) builder;
  final String semanticLabel;
  final String? semanticValue;

  /// Exposes a checked / unchecked state to assistive tech (done cards).
  final bool? checked;
  final BorderRadius borderRadius;
  final BoxShape shape;

  @override
  State<KidTap> createState() => _KidTapState();
}

class _KidTapState extends State<KidTap> {
  bool _pressed = false;
  bool _focused = false;

  void _setPressed(bool value) {
    if (_pressed != value) {
      setState(() => _pressed = value);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bool enabled = widget.onTap != null;
    final Widget content = widget.builder(
      context,
      KidTapState(pressed: _pressed, focused: _focused),
    );
    final Widget ring = DecoratedBox(
      position: DecorationPosition.foreground,
      decoration: BoxDecoration(
        shape: widget.shape,
        borderRadius: widget.shape == BoxShape.circle
            ? null
            : widget.borderRadius,
        border: _focused
            ? Border.all(color: context.kid.focus, width: kKidFocusRing)
            : null,
      ),
      child: content,
    );

    return Semantics(
      container: true,
      button: true,
      enabled: enabled,
      checked: widget.checked,
      label: widget.semanticLabel,
      value: widget.semanticValue,
      onTap: widget.onTap,
      excludeSemantics: true,
      child: FocusableActionDetector(
        enabled: enabled,
        onShowFocusHighlight: (bool value) => setState(() => _focused = value),
        actions: <Type, Action<Intent>>{
          ActivateIntent: CallbackAction<ActivateIntent>(
            onInvoke: (ActivateIntent _) {
              widget.onTap?.call();
              return null;
            },
          ),
        },
        shortcuts: const <ShortcutActivator, Intent>{
          SingleActivator(LogicalKeyboardKey.enter): ActivateIntent(),
          SingleActivator(LogicalKeyboardKey.space): ActivateIntent(),
        },
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapDown: enabled ? (TapDownDetails _) => _setPressed(true) : null,
          onTapUp: enabled ? (TapUpDetails _) => _setPressed(false) : null,
          onTapCancel: enabled ? () => _setPressed(false) : null,
          onTap: widget.onTap,
          child: ring,
        ),
      ),
    );
  }
}

/// Round button of the kid UI (↶, ↻, +): at least 56 dp, raised, focus ring.
class KidRoundButton extends StatelessWidget {
  const KidRoundButton({
    required this.child,
    required this.semanticLabel,
    required this.onTap,
    this.size = 56,
    this.color,
    this.borderColor,
    super.key,
  });

  final Widget child;
  final String semanticLabel;
  final VoidCallback? onTap;
  final double size;
  final Color? color;
  final Color? borderColor;

  @override
  Widget build(BuildContext context) {
    final KidTokens tokens = context.kid;
    return KidTap(
      onTap: onTap,
      semanticLabel: semanticLabel,
      shape: BoxShape.circle,
      builder: (BuildContext context, KidTapState state) {
        return Transform.translate(
          offset: Offset(0, state.pressed ? kKidPressDepth : 0),
          child: Container(
            width: size,
            height: size,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: color ?? tokens.surface,
              border: Border.all(
                color: borderColor ?? tokens.muted.withValues(alpha: 0.6),
                width: 2,
              ),
              boxShadow: state.pressed ? null : KidElevation.pop(tokens),
            ),
            child: child,
          ),
        );
      },
    );
  }
}
