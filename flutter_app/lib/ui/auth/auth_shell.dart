import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';

import '../../app_state.dart';

class AuthShell extends StatelessWidget {
  const AuthShell({
    super.key,
    required this.state,
    required this.title,
    required this.description,
    required this.child,
    this.hero,
    this.heroIcon = Icons.hub_rounded,
    this.footer,
  });

  final AppState state;
  final String title;
  final String description;
  final Widget child;
  final Widget? hero;
  final IconData heroIcon;
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final isDark = state.themeMode == AppThemeMode.dark;

    final backgroundGradient = LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [
        Color.alphaBlend(
          scheme.primary.withValues(alpha: isDark ? 0.24 : 0.12),
          isDark ? const Color(0xFF0D1424) : const Color(0xFFF7FAFF),
        ),
        Color.alphaBlend(
          scheme.secondary.withValues(alpha: isDark ? 0.18 : 0.10),
          isDark ? const Color(0xFF0E192E) : const Color(0xFFFAFCFF),
        ),
        Color.alphaBlend(
          scheme.tertiary.withValues(alpha: isDark ? 0.14 : 0.08),
          isDark ? const Color(0xFF101B34) : const Color(0xFFF4F9FF),
        ),
      ],
    );

    return Directionality(
      textDirection: state.dir,
      child: Scaffold(
        body: Stack(
          children: [
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(gradient: backgroundGradient),
              ),
            ),
            Positioned(
              top: -72,
              right: -52,
              child: _BlurOrb(
                color: scheme.primary.withValues(alpha: isDark ? 0.34 : 0.20),
                size: 210,
              ),
            ),
            Positioned(
              bottom: -90,
              left: -60,
              child: _BlurOrb(
                color: scheme.secondary.withValues(alpha: isDark ? 0.30 : 0.18),
                size: 240,
              ),
            ),
            SafeArea(
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(24, 12, 24, 4),
                    child: Row(
                      children: [
                        Expanded(child: _BrandBadge(isDark: isDark)),
                        _TopControls(state: state),
                      ],
                    ),
                  ),
                  Expanded(
                    child: SingleChildScrollView(
                      keyboardDismissBehavior:
                          ScrollViewKeyboardDismissBehavior.onDrag,
                      padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
                      child: Center(
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 430),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(28),
                            child: BackdropFilter(
                              filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
                              child: Container(
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                    colors: [
                                      Color.alphaBlend(
                                        scheme.onSurface.withValues(
                                          alpha: isDark ? 0.09 : 0.04,
                                        ),
                                        scheme.surface,
                                      ).withValues(alpha: isDark ? 0.94 : 0.96),
                                      Color.alphaBlend(
                                        scheme.primary.withValues(
                                          alpha: isDark ? 0.17 : 0.08,
                                        ),
                                        scheme.surface,
                                      ).withValues(alpha: isDark ? 0.92 : 0.95),
                                    ],
                                  ),
                                  borderRadius: BorderRadius.circular(28),
                                  border: Border.all(
                                    color: scheme.outline.withValues(
                                      alpha: isDark ? 0.46 : 0.36,
                                    ),
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withValues(
                                        alpha: isDark ? 0.30 : 0.08,
                                      ),
                                      blurRadius: 26,
                                      offset: const Offset(0, 14),
                                    ),
                                    BoxShadow(
                                      color: scheme.primary.withValues(
                                        alpha: isDark ? 0.20 : 0.12,
                                      ),
                                      blurRadius: 32,
                                      offset: const Offset(0, 8),
                                    ),
                                  ],
                                ),
                                padding: const EdgeInsets.fromLTRB(
                                  20,
                                  22,
                                  20,
                                  20,
                                ),
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                    hero ?? _HeroIcon(icon: heroIcon),
                                    const SizedBox(height: 16),
                                    Text(
                                      title,
                                      textAlign: TextAlign.center,
                                      style: TextStyle(
                                        fontSize: 32,
                                        height: 1.08,
                                        fontWeight: FontWeight.w800,
                                        color: scheme.onSurface,
                                      ),
                                    ),
                                    const SizedBox(height: 10),
                                    Text(
                                      description,
                                      textAlign: TextAlign.center,
                                      style: TextStyle(
                                        fontSize: 14,
                                        height: 1.45,
                                        color: scheme.onSurfaceVariant,
                                      ),
                                    ),
                                    const SizedBox(height: 20),
                                    child,
                                    if (footer != null) ...[
                                      const SizedBox(height: 16),
                                      footer!,
                                    ],
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TopControls extends StatelessWidget {
  const _TopControls({required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final isDark = state.themeMode == AppThemeMode.dark;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton(
          tooltip: state.locale == 'ar' ? 'EN' : 'AR',
          onPressed: state.toggleLocale,
          icon: const Icon(Icons.language_rounded, size: 19),
          style: IconButton.styleFrom(
            foregroundColor: scheme.onSurfaceVariant,
            backgroundColor: Colors.transparent,
          ),
          constraints: const BoxConstraints.tightFor(width: 38, height: 38),
        ),
        const SizedBox(width: 6),
        IconButton(
          tooltip: isDark ? 'Light mode' : 'Dark mode',
          onPressed: state.toggleThemeMode,
          icon: AnimatedSwitcher(
            duration: const Duration(milliseconds: 170),
            transitionBuilder: (child, animation) => FadeTransition(
              opacity: animation,
              child: ScaleTransition(scale: animation, child: child),
            ),
            child: Icon(
              isDark ? Icons.light_mode_rounded : Icons.dark_mode_rounded,
              key: ValueKey<bool>(isDark),
              size: 19,
            ),
          ),
          style: IconButton.styleFrom(
            foregroundColor: isDark ? scheme.secondary : scheme.primary,
            backgroundColor: Colors.transparent,
          ),
          constraints: const BoxConstraints.tightFor(width: 38, height: 38),
        ),
      ],
    );
  }
}

class _BrandBadge extends StatelessWidget {
  const _BrandBadge({required this.isDark});

  final bool isDark;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Color.alphaBlend(
          scheme.onSurface.withValues(alpha: isDark ? 0.08 : 0.05),
          scheme.surface,
        ).withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: scheme.outline.withValues(alpha: 0.24)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  scheme.primary,
                  Color.alphaBlend(
                    scheme.secondary.withValues(alpha: 0.40),
                    scheme.primary,
                  ),
                ],
              ),
            ),
            child: Icon(Icons.hub_rounded, size: 16, color: scheme.onPrimary),
          ),
          const SizedBox(width: 8),
          Text(
            'SocialFlow',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: scheme.onSurface,
            ),
          ),
        ],
      ),
    );
  }
}

class _HeroIcon extends StatelessWidget {
  const _HeroIcon({required this.icon});

  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Center(
      child: TweenAnimationBuilder<double>(
        tween: Tween<double>(begin: 0.98, end: 1.02),
        duration: const Duration(milliseconds: 1800),
        curve: Curves.easeInOut,
        builder: (context, scale, child) {
          return Transform.scale(scale: scale, child: child);
        },
        child: Container(
          width: 88,
          height: 88,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Color.alphaBlend(
                  scheme.primary.withValues(alpha: isDark ? 0.60 : 0.92),
                  scheme.secondary,
                ),
                Color.alphaBlend(
                  scheme.tertiary.withValues(alpha: isDark ? 0.30 : 0.18),
                  scheme.primary,
                ),
              ],
            ),
            boxShadow: [
              BoxShadow(
                color: scheme.primary.withValues(alpha: isDark ? 0.38 : 0.26),
                blurRadius: 24,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Icon(icon, color: scheme.onPrimary, size: 38),
        ),
      ),
    );
  }
}

class _BlurOrb extends StatelessWidget {
  const _BlurOrb({required this.color, required this.size});

  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: color,
              blurRadius: size * 0.44,
              spreadRadius: size * 0.05,
            ),
          ],
        ),
      ),
    );
  }
}
