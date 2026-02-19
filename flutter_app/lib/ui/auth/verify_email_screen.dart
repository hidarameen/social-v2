import 'dart:async';

import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../../app_state.dart';
import '../../i18n.dart';
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
  final FocusNode _emailFocus = FocusNode();

  final List<TextEditingController> _otpControllers =
      List<TextEditingController>.generate(6, (_) => TextEditingController());
  final List<FocusNode> _otpFocusNodes = List<FocusNode>.generate(
    6,
    (_) => FocusNode(),
  );

  bool _busy = false;
  bool _success = false;
  String _error = '';
  String _info = '';
  int _resendSeconds = 45;
  Timer? _countdownTimer;

  @override
  void initState() {
    super.initState();
    _email.text = widget.prefilledEmail;
    _startCountdown();
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    _email.dispose();
    _emailFocus.dispose();
    for (final controller in _otpControllers) {
      controller.dispose();
    }
    for (final node in _otpFocusNodes) {
      node.dispose();
    }
    super.dispose();
  }

  bool _isValidEmail(String value) {
    final v = value.trim();
    return v.contains('@') && v.contains('.');
  }

  void _startCountdown({int seconds = 45}) {
    _countdownTimer?.cancel();
    setState(() => _resendSeconds = seconds);
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (_resendSeconds <= 0) {
        timer.cancel();
        return;
      }
      setState(() => _resendSeconds -= 1);
    });
  }

  String _normalizedCode() {
    final code = _otpControllers.map((c) => c.text).join();
    final digits = code.replaceAll(RegExp(r'\D'), '');
    return digits.length <= 6 ? digits : digits.substring(0, 6);
  }

  void _setCode(String value) {
    final normalized = value
        .replaceAll(RegExp(r'\D'), '')
        .padRight(6)
        .substring(0, 6);
    for (int i = 0; i < _otpControllers.length; i++) {
      _otpControllers[i].text = normalized[i] == ' ' ? '' : normalized[i];
    }
    final firstEmpty = _otpControllers.indexWhere((c) => c.text.isEmpty);
    final targetIndex = firstEmpty == -1 ? 5 : firstEmpty;
    _otpFocusNodes[targetIndex].requestFocus();
  }

  void _onOtpChanged(int index, String raw) {
    final digitsOnly = raw.replaceAll(RegExp(r'\D'), '');
    if (digitsOnly.length > 1) {
      _setCode(digitsOnly);
      return;
    }

    final nextValue = digitsOnly.isEmpty ? '' : digitsOnly[0];
    _otpControllers[index].value = TextEditingValue(
      text: nextValue,
      selection: TextSelection.collapsed(offset: nextValue.length),
    );

    if (nextValue.isNotEmpty && index < 5) {
      _otpFocusNodes[index + 1].requestFocus();
    }

    if (nextValue.isEmpty && index > 0) {
      _otpFocusNodes[index - 1].requestFocus();
    }
  }

  Future<void> _submit() async {
    if (_busy) return;
    final email = _email.text.trim().toLowerCase();
    final code = _normalizedCode();

    if (!_isValidEmail(email)) {
      setState(() => _error = 'Enter a valid email address.');
      return;
    }
    if (code.length != 6) {
      setState(() => _error = 'Enter the 6-digit verification code.');
      return;
    }

    setState(() {
      _busy = true;
      _error = '';
      _info = '';
    });

    try {
      await widget.api.verifyEmail(email: email, code: code);
      if (!mounted) return;
      setState(() {
        _success = true;
        _info = 'Your email has been verified successfully.';
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _success = false;
        _error = error is ApiException ? error.message : 'Verification failed.';
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resend() async {
    if (_busy || _resendSeconds > 0) return;
    final email = _email.text.trim().toLowerCase();
    if (!_isValidEmail(email)) {
      setState(() => _error = 'Enter a valid email address first.');
      return;
    }

    setState(() {
      _busy = true;
      _error = '';
      _info = '';
    });

    try {
      final res = await widget.api.resendVerification(email: email);
      String debugCode = '';
      final debug = res['debug'];
      if (debug is Map<String, dynamic>) {
        debugCode = (debug['verificationCode']?.toString() ?? '').trim();
      }
      if (!mounted) return;
      setState(() {
        _info = debugCode.isNotEmpty
            ? 'Code sent. (debug code: $debugCode)'
            : 'If the account exists, a verification code has been sent.';
      });
      if (debugCode.isNotEmpty) {
        _setCode(debugCode);
      }
      _startCountdown();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error is ApiException
            ? error.message
            : 'Unable to resend code.';
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final i18n = I18n(widget.state.locale);
    final scheme = Theme.of(context).colorScheme;
    final mm = (_resendSeconds ~/ 60).toString().padLeft(2, '0');
    final ss = (_resendSeconds % 60).toString().padLeft(2, '0');

    return AuthShell(
      state: widget.state,
      heroIcon: Icons.security_rounded,
      title: 'Verify Your Account',
      description: 'We sent a verification code to your email',
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _FieldFrame(
              focusNode: _emailFocus,
              child: TextFormField(
                controller: _email,
                focusNode: _emailFocus,
                keyboardType: TextInputType.emailAddress,
                textDirection: TextDirection.ltr,
                enabled: !_success,
                onTapOutside: (_) =>
                    FocusManager.instance.primaryFocus?.unfocus(),
                decoration: const InputDecoration(
                  labelText: 'Email',
                  hintText: 'you@example.com',
                  prefixIcon: Icon(Icons.mail_outline_rounded),
                  floatingLabelBehavior: FloatingLabelBehavior.auto,
                ),
              ),
            ),
            const SizedBox(height: 14),
            Text(
              i18n.isArabic
                  ? 'أدخل الرمز المكون من 6 أرقام'
                  : 'Enter the 6-digit verification code',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: scheme.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: List<Widget>.generate(6, (index) {
                return _OtpDigitField(
                  controller: _otpControllers[index],
                  focusNode: _otpFocusNodes[index],
                  enabled: !_success && !_busy,
                  hasError: _error.isNotEmpty,
                  onChanged: (value) => _onOtpChanged(index, value),
                );
              }),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: Text(
                    _resendSeconds > 0
                        ? 'Resend available in $mm:$ss'
                        : 'You can resend a new code now',
                    style: TextStyle(
                      fontSize: 12,
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                ),
                TextButton(
                  onPressed: (_resendSeconds > 0 || _busy || _success)
                      ? null
                      : _resend,
                  child: Text(i18n.t('auth.resendCode', 'Resend Code')),
                ),
              ],
            ),
            if (_error.isNotEmpty)
              _InlineBanner(
                text: _error,
                icon: Icons.error_outline_rounded,
                color: scheme.error,
              ),
            if (_info.isNotEmpty)
              _InlineBanner(
                text: _info,
                icon: Icons.check_circle_outline_rounded,
                color: scheme.primary,
              ),
            const SizedBox(height: 8),
            if (_success)
              _GradientCtaButton(
                label: i18n.isArabic
                    ? 'الانتقال لتسجيل الدخول'
                    : 'Go to Sign In',
                loadingLabel: i18n.isArabic
                    ? 'جارٍ التحويل...'
                    : 'Redirecting...',
                loading: false,
                onPressed: widget.onVerified,
              )
            else
              _GradientCtaButton(
                label: i18n.t('auth.verifyEmail', 'Confirm Code'),
                loadingLabel: i18n.isArabic
                    ? 'جارٍ التحقق...'
                    : 'Confirming...',
                loading: _busy,
                onPressed: _busy ? null : _submit,
              ),
          ],
        ),
      ),
    );
  }
}

class _OtpDigitField extends StatelessWidget {
  const _OtpDigitField({
    required this.controller,
    required this.focusNode,
    required this.enabled,
    required this.hasError,
    required this.onChanged,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final bool enabled;
  final bool hasError;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return AnimatedBuilder(
      animation: focusNode,
      builder: (context, _) {
        final focused = focusNode.hasFocus;
        final borderColor = hasError
            ? scheme.error.withOpacity(0.62)
            : focused
            ? scheme.primary
            : scheme.outline.withOpacity(0.38);
        return AnimatedContainer(
          duration: const Duration(milliseconds: 170),
          width: 46,
          height: 56,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: borderColor, width: focused ? 1.6 : 1.2),
            boxShadow: focused
                ? [
                    BoxShadow(
                      color: scheme.primary.withOpacity(0.22),
                      blurRadius: 14,
                      offset: const Offset(0, 4),
                    ),
                  ]
                : [],
          ),
          child: TextField(
            controller: controller,
            focusNode: focusNode,
            enabled: enabled,
            textAlign: TextAlign.center,
            keyboardType: TextInputType.number,
            textInputAction: TextInputAction.next,
            maxLength: 6,
            onChanged: onChanged,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: scheme.onSurface,
            ),
            decoration: const InputDecoration(
              counterText: '',
              border: InputBorder.none,
              contentPadding: EdgeInsets.zero,
            ),
          ),
        );
      },
    );
  }
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
                      color: scheme.primary.withOpacity(0.20),
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
        color: color.withOpacity(0.10),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withOpacity(0.24)),
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
              scheme.secondary.withOpacity(0.32),
              scheme.primary,
            ),
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: scheme.primary.withOpacity(0.30),
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
                    const Icon(Icons.check_circle_outline_rounded, size: 18),
                  ],
                ),
        ),
      ),
    );
  }
}
