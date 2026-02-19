import 'dart:async';

import 'package:flutter/material.dart';

import '../../app_state.dart';
import '../../i18n.dart';
import '../../api/api_client.dart';
import 'auth_shell.dart';
import 'password_policy.dart';

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

  bool _agree = false;
  bool _busy = false;
  bool _showPassword = false;
  bool _showConfirm = false;

  String _error = '';

  static const _primary = Color(0xFF6366F1);

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    _confirmPassword.dispose();
    super.dispose();
  }

  bool _isValidEmail(String value) {
    final v = value.trim();
    return v.contains('@') && v.contains('.');
  }

  Future<void> _submit() async {
    if (_busy) return;
    _error = '';
    if (!mounted) return;
    setState(() {});

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
    final checks = kPasswordRules
        .map(
          (r) => _RuleCheck(
            label: i18n.t(r.testKey, r.testKey),
            pass: r.test(_password.text),
          ),
        )
        .toList(growable: false);
    final score = passwordStrengthScore(_password.text);
    final strengthLabel = score <= 2
        ? (i18n.isArabic ? 'ضعيفة' : 'Weak')
        : score <= 4
            ? (i18n.isArabic ? 'متوسطة' : 'Medium')
            : (i18n.isArabic ? 'قوية' : 'Strong');

    return AuthShell(
      state: widget.state,
      title: i18n.t('auth.registerTitle', 'Create Account'),
      description: i18n.t(
        'auth.registerDesc',
        'Start securely with verified email access and strong credential requirements.',
      ),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _LabeledField(
              label: i18n.t('auth.fullName', 'Full Name'),
              icon: Icons.badge_outlined,
              child: TextFormField(
                key: const Key('register-name-field'),
                controller: _name,
                textDirection: widget.state.dir,
                decoration: InputDecoration(
                  hintText: i18n.isArabic ? 'اسمك الكامل' : 'Your full name',
                  prefixIcon: const Icon(Icons.person_outline_rounded),
                ),
                validator: (value) {
                  final v = (value ?? '').trim();
                  if (v.isEmpty) return i18n.isArabic ? 'الاسم مطلوب.' : 'Name is required.';
                  if (v.length < 2) return i18n.isArabic ? 'الاسم قصير.' : 'Name must be at least 2 characters.';
                  if (v.length > 80) return i18n.isArabic ? 'الاسم طويل.' : 'Name must be 80 characters or fewer.';
                  return null;
                },
              ),
            ),
            const SizedBox(height: 12),
            _LabeledField(
              label: i18n.t('auth.email', 'Email'),
              icon: Icons.alternate_email_rounded,
              child: TextFormField(
                key: const Key('register-email-field'),
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                textDirection: TextDirection.ltr,
                decoration: const InputDecoration(
                  hintText: 'you@example.com',
                  prefixIcon: Icon(Icons.mail_outline_rounded),
                ),
                validator: (value) {
                  final v = (value ?? '').trim();
                  if (v.isEmpty) return i18n.isArabic ? 'البريد مطلوب.' : 'Email is required.';
                  if (!_isValidEmail(v)) return i18n.isArabic ? 'أدخل بريدًا صحيحًا.' : 'Enter a valid email address.';
                  return null;
                },
              ),
            ),
            const SizedBox(height: 12),
            _LabeledField(
              label: i18n.t('auth.password', 'Password'),
              icon: Icons.lock_outline_rounded,
              child: TextFormField(
                key: const Key('register-password-field'),
                controller: _password,
                obscureText: !_showPassword,
                autofillHints: const [AutofillHints.newPassword],
                textDirection: TextDirection.ltr,
                decoration: InputDecoration(
                  hintText: i18n.isArabic ? 'كلمة مرور قوية' : 'Create a strong password',
                  prefixIcon: const Icon(Icons.password_rounded),
                  suffixIcon: IconButton(
                    onPressed: _busy ? null : () => setState(() => _showPassword = !_showPassword),
                    icon: Icon(_showPassword ? Icons.visibility_off_rounded : Icons.visibility_rounded),
                  ),
                ),
                onChanged: (_) => setState(() {}),
                validator: (value) {
                  final v = value ?? '';
                  if (v.isEmpty) return i18n.isArabic ? 'كلمة المرور مطلوبة.' : 'Password is required.';
                  if (!passwordMeetsPolicy(v)) {
                    return i18n.isArabic ? 'كلمة المرور لا تطابق المتطلبات.' : 'Password does not meet all requirements.';
                  }
                  return null;
                },
              ),
            ),
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: LinearProgressIndicator(
                value: (score / kPasswordRules.length).clamp(0.0, 1.0),
                minHeight: 8,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              '${i18n.t('auth.passwordStrength', 'Password strength')}: $strengthLabel',
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
              textAlign: TextAlign.start,
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 10,
              runSpacing: 6,
              children: [
                for (final c in checks)
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        c.pass ? Icons.check_circle_rounded : Icons.error_outline_rounded,
                        size: 14,
                        color: c.pass ? Colors.green : Colors.orange,
                      ),
                      const SizedBox(width: 6),
                      Text(c.label, style: const TextStyle(fontSize: 12)),
                    ],
                  ),
              ],
            ),
            const SizedBox(height: 12),
            _LabeledField(
              label: i18n.t('auth.confirmPassword', 'Confirm Password'),
              icon: Icons.verified_rounded,
              child: TextFormField(
                key: const Key('register-confirm-password-field'),
                controller: _confirmPassword,
                obscureText: !_showConfirm,
                autofillHints: const [AutofillHints.newPassword],
                textDirection: TextDirection.ltr,
                decoration: InputDecoration(
                  hintText: i18n.isArabic ? 'أعد كتابة كلمة المرور' : 'Re-enter your password',
                  prefixIcon: const Icon(Icons.shield_outlined),
                  suffixIcon: IconButton(
                    onPressed: _busy ? null : () => setState(() => _showConfirm = !_showConfirm),
                    icon: Icon(_showConfirm ? Icons.visibility_off_rounded : Icons.visibility_rounded),
                  ),
                ),
                validator: (value) {
                  final v = value ?? '';
                  if (v.isEmpty) return i18n.isArabic ? 'أكد كلمة المرور.' : 'Please confirm your password.';
                  if (v != _password.text) return i18n.isArabic ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.';
                  return null;
                },
              ),
            ),
            const SizedBox(height: 12),
            Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white.withOpacity(widget.state.themeMode == AppThemeMode.dark ? 0.10 : 0.14)),
                color: (widget.state.themeMode == AppThemeMode.dark ? Colors.white : const Color(0xFF0D1422)).withOpacity(0.04),
              ),
              child: CheckboxListTile(
                value: _agree,
                onChanged: _busy ? null : (v) => setState(() => _agree = v == true),
                title: Text(i18n.t('auth.termsAgree', 'I agree to the Terms of Service and Privacy Policy.')),
                controlAffinity: ListTileControlAffinity.leading,
                contentPadding: EdgeInsets.zero,
                subtitle: _agree
                    ? null
                    : Text(
                        i18n.isArabic ? 'يجب الموافقة للمتابعة.' : 'You must accept the terms to continue.',
                        style: const TextStyle(color: Colors.redAccent),
                      ),
              ),
            ),
            const SizedBox(height: 8),
            if (_error.isNotEmpty)
              _InlineStatus(
                text: _error,
                color: Colors.redAccent,
                icon: Icons.error_outline_rounded,
              ),
            FilledButton(
              key: const Key('register-submit-button'),
              onPressed: (_busy || !_agree) ? null : _submit,
              style: FilledButton.styleFrom(
                backgroundColor: _primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: _busy
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                    : Text(i18n.t('auth.createAccount', 'Create Account')),
              ),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              alignment: WrapAlignment.center,
              children: [
                _AssistPill(text: i18n.isArabic ? 'تحقق بريد إلكتروني' : 'Email verification', icon: Icons.verified_user_rounded),
                _AssistPill(text: i18n.isArabic ? 'قوة كلمة المرور' : 'Password strength', icon: Icons.security_rounded),
                _AssistPill(text: i18n.isArabic ? 'سهولة التسجيل' : 'Smooth signup', icon: Icons.bolt_rounded),
              ],
            ),
            TextButton(
              onPressed: _busy ? null : widget.onGoToLogin,
              child: Text(
                '${i18n.t('auth.alreadyHaveAccount', 'Already have an account?')} ${i18n.t('auth.goToLogin', 'Sign in')}',
                textAlign: TextAlign.center,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LabeledField extends StatelessWidget {
  const _LabeledField({required this.label, required this.child, this.icon});

  final String label;
  final Widget child;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            if (icon != null) ...[
              Icon(icon, size: 16),
              const SizedBox(width: 6),
            ],
            Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
          ],
        ),
        const SizedBox(height: 6),
        child,
      ],
    );
  }
}

class _RuleCheck {
  const _RuleCheck({required this.label, required this.pass});

  final String label;
  final bool pass;
}

class _InlineStatus extends StatelessWidget {
  const _InlineStatus({required this.text, required this.color, required this.icon});

  final String text;
  final Color color;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: color.withOpacity(0.10),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.24)),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 16),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: TextStyle(color: color))),
        ],
      ),
    );
  }
}

class _AssistPill extends StatelessWidget {
  static const _successColor = Color(0xFF10B981);
  const _AssistPill({required this.text, required this.icon});

  final String text;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        color: _successColor.withOpacity(0.10),
        border: Border.all(color: _successColor.withOpacity(0.24)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: _successColor),
          const SizedBox(width: 6),
          Text(text, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: _successColor)),
        ],
      ),
    );
  }
}
