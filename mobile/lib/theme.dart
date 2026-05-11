import 'package:flutter/material.dart';

/// FamilyBoard accent palette (8 member colors).
///
/// Hex values mirror the wall's design tokens — keep them in sync if
/// `src/app/globals.css` ever moves. The keys here match the
/// `MEMBER_COLORS` enum on the wall ("peach", "mint", …).
class AccentPalette {
  const AccentPalette._();

  static const Map<String, Color> light = <String, Color>{
    'peach': Color(0xFFFF8E72),
    'mint': Color(0xFF7AD2B0),
    'sun': Color(0xFFFFD166),
    'sky': Color(0xFF7CC5F2),
    'lilac': Color(0xFFB8A4E3),
    'rose': Color(0xFFF7A8C0),
    'teal': Color(0xFF6BCBC2),
    'sand': Color(0xFFE3C9A5),
  };

  static const Color fallback = Color(0xFF7CC5F2);

  static Color resolve(String? key) {
    if (key == null) {
      return fallback;
    }
    return light[key.toLowerCase()] ?? fallback;
  }
}

class FamilyBoardTheme {
  const FamilyBoardTheme._();

  static const Color _bg = Color(0xFFFAF7F2);
  static const Color _surface = Color(0xFFFFFFFF);
  static const Color _ink = Color(0xFF1B1F3B);
  static const Color _muted = Color(0xFF6B7280);

  static const Color _bgDark = Color(0xFF10131F);
  static const Color _surfaceDark = Color(0xFF181C2C);
  static const Color _inkDark = Color(0xFFF1EFE9);

  static ThemeData light() {
    final ColorScheme scheme = ColorScheme.fromSeed(
      seedColor: AccentPalette.light['sky']!,
      brightness: Brightness.light,
      surface: _surface,
    ).copyWith(onSurface: _ink, outline: const Color(0xFFE6E1D9));
    return _base(scheme, background: _bg, mutedText: _muted);
  }

  static ThemeData dark() {
    final ColorScheme scheme = ColorScheme.fromSeed(
      seedColor: AccentPalette.light['sky']!,
      brightness: Brightness.dark,
      surface: _surfaceDark,
    ).copyWith(onSurface: _inkDark, outline: const Color(0xFF2A2E40));
    return _base(scheme,
        background: _bgDark, mutedText: const Color(0xFF9CA3AF));
  }

  static ThemeData _base(
    ColorScheme scheme, {
    required Color background,
    required Color mutedText,
  }) {
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: background,
      textTheme: const TextTheme(
        displaySmall: TextStyle(
          fontSize: 32,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.5,
        ),
        headlineSmall: TextStyle(
          fontSize: 22,
          fontWeight: FontWeight.w600,
        ),
        titleMedium: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        bodyLarge: TextStyle(fontSize: 16, height: 1.4),
        bodyMedium: TextStyle(fontSize: 14, height: 1.4),
      ).apply(
        bodyColor: scheme.onSurface,
        displayColor: scheme.onSurface,
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: scheme.surface,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
          side: BorderSide(color: scheme.outline),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: scheme.surface,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: scheme.outline),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: scheme.outline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: scheme.primary, width: 2),
        ),
        labelStyle: TextStyle(color: mutedText),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: background,
        foregroundColor: scheme.onSurface,
        elevation: 0,
        centerTitle: false,
      ),
    );
  }
}
