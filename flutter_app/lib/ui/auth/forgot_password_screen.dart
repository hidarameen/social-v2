import 'dart:async';

import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../../app_state.dart';
import '../../i18n.dart';
import 'auth_shell.dart';
import 'password_policy.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({
    super.key,
    required this.state,
    required this.api,
    required this.onBackToLogin,
  });

  final AppState state;
  final ApiClient api;
  final VoidCallback onBackToLogin;

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _email = TextEditingController();
  final TextEditingController _code = TextEditingController();
  final TextEditingController _password = TextEditingController();
  final TextEditingController _confirmPassword = TextEditingController();

  final FocusNode _emailFocus = FocusNode();
  final FocusNode _codeFocus = FocusNode();
  final FocusNode _passwordFocus = FocusNode();
  final FocusNode _confirmFocus = FocusNode();

  bool _busy = false;
  bool _emailSent = false;
  bool _done = false;
  bool _showPassword = false;
  bool _showConfirmPassword = false;
  String _error = '';
  String _message = '';
  int _resendSeconds = 0;
  Timer? _countdownTimer;

  @override
  void dispose() {
    _countdownTimer?.cancel();
    _email.dispose();
    _code.dispose();
    _password.dispose();
    _confirmPassword.dispose();
    _emailFocus.dispose();
    _codeFocus.dispose();
    _passwordFocus.dispose();
    _confirmFocus.dispose();
    super.dispose();
  }

  bool _isValidEmail(String value) {
    final v = value.trim();
    return v.contains('@') && v.contains('.');
  }

  String _normalizeCode(String value) {
    final digits = value.replaceAll(RegExp(r'\D'), '');
    return digits.length <= 6 ? digits : digits.substring(0, 6);
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

  void _changeEmail() {
    _countdownTimer?.cancel();
    setState(() {
      _emailSent = false;
      _done = false;
      _busy = false;
      _error = '';
      _message = '';
      _resendSeconds = 0;
      _code.clear();
      _password.clear();
      _confirmPassword.clear();
    });
    _emailFocus.requestFocus();
  }

  Future<void> _sendCode() async {
    if (_busy) return;
    final i18n = I18n(widget.state.locale);
    final email = _email.text.trim().toLowerCase();
    if (!_isValidEmail(email)) {
      setState(() {
        _error = i18n.isArabic
            ? 'أدخل بريدًا إلكترونيًا صحيحًا.'
            : 'Enter a valid email address.';
      });
      return;
    }

    setState(() {
      _busy = true;
      _error = '';
      _message = '';
    });

    try {
      final res = await widget.api.forgotPassword(email: email);
      String debugCode = '';
      final debug = res['debug'];
      if (debug is Map<String, dynamic>) {
        debugCode = (debug['resetCode']?.toString() ?? '').trim();
      }
      if (!mounted) return;
      setState(() {
        _emailSent = true;
        _message = (res['message']?.toString() ?? '').trim().isNotEmpty
            ? res['message'].toString().trim()
            : i18n.isArabic
                ? 'إذا كان الحساب موجودًا، تم إرسال رمز إعادة التعيين.'
                : 'If the account exists, a reset code has been sent.';
        if (debugCode.isNotEmpty) {
          _code.text = _normalizeCode(debugCode);
        }
      });
      _startCountdown();
      _codeFocus.requestFocus();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error is ApiException
            ? error.message
            : i18n.isArabic
                ? 'تعذر تنفيذ الطلب.'
                : 'Unable to process request.';
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _updatePassword() async {
    if (_busy) return;
    final i18n = I18n(widget.state.locale);

    if (!_formKey.currentState!.validate()) return;

    final email = _email.text.trim().toLowerCase();
    final code = _normalizeCode(_code.text);
    final password = _password.text;

    setState(() {
      _busy = true;
      _error = '';
      _message = '';
    });

    try {
      await widget.api.resetPassword(
        email: email,
        code: code,
        password: password,
      );
      if (!mounted) return;
      setState(() {
        _done = true;
        _message = i18n.isArabic
            ? 'تم تحديث كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن.'
            : 'Password updated successfully. You can sign in now.';
        _password.clear();
        _confirmPassword.clear();
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error is ApiException
            ? error.message
            : i18n.isArabic
                ? 'تعذر إعادة تعيين كلمة المرور.'
                : 'Unable to reset password.';
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

    final mm = (_resendSeconds ~/ 60).toString().padLeft(2, '0');
    final ss = (_resendSeconds % 60).toString().padLeft(2, '0');

    return AuthShell(
      state: widget.state,
      heroIcon: Icons.lock_reset_rounded,
      title: i18n.isArabic ? 'إعادة تعيين كلمة المرور' : 'Reset Password',
      description: i18n.isArabic
          ? 'أدخل بريدك أولاً، ثم أرسل الكود لإظهار خطوات التحقق وتعيين كلمة مرور جديدة.'
          : 'Enter your email first. After sending the code, complete verification and set a new password.',
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
                enabled: !_done && !_emailSent,
                textInputAction: TextInputAction.next,
                onFieldSubmitted: (_) {
                  if (_emailSent) _codeFocus.requestFocus();
                },
                onTapOutside: (_) =>
                    FocusManager.instance.primaryFocus?.unfocus(),
                decoration: InputDecoration(
                  labelText: i18n.t('auth.email', 'Email'),
                  hintText: 'you@example.com',
                  prefixIcon: const Icon(Icons.mail_outline_rounded),
                  suffixIcon: _emailSent && !_done
                      ? TextButton(
                          onPressed: _busy ? null : _changeEmail,
                          child: Text(i18n.isArabic ? 'تغيير' : 'Change'),
                        )
                      : null,
                  floatingLabelBehavior: FloatingLabelBehavior.auto,
                ),
                validator: (value) {
                  final v = (value ?? '').trim();
                  if (v.isEmpty) {
                    return i18n.isArabic
                        ? 'البريد الإلكتروني مطلوب.'
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
            const SizedBox(height: 12),
            if (!_emailSent)
              _GradientCtaButton(
                label: i18n.isArabic ? 'إرسال الكود' : 'Send Code',
                loadingLabel:
                    i18n.isArabic ? 'جارٍ الإرسال...' : 'Sending code...',
                loading: _busy,
                onPressed: _busy ? null : _sendCode,
              ),
            if (_emailSent) ...[
              _FieldFrame(
                focusNode: _codeFocus,
                child: TextFormField(
                  controller: _code,
                  focusNode: _codeFocus,
                  keyboardType: TextInputType.number,
                  textDirection: TextDirection.ltr,
                  maxLength: 6,
                  enabled: !_done,
                  textInputAction: TextInputAction.next,
                  onFieldSubmitted: (_) => _passwordFocus.requestFocus(),
                  onTapOutside: (_) =>
                      FocusManager.instance.primaryFocus?.unfocus(),
                  onChanged: (value) {
                    final normalized = _normalizeCode(value);
                    if (normalized != value) {
                      _code.value = TextEditingValue(
                        text: normalized,
                        selection: TextSelection.collapsed(
                          offset: normalized.length,
                        ),
                      );
                    }
                  },
                  decoration: InputDecoration(
                    labelText:
                        i18n.isArabic ? 'رمز التحقق' : 'Verification Code',
                    hintText: '123456',
                    prefixIcon: const Icon(Icons.pin_outlined),
                    floatingLabelBehavior: FloatingLabelBehavior.auto,
                  ),
                  validator: (value) {
                    if (!_emailSent) return null;
                    final v = _normalizeCode(value ?? '');
                    if (v.length != 6) {
                      return i18n.isArabic
                          ? 'أدخل 6 أرقام.'
                          : 'Enter the 6-digit code.';
                    }
                    return null;
                  },
                ),
              ),
              const SizedBox(height: 10),
              _FieldFrame(
                focusNode: _passwordFocus,
                child: TextFormField(
                  controller: _password,
                  focusNode: _passwordFocus,
                  obscureText: !_showPassword,
                  enabled: !_done,
                  textDirection: TextDirection.ltr,
                  textInputAction: TextInputAction.next,
                  onFieldSubmitted: (_) => _confirmFocus.requestFocus(),
                  onTapOutside: (_) =>
                      FocusManager.instance.primaryFocus?.unfocus(),
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    labelText:
                        i18n.isArabic ? 'كلمة مرور جديدة' : 'New Password',
                    prefixIcon: const Icon(Icons.lock_outline_rounded),
                    floatingLabelBehavior: FloatingLabelBehavior.auto,
                    suffixIcon: IconButton(
                      onPressed: _done
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
                  validator: (value) {
                    if (!_emailSent) return null;
                    final v = value ?? '';
                    if (!passwordMeetsPolicy(v)) {
                      return i18n.isArabic
                          ? 'كلمة المرور لا تطابق المتطلبات.'
                          : 'Password does not meet all requirements.';
                    }
                    return null;
                  },
                ),
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
                          c.pass
                              ? Icons.check_circle_rounded
                              : Icons.radio_button_unchecked_rounded,
                          size: 14,
                          color: c.pass
                              ? scheme.primary
                              : scheme.onSurfaceVariant.withValues(alpha: 0.74),
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
              const SizedBox(height: 10),
              _FieldFrame(
                focusNode: _confirmFocus,
                child: TextFormField(
                  controller: _confirmPassword,
                  focusNode: _confirmFocus,
                  obscureText: !_showConfirmPassword,
                  enabled: !_done,
                  textDirection: TextDirection.ltr,
                  textInputAction: TextInputAction.done,
                  onTapOutside: (_) =>
                      FocusManager.instance.primaryFocus?.unfocus(),
                  decoration: InputDecoration(
                    labelText: i18n.t(
                      'auth.confirmPassword',
                      'Confirm Password',
                    ),
                    prefixIcon: const Icon(Icons.verified_user_outlined),
                    floatingLabelBehavior: FloatingLabelBehavior.auto,
                    suffixIcon: IconButton(
                      onPressed: _done
                          ? null
                          : () => setState(
                                () => _showConfirmPassword =
                                    !_showConfirmPassword,
                              ),
                      icon: Icon(
                        _showConfirmPassword
                            ? Icons.visibility_off_rounded
                            : Icons.visibility_rounded,
                      ),
                    ),
                  ),
                  validator: (value) {
                    if (!_emailSent) return null;
                    if ((value ?? '') != _password.text) {
                      return i18n.isArabic
                          ? 'كلمتا المرور غير متطابقتين.'
                          : 'Passwords do not match.';
                    }
                    return null;
                  },
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      _resendSeconds > 0
                          ? (i18n.isArabic
                              ? 'إعادة الإرسال بعد $mm:$ss'
                              : 'Resend in $mm:$ss')
                          : (i18n.isArabic
                              ? 'تحتاج رمزًا جديدًا؟'
                              : 'Need another code?'),
                      style: TextStyle(
                        fontSize: 12,
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                  ),
                  TextButton(
                    onPressed: (_resendSeconds > 0 || _busy || _done)
                        ? null
                        : _sendCode,
                    child: Text(i18n.t('auth.resendCode', 'Resend Code')),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              if (!_done)
                _GradientCtaButton(
                  label: i18n.isArabic ? 'تأكيد الكود' : 'Confirm Code',
                  loadingLabel:
                      i18n.isArabic ? 'جارٍ التأكيد...' : 'Confirming...',
                  loading: _busy,
                  onPressed: _busy ? null : _updatePassword,
                ),
            ],
            const SizedBox(height: 12),
            if (_error.isNotEmpty)
              _InlineBanner(
                text: _error,
                icon: Icons.error_outline_rounded,
                color: scheme.error,
              ),
            if (_message.isNotEmpty)
              _InlineBanner(
                text: _message,
                icon: Icons.info_outline_rounded,
                color: scheme.primary,
              ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: _busy ? null : widget.onBackToLogin,
              child: Text(
                i18n.isArabic ? 'العودة لتسجيل الدخول' : 'Back to Sign In',
              ),
            ),
          ],
        ),
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
