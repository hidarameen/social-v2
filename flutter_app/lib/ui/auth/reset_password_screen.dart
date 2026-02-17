import 'dart:async';

import 'package:flutter/material.dart';

import '../../app_state.dart';
import '../../i18n.dart';
import '../../api/api_client.dart';
import 'auth_shell.dart';
import 'password_policy.dart';

class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({
    super.key,
    required this.state,
    required this.api,
    required this.onDone,
  });

  final AppState state;
  final ApiClient api;
  final VoidCallback onDone;

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _RuleCheck {
  const _RuleCheck({required this.label, required this.pass});

  final String label;
  final bool pass;
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _email = TextEditingController();
  final TextEditingController _code = TextEditingController();
  final TextEditingController _password = TextEditingController();
  final TextEditingController _confirmPassword = TextEditingController();

  bool _busy = false;
  bool _showPassword = false;
  bool _showConfirm = false;
  bool _succeeded = false;
  String _error = '';
  String _message = '';

  @override
  void dispose() {
    _email.dispose();
    _code.dispose();
    _password.dispose();
    _confirmPassword.dispose();
    super.dispose();
  }

  bool _isValidEmail(String value) {
    final v = value.trim();
    return v.contains('@') && v.contains('.');
  }

  String _normalizeCode(String value) {
    final digits = value.replaceAll(RegExp(r'\\D'), '');
    return digits.length <= 6 ? digits : digits.substring(0, 6);
  }

  Future<void> _submit() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = '';
      _message = '';
    });

    try {
      if (!_formKey.currentState!.validate()) {
        setState(() => _busy = false);
        return;
      }

      final email = _email.text.trim().toLowerCase();
      final code = _normalizeCode(_code.text);
      final password = _password.text;

      await widget.api.resetPassword(
        email: email,
        code: code,
        password: password,
      );

      if (!mounted) return;
      setState(() {
        _succeeded = true;
        _message = widget.state.locale == 'ar'
            ? 'تم تحديث كلمة المرور. يمكنك تسجيل الدخول الآن.'
            : 'Password updated successfully. You can sign in now.';
        _password.clear();
        _confirmPassword.clear();
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error is ApiException ? error.message : 'Unable to reset password.';
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

    return AuthShell(
      state: widget.state,
      title: i18n.isArabic ? 'إعادة تعيين كلمة المرور' : 'Reset Password',
      description: i18n.isArabic
          ? 'عيّن كلمة مرور جديدة باستخدام رمز إعادة التعيين.'
          : 'Set a new password using your email reset code.',
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextFormField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              decoration: InputDecoration(labelText: i18n.t('auth.email', 'Email'), hintText: 'you@example.com'),
              textDirection: TextDirection.ltr,
              enabled: !_succeeded,
              validator: (value) {
                final v = (value ?? '').trim();
                if (!_isValidEmail(v)) return i18n.isArabic ? 'أدخل بريدًا صحيحًا.' : 'Enter a valid email address.';
                return null;
              },
            ),
            const SizedBox(height: 10),
            TextFormField(
              controller: _code,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(labelText: i18n.isArabic ? 'رمز إعادة التعيين' : 'Reset Code', hintText: '123456'),
              textDirection: TextDirection.ltr,
              enabled: !_succeeded,
              maxLength: 6,
              onChanged: (value) {
                final normalized = _normalizeCode(value);
                if (normalized != value) {
                  _code.value = TextEditingValue(
                    text: normalized,
                    selection: TextSelection.collapsed(offset: normalized.length),
                  );
                }
              },
              validator: (value) {
                final v = _normalizeCode(value ?? '');
                if (v.length != 6) return i18n.isArabic ? 'أدخل 6 أرقام.' : 'Enter the 6-digit reset code.';
                return null;
              },
            ),
            const SizedBox(height: 10),
            TextFormField(
              controller: _password,
              obscureText: !_showPassword,
              decoration: InputDecoration(
                labelText: i18n.isArabic ? 'كلمة مرور جديدة' : 'New Password',
                suffixIcon: IconButton(
                  onPressed: _succeeded ? null : () => setState(() => _showPassword = !_showPassword),
                  icon: Icon(_showPassword ? Icons.visibility_off_rounded : Icons.visibility_rounded),
                ),
              ),
              enabled: !_succeeded,
              textDirection: TextDirection.ltr,
              onChanged: (_) => setState(() {}),
              validator: (value) {
                final v = value ?? '';
                if (!passwordMeetsPolicy(v)) {
                  return i18n.isArabic ? 'كلمة المرور لا تطابق المتطلبات.' : 'Password does not meet all requirements.';
                }
                return null;
              },
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
                      Icon(c.pass ? Icons.check_circle_rounded : Icons.circle_outlined, size: 14),
                      const SizedBox(width: 6),
                      Text(c.label, style: const TextStyle(fontSize: 12)),
                    ],
                  ),
              ],
            ),
            const SizedBox(height: 10),
            TextFormField(
              controller: _confirmPassword,
              obscureText: !_showConfirm,
              decoration: InputDecoration(
                labelText: i18n.t('auth.confirmPassword', 'Confirm Password'),
                suffixIcon: IconButton(
                  onPressed: _succeeded ? null : () => setState(() => _showConfirm = !_showConfirm),
                  icon: Icon(_showConfirm ? Icons.visibility_off_rounded : Icons.visibility_rounded),
                ),
              ),
              enabled: !_succeeded,
              textDirection: TextDirection.ltr,
              validator: (value) {
                final v = value ?? '';
                if (v != _password.text) return i18n.isArabic ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.';
                return null;
              },
            ),
            const SizedBox(height: 12),
            if (_error.isNotEmpty) Text(_error, style: const TextStyle(color: Colors.redAccent)),
            if (_message.isNotEmpty) Text(_message),
            const SizedBox(height: 12),
            if (_succeeded)
              FilledButton(
                onPressed: widget.onDone,
                child: Text(i18n.isArabic ? 'الانتقال لتسجيل الدخول' : 'Go to Sign In'),
              )
            else
              FilledButton(
                onPressed: _busy ? null : _submit,
                child: Text(_busy ? (i18n.isArabic ? 'جارٍ التحديث...' : 'Updating...') : (i18n.isArabic ? 'تحديث كلمة المرور' : 'Update Password')),
              ),
          ],
        ),
      ),
    );
  }
}
