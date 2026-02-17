import 'dart:async';

import 'package:flutter/material.dart';

import '../../app_state.dart';
import '../../i18n.dart';
import '../../api/api_client.dart';
import 'auth_shell.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({
    super.key,
    required this.state,
    required this.api,
    required this.onBackToLogin,
    required this.onGoToResetPassword,
  });

  final AppState state;
  final ApiClient api;
  final VoidCallback onBackToLogin;
  final void Function(String email) onGoToResetPassword;

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _email = TextEditingController();

  bool _busy = false;
  String _error = '';
  String _message = '';
  String _debugCode = '';
  String _debugUrl = '';

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  bool _isValidEmail(String value) {
    final v = value.trim();
    return v.contains('@') && v.contains('.');
  }

  Future<void> _submit() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = '';
      _message = '';
      _debugCode = '';
      _debugUrl = '';
    });

    try {
      if (!_formKey.currentState!.validate()) {
        setState(() => _busy = false);
        return;
      }

      final email = _email.text.trim().toLowerCase();
      final res = await widget.api.forgotPassword(email: email);

      final debug = res['debug'];
      if (debug is Map<String, dynamic>) {
        _debugCode = debug['resetCode']?.toString() ?? '';
        _debugUrl = debug['resetUrl']?.toString() ?? '';
      }

      if (!mounted) return;
      setState(() {
        _message = res['message']?.toString() ??
            (widget.state.locale == 'ar'
                ? 'إذا كان الحساب موجودًا، تم إرسال رمز إعادة التعيين.'
                : 'If the account exists, a reset code has been sent.');
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error is ApiException ? error.message : 'Unable to process request.';
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
      title: i18n.isArabic ? 'نسيت كلمة المرور' : 'Forgot Password',
      description: i18n.isArabic
          ? 'اطلب رمز إعادة تعيين كلمة المرور لحسابك.'
          : 'Request a secure password reset code for your account.',
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
              validator: (value) {
                final v = (value ?? '').trim();
                if (v.isEmpty) return i18n.isArabic ? 'البريد مطلوب.' : 'Email is required.';
                if (!_isValidEmail(v)) return i18n.isArabic ? 'أدخل بريدًا صحيحًا.' : 'Enter a valid email address.';
                return null;
              },
            ),
            const SizedBox(height: 12),
            if (_error.isNotEmpty) Text(_error, style: const TextStyle(color: Colors.redAccent)),
            if (_message.isNotEmpty) Text(_message),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: _busy ? null : _submit,
              child: Text(_busy ? (i18n.isArabic ? 'جارٍ الإرسال...' : 'Sending...') : (i18n.isArabic ? 'إرسال رمز' : 'Send Reset Code')),
            ),
            const SizedBox(height: 10),
            OutlinedButton(
              onPressed: _busy
                  ? null
                  : () {
                      final email = _email.text.trim().toLowerCase();
                      if (_isValidEmail(email)) {
                        widget.onGoToResetPassword(email);
                      }
                    },
              child: Text(i18n.isArabic ? 'لدي رمز' : 'I have a code'),
            ),
            if (_debugCode.trim().isNotEmpty || _debugUrl.trim().isNotEmpty) ...[
              const SizedBox(height: 14),
              Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: Theme.of(context).dividerColor.withOpacity(0.6)),
                  color: Theme.of(context).colorScheme.surface.withOpacity(0.55),
                ),
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(i18n.isArabic ? 'تفاصيل التطوير:' : 'Development reset details:', style: const TextStyle(fontWeight: FontWeight.w700)),
                    if (_debugCode.trim().isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text('Code: ${_debugCode.trim()}'),
                    ],
                    if (_debugUrl.trim().isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text('URL: ${_debugUrl.trim()}'),
                    ],
                  ],
                ),
              ),
            ],
            const SizedBox(height: 12),
            TextButton(
              onPressed: _busy ? null : widget.onBackToLogin,
              child: Text(i18n.isArabic ? 'العودة لتسجيل الدخول' : 'Back to Sign In'),
            ),
          ],
        ),
      ),
    );
  }
}
