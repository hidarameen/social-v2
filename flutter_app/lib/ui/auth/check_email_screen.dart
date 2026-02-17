import 'dart:async';

import 'package:flutter/material.dart';

import '../../app_state.dart';
import '../../i18n.dart';
import '../../api/api_client.dart';
import 'auth_shell.dart';

class CheckEmailScreen extends StatefulWidget {
  const CheckEmailScreen({
    super.key,
    required this.state,
    required this.api,
    required this.email,
    required this.onEnterVerificationCode,
  });

  final AppState state;
  final ApiClient api;
  final String email;
  final VoidCallback onEnterVerificationCode;

  @override
  State<CheckEmailScreen> createState() => _CheckEmailScreenState();
}

class _CheckEmailScreenState extends State<CheckEmailScreen> {
  bool _busy = false;
  String _error = '';
  String _info = '';
  String _debugCode = '';
  String _debugUrl = '';

  Future<void> _resend() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = '';
      _info = '';
    });
    try {
      final res = await widget.api.resendVerification(email: widget.email);
      final debug = res['debug'];
      String code = '';
      String url = '';
      if (debug is Map<String, dynamic>) {
        code = debug['verificationCode']?.toString() ?? '';
        url = debug['verificationUrl']?.toString() ?? '';
      }
      if (!mounted) return;
      setState(() {
        _info = res['message']?.toString() ?? 'Verification code resent.';
        _debugCode = code.trim();
        _debugUrl = url.trim();
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

  @override
  Widget build(BuildContext context) {
    final i18n = I18n(widget.state.locale);

    return AuthShell(
      state: widget.state,
      title: i18n.t('auth.checkEmailTitle', 'Check Your Email'),
      description: i18n.t(
        'auth.checkEmailDesc',
        'Your account has been created. Verify your email to activate secure sign in.',
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: Theme.of(context).colorScheme.primary.withOpacity(0.25)),
              color: Theme.of(context).colorScheme.primary.withOpacity(0.10),
            ),
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.mark_email_read_rounded, size: 18, color: Theme.of(context).colorScheme.primary),
                    const SizedBox(width: 8),
                    Text(
                      i18n.t('auth.verificationRequired', 'Verification Required'),
                      style: TextStyle(fontWeight: FontWeight.w800, color: Theme.of(context).colorScheme.primary),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  i18n.isArabic
                      ? 'أرسلنا رمز تحقق إلى:'
                      : 'We sent a verification code to:',
                  style: const TextStyle(fontSize: 13),
                ),
                const SizedBox(height: 4),
                Text(widget.email, style: const TextStyle(fontWeight: FontWeight.w800)),
              ],
            ),
          ),
          const SizedBox(height: 12),
          if (_info.isNotEmpty) Text(_info),
          if (_error.isNotEmpty) Text(_error, style: const TextStyle(color: Colors.redAccent)),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _busy ? null : _resend,
                  child: Text(_busy ? (i18n.isArabic ? 'جاري الإرسال...' : 'Resending...') : i18n.t('auth.resendCode', 'Resend Code')),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton(
                  onPressed: _busy ? null : widget.onEnterVerificationCode,
                  child: Text(i18n.t('auth.enterVerificationCode', 'Enter Verification Code')),
                ),
              ),
            ],
          ),
          if (_debugCode.isNotEmpty || _debugUrl.isNotEmpty) ...[
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
                  Text(
                    i18n.isArabic ? 'تفاصيل التطوير:' : 'Development details:',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  if (_debugCode.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text('Code: $_debugCode'),
                  ],
                  if (_debugUrl.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text('URL: $_debugUrl'),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
