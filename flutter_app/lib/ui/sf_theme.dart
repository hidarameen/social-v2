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
      _build(lightScheme(preset),
          isDark: false, density: density, reducedMotion: reducedMotion);

  static ThemeData dark({
    String preset = 'orbit',
    String density = 'comfortable',
    bool reducedMotion = false,
  }) =>
      _build(darkScheme(preset),
          isDark: true, density: density, reducedMotion: reducedMotion);

  static ColorScheme lightScheme(String preset) {
    final p = _paletteFor(preset, isDark: false);
    final base = ColorScheme.fromSeed(
        seedColor: p.primary, brightness: Brightness.light);
    return base.copyWith(
      primary: p.primary,
      onPrimary: p.onPrimary,
      secondary: p.secondary,
      onSecondary: p.onSecondary,
      tertiary: p.accent,
      onTertiary: p.onAccent,
      error: const Color(0xFFFF5656),
      onError: Colors.white,
      surface: p.surface,
      onSurface: p.onSurface,
      surfaceContainerHighest: p.surfaceVariant,
      onSurfaceVariant: p.onSurfaceVariant,
      outline: p.outline,
      outlineVariant: p.outline,
    );
  }

  static ColorScheme darkScheme(String preset) {
    final p = _paletteFor(preset, isDark: true);
    final base =
        ColorScheme.fromSeed(seedColor: p.primary, brightness: Brightness.dark);
    return base.copyWith(
      primary: p.primary,
      onPrimary: p.onPrimary,
      secondary: p.secondary,
      onSecondary: p.onSecondary,
      tertiary: p.accent,
      onTertiary: p.onAccent,
      error: const Color(0xFFFF5656),
      onError: Colors.white,
      surface: p.surface,
      onSurface: p.onSurface,
      surfaceContainerHighest: p.surfaceVariant,
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
      textTheme: _textTheme(scheme, isDark: isDark),
      visualDensity:
          density == 'compact' ? VisualDensity.compact : VisualDensity.standard,
      pageTransitionsTheme: PageTransitionsTheme(
        builders: <TargetPlatform, PageTransitionsBuilder>{
          for (final platform in TargetPlatform.values)
            platform: reducedMotion
                ? const _SfNoMotionPageTransitionsBuilder()
                : const _SfElevatedFadePageTransitionsBuilder(),
        },
      ),
    );

    final radius = BorderRadius.circular(22);
    final fieldRadius = BorderRadius.circular(16);
    final bgColor = isDark
        ? Color.alphaBlend(
            scheme.primary.withAlpha(16), const Color(0xFF0E1320))
        : Color.alphaBlend(
            scheme.primary.withAlpha(8), const Color(0xFFF5F7FC));
    final canvasColor = isDark
        ? Color.alphaBlend(
            scheme.secondary.withAlpha(14), const Color(0xFF0A101B))
        : Color.alphaBlend(
            scheme.secondary.withAlpha(8), const Color(0xFFF1F5FB));

    return base.copyWith(
      scaffoldBackgroundColor: bgColor,
      canvasColor: canvasColor,
      appBarTheme: AppBarTheme(
        centerTitle: false,
        elevation: 0,
        backgroundColor: Colors.transparent,
        foregroundColor: scheme.onSurface,
        surfaceTintColor: Colors.transparent,
        toolbarHeight: 62,
        titleTextStyle: TextStyle(
          fontFamily: 'Tajawal',
          fontSize: 21,
          fontWeight: FontWeight.w800,
          color: scheme.onSurface,
        ),
      ),
      dividerTheme: DividerThemeData(
        thickness: 1,
        color: (isDark ? const Color(0xFFE5E8F1) : const Color(0xFFDDE3EF))
            .withAlpha(isDark ? 30 : 176),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: isDark
            ? Color.alphaBlend(
                scheme.primary.withAlpha(9),
                scheme.surface,
              )
            : const Color(0xFFFFFFFF),
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: radius,
          side: BorderSide(
            color: scheme.outline.withAlpha(isDark ? 94 : 112),
          ),
        ),
        margin: EdgeInsets.zero,
      ),
      listTileTheme: ListTileThemeData(
        iconColor: scheme.onSurfaceVariant,
        textColor: scheme.onSurface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: isDark
            ? scheme.surfaceContainerHighest.withAlpha(158)
            : const Color(0xFFFFFFFF),
        border: OutlineInputBorder(borderRadius: fieldRadius),
        enabledBorder: OutlineInputBorder(
          borderRadius: fieldRadius,
          borderSide: BorderSide(
            color: scheme.outlineVariant.withAlpha(isDark ? 116 : 204),
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: fieldRadius,
          borderSide: BorderSide(color: scheme.primary, width: 1.6),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      chipTheme: base.chipTheme.copyWith(
        backgroundColor: scheme.surface.withAlpha(isDark ? 192 : 255),
        selectedColor: scheme.primary.withAlpha(isDark ? 62 : 32),
        side: BorderSide(color: scheme.outline.withAlpha(isDark ? 90 : 112)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        labelStyle:
            TextStyle(fontWeight: FontWeight.w600, color: scheme.onSurface),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: ButtonStyle(
          padding: const WidgetStatePropertyAll(
            EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          ),
          foregroundColor: const WidgetStatePropertyAll(Colors.white),
          backgroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.disabled)) {
              return scheme.primary.withAlpha(isDark ? 102 : 120);
            }
            if (states.contains(WidgetState.pressed)) {
              return Color.alphaBlend(
                Colors.black.withAlpha(isDark ? 18 : 12),
                scheme.primary,
              );
            }
            if (states.contains(WidgetState.hovered)) {
              return Color.alphaBlend(
                Colors.white.withAlpha(isDark ? 8 : 14),
                scheme.primary,
              );
            }
            return scheme.primary;
          }),
          elevation: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.disabled)) return 0;
            if (states.contains(WidgetState.pressed)) return 0;
            if (states.contains(WidgetState.hovered)) return 2;
            return 1;
          }),
          overlayColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.pressed)) {
              return Colors.white.withAlpha(isDark ? 24 : 30);
            }
            if (states.contains(WidgetState.hovered)) {
              return Colors.white.withAlpha(isDark ? 14 : 18);
            }
            return null;
          }),
          shape: WidgetStatePropertyAll(
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          ),
          textStyle: const WidgetStatePropertyAll(
              TextStyle(fontWeight: FontWeight.w700)),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: ButtonStyle(
          padding: const WidgetStatePropertyAll(
            EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          ),
          side: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.pressed)) {
              return BorderSide(
                  color: scheme.primary.withAlpha(isDark ? 180 : 160));
            }
            if (states.contains(WidgetState.hovered)) {
              return BorderSide(
                  color: scheme.primary.withAlpha(isDark ? 160 : 140));
            }
            return BorderSide(
                color: scheme.outline.withAlpha(isDark ? 97 : 158));
          }),
          foregroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.disabled)) {
              return scheme.onSurfaceVariant.withAlpha(isDark ? 110 : 120);
            }
            return scheme.onSurface;
          }),
          backgroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.pressed)) {
              return scheme.primary.withAlpha(isDark ? 38 : 24);
            }
            if (states.contains(WidgetState.hovered)) {
              return scheme.primary.withAlpha(isDark ? 28 : 16);
            }
            return Colors.transparent;
          }),
          overlayColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.pressed)) {
              return scheme.primary.withAlpha(isDark ? 42 : 28);
            }
            if (states.contains(WidgetState.hovered)) {
              return scheme.primary.withAlpha(isDark ? 26 : 18);
            }
            return null;
          }),
          shape: WidgetStatePropertyAll(
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          ),
          textStyle: const WidgetStatePropertyAll(
              TextStyle(fontWeight: FontWeight.w700)),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: ButtonStyle(
          padding: const WidgetStatePropertyAll(
            EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          ),
          foregroundColor: WidgetStatePropertyAll(scheme.primary),
          overlayColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.pressed)) {
              return scheme.primary.withAlpha(isDark ? 36 : 28);
            }
            if (states.contains(WidgetState.hovered)) {
              return scheme.primary.withAlpha(isDark ? 24 : 16);
            }
            return null;
          }),
          shape: WidgetStatePropertyAll(
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
          textStyle: const WidgetStatePropertyAll(
              TextStyle(fontWeight: FontWeight.w700)),
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: ButtonStyle(
          padding: const WidgetStatePropertyAll(EdgeInsets.all(10)),
          iconSize: const WidgetStatePropertyAll(20),
          foregroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.disabled)) {
              return scheme.onSurfaceVariant.withAlpha(isDark ? 95 : 120);
            }
            if (states.contains(WidgetState.pressed) ||
                states.contains(WidgetState.hovered)) {
              return scheme.primary;
            }
            return scheme.onSurfaceVariant;
          }),
          backgroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.pressed)) {
              return scheme.primary.withAlpha(isDark ? 44 : 28);
            }
            if (states.contains(WidgetState.hovered)) {
              return scheme.primary.withAlpha(isDark ? 30 : 18);
            }
            return Colors.transparent;
          }),
          overlayColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.pressed)) {
              return scheme.primary.withAlpha(isDark ? 50 : 36);
            }
            if (states.contains(WidgetState.hovered)) {
              return scheme.primary.withAlpha(isDark ? 32 : 20);
            }
            return null;
          }),
          shape: WidgetStatePropertyAll(
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
      ),
      switchTheme: SwitchThemeData(
        trackColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected))
            return const Color(0xFF4CD964);
          return scheme.outline.withAlpha(isDark ? 116 : 140);
        }),
        thumbColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return Colors.white;
          return Colors.white;
        }),
      ),
      navigationRailTheme: NavigationRailThemeData(
        backgroundColor: scheme.surface.withAlpha(isDark ? 179 : 235),
        indicatorColor: scheme.primary.withAlpha(isDark ? 67 : 36),
        selectedIconTheme: IconThemeData(color: scheme.primary),
        selectedLabelTextStyle:
            TextStyle(fontWeight: FontWeight.w700, color: scheme.primary),
        unselectedIconTheme: IconThemeData(color: scheme.onSurfaceVariant),
        unselectedLabelTextStyle: TextStyle(
            color: scheme.onSurfaceVariant, fontWeight: FontWeight.w500),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: scheme.surface.withAlpha(isDark ? 184 : 242),
        indicatorColor: scheme.primary.withAlpha(isDark ? 67 : 34),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return TextStyle(
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            color: selected ? scheme.primary : scheme.onSurfaceVariant,
          );
        }),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: isDark
            ? Color.alphaBlend(scheme.primary.withAlpha(11), scheme.surface)
            : const Color(0xFFFFFFFF),
        surfaceTintColor: Colors.transparent,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor:
            isDark ? const Color(0xFF0F1826) : const Color(0xFF0B1220),
        contentTextStyle:
            const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
    );
  }

  static TextTheme _textTheme(ColorScheme scheme, {required bool isDark}) {
    final base =
        ThemeData(brightness: isDark ? Brightness.dark : Brightness.light)
            .textTheme;
    final bodyColor = scheme.onSurface;
    final mutedColor = scheme.onSurfaceVariant;
    return base.copyWith(
      headlineLarge: TextStyle(
          fontSize: 32,
          fontWeight: FontWeight.w700,
          color: bodyColor,
          height: 1.1),
      headlineMedium: TextStyle(
          fontSize: 28,
          fontWeight: FontWeight.w700,
          color: bodyColor,
          height: 1.12),
      titleLarge: TextStyle(
          fontSize: 20, fontWeight: FontWeight.w700, color: bodyColor),
      titleMedium: TextStyle(
          fontSize: 16, fontWeight: FontWeight.w500, color: bodyColor),
      bodyLarge: TextStyle(
          fontSize: 16, fontWeight: FontWeight.w500, color: mutedColor),
      bodyMedium: TextStyle(
          fontSize: 14, fontWeight: FontWeight.w500, color: mutedColor),
      bodySmall: TextStyle(
          fontSize: 12, fontWeight: FontWeight.w500, color: mutedColor),
      labelLarge: TextStyle(
          fontSize: 14, fontWeight: FontWeight.w600, color: bodyColor),
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
          background:
              isDark ? const Color(0xFF1B1F25) : const Color(0xFFF6F7FA),
          surface: isDark ? const Color(0xFF262B33) : const Color(0xFFFFFFFF),
          surfaceVariant:
              isDark ? const Color(0xFF20242C) : const Color(0xFFEFF2F6),
          onSurface: isDark ? const Color(0xFFE6EDF3) : const Color(0xFF172B4D),
          onSurfaceVariant:
              isDark ? const Color(0xFFB7C0D0) : const Color(0xFF57606A),
          outline: isDark ? const Color(0xFF3A414C) : const Color(0xFFD5DBE4),
        );
      case 'sunrise':
        return _SfPalette(
          primary: const Color(0xFFE57A39),
          secondary: const Color(0xFFEDB84C),
          accent: const Color(0xFF46B8A8),
          background:
              isDark ? const Color(0xFF201914) : const Color(0xFFFFF7F0),
          surface: isDark ? const Color(0xFF2A201A) : const Color(0xFFFFFFFF),
          surfaceVariant:
              isDark ? const Color(0xFF2F251F) : const Color(0xFFFFEBDD),
          onSurface: isDark ? const Color(0xFFFFF4EC) : const Color(0xFF2C2C2C),
          onSurfaceVariant:
              isDark ? const Color(0xFFEAC8B3) : const Color(0xFF6B5B52),
          outline: isDark ? const Color(0xFF4E3B30) : const Color(0xFFE6D7CC),
        );
      case 'nord':
        return _SfPalette(
          primary: const Color(0xFF5E81AC),
          secondary: const Color(0xFF88C0D0),
          accent: const Color(0xFF81A1C1),
          background:
              isDark ? const Color(0xFF2E3440) : const Color(0xFFECEFF4),
          surface: isDark ? const Color(0xFF3B4252) : const Color(0xFFFFFFFF),
          surfaceVariant:
              isDark ? const Color(0xFF343B48) : const Color(0xFFE3E8F1),
          onSurface: isDark ? const Color(0xFFECEFF4) : const Color(0xFF2E3440),
          onSurfaceVariant:
              isDark ? const Color(0xFFC8D2E3) : const Color(0xFF4C566A),
          outline: isDark ? const Color(0xFF4C566A) : const Color(0xFFD5DBE4),
        );
      case 'ocean':
        return _SfPalette(
          primary: const Color(0xFF2F84D4),
          secondary: const Color(0xFFEEF3F8),
          accent: const Color(0xFF3AA8FF),
          background:
              isDark ? const Color(0xFF0E1720) : const Color(0xFFEEF3F8),
          surface: isDark ? const Color(0xFF15222F) : const Color(0xFFF8F8FA),
          surfaceVariant:
              isDark ? const Color(0xFF122030) : const Color(0xFFE7EEF6),
          onSurface: isDark ? const Color(0xFFE7F2FF) : const Color(0xFF172B4D),
          onSurfaceVariant:
              isDark ? const Color(0xFFB7C8DA) : const Color(0xFF4B5A6A),
          outline: isDark ? const Color(0xFF2A3A4B) : const Color(0xFFD5DBE4),
        );
      case 'warmlux':
        return _SfPalette(
          primary: const Color(0xFFE5B73B),
          secondary: const Color(0xFF2C2C2C),
          accent: const Color(0xFFB48A2A),
          background:
              isDark ? const Color(0xFF151311) : const Color(0xFFE9E6DF),
          surface: isDark ? const Color(0xFF1D1A17) : const Color(0xFFFFFFFF),
          surfaceVariant:
              isDark ? const Color(0xFF221E1A) : const Color(0xFFF3F0EA),
          onSurface: isDark ? const Color(0xFFF7F3E8) : const Color(0xFF2C2C2C),
          onSurfaceVariant:
              isDark ? const Color(0xFFD7C7A8) : const Color(0xFF6B6253),
          outline: isDark ? const Color(0xFF3B342A) : const Color(0xFFD5DBE4),
        );
      case 'orbit':
      default:
        return _SfPalette(
          primary: isDark ? const Color(0xFF5B8DFF) : const Color(0xFF2F6BFF),
          secondary: isDark ? const Color(0xFF17A0B5) : const Color(0xFF0E9AB2),
          accent: isDark ? const Color(0xFF22C7A2) : const Color(0xFF0DA781),
          background:
              isDark ? const Color(0xFF111826) : const Color(0xFFF5F7FC),
          surface: isDark ? const Color(0xFF172133) : const Color(0xFFFFFFFF),
          surfaceVariant:
              isDark ? const Color(0xFF212D42) : const Color(0xFFE9EEF8),
          onSurface: isDark ? const Color(0xFFF2F6FF) : const Color(0xFF1B2538),
          onSurfaceVariant:
              isDark ? const Color(0xFFAFBDD7) : const Color(0xFF61708A),
          outline: isDark ? const Color(0xFF34455F) : const Color(0xFFD6DEEB),
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

class _SfElevatedFadePageTransitionsBuilder extends PageTransitionsBuilder {
  const _SfElevatedFadePageTransitionsBuilder();

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    final curved = CurvedAnimation(
      parent: animation,
      curve: Curves.easeOutCubic,
      reverseCurve: Curves.easeInCubic,
    );
    return FadeTransition(
      opacity: curved,
      child: SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(0, 0.03),
          end: Offset.zero,
        ).animate(curved),
        child: child,
      ),
    );
  }
}
