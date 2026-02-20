import 'dart:math' as math;

import 'package:flutter/material.dart';

class SocialAuthButton extends StatefulWidget {
  const SocialAuthButton({
    super.key,
    required this.provider,
    required this.label,
    required this.onPressed,
  });

  final SocialProvider provider;
  final String label;
  final VoidCallback onPressed;

  @override
  State<SocialAuthButton> createState() => _SocialAuthButtonState();
}

class _SocialAuthButtonState extends State<SocialAuthButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Listener(
      onPointerDown: (_) => setState(() => _pressed = true),
      onPointerUp: (_) => setState(() => _pressed = false),
      onPointerCancel: (_) => setState(() => _pressed = false),
      child: AnimatedScale(
        scale: _pressed ? 0.985 : 1,
        duration: const Duration(milliseconds: 120),
        curve: Curves.easeOut,
        child: OutlinedButton(
          onPressed: widget.onPressed,
          style: OutlinedButton.styleFrom(
            minimumSize: const Size.fromHeight(52),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            side: BorderSide(color: scheme.outline.withValues(alpha: 0.34)),
            backgroundColor: Colors.transparent,
            foregroundColor: scheme.onSurface,
            textStyle: const TextStyle(
              fontWeight: FontWeight.w600,
              fontSize: 14,
              letterSpacing: 0.1,
            ),
          ).copyWith(
            overlayColor: WidgetStatePropertyAll(
              scheme.primary.withValues(alpha: 0.08),
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _ProviderMark(provider: widget.provider, size: 20),
              const SizedBox(width: 10),
              Text(widget.label),
            ],
          ),
        ),
      ),
    );
  }
}

enum SocialProvider { google, apple }

class _ProviderMark extends StatelessWidget {
  const _ProviderMark({required this.provider, required this.size});

  final SocialProvider provider;
  final double size;

  @override
  Widget build(BuildContext context) {
    switch (provider) {
      case SocialProvider.google:
        return SizedBox.square(
          dimension: size,
          child: const CustomPaint(painter: _GoogleMarkPainter()),
        );
      case SocialProvider.apple:
        final color = Theme.of(context).brightness == Brightness.dark
            ? Colors.white
            : Colors.black;
        return Icon(Icons.apple_rounded, size: size + 1, color: color);
    }
  }
}

class _GoogleMarkPainter extends CustomPainter {
  const _GoogleMarkPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final stroke = size.width * 0.18;
    final rect = Rect.fromLTWH(
      stroke * 0.5,
      stroke * 0.5,
      size.width - stroke,
      size.height - stroke,
    );

    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;

    paint.color = const Color(0xFFEA4335);
    canvas.drawArc(rect, _deg(-35), _deg(95), false, paint);

    paint.color = const Color(0xFFFBBC05);
    canvas.drawArc(rect, _deg(60), _deg(95), false, paint);

    paint.color = const Color(0xFF34A853);
    canvas.drawArc(rect, _deg(155), _deg(95), false, paint);

    paint.color = const Color(0xFF4285F4);
    canvas.drawArc(rect, _deg(250), _deg(120), false, paint);

    final barPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round
      ..color = const Color(0xFF4285F4);

    final center = size.center(Offset.zero);
    final barStart = Offset(center.dx + size.width * 0.03, center.dy);
    final barEnd = Offset(size.width - stroke * 0.55, center.dy);
    canvas.drawLine(barStart, barEnd, barPaint);
  }

  double _deg(double value) => value * math.pi / 180.0;

  @override
  bool shouldRepaint(covariant _GoogleMarkPainter oldDelegate) => false;
}
