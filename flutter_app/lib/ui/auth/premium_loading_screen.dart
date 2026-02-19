import 'package:flutter/material.dart';

class PremiumLoadingScreen extends StatefulWidget {
  const PremiumLoadingScreen({
    super.key,
    required this.title,
    required this.subtitle,
  });

  final String title;
  final String subtitle;

  @override
  State<PremiumLoadingScreen> createState() => _PremiumLoadingScreenState();
}

class _PremiumLoadingScreenState extends State<PremiumLoadingScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      body: Stack(
        children: [
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Color.alphaBlend(
                      scheme.primary.withOpacity(isDark ? 0.24 : 0.12),
                      isDark
                          ? const Color(0xFF0C1220)
                          : const Color(0xFFF7FAFF),
                    ),
                    Color.alphaBlend(
                      scheme.secondary.withOpacity(isDark ? 0.16 : 0.08),
                      isDark
                          ? const Color(0xFF0E1A31)
                          : const Color(0xFFF4F9FF),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  AnimatedBuilder(
                    animation: _pulseController,
                    builder: (context, _) {
                      final t = _pulseController.value;
                      final scale = 0.96 + (t * 0.08);
                      return Transform.scale(
                        scale: scale,
                        child: Container(
                          width: 96,
                          height: 96,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: [
                                Color.alphaBlend(
                                  scheme.primary.withOpacity(
                                    isDark ? 0.70 : 0.94,
                                  ),
                                  scheme.secondary,
                                ),
                                Color.alphaBlend(
                                  scheme.tertiary.withOpacity(
                                    isDark ? 0.26 : 0.14,
                                  ),
                                  scheme.primary,
                                ),
                              ],
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: scheme.primary.withOpacity(
                                  isDark ? 0.42 : 0.24,
                                ),
                                blurRadius: 26,
                                offset: const Offset(0, 10),
                              ),
                            ],
                          ),
                          child: Icon(
                            Icons.hub_rounded,
                            size: 44,
                            color: scheme.onPrimary,
                          ),
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 20),
                  Text(
                    widget.title,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                      color: scheme.onSurface,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    widget.subtitle,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 14,
                      height: 1.4,
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: 200,
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(999),
                      child: LinearProgressIndicator(
                        minHeight: 7,
                        color: scheme.primary,
                        backgroundColor: scheme.onSurface.withOpacity(0.12),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
