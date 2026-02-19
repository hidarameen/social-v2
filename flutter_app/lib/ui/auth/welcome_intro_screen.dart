import 'package:flutter/material.dart';

import '../../app_state.dart';
import '../../i18n.dart';
import 'auth_shell.dart';

class WelcomeIntroScreen extends StatelessWidget {
  const WelcomeIntroScreen({
    super.key,
    required this.state,
    required this.onGetStarted,
  });

  final AppState state;
  final VoidCallback onGetStarted;

  @override
  Widget build(BuildContext context) {
    final i18n = I18n(state.locale);

    return AuthShell(
      state: state,
      title: 'Explore the App',
      description: i18n.isArabic
          ? 'اربط المنصات، ابنِ سير العمل، وتابع الأتمتة من واجهة واحدة.'
          : 'Connect platforms, build workflows, and monitor automation from one premium mobile workspace.',
      hero: const _WorkflowHero(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const _IntroPillRow(),
          const SizedBox(height: 18),
          _GradientCtaButton(
            label: i18n.isArabic ? 'ابدأ الآن' : 'Get Started',
            onPressed: onGetStarted,
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: const [
              _Dot(active: true),
              SizedBox(width: 6),
              _Dot(active: false),
              SizedBox(width: 6),
              _Dot(active: false),
            ],
          ),
        ],
      ),
    );
  }
}

class _WorkflowHero extends StatelessWidget {
  const _WorkflowHero();

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      height: 176,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color.alphaBlend(
              scheme.primary.withOpacity(isDark ? 0.26 : 0.12),
              scheme.surface,
            ),
            Color.alphaBlend(
              scheme.secondary.withOpacity(isDark ? 0.20 : 0.10),
              scheme.surface,
            ),
          ],
        ),
        border: Border.all(color: scheme.outline.withOpacity(0.24)),
      ),
      child: CustomPaint(
        size: const Size(280, 150),
        painter: _WorkflowPainter(
          nodeColor: scheme.primary,
          edgeColor: scheme.onSurfaceVariant.withOpacity(isDark ? 0.58 : 0.46),
          accentColor: Color.alphaBlend(
            scheme.secondary.withOpacity(0.38),
            scheme.primary,
          ),
        ),
      ),
    );
  }
}

class _WorkflowPainter extends CustomPainter {
  _WorkflowPainter({
    required this.nodeColor,
    required this.edgeColor,
    required this.accentColor,
  });

  final Color nodeColor;
  final Color edgeColor;
  final Color accentColor;

  @override
  void paint(Canvas canvas, Size size) {
    final line = Paint()
      ..color = edgeColor
      ..strokeWidth = 2.2
      ..style = PaintingStyle.stroke;

    final glow = Paint()
      ..color = nodeColor.withOpacity(0.24)
      ..style = PaintingStyle.fill;

    final mainNode = Paint()
      ..color = nodeColor
      ..style = PaintingStyle.fill;

    final accentNode = Paint()
      ..color = accentColor
      ..style = PaintingStyle.fill;

    final a = Offset(size.width * 0.16, size.height * 0.30);
    final b = Offset(size.width * 0.38, size.height * 0.18);
    final c = Offset(size.width * 0.62, size.height * 0.32);
    final d = Offset(size.width * 0.84, size.height * 0.20);
    final e = Offset(size.width * 0.28, size.height * 0.70);
    final f = Offset(size.width * 0.54, size.height * 0.78);
    final g = Offset(size.width * 0.78, size.height * 0.66);

    final path = Path()
      ..moveTo(a.dx, a.dy)
      ..lineTo(b.dx, b.dy)
      ..lineTo(c.dx, c.dy)
      ..lineTo(d.dx, d.dy)
      ..moveTo(a.dx, a.dy)
      ..lineTo(e.dx, e.dy)
      ..lineTo(f.dx, f.dy)
      ..lineTo(g.dx, g.dy)
      ..moveTo(c.dx, c.dy)
      ..lineTo(f.dx, f.dy)
      ..moveTo(b.dx, b.dy)
      ..lineTo(e.dx, e.dy)
      ..moveTo(d.dx, d.dy)
      ..lineTo(g.dx, g.dy);

    canvas.drawPath(path, line);

    final nodes = <Offset>[a, b, c, d, e, f, g];
    for (int i = 0; i < nodes.length; i++) {
      final node = nodes[i];
      canvas.drawCircle(node, 12, glow);
      canvas.drawCircle(node, 7.5, i.isEven ? mainNode : accentNode);
    }
  }

  @override
  bool shouldRepaint(covariant _WorkflowPainter oldDelegate) {
    return oldDelegate.nodeColor != nodeColor ||
        oldDelegate.edgeColor != edgeColor ||
        oldDelegate.accentColor != accentColor;
  }
}

class _IntroPillRow extends StatelessWidget {
  const _IntroPillRow();

  @override
  Widget build(BuildContext context) {
    return Wrap(
      alignment: WrapAlignment.center,
      spacing: 8,
      runSpacing: 8,
      children: const [
        _Pill(icon: Icons.hub_rounded, label: 'Connected Platforms'),
        _Pill(icon: Icons.schema_rounded, label: 'Smart Workflows'),
        _Pill(icon: Icons.insights_rounded, label: 'Live Insights'),
      ],
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        color: Color.alphaBlend(
          scheme.onSurface.withOpacity(0.02),
          scheme.surface,
        ),
        border: Border.all(color: scheme.outline.withOpacity(0.28)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: scheme.primary),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
              color: scheme.onSurface,
            ),
          ),
        ],
      ),
    );
  }
}

class _Dot extends StatelessWidget {
  const _Dot({required this.active});

  final bool active;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      width: active ? 18 : 8,
      height: 8,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        color: active
            ? scheme.primary
            : scheme.onSurfaceVariant.withOpacity(0.34),
      ),
    );
  }
}

class _GradientCtaButton extends StatelessWidget {
  const _GradientCtaButton({required this.label, required this.onPressed});

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            scheme.primary,
            Color.alphaBlend(
              scheme.secondary.withOpacity(0.32),
              scheme.primary,
            ),
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: scheme.primary.withOpacity(0.30),
            blurRadius: 18,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: FilledButton(
        onPressed: onPressed,
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(56),
          backgroundColor: Colors.transparent,
          shadowColor: Colors.transparent,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(label),
            const SizedBox(width: 8),
            const Icon(Icons.arrow_forward_rounded, size: 18),
          ],
        ),
      ),
    );
  }
}
