import 'dart:async';

import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../../app_state.dart';
import '../../i18n.dart';
import 'auth_shell.dart';
import 'password_policy.dart';
import 'auth_social.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({
    super.key,
    required this.state,
    required this.api,
    required this.onRegisteredNeedingVerification,
    required this.onGoToLogin,
  });

  final AppState state;
  final ApiClient api;
  final void Function(String email) onRegisteredNeedingVerification;
  final VoidCallback onGoToLogin;

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _name = TextEditingController();
  final TextEditingController _email = TextEditingController();
  final TextEditingController _password = TextEditingController();
  final TextEditingController _confirmPassword = TextEditingController();
  final FocusNode _nameFocus = FocusNode();
  final FocusNode _emailFocus = FocusNode();
  final FocusNode _passwordFocus = FocusNode();
  final FocusNode _confirmFocus = FocusNode();

  bool _agree = false;
  bool _busy = false;
  bool _showPassword = false;
  bool _showConfirm = false;
  bool _entered = false;
  String _error = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      setState(() => _entered = true);
    });
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    _confirmPassword.dispose();
    _nameFocus.dispose();
    _emailFocus.dispose();
    _passwordFocus.dispose();
    _confirmFocus.dispose();
    super.dispose();
  }

  void _showSocialMessage(String provider) {
    final i18n = I18n(widget.state.locale);
    final text = i18n.isArabic
        ? 'تسجيل $provider سيُضاف قريبًا.'
        : '$provider sign in will be added soon.';
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  bool _isValidEmail(String value) {
    final v = value.trim();
    return v.contains('@') && v.contains('.');
  }

  Future<void> _submit() async {
    if (_busy) return;
    setState(() => _error = '');
    if (!_formKey.currentState!.validate()) return;

    final email = _email.text.trim().toLowerCase();
    final password = _password.text;

    setState(() => _busy = true);
    try {
      final res = await widget.api.register(
        name: _name.text.trim(),
        email: email,
        password: password,
      );

      final verificationRequired = res['verificationRequired'] != false;
      if (!verificationRequired) {
        if (!mounted) return;
        widget.onGoToLogin();
        return;
      }

      widget.onRegisteredNeedingVerification(email);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error is ApiException ? error.message : 'Registration failed.';
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final i18n = I18n(widget.state.locale);
    final scheme = Theme.of(context).colorScheme;

    final checks = kPasswordRules
        .map(
          (rule) => _RuleCheck(
            label: i18n.t(rule.testKey, rule.testKey),
            pass: rule.test(_password.text),
          ),
        )
        .toList(growable: false);

    final score = passwordStrengthScore(_password.text);
    final progress = (score / kPasswordRules.length).clamp(0.0, 1.0);
    final strengthLabel = score <= 2
        ? (i18n.isArabic ? 'ضعيف' : 'Weak')
        : score <= 4
            ? (i18n.isArabic ? 'متوسط' : 'Medium')
            : (i18n.isArabic ? 'قوي' : 'Strong');

    return AuthShell(
      state: widget.state,
      heroIcon: Icons.person_add_alt_1_rounded,
      title: i18n.t('auth.registerTitle', 'Create Account'),
      description: i18n.t(
        'auth.registerDesc',
        'Set up your workspace and start automating your flow.',
      ),
      child: AutofillGroup(
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _staggered(
                index: 0,
                child: _FieldFrame(
                  focusNode: _nameFocus,
                  child: TextFormField(
                    key: const Key('register-name-field'),
                    controller: _name,
                    focusNode: _nameFocus,
                    textDirection: widget.state.dir,
                    textInputAction: TextInputAction.next,
                    onFieldSubmitted: (_) => _emailFocus.requestFocus(),
                    onTapOutside: (_) =>
                        FocusManager.instance.primaryFocus?.unfocus(),
                    decoration: InputDecoration(
                      labelText: i18n.t('auth.fullName', 'Full Name'),
                      hintText:
                          i18n.isArabic ? 'اسمك الكامل' : 'Your full name',
                      prefixIcon: const Icon(Icons.badge_outlined),
                      floatingLabelBehavior: FloatingLabelBehavior.auto,
                    ),
                    validator: (value) {
                      final v = (value ?? '').trim();
                      if (v.isEmpty) {
                        return i18n.isArabic
                            ? 'الاسم مطلوب.'
                            : 'Name is required.';
                      }
                      if (v.length < 2) {
                        return i18n.isArabic
                            ? 'الاسم قصير.'
                            : 'Name must be at least 2 characters.';
                      }
                      if (v.length > 80) {
                        return i18n.isArabic
                            ? 'الاسم طويل.'
                            : 'Name must be 80 characters or fewer.';
                      }
                      return null;
                    },
                  ),
                ),
              ),
              const SizedBox(height: 12),
              _staggered(
                index: 1,
                child: _FieldFrame(
                  focusNode: _emailFocus,
                  child: TextFormField(
                    key: const Key('register-email-field'),
                    controller: _email,
                    focusNode: _emailFocus,
                    keyboardType: TextInputType.emailAddress,
                    autofillHints: const [AutofillHints.email],
                    textDirection: TextDirection.ltr,
                    textInputAction: TextInputAction.next,
                    onFieldSubmitted: (_) => _passwordFocus.requestFocus(),
                    onTapOutside: (_) =>
                        FocusManager.instance.primaryFocus?.unfocus(),
                    decoration: InputDecoration(
                      labelText: i18n.t('auth.email', 'Email'),
                      hintText: 'you@example.com',
                      prefixIcon: const Icon(Icons.alternate_email_rounded),
                      floatingLabelBehavior: FloatingLabelBehavior.auto,
                    ),
                    validator: (value) {
                      final v = (value ?? '').trim();
                      if (v.isEmpty) {
                        return i18n.isArabic
                            ? 'البريد مطلوب.'
                            : 'Email is required.';
                      }
                      if (!_isValidEmail(v)) {
                        return i18n.isArabic
                            ? 'أدخل بريدًا صحيحًا.'
                            : 'Enter a valid email address.';
                      }
                      return null;
                    },
                  ),
                ),
              ),
              const SizedBox(height: 12),
              _staggered(
                index: 2,
                child: _FieldFrame(
                  focusNode: _passwordFocus,
                  child: TextFormField(
                    key: const Key('register-password-field'),
                    controller: _password,
                    focusNode: _passwordFocus,
                    obscureText: !_showPassword,
                    autofillHints: const [AutofillHints.newPassword],
                    textDirection: TextDirection.ltr,
                    textInputAction: TextInputAction.next,
                    onFieldSubmitted: (_) => _confirmFocus.requestFocus(),
                    onTapOutside: (_) =>
                        FocusManager.instance.primaryFocus?.unfocus(),
                    decoration: InputDecoration(
                      labelText: i18n.t('auth.password', 'Password'),
                      hintText: i18n.isArabic
                          ? 'كلمة مرور قوية'
                          : 'Create a strong password',
                      prefixIcon: const Icon(Icons.password_rounded),
                      floatingLabelBehavior: FloatingLabelBehavior.auto,
                      suffixIcon: IconButton(
                        onPressed: _busy
                            ? null
                            : () =>
                                setState(() => _showPassword = !_showPassword),
                        icon: Icon(
                          _showPassword
                              ? Icons.visibility_off_rounded
                              : Icons.visibility_rounded,
                        ),
                      ),
                    ),
                    onChanged: (_) => setState(() {}),
                    validator: (value) {
                      final v = value ?? '';
                      if (v.isEmpty) {
                        return i18n.isArabic
                            ? 'كلمة المرور مطلوبة.'
                            : 'Password is required.';
                      }
                      if (!passwordMeetsPolicy(v)) {
                        return i18n.isArabic
                            ? 'كلمة المرور لا تطابق المتطلبات.'
                            : 'Password does not meet all requirements.';
                      }
                      return null;
                    },
                  ),
                ),
              ),
              const SizedBox(height: 10),
              _staggered(
                index: 3,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(999),
                  child: LinearProgressIndicator(
                    value: progress,
                    minHeight: 8,
                    color: Color.alphaBlend(
                      scheme.secondary.withValues(alpha: 0.22),
                      scheme.primary,
                    ),
                    backgroundColor: scheme.onSurface.withValues(alpha: 0.12),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              _staggered(
                index: 4,
                child: Text(
                  '${i18n.t('auth.passwordStrength', 'Password strength')}: $strengthLabel',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: scheme.onSurfaceVariant,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              _staggered(
                index: 5,
                child: Wrap(
                  spacing: 10,
                  runSpacing: 6,
                  children: [
                    for (final c in checks)
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            c.pass
                                ? Icons.check_circle_rounded
                                : Icons.radio_button_unchecked_rounded,
                            size: 14,
                            color: c.pass
                                ? scheme.primary
                                : scheme.onSurfaceVariant
                                    .withValues(alpha: 0.74),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            c.label,
                            style: TextStyle(
                              fontSize: 12,
                              color: c.pass
                                  ? scheme.onSurface
                                  : scheme.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              _staggered(
                index: 6,
                child: _FieldFrame(
                  focusNode: _confirmFocus,
                  child: TextFormField(
                    key: const Key('register-confirm-password-field'),
                    controller: _confirmPassword,
                    focusNode: _confirmFocus,
                    obscureText: !_showConfirm,
                    autofillHints: const [AutofillHints.newPassword],
                    textDirection: TextDirection.ltr,
                    textInputAction: TextInputAction.done,
                    onFieldSubmitted: (_) => _submit(),
                    onTapOutside: (_) =>
                        FocusManager.instance.primaryFocus?.unfocus(),
                    decoration: InputDecoration(
                      labelText: i18n.t(
                        'auth.confirmPassword',
                        'Confirm Password',
                      ),
                      hintText: i18n.isArabic
                          ? 'أعد كتابة كلمة المرور'
                          : 'Re-enter your password',
                      prefixIcon: const Icon(Icons.verified_user_rounded),
                      floatingLabelBehavior: FloatingLabelBehavior.auto,
                      suffixIcon: IconButton(
                        onPressed: _busy
                            ? null
                            : () =>
                                setState(() => _showConfirm = !_showConfirm),
                        icon: Icon(
                          _showConfirm
                              ? Icons.visibility_off_rounded
                              : Icons.visibility_rounded,
                        ),
                      ),
                    ),
                    validator: (value) {
                      final v = value ?? '';
                      if (v.isEmpty) {
                        return i18n.isArabic
                            ? 'أكد كلمة المرور.'
                            : 'Please confirm your password.';
                      }
                      if (v != _password.text) {
                        return i18n.isArabic
                            ? 'كلمتا المرور غير متطابقتين.'
                            : 'Passwords do not match.';
                      }
                      return null;
                    },
                  ),
                ),
              ),
              const SizedBox(height: 12),
              _staggered(
                index: 7,
                child: Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                        color: scheme.outline.withValues(alpha: 0.30)),
                    color: Color.alphaBlend(
                      scheme.onSurface.withValues(alpha: 0.02),
                      scheme.surface,
                    ),
                  ),
                  child: CheckboxListTile(
                    value: _agree,
                    onChanged: _busy
                        ? null
                        : (v) => setState(() => _agree = v == true),
                    title: Text(
                      i18n.t(
                        'auth.termsAgree',
                        'I agree to the Terms of Service and Privacy Policy.',
                      ),
                    ),
                    controlAffinity: ListTileControlAffinity.leading,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 2,
                    ),
                    subtitle: _agree
                        ? null
                        : Text(
                            i18n.isArabic
                                ? 'يجب الموافقة للمتابعة.'
                                : 'You must accept the terms to continue.',
                            style: TextStyle(color: scheme.error),
                          ),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              if (_error.isNotEmpty)
                _staggered(
                  index: 8,
                  child: _InlineBanner(
                    text: _error,
                    icon: Icons.error_outline_rounded,
                    color: scheme.error,
                  ),
                ),
              _staggered(
                index: 9,
                child: _GradientCtaButton(
                  key: const Key('register-submit-button'),
                  label: i18n.t('auth.createAccount', 'Create Account'),
                  loadingLabel:
                      i18n.isArabic ? 'جارٍ الإنشاء...' : 'Creating account...',
                  loading: _busy,
                  onPressed: (_busy || !_agree) ? null : _submit,
                ),
              ),
              const SizedBox(height: 12),
              _staggered(
                index: 10,
                child: TextButton(
                  onPressed: _busy ? null : widget.onGoToLogin,
                  child: Text(
                    '${i18n.t('auth.alreadyHaveAccount', 'Already have an account?')} ${i18n.t('auth.goToLogin', 'Log in')}',
                    textAlign: TextAlign.center,
                  ),
                ),
              ),
              const SizedBox(height: 10),
              _staggered(
                index: 11,
                child: Row(
                  children: [
                    Expanded(
                      child: Divider(
                        color: scheme.outline.withValues(alpha: 0.36),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      child: Text(
                        i18n.isArabic ? 'أو واصل عبر' : 'Or continue with',
                        style: TextStyle(
                          fontSize: 12,
                          color: scheme.onSurfaceVariant,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    Expanded(
                      child: Divider(
                        color: scheme.outline.withValues(alpha: 0.36),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              _staggered(
                index: 12,
                child: Column(
                  children: [
                    SocialAuthButton(
                      provider: SocialProvider.google,
                      label: i18n.isArabic
                          ? 'المتابعة عبر Google'
                          : 'Continue with Google',
                      onPressed: () => _showSocialMessage('Google'),
                    ),
                    const SizedBox(height: 10),
                    SocialAuthButton(
                      provider: SocialProvider.apple,
                      label: i18n.isArabic
                          ? 'المتابعة عبر Apple'
                          : 'Continue with Apple',
                      onPressed: () => _showSocialMessage('Apple'),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _staggered({required int index, required Widget child}) {
    final duration = Duration(milliseconds: 260 + (index * 45));
    return AnimatedSlide(
      duration: duration,
      curve: Curves.easeOutCubic,
      offset: _entered ? Offset.zero : const Offset(0, 0.06),
      child: AnimatedOpacity(
        duration: duration,
        opacity: _entered ? 1 : 0,
        child: child,
      ),
    );
  }
}

class _RuleCheck {
  const _RuleCheck({required this.label, required this.pass});

  final String label;
  final bool pass;
}

class _FieldFrame extends StatelessWidget {
  const _FieldFrame({required this.focusNode, required this.child});

  final FocusNode focusNode;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return AnimatedBuilder(
      animation: focusNode,
      builder: (context, _) {
        final focused = focusNode.hasFocus;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOut,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            boxShadow: focused
                ? [
                    BoxShadow(
                      color: scheme.primary.withValues(alpha: 0.20),
                      blurRadius: 14,
                      offset: const Offset(0, 4),
                    ),
                  ]
                : [],
          ),
          child: child,
        );
      },
    );
  }
}

class _InlineBanner extends StatelessWidget {
  const _InlineBanner({
    required this.text,
    required this.icon,
    required this.color,
  });

  final String text;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.24)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: TextStyle(color: color, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

class _GradientCtaButton extends StatelessWidget {
  const _GradientCtaButton({
    super.key,
    required this.label,
    required this.loadingLabel,
    required this.loading,
    required this.onPressed,
  });

  final String label;
  final String loadingLabel;
  final bool loading;
  final VoidCallback? onPressed;

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
              scheme.secondary.withValues(alpha: 0.32),
              scheme.primary,
            ),
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: scheme.primary.withValues(alpha: 0.30),
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
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 180),
          child: loading
              ? Row(
                  key: const ValueKey('loading'),
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: scheme.onPrimary,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text(loadingLabel),
                  ],
                )
              : Row(
                  key: const ValueKey('idle'),
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(label),
                    const SizedBox(width: 8),
                    const Icon(Icons.arrow_forward_rounded, size: 18),
                  ],
                ),
        ),
      ),
    );
  }
}
