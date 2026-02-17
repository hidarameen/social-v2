import 'dart:async';

import 'package:flutter/material.dart';

import '../../app_state.dart';
import '../../i18n.dart';
import '../../api/api_client.dart';
import 'auth_shell.dart';

class VerifyEmailScreen extends StatefulWidget {
  const VerifyEmailScreen({
    super.key,
    required this.state,
    required this.api,
    required this.prefilledEmail,
    required this.onVerified,
  });

  final AppState state;
  final ApiClient api;
  final String prefilledEmail;
  final VoidCallback onVerified;

  @override
  State<VerifyEmailScreen> createState() => _VerifyEmailScreenState();
}

class _VerifyEmailScreenState extends State<VerifyEmailScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _email = TextEditingController();
  final TextEditingController _code = TextEditingController();

  bool _busy = false;
  String _message = '';
  bool _success = false;

  @override
  void initState() {
    super.initState();
    _email.text = widget.prefilledEmail;
  }

  @override
  void dispose() {
    _email.dispose();
    _code.dispose();
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
      _message = '';
    });
    try {
      if (!_formKey.currentState!.validate()) {
        setState(() => _busy = false);
        return;
      }

      final email = _email.text.trim().toLowerCase();
      final code = _normalizeCode(_code.text);
      await widget.api.verifyEmail(email: email, code: code);
      if (!mounted) return;
      setState(() {
        _success = true;
        _message = widget.state.locale == 'ar'
            ? 'تم التحقق من البريد بنجاح.'
            : 'Your email has been verified successfully.';
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _success = false;
        _message = error is ApiException ? error.message : 'Verification failed.';
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final i18n = I18n(widget.state.locale);

    return AuthShell(
      state: widget.state,
      title: i18n.isArabic ? 'التحقق من البريد' : 'Email Verification',
      description: i18n.isArabic
          ? 'أكد حسابك باستخدام رمز التحقق.'
          : 'Confirm your account with the verification code.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            _message.isNotEmpty
                ? _message
                : (i18n.isArabic
                    ? 'أدخل بريدك ورمز التحقق المكون من 6 أرقام.'
                    : 'Enter your email and 6-digit verification code.'),
          ),
          const SizedBox(height: 12),
          if (_success)
            FilledButton(
              onPressed: widget.onVerified,
              child: Text(i18n.isArabic ? 'الانتقال لتسجيل الدخول' : 'Go to Sign In'),
            )
          else
            Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextFormField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    decoration: InputDecoration(labelText: i18n.t('auth.email', 'Email')),
                    textDirection: TextDirection.ltr,
                    validator: (value) {
                      final v = (value ?? '').trim();
                      if (!_isValidEmail(v)) {
                        return i18n.isArabic ? 'أدخل بريدًا صحيحًا.' : 'Enter a valid email address.';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 10),
                  TextFormField(
                    controller: _code,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(labelText: i18n.isArabic ? 'رمز التحقق' : 'Verification Code'),
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
                      if (v.length != 6) {
                        return i18n.isArabic ? 'أدخل 6 أرقام.' : 'Enter the 6-digit verification code.';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 10),
                  FilledButton(
                    onPressed: _busy ? null : _submit,
                    child: Text(_busy ? (i18n.isArabic ? 'جارٍ التحقق...' : 'Verifying...') : i18n.t('auth.verifyEmail', 'Verify Email')),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
