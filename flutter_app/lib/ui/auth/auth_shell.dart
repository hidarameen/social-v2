import 'package:flutter/material.dart';

import '../../app_state.dart';
import '../../i18n.dart';

class AuthShell extends StatelessWidget {
  const AuthShell({
    super.key,
    required this.state,
    required this.title,
    required this.description,
    required this.child,
  });

  final AppState state;
  final String title;
  final String description;
  final Widget child;

  static const _primary = Color(0xFF6366F1);
  static const _accent = Color(0xFF06B6D4);

  @override
  Widget build(BuildContext context) {
    final i18n = I18n(state.locale);
    final isDark = state.themeMode == AppThemeMode.dark;

    final bg = BoxDecoration(
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: isDark
            ? const [
                Color(0xFF070B14),
                Color(0xFF0A1224),
                Color(0xFF121D39),
              ]
            : const [
                Color(0xFFF5F7FF),
                Color(0xFFF1F7FF),
                Color(0xFFFFFFFF),
              ],
      ),
    );

    final overlay = BoxDecoration(
      gradient: RadialGradient(
        center: const Alignment(0.7, -0.85),
        radius: 1.1,
        colors: [
          (isDark ? _primary : _accent).withOpacity(isDark ? 0.20 : 0.14),
          Colors.transparent,
        ],
      ),
    );

    return Directionality(
      textDirection: state.dir,
      child: Scaffold(
        body: Stack(
          children: [
            Positioned.fill(child: Container(decoration: bg)),
            Positioned.fill(child: Container(decoration: overlay)),
            Positioned(
              top: -70,
              right: -50,
              child: _GlowOrb(color: _primary.withOpacity(isDark ? 0.33 : 0.20), size: 210),
            ),
            Positioned(
              bottom: -90,
              left: -60,
              child: _GlowOrb(color: _accent.withOpacity(isDark ? 0.28 : 0.20), size: 240),
            ),
            PositionedDirectional(
              top: 24,
              end: 18,
              child: _TopControls(state: state, i18n: i18n),
            ),
            SafeArea(
              child: Align(
                alignment: Alignment.center,
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
                  keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 1024),
                    child: LayoutBuilder(
                      builder: (context, constraints) {
                        final wide = constraints.maxWidth >= 980;
                        return Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (wide) ...[
                              Expanded(
                                child: _IdentityPanel(i18n: i18n, isDark: isDark),
                              ),
                              const SizedBox(width: 18),
                            ],
                            Expanded(
                              child: _AuthCard(
                                title: title,
                                description: description,
                                child: child,
                                isDark: isDark,
                              ),
                            ),
                          ],
                        );
                      },
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TopControls extends StatelessWidget {
  const _TopControls({required this.state, required this.i18n});

  final AppState state;
  final I18n i18n;

  @override
  Widget build(BuildContext context) {
    final isDark = state.themeMode == AppThemeMode.dark;
    return Material(
      color: (isDark ? const Color(0xFF0F162A) : Colors.white).withOpacity(0.66),
      elevation: 14,
      borderRadius: BorderRadius.circular(999),
      child: Padding(
        padding: const EdgeInsets.all(6),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconButton(
              tooltip: state.locale == 'ar' ? 'EN' : 'AR',
              onPressed: () => state.toggleLocale(),
              icon: const Icon(Icons.language_rounded, size: 18),
              constraints: const BoxConstraints.tightFor(width: 38, height: 38),
            ),
            const SizedBox(width: 6),
            IconButton(
              tooltip: isDark ? 'Light mode' : 'Dark mode',
              onPressed: () => state.toggleThemeMode(),
              icon: Icon(isDark ? Icons.light_mode_rounded : Icons.dark_mode_rounded, size: 18),
              constraints: const BoxConstraints.tightFor(width: 38, height: 38),
              style: IconButton.styleFrom(
                backgroundColor: isDark ? const Color(0xFFE9EEF9) : const Color(0xFF0D1422),
                foregroundColor: isDark ? const Color(0xFF0D1422) : const Color(0xFFE9EEF9),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _IdentityPanel extends StatelessWidget {
  const _IdentityPanel({required this.i18n, required this.isDark});

  final I18n i18n;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    final panelBg = (isDark ? const Color(0xFF0F162A) : Colors.white).withOpacity(0.66);
    final border = (isDark ? Colors.white : Colors.black).withOpacity(0.10);
    final fg = isDark ? const Color(0xFFE9EEF9) : const Color(0xFF0D1422);
    final muted = fg.withOpacity(0.68);

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            panelBg,
            (isDark ? const Color(0xFF111C34) : const Color(0xFFF4F8FF)).withOpacity(0.55),
          ],
        ),
        borderRadius: BorderRadius.circular(26),
        border: Border.all(color: border),
        boxShadow: const [
          BoxShadow(
            blurRadius: 40,
            spreadRadius: 2,
            offset: Offset(0, 14),
            color: Color(0x33000000),
          ),
        ],
      ),
      padding: const EdgeInsets.all(22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.asset(
                  'assets/icon-192.png',
                  width: 36,
                  height: 36,
                  fit: BoxFit.cover,
                ),
              ),
              const SizedBox(width: 10),
              Text(
                'SocialFlow Orbit',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: fg),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _TrendChip(label: i18n.isArabic ? 'تصميم حديث 2026' : 'Modern 2026 UI', icon: Icons.tips_and_updates_rounded, fg: fg),
              _TrendChip(label: i18n.isArabic ? 'سهولة الاستخدام' : 'High usability', icon: Icons.touch_app_rounded, fg: fg),
              _TrendChip(label: i18n.isArabic ? 'وصول أسرع' : 'Faster access', icon: Icons.rocket_launch_rounded, fg: fg),
            ],
          ),
          const SizedBox(height: 16),
          Container(
            decoration: BoxDecoration(
              color: fg.withOpacity(0.08),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: fg.withOpacity(0.10)),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.auto_awesome_rounded, size: 14, color: fg),
                const SizedBox(width: 8),
                Text(
                  i18n.t('auth.identity', 'SocialFlow Identity'),
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: fg),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Text(
            i18n.t('auth.secureAccessTitle', 'Secure access to your automation workspace'),
            style: TextStyle(fontSize: 32, height: 1.12, fontWeight: FontWeight.w700, color: fg),
          ),
          const SizedBox(height: 14),
          Text(
            i18n.t(
              'auth.secureAccessDescription',
              'Built for operators managing high-volume cross-platform workflows with enterprise-grade account protection.',
            ),
            style: TextStyle(fontSize: 13, height: 1.5, color: muted),
          ),
          const SizedBox(height: 18),
          _FeatureCard(
            title: i18n.t('auth.verificationTitle', 'Verification First'),
            body: i18n.t('auth.verificationDescription', 'Email verification protects account ownership from day one.'),
            icon: Icons.verified_user_rounded,
            fg: fg,
            isDark: isDark,
          ),
          const SizedBox(height: 10),
          _FeatureCard(
            title: i18n.t('auth.sessionTitle', 'Fast Session Access'),
            body: i18n.t('auth.sessionDescription', 'Smart sign-in experience with callback routing and quick recovery flows.'),
            icon: Icons.flash_on_rounded,
            fg: fg,
            isDark: isDark,
          ),
          const SizedBox(height: 10),
          _FeatureCard(
            title: i18n.t('auth.uxTitle', 'Role-ready UX'),
            body: i18n.t('auth.uxDescription', 'Optimized for validation clarity and accessibility.'),
            icon: Icons.badge_rounded,
            fg: fg,
            isDark: isDark,
          ),
        ],
      ),
    );
  }
}

class _FeatureCard extends StatelessWidget {
  const _FeatureCard({
    required this.title,
    required this.body,
    required this.icon,
    required this.fg,
    required this.isDark,
  });

  final String title;
  final String body;
  final IconData icon;
  final Color fg;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    final bg = (isDark ? const Color(0xFF0B1020) : Colors.white).withOpacity(0.60);
    final border = fg.withOpacity(0.10);
    return Container(
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: border),
      ),
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: fg),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: fg),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            body,
            style: TextStyle(fontSize: 12, height: 1.35, color: fg.withOpacity(0.7)),
          ),
        ],
      ),
    );
  }
}

class _AuthCard extends StatelessWidget {
  const _AuthCard({
    required this.title,
    required this.description,
    required this.child,
    required this.isDark,
  });

  final String title;
  final String description;
  final Widget child;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    final bg = (isDark ? const Color(0xFF0F162A) : Colors.white).withOpacity(0.74);
    final border = (isDark ? Colors.white : Colors.black).withOpacity(0.10);
    final fg = isDark ? const Color(0xFFE9EEF9) : const Color(0xFF0D1422);
    final muted = fg.withOpacity(0.68);

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            bg,
            (isDark ? const Color(0xFF141F3A) : const Color(0xFFF8FBFF)).withOpacity(0.78),
          ],
        ),
        borderRadius: BorderRadius.circular(26),
        border: Border.all(color: border),
        boxShadow: const [
          BoxShadow(
            blurRadius: 48,
            spreadRadius: 4,
            offset: Offset(0, 20),
            color: Color(0x33000000),
          ),
        ],
      ),
      padding: const EdgeInsets.all(18),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(18),
            child: Image.asset(
              'assets/icon-192.png',
              width: 92,
              height: 92,
              fit: BoxFit.cover,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            title,
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: fg),
          ),
          const SizedBox(height: 8),
          Text(
            description,
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, height: 1.35, color: muted),
          ),
          const SizedBox(height: 16),
          child,
        ],
      ),
    );
  }
}

class _TrendChip extends StatelessWidget {
  const _TrendChip({required this.label, required this.icon, required this.fg});

  final String label;
  final IconData icon;
  final Color fg;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: fg.withOpacity(0.08),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: fg.withOpacity(0.10)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: fg),
          const SizedBox(width: 6),
          Text(label, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: fg)),
        ],
      ),
    );
  }
}

class _GlowOrb extends StatelessWidget {
  const _GlowOrb({required this.color, required this.size});

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
            BoxShadow(color: color, blurRadius: size * 0.42, spreadRadius: size * 0.05),
          ],
        ),
      ),
    );
  }
}
