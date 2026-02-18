import 'dart:async';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../app_config.dart';
import '../../app_state.dart';
import '../../i18n.dart';
import '../../storage_keys.dart';
import '../../api/api_client.dart';
import 'auth_shell.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({
    super.key,
    required this.state,
    required this.api,
    required this.onSignedIn,
    required this.onGoToRegister,
    required this.onGoToForgotPassword,
    this.prefillEmail,
  });

  final AppState state;
  final ApiClient api;
  final Future<void> Function(AuthSession session) onSignedIn;
  final VoidCallback onGoToRegister;
  final VoidCallback onGoToForgotPassword;
  final String? prefillEmail;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();

  bool _rememberMe = false;
  bool _showPassword = false;
  bool _busy = false;
  bool _needsVerification = false;
  String _error = '';
  String _info = '';

  static const _success = Color(0xFF10B981);
  static const _danger = Color(0xFFEF4444);
  static const _primary = Color(0xFF6366F1);

  @override
  void initState() {
    super.initState();
    unawaited(_restoreRememberedEmail());
  }

  Future<void> _restoreRememberedEmail() async {
    final prefs = await SharedPreferences.getInstance();
    final enabled = prefs.getString(StorageKeys.authRememberEnabled) == '1';
    final email = prefs.getString(StorageKeys.authRememberEmail) ?? '';
    if (!mounted) return;
    setState(() {
      _rememberMe = enabled;
      final preferred = (widget.prefillEmail ?? '').trim();
      if (preferred.isNotEmpty) {
        _emailController.text = preferred;
      } else if (enabled && email.trim().isNotEmpty) {
        _emailController.text = email.trim();
      }
    });
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  bool _isValidEmail(String value) {
    final v = value.trim();
    return v.contains('@') && v.contains('.');
  }

  Future<void> _submit() async {
    if (_busy) return;
    _error = '';
    _info = '';
    _needsVerification = false;
    if (!mounted) return;
    setState(() {});

    if (!_formKey.currentState!.validate()) return;

    setState(() => _busy = true);
    try {
      final email = _emailController.text.trim().toLowerCase();
      final password = _passwordController.text;
      final session = await widget.api.login(email: email, password: password);

      final prefs = await SharedPreferences.getInstance();
      if (_rememberMe) {
        await prefs.setString(StorageKeys.authRememberEnabled, '1');
        await prefs.setString(StorageKeys.authRememberEmail, email);
      } else {
        await prefs.setString(StorageKeys.authRememberEnabled, '0');
        await prefs.remove(StorageKeys.authRememberEmail);
      }

      await widget.onSignedIn(session);
    } catch (error) {
      if (!mounted) return;
      final message = error is ApiException ? error.message : 'Unable to sign in.';
      final lower = message.toLowerCase();
      setState(() {
        _error = message;
        _needsVerification =
            lower.contains('verify') || lower.contains('verification');
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resendVerification() async {
    if (_busy) return;
    final email = _emailController.text.trim().toLowerCase();
    if (!_isValidEmail(email)) return;
    setState(() {
      _busy = true;
      _error = '';
      _info = '';
    });
    try {
      final response = await widget.api.resendVerification(email: email);
      final debugCode = _extractDebugVerificationCode(response);
      if (!mounted) return;
      setState(() {
        _info = debugCode.isNotEmpty
            ? 'Verification code sent. (debug code: $debugCode)'
            : 'If the account exists, a verification code has been sent.';
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error is ApiException ? error.message : 'Unable to resend code.';
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _extractDebugVerificationCode(Map<String, dynamic> response) {
    final debug = response['debug'];
    if (debug is Map<String, dynamic>) {
      final code = debug['verificationCode']?.toString() ?? '';
      return code.trim();
    }
    return '';
  }

  @override
  Widget build(BuildContext context) {
    final i18n = I18n(widget.state.locale);
    final isDark = widget.state.themeMode == AppThemeMode.dark;
    final fg = isDark ? const Color(0xFFE9EEF9) : const Color(0xFF0D1422);
    final muted = fg.withOpacity(0.65);

    return AuthShell(
      state: widget.state,
      title: i18n.t('auth.signInTitle', 'Sign In'),
      description: i18n.t(
        'auth.signInDesc',
        'Access your verified workspace and continue your automation flow.',
      ),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _LabeledField(
              label: i18n.t('auth.email', 'Email'),
              icon: Icons.alternate_email_rounded,
              child: TextFormField(
                key: const Key('login-email-field'),
                controller: _emailController,
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
                key: const Key('login-password-field'),
                controller: _passwordController,
                obscureText: !_showPassword,
                autofillHints: const [AutofillHints.password],
                textDirection: TextDirection.ltr,
                decoration: InputDecoration(
                  hintText: '••••••••',
                  prefixIcon: const Icon(Icons.password_rounded),
                  suffixIcon: IconButton(
                    onPressed: _busy ? null : () => setState(() => _showPassword = !_showPassword),
                    icon: Icon(_showPassword ? Icons.visibility_off_rounded : Icons.visibility_rounded),
                  ),
                ),
                validator: (value) {
                  if ((value ?? '').isEmpty) return i18n.isArabic ? 'كلمة المرور مطلوبة.' : 'Password is required.';
                  return null;
                },
              ),
            ),
            const SizedBox(height: 12),
            Container(
              decoration: BoxDecoration(
                color: (isDark ? Colors.white : const Color(0xFF0D1422)).withOpacity(0.04),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: fg.withOpacity(0.08)),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              child: Row(
                children: [
                  Expanded(
                    child: CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      value: _rememberMe,
                      onChanged: _busy ? null : (v) => setState(() => _rememberMe = v == true),
                      title: Text(i18n.t('auth.rememberMe', 'Remember me'), style: TextStyle(color: muted)),
                      controlAffinity: ListTileControlAffinity.leading,
                    ),
                  ),
                  TextButton.icon(
                    onPressed: _busy ? null : widget.onGoToForgotPassword,
                    icon: const Icon(Icons.help_outline_rounded, size: 16),
                    label: Text(i18n.t('auth.forgotPassword', 'Forgot password?')),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            if (_error.isNotEmpty)
              _StatusCard(icon: Icons.error_outline_rounded, text: _error, color: _danger),
            if (_info.isNotEmpty)
              _StatusCard(icon: Icons.check_circle_outline_rounded, text: _info, color: _success),
            if (_needsVerification)
              Container(
                decoration: BoxDecoration(
                  color: (isDark ? const Color(0xFF22345C) : const Color(0xFFE9F0FF)).withOpacity(0.65),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: fg.withOpacity(0.10)),
                ),
                padding: const EdgeInsets.all(12),
                margin: const EdgeInsets.only(bottom: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.mark_email_read_rounded, size: 18, color: fg),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            i18n.t('auth.verificationRequired', 'Verification Required'),
                            style: TextStyle(fontWeight: FontWeight.w700, color: fg),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      i18n.isArabic
                          ? 'تحقق من بريدك الإلكتروني ثم حاول تسجيل الدخول مرة أخرى.'
                          : 'Verify your email first, then sign in again.',
                      style: TextStyle(color: fg.withOpacity(0.75)),
                    ),
                    const SizedBox(height: 10),
                    OutlinedButton(
                      onPressed: _busy ? null : _resendVerification,
                      child: Text(i18n.t('auth.resendCode', 'Resend Code')),
                    ),
                  ],
                ),
              ),
            FilledButton(
              key: const Key('login-submit-button'),
              onPressed: _busy ? null : _submit,
              style: FilledButton.styleFrom(
                backgroundColor: _primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: _busy
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(i18n.t('auth.signIn', 'Sign In')),
              ),
            ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: _busy ? null : widget.onGoToRegister,
              child: Text(
                '${i18n.t('auth.noAccount', "Don't have an account?")} ${i18n.t('auth.goToRegister', 'Create one')}',
                textAlign: TextAlign.center,
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              alignment: WrapAlignment.center,
              children: [
                _MetaPill(text: i18n.isArabic ? 'واجهات نظيفة' : 'Clean layouts', icon: Icons.grid_view_rounded, fg: fg),
                _MetaPill(text: i18n.isArabic ? 'أيقونات حديثة' : 'Modern icons', icon: Icons.interests_rounded, fg: fg),
                _MetaPill(text: i18n.isArabic ? 'UX أسرع' : 'Faster UX', icon: Icons.speed_rounded, fg: fg),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              'APP_URL: ${AppConfig.baseUri.toString()}',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 11, color: muted),
            ),
            const SizedBox(height: 10),
            Text(
              '${i18n.t('auth.credit', 'Programming & Design: Oday Algholy')} - ${i18n.t('auth.rights', 'All rights reserved')}',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 11, color: muted),
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

class _StatusCard extends StatelessWidget {
  const _StatusCard({required this.icon, required this.text, required this.color});

  final IconData icon;
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: color.withOpacity(0.10),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.24)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: TextStyle(color: color))),
        ],
      ),
    );
  }
}

class _MetaPill extends StatelessWidget {
  const _MetaPill({required this.text, required this.icon, required this.fg});

  final String text;
  final IconData icon;
  final Color fg;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: fg.withOpacity(0.06),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: fg.withOpacity(0.10)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: fg),
          const SizedBox(width: 6),
          Text(text, style: TextStyle(fontSize: 11.5, color: fg, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
