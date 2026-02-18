import 'package:flutter/material.dart';

class SfTokens {
  static const double pagePadding = 14;
  static const double cardPadding = 14;
  static const double sectionGap = 12;
  static const double itemGap = 10;

  static const double radiusLg = 18;
  static const double radiusMd = 14;

  static BorderRadius get radiusLarge => BorderRadius.circular(radiusLg);
  static BorderRadius get radiusMedium => BorderRadius.circular(radiusMd);
}

class SfPage extends StatelessWidget {
  const SfPage({
    super.key,
    required this.child,
    this.maxWidth = 1120,
    this.padding = const EdgeInsets.all(SfTokens.pagePadding),
  });

  final Widget child;
  final double maxWidth;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: Padding(padding: padding, child: child),
      ),
    );
  }
}

class SfAppBackground extends StatelessWidget {
  const SfAppBackground({
    super.key,
    required this.child,
  });

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final isDark = theme.brightness == Brightness.dark;

    final bgStart = isDark ? const Color(0xFF1F232A) : const Color(0xFFFFFFFF);
    final bgEnd = scheme.background;

    final glowA = scheme.primary.withOpacity(isDark ? 0.14 : 0.10);
    final glowB = scheme.secondary.withOpacity(isDark ? 0.10 : 0.08);

    return Stack(
      children: [
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [bgStart, bgEnd],
              ),
            ),
          ),
        ),
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: const Alignment(-0.8, -0.85),
                radius: 1.25,
                colors: [glowA, Colors.transparent],
              ),
            ),
          ),
        ),
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: const Alignment(0.9, -0.2),
                radius: 1.15,
                colors: [glowB, Colors.transparent],
              ),
            ),
          ),
        ),
        Positioned.fill(
          child: IgnorePointer(
            child: CustomPaint(
              painter: _SfDotGridPainter(
                color: scheme.outline.withOpacity(isDark ? 0.12 : 0.10),
              ),
            ),
          ),
        ),
        child,
      ],
    );
  }
}

class _SfDotGridPainter extends CustomPainter {
  _SfDotGridPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    const double step = 28;
    const double r = 0.9;

    for (double y = 0; y <= size.height; y += step) {
      for (double x = 0; x <= size.width; x += step) {
        canvas.drawCircle(Offset(x, y), r, paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant _SfDotGridPainter oldDelegate) {
    return oldDelegate.color != color;
  }
}

class SfSectionHeader extends StatelessWidget {
  const SfSectionHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.trailing,
  });

  final String title;
  final String? subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
              ),
              if (subtitle != null && subtitle!.trim().isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  subtitle!,
                  style: TextStyle(
                    color: scheme.onSurfaceVariant,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ],
          ),
        ),
        if (trailing != null) ...[
          const SizedBox(width: 10),
          trailing!,
        ],
      ],
    );
  }
}

class SfPanelCard extends StatelessWidget {
  const SfPanelCard({
    super.key,
    this.padding = const EdgeInsets.all(SfTokens.cardPadding),
    this.child,
    this.leading,
    this.trailing,
  });

  final EdgeInsets padding;
  final Widget? child;
  final Widget? leading;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final body = Padding(padding: padding, child: child);

    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: SfTokens.radiusLarge,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            scheme.surface.withOpacity(isDark ? 0.82 : 1.0),
            scheme.surfaceContainerHighest.withOpacity(isDark ? 0.46 : 0.40),
          ],
        ),
        boxShadow: [
          BoxShadow(
            blurRadius: isDark ? 22 : 26,
            spreadRadius: -18,
            offset: const Offset(0, 18),
            color: scheme.onSurface.withOpacity(isDark ? 0.22 : 0.14),
          ),
        ],
        border: Border.all(color: scheme.outline.withOpacity(isDark ? 0.70 : 0.75)),
      ),
      child: ClipRRect(
        borderRadius: SfTokens.radiusLarge,
        child: Stack(
          children: [
            body,
            if (leading != null)
              Positioned(
                left: 12,
                top: 12,
                child: leading!,
              ),
            if (trailing != null)
              Positioned(
                right: 12,
                top: 12,
                child: trailing!,
              ),
          ],
        ),
      ),
    );
  }
}

class SfBadge extends StatelessWidget {
  const SfBadge(
    this.text, {
    super.key,
    required this.tone,
    this.icon,
  });

  final String text;
  final Color tone;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: tone.withOpacity(isDark ? 0.22 : 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: tone.withOpacity(isDark ? 0.35 : 0.30)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 14, color: tone),
            const SizedBox(width: 6),
          ],
          Text(
            text,
            style: TextStyle(color: tone, fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }
}

class SfEmptyState extends StatelessWidget {
  const SfEmptyState({
    super.key,
    required this.title,
    required this.subtitle,
    required this.icon,
    this.primary,
    this.secondary,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final Widget? primary;
  final Widget? secondary;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 520),
        child: SfPanelCard(
          padding: const EdgeInsets.all(18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 54,
                height: 54,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: scheme.primary.withOpacity(0.14),
                  border: Border.all(color: scheme.primary.withOpacity(0.28)),
                ),
                child: Icon(icon, color: scheme.primary),
              ),
              const SizedBox(height: 12),
              Text(
                title,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 8),
              Text(
                subtitle,
                textAlign: TextAlign.center,
                style: TextStyle(color: scheme.onSurfaceVariant, fontWeight: FontWeight.w700),
              ),
              if (primary != null || secondary != null) ...[
                const SizedBox(height: 14),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  alignment: WrapAlignment.center,
                  children: [
                    if (secondary != null) secondary!,
                    if (primary != null) primary!,
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class SfKpiTile extends StatelessWidget {
  const SfKpiTile({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    this.tone,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color? tone;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final resolved = tone ?? scheme.primary;
    return SfPanelCard(
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  resolved.withOpacity(0.22),
                  resolved.withOpacity(0.10),
                ],
              ),
              border: Border.all(color: resolved.withOpacity(0.25)),
            ),
            child: Icon(icon, color: resolved),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    color: scheme.onSurfaceVariant,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
