import 'dart:async';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../api/api_client.dart';
import '../../app_state.dart';
import '../../i18n.dart';
import '../../storage_keys.dart';
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
  final FocusNode _emailFocus = FocusNode();
  final FocusNode _passwordFocus = FocusNode();

  bool _rememberMe = false;
  bool _showPassword = false;
  bool _busy = false;
  bool _needsVerification = false;
  String _error = '';
  String _info = '';

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
    _emailFocus.dispose();
    _passwordFocus.dispose();
    super.dispose();
  }

  bool _isValidEmail(String value) {
    final v = value.trim();
    return v.contains('@') && v.contains('.');
  }

  Future<void> _submit() async {
    if (_busy) return;
    setState(() {
      _error = '';
      _info = '';
      _needsVerification = false;
    });

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
      final message = error is ApiException
          ? error.message
          : 'Unable to sign in.';
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
        _error = error is ApiException
            ? error.message
            : 'Unable to resend code.';
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

  void _showSocialMessage(String provider) {
    final i18n = I18n(widget.state.locale);
    final text = i18n.isArabic
        ? 'تسجيل $provider سيُضاف قريبًا.'
        : '$provider sign in will be added soon.';
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  @override
  Widget build(BuildContext context) {
    final i18n = I18n(widget.state.locale);
    final scheme = Theme.of(context).colorScheme;

    return AuthShell(
      state: widget.state,
      heroIcon: Icons.account_circle_rounded,
      title: 'Welcome Back',
      description: 'Sign in to continue',
      child: AutofillGroup(
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _FieldFrame(
                focusNode: _emailFocus,
                child: TextFormField(
                  key: const Key('login-email-field'),
                  controller: _emailController,
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
                    prefixIcon: const Icon(Icons.mail_outline_rounded),
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
              const SizedBox(height: 12),
              _FieldFrame(
                focusNode: _passwordFocus,
                child: TextFormField(
                  key: const Key('login-password-field'),
                  controller: _passwordController,
                  focusNode: _passwordFocus,
                  obscureText: !_showPassword,
                  autofillHints: const [AutofillHints.password],
                  textDirection: TextDirection.ltr,
                  textInputAction: TextInputAction.done,
                  onFieldSubmitted: (_) => _submit(),
                  onTapOutside: (_) =>
                      FocusManager.instance.primaryFocus?.unfocus(),
                  decoration: InputDecoration(
                    labelText: i18n.t('auth.password', 'Password'),
                    hintText: '••••••••',
                    prefixIcon: const Icon(Icons.lock_outline_rounded),
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
                  validator: (value) {
                    if ((value ?? '').isEmpty) {
                      return i18n.isArabic
                          ? 'كلمة المرور مطلوبة.'
                          : 'Password is required.';
                    }
                    return null;
                  },
                ),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  color: Color.alphaBlend(
                    scheme.onSurface.withOpacity(0.03),
                    scheme.surface,
                  ),
                  border: Border.all(color: scheme.outline.withOpacity(0.28)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Row(
                        children: [
                          Switch.adaptive(
                            value: _rememberMe,
                            onChanged: _busy
                                ? null
                                : (v) => setState(() => _rememberMe = v),
                          ),
                          Expanded(
                            child: Text(
                              i18n.t('auth.rememberMe', 'Remember me'),
                              style: TextStyle(
                                fontSize: 13,
                                color: scheme.onSurfaceVariant,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    TextButton(
                      onPressed: _busy ? null : widget.onGoToForgotPassword,
                      child: Text(
                        i18n.t('auth.forgotPassword', 'Forgot password?'),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
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
              if (_needsVerification)
                Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    color: scheme.primary.withOpacity(0.12),
                    border: Border.all(color: scheme.primary.withOpacity(0.28)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        i18n.t(
                          'auth.verificationRequired',
                          'Verification Required',
                        ),
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          color: scheme.onSurface,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        i18n.isArabic
                            ? 'تحقق من بريدك الإلكتروني ثم سجّل الدخول.'
                            : 'Verify your email first, then sign in.',
                        style: TextStyle(color: scheme.onSurfaceVariant),
                      ),
                      const SizedBox(height: 10),
                      OutlinedButton(
                        onPressed: _busy ? null : _resendVerification,
                        child: Text(i18n.t('auth.resendCode', 'Resend Code')),
                      ),
                    ],
                  ),
                ),
              _GradientCtaButton(
                key: const Key('login-submit-button'),
                label: i18n.t('auth.signIn', 'Sign In'),
                loadingLabel: i18n.isArabic
                    ? 'جاري تسجيل الدخول...'
                    : 'Signing in...',
                loading: _busy,
                onPressed: _busy ? null : _submit,
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: Divider(color: scheme.outline.withOpacity(0.36)),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    child: Text(
                      'Or continue with',
                      style: TextStyle(
                        fontSize: 12,
                        color: scheme.onSurfaceVariant,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  Expanded(
                    child: Divider(color: scheme.outline.withOpacity(0.36)),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _SocialCircleButton(
                    icon: Icons.g_mobiledata_rounded,
                    label: 'Google',
                    onTap: () => _showSocialMessage('Google'),
                  ),
                  const SizedBox(width: 12),
                  _SocialCircleButton(
                    icon: Icons.apple_rounded,
                    label: 'Apple',
                    onTap: () => _showSocialMessage('Apple'),
                  ),
                  const SizedBox(width: 12),
                  _SocialCircleButton(
                    icon: Icons.alternate_email_rounded,
                    label: 'X',
                    onTap: () => _showSocialMessage('X'),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: _busy ? null : widget.onGoToRegister,
                child: Text(
                  "Don't have an account? Create Account",
                  textAlign: TextAlign.center,
                ),
              ),
            ],
          ),
        ),
      ),
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
                    const Icon(Icons.arrow_forward_rounded, size: 18),
                  ],
                ),
        ),
      ),
    );
  }
}

class _SocialCircleButton extends StatelessWidget {
  const _SocialCircleButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Tooltip(
      message: label,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Ink(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: scheme.outline.withOpacity(0.32)),
            color: Color.alphaBlend(
              scheme.onSurface.withOpacity(0.02),
              scheme.surface,
            ),
          ),
          child: Icon(icon, size: 22, color: scheme.onSurfaceVariant),
        ),
      ),
    );
  }
}
