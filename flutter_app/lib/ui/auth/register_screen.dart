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
              child: TextFormField(
                key: const Key('register-name-field'),
                controller: _name,
                textDirection: widget.state.dir,
                decoration: InputDecoration(
                  hintText: i18n.isArabic ? 'اسمك الكامل' : 'Your full name',
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
              child: TextFormField(
                key: const Key('register-email-field'),
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                textDirection: TextDirection.ltr,
                decoration: const InputDecoration(hintText: 'you@example.com'),
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
              child: TextFormField(
                key: const Key('register-password-field'),
                controller: _password,
                obscureText: !_showPassword,
                autofillHints: const [AutofillHints.newPassword],
                textDirection: TextDirection.ltr,
                decoration: InputDecoration(
                  hintText: i18n.isArabic ? 'كلمة مرور قوية' : 'Create a strong password',
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
              child: TextFormField(
                key: const Key('register-confirm-password-field'),
                controller: _confirmPassword,
                obscureText: !_showConfirm,
                autofillHints: const [AutofillHints.newPassword],
                textDirection: TextDirection.ltr,
                decoration: InputDecoration(
                  hintText: i18n.isArabic ? 'أعد كتابة كلمة المرور' : 'Re-enter your password',
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
            CheckboxListTile(
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
            const SizedBox(height: 8),
            if (_error.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Text(_error, style: const TextStyle(color: Colors.redAccent)),
              ),
            FilledButton(
              key: const Key('register-submit-button'),
              onPressed: (_busy || !_agree) ? null : _submit,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: _busy
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                    : Text(i18n.t('auth.createAccount', 'Create Account')),
              ),
            ),
            const SizedBox(height: 12),
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
  const _LabeledField({required this.label, required this.child});

  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
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
