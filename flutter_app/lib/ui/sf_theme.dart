import 'package:flutter/material.dart';

class SfTheme {
  // Keep Flutter and Next.js visually aligned with the CSS preset system in app/globals.css.
  static const List<String> presets = <String>[
    'orbit',
    'graphite',
    'sunrise',
    'nord',
    'ocean',
    'warmlux',
  ];

  static ThemeData light({
    String preset = 'orbit',
    String density = 'comfortable',
    bool reducedMotion = false,
  }) =>
      _build(lightScheme(preset), isDark: false, density: density, reducedMotion: reducedMotion);

  static ThemeData dark({
    String preset = 'orbit',
    String density = 'comfortable',
    bool reducedMotion = false,
  }) =>
      _build(darkScheme(preset), isDark: true, density: density, reducedMotion: reducedMotion);

  static ColorScheme lightScheme(String preset) {
    final p = _paletteFor(preset, isDark: false);
    final base = ColorScheme.fromSeed(seedColor: p.primary, brightness: Brightness.light);
    return base.copyWith(
      primary: p.primary,
      onPrimary: p.onPrimary,
      secondary: p.secondary,
      onSecondary: p.onSecondary,
      tertiary: p.accent,
      onTertiary: p.onAccent,
      background: p.background,
      onBackground: p.onBackground,
      surface: p.surface,
      onSurface: p.onSurface,
      surfaceVariant: p.surfaceVariant,
      onSurfaceVariant: p.onSurfaceVariant,
      outline: p.outline,
      outlineVariant: p.outline,
    );
  }

  static ColorScheme darkScheme(String preset) {
    final p = _paletteFor(preset, isDark: true);
    final base = ColorScheme.fromSeed(seedColor: p.primary, brightness: Brightness.dark);
    return base.copyWith(
      primary: p.primary,
      onPrimary: p.onPrimary,
      secondary: p.secondary,
      onSecondary: p.onSecondary,
      tertiary: p.accent,
      onTertiary: p.onAccent,
      background: p.background,
      onBackground: p.onBackground,
      surface: p.surface,
      onSurface: p.onSurface,
      surfaceVariant: p.surfaceVariant,
      onSurfaceVariant: p.onSurfaceVariant,
      outline: p.outline,
      outlineVariant: p.outline,
    );
  }

  static ThemeData _build(
    ColorScheme scheme, {
    required bool isDark,
    required String density,
    required bool reducedMotion,
  }) {
    final base = ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      brightness: isDark ? Brightness.dark : Brightness.light,
      fontFamily: 'Tajawal',
      visualDensity: density == 'compact' ? VisualDensity.compact : VisualDensity.standard,
      pageTransitionsTheme: PageTransitionsTheme(
        builders: <TargetPlatform, PageTransitionsBuilder>{
          for (final platform in TargetPlatform.values)
            platform: reducedMotion ? const _SfNoMotionPageTransitionsBuilder() : const ZoomPageTransitionsBuilder(),
        },
      ),
    );

    final radius = BorderRadius.circular(16);
    final fieldRadius = BorderRadius.circular(16);

    return base.copyWith(
      scaffoldBackgroundColor: scheme.background,
      canvasColor: scheme.background,
      appBarTheme: AppBarTheme(
        centerTitle: false,
        elevation: 0,
        backgroundColor: Colors.transparent,
        foregroundColor: scheme.onSurface,
        surfaceTintColor: Colors.transparent,
        toolbarHeight: isDark ? 60 : 60,
        titleTextStyle: TextStyle(
          fontFamily: 'Tajawal',
          fontSize: 18,
          fontWeight: FontWeight.w800,
          color: scheme.onSurface,
        ),
      ),
      dividerTheme: DividerThemeData(
        thickness: 1,
        color: (isDark ? Colors.white : Colors.black).withOpacity(0.08),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: scheme.surface.withOpacity(isDark ? 0.78 : 1.0),
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: radius,
          side: BorderSide(color: scheme.outline.withOpacity(isDark ? 0.70 : 0.75)),
        ),
        margin: EdgeInsets.zero,
      ),
      listTileTheme: ListTileThemeData(
        iconColor: scheme.onSurfaceVariant,
        textColor: scheme.onSurface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: scheme.surface.withOpacity(isDark ? 0.55 : 1.0),
        border: OutlineInputBorder(borderRadius: fieldRadius),
        enabledBorder: OutlineInputBorder(
          borderRadius: fieldRadius,
          borderSide: BorderSide(color: scheme.outlineVariant.withOpacity(isDark ? 0.70 : 0.90)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: fieldRadius,
          borderSide: BorderSide(color: scheme.primary, width: 1.5),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      ),
      chipTheme: base.chipTheme.copyWith(
        backgroundColor: scheme.surface.withOpacity(isDark ? 0.75 : 1.0),
        selectedColor: scheme.primary.withOpacity(isDark ? 0.22 : 0.14),
        side: BorderSide(color: scheme.outline.withOpacity(isDark ? 0.70 : 0.75)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        labelStyle: TextStyle(fontWeight: FontWeight.w800, color: scheme.onSurface),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: const TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: const TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          textStyle: const TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      navigationRailTheme: NavigationRailThemeData(
        backgroundColor: scheme.surface.withOpacity(isDark ? 0.65 : 0.92),
        indicatorColor: scheme.primary.withOpacity(isDark ? 0.22 : 0.14),
        selectedIconTheme: IconThemeData(color: scheme.primary),
        selectedLabelTextStyle: TextStyle(fontWeight: FontWeight.w800, color: scheme.primary),
        unselectedIconTheme: IconThemeData(color: scheme.onSurfaceVariant),
        unselectedLabelTextStyle: TextStyle(color: scheme.onSurfaceVariant),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: scheme.surface.withOpacity(isDark ? 0.65 : 0.96),
        indicatorColor: scheme.primary.withOpacity(isDark ? 0.22 : 0.14),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return TextStyle(
            fontWeight: selected ? FontWeight.w800 : FontWeight.w700,
            color: selected ? scheme.primary : scheme.onSurfaceVariant,
          );
        }),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: isDark ? const Color(0xFF121824) : const Color(0xFF0B1220),
        contentTextStyle: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    );
  }

  static _SfPalette _paletteFor(String preset, {required bool isDark}) {
    final normalized = preset.trim().toLowerCase();
    switch (normalized) {
      case 'graphite':
        return _SfPalette(
          primary: const Color(0xFF667086),
          secondary: const Color(0xFF7F8EA4),
          accent: const Color(0xFFA6B0C2),
          background: isDark ? const Color(0xFF1B1F25) : const Color(0xFFF6F7FA),
          surface: isDark ? const Color(0xFF262B33) : const Color(0xFFFFFFFF),
          surfaceVariant: isDark ? const Color(0xFF20242C) : const Color(0xFFEFF2F6),
          onSurface: isDark ? const Color(0xFFE6EDF3) : const Color(0xFF172B4D),
          onSurfaceVariant: isDark ? const Color(0xFFB7C0D0) : const Color(0xFF57606A),
          outline: isDark ? const Color(0xFF3A414C) : const Color(0xFFD5DBE4),
        );
      case 'sunrise':
        return _SfPalette(
          primary: const Color(0xFFE57A39),
          secondary: const Color(0xFFEDB84C),
          accent: const Color(0xFF46B8A8),
          background: isDark ? const Color(0xFF201914) : const Color(0xFFFFF7F0),
          surface: isDark ? const Color(0xFF2A201A) : const Color(0xFFFFFFFF),
          surfaceVariant: isDark ? const Color(0xFF2F251F) : const Color(0xFFFFEBDD),
          onSurface: isDark ? const Color(0xFFFFF4EC) : const Color(0xFF2C2C2C),
          onSurfaceVariant: isDark ? const Color(0xFFEAC8B3) : const Color(0xFF6B5B52),
          outline: isDark ? const Color(0xFF4E3B30) : const Color(0xFFE6D7CC),
        );
      case 'nord':
        return _SfPalette(
          primary: const Color(0xFF5E81AC),
          secondary: const Color(0xFF88C0D0),
          accent: const Color(0xFF81A1C1),
          background: isDark ? const Color(0xFF2E3440) : const Color(0xFFECEFF4),
          surface: isDark ? const Color(0xFF3B4252) : const Color(0xFFFFFFFF),
          surfaceVariant: isDark ? const Color(0xFF343B48) : const Color(0xFFE3E8F1),
          onSurface: isDark ? const Color(0xFFECEFF4) : const Color(0xFF2E3440),
          onSurfaceVariant: isDark ? const Color(0xFFC8D2E3) : const Color(0xFF4C566A),
          outline: isDark ? const Color(0xFF4C566A) : const Color(0xFFD5DBE4),
        );
      case 'ocean':
        return _SfPalette(
          primary: const Color(0xFF2F84D4),
          secondary: const Color(0xFFEEF3F8),
          accent: const Color(0xFF3AA8FF),
          background: isDark ? const Color(0xFF0E1720) : const Color(0xFFEEF3F8),
          surface: isDark ? const Color(0xFF15222F) : const Color(0xFFF8F8FA),
          surfaceVariant: isDark ? const Color(0xFF122030) : const Color(0xFFE7EEF6),
          onSurface: isDark ? const Color(0xFFE7F2FF) : const Color(0xFF172B4D),
          onSurfaceVariant: isDark ? const Color(0xFFB7C8DA) : const Color(0xFF4B5A6A),
          outline: isDark ? const Color(0xFF2A3A4B) : const Color(0xFFD5DBE4),
        );
      case 'warmlux':
        return _SfPalette(
          primary: const Color(0xFFE5B73B),
          secondary: const Color(0xFF2C2C2C),
          accent: const Color(0xFFB48A2A),
          background: isDark ? const Color(0xFF151311) : const Color(0xFFE9E6DF),
          surface: isDark ? const Color(0xFF1D1A17) : const Color(0xFFFFFFFF),
          surfaceVariant: isDark ? const Color(0xFF221E1A) : const Color(0xFFF3F0EA),
          onSurface: isDark ? const Color(0xFFF7F3E8) : const Color(0xFF2C2C2C),
          onSurfaceVariant: isDark ? const Color(0xFFD7C7A8) : const Color(0xFF6B6253),
          outline: isDark ? const Color(0xFF3B342A) : const Color(0xFFD5DBE4),
        );
      case 'orbit':
      default:
        return _SfPalette(
          primary: const Color(0xFF0F62FE),
          secondary: const Color(0xFF0052CC),
          accent: const Color(0xFF57606A),
          background: isDark ? const Color(0xFF24292F) : const Color(0xFFF7F8FA),
          surface: isDark ? const Color(0xFF32383F) : const Color(0xFFFFFFFF),
          surfaceVariant: isDark ? const Color(0xFF2D333B) : const Color(0xFFEEF1F5),
          onSurface: isDark ? const Color(0xFFE6EDF3) : const Color(0xFF172B4D),
          onSurfaceVariant: isDark ? const Color(0xFF8C959F) : const Color(0xFF57606A),
          outline: isDark ? const Color(0xFF424A53) : const Color(0xFFD5DBE4),
        );
    }
  }
}

class _SfPalette {
  const _SfPalette({
    required this.primary,
    required this.secondary,
    required this.accent,
    required this.background,
    required this.surface,
    required this.surfaceVariant,
    required this.onSurface,
    required this.onSurfaceVariant,
    required this.outline,
  });

  final Color primary;
  final Color secondary;
  final Color accent;
  final Color background;
  final Color surface;
  final Color surfaceVariant;
  final Color onSurface;
  final Color onSurfaceVariant;
  final Color outline;

  Color get onPrimary => Colors.white;
  Color get onSecondary => Colors.white;
  Color get onAccent => Colors.white;
  Color get onBackground => onSurface;
}

class _SfNoMotionPageTransitionsBuilder extends PageTransitionsBuilder {
  const _SfNoMotionPageTransitionsBuilder();

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    return child;
  }
}
