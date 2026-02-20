import 'dart:convert';
import 'dart:async';
import 'dart:ui' show ImageFilter;

import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import 'app_config.dart';
import 'app_state.dart';
import 'api/api_client.dart';
import 'firebase_options.dart';
import 'i18n.dart';
import 'ui/auth/forgot_password_screen.dart';
import 'ui/auth/login_screen.dart';
import 'ui/auth/premium_loading_screen.dart';
import 'ui/auth/register_screen.dart';
import 'ui/auth/verify_email_screen.dart';
import 'ui/auth/welcome_intro_screen.dart';
import 'ui/platform_brand.dart';
import 'ui/sf_theme.dart';
import 'ui/tasks/task_composer_sheet.dart';
import 'ui/widgets/sf_ui.dart';
import 'storage_keys.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  runApp(const SocialFlowApp());
}

class SocialFlowApp extends StatelessWidget {
  const SocialFlowApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const _StateLoader();
  }
}

class _StateLoader extends StatefulWidget {
  const _StateLoader();

  @override
  State<_StateLoader> createState() => _StateLoaderState();
}

class _StateLoaderState extends State<_StateLoader> {
  AppState? _state;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    final state = await AppState.load();
    if (!mounted) return;
    setState(() => _state = state);
  }

  @override
  Widget build(BuildContext context) {
    final state = _state;
    if (state == null) {
      return const MaterialApp(
        debugShowCheckedModeBanner: false,
        home: PremiumLoadingScreen(
          title: 'Launching SocialFlow',
          subtitle: 'Preparing your premium workspace...',
        ),
      );
    }

    return AnimatedBuilder(
      animation: state,
      builder: (context, _) {
        final themeMode = state.themeMode == AppThemeMode.dark
            ? ThemeMode.dark
            : ThemeMode.light;

        return MaterialApp(
          title: 'SocialFlow',
          debugShowCheckedModeBanner: false,
          themeMode: themeMode,
          theme: SfTheme.light(
            preset: state.themePreset,
            density: state.density,
            reducedMotion: state.reducedMotion,
          ),
          darkTheme: SfTheme.dark(
            preset: state.themePreset,
            density: state.density,
            reducedMotion: state.reducedMotion,
          ),
          locale: Locale(state.locale),
          builder: (context, child) {
            return Directionality(
              textDirection: state.dir,
              child: child ?? const SizedBox.shrink(),
            );
          },
          home: AppBootstrap(state: state),
        );
      },
    );
  }
}

class AppBootstrap extends StatefulWidget {
  const AppBootstrap({super.key, required this.state});

  final AppState state;

  @override
  State<AppBootstrap> createState() => _AppBootstrapState();
}

class _AppBootstrapState extends State<AppBootstrap> {
  final ApiClient _api = ApiClient(baseUri: AppConfig.baseUri);

  bool _loading = true;
  String? _token;
  String _name = '';
  String _email = '';

  @override
  void initState() {
    super.initState();
    unawaited(_restoreSession());
  }

  Future<void> _restoreSession() async {
    final prefs = await SharedPreferences.getInstance();
    final persistPreference =
        (prefs.getString(StorageKeys.authSessionPersistence) ?? '').trim();
    if (persistPreference == '0') {
      await prefs.remove(StorageKeys.mobileAccessToken);
      await prefs.remove(StorageKeys.mobileUserName);
      await prefs.remove(StorageKeys.mobileUserEmail);
      if (!mounted) return;
      setState(() {
        _token = null;
        _name = '';
        _email = '';
        _loading = false;
      });
      return;
    }

    final savedToken =
        (prefs.getString(StorageKeys.mobileAccessToken) ?? '').trim();
    final savedName = prefs.getString(StorageKeys.mobileUserName) ?? '';
    final savedEmail = prefs.getString(StorageKeys.mobileUserEmail) ?? '';

    if (savedToken.isEmpty) {
      if (!mounted) return;
      setState(() {
        _loading = false;
      });
      return;
    }

    try {
      final me = await _api.fetchMobileMe(savedToken);
      if (!mounted) return;
      setState(() {
        _token = savedToken;
        _name = me['name']?.toString() ?? savedName;
        _email = me['email']?.toString() ?? savedEmail;
        _loading = false;
      });
    } catch (_) {
      await prefs.remove(StorageKeys.mobileAccessToken);
      await prefs.remove(StorageKeys.mobileUserName);
      await prefs.remove(StorageKeys.mobileUserEmail);
      if (!mounted) return;
      setState(() {
        _token = null;
        _name = '';
        _email = '';
        _loading = false;
      });
    }
  }

  Future<void> _handleSignedIn(AuthSession session) async {
    final prefs = await SharedPreferences.getInstance();
    final persistPreference =
        (prefs.getString(StorageKeys.authSessionPersistence) ?? '').trim();
    final shouldPersistSession =
        persistPreference.isEmpty ? true : persistPreference == '1';

    if (shouldPersistSession) {
      await prefs.setString(StorageKeys.mobileAccessToken, session.accessToken);
      await prefs.setString(StorageKeys.mobileUserName, session.name);
      await prefs.setString(StorageKeys.mobileUserEmail, session.email);
    } else {
      await prefs.remove(StorageKeys.mobileAccessToken);
      await prefs.remove(StorageKeys.mobileUserName);
      await prefs.remove(StorageKeys.mobileUserEmail);
    }

    if (!mounted) return;
    setState(() {
      _token = session.accessToken;
      _name = session.name;
      _email = session.email;
    });
  }

  Future<void> _handleSignOut() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(StorageKeys.mobileAccessToken);
    await prefs.remove(StorageKeys.mobileUserName);
    await prefs.remove(StorageKeys.mobileUserEmail);

    if (!mounted) return;
    setState(() {
      _token = null;
      _name = '';
      _email = '';
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const PremiumLoadingScreen(
        title: 'Restoring Session',
        subtitle: 'Checking secure session state...',
      );
    }

    if (_token == null || _token!.isEmpty) {
      return AuthFlow(
          state: widget.state, api: _api, onSignedIn: _handleSignedIn);
    }

    return SocialShell(
      api: _api,
      appState: widget.state,
      accessToken: _token!,
      userName: _name,
      userEmail: _email,
      onSignOut: _handleSignOut,
    );
  }
}

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key, required this.api, required this.onSignedIn});

  final ApiClient api;
  final Future<void> Function(AuthSession session) onSignedIn;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final GlobalKey<FormState> _loginFormKey = GlobalKey<FormState>();
  final GlobalKey<FormState> _registerFormKey = GlobalKey<FormState>();

  final TextEditingController _loginEmailController = TextEditingController();
  final TextEditingController _loginPasswordController =
      TextEditingController();

  final TextEditingController _registerNameController = TextEditingController();
  final TextEditingController _registerEmailController =
      TextEditingController();
  final TextEditingController _registerPasswordController =
      TextEditingController();
  final TextEditingController _verificationCodeController =
      TextEditingController();

  bool _busy = false;
  bool _showVerificationForm = false;
  String _infoMessage = '';
  String _pendingVerificationEmail = '';
  String _pendingVerificationPassword = '';

  @override
  void dispose() {
    _loginEmailController.dispose();
    _loginPasswordController.dispose();
    _registerNameController.dispose();
    _registerEmailController.dispose();
    _registerPasswordController.dispose();
    _verificationCodeController.dispose();
    super.dispose();
  }

  Future<void> _submitLogin() async {
    if (!_loginFormKey.currentState!.validate()) return;

    setState(() {
      _busy = true;
      _infoMessage = '';
    });

    try {
      final session = await widget.api.login(
        email: _loginEmailController.text.trim(),
        password: _loginPasswordController.text,
      );
      await widget.onSignedIn(session);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _infoMessage =
            error is ApiException ? error.message : 'Failed to sign in.';
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _submitRegister() async {
    if (!_registerFormKey.currentState!.validate()) return;

    final registerEmail = _registerEmailController.text.trim().toLowerCase();
    final registerPassword = _registerPasswordController.text;

    setState(() {
      _busy = true;
      _infoMessage = '';
    });

    try {
      final registerResponse = await widget.api.register(
        name: _registerNameController.text.trim(),
        email: registerEmail,
        password: registerPassword,
      );

      final verificationRequired =
          registerResponse['verificationRequired'] == true;
      if (verificationRequired) {
        final debugCode = _extractDebugVerificationCode(registerResponse);
        setState(() {
          _showVerificationForm = true;
          _pendingVerificationEmail = registerEmail;
          _pendingVerificationPassword = registerPassword;
          _verificationCodeController.text = debugCode;
          _infoMessage = debugCode.isNotEmpty
              ? 'Account created. Enter your email verification code. (debug code: $debugCode)'
              : 'Account created. Enter your email verification code to continue.';
        });
        return;
      }

      final session = await widget.api.login(
        email: registerEmail,
        password: registerPassword,
      );
      await widget.onSignedIn(session);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _infoMessage =
            error is ApiException ? error.message : 'Failed to register.';
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _normalizeVerificationCode(String input) {
    return input.replaceAll(RegExp(r'[^0-9]'), '').trim();
  }

  String _extractDebugVerificationCode(Map<String, dynamic> registerResponse) {
    final debug = registerResponse['debug'];
    if (debug is! Map<String, dynamic>) return '';
    return _normalizeVerificationCode(
      debug['verificationCode']?.toString() ?? '',
    );
  }

  Future<void> _submitVerificationCode() async {
    final code = _normalizeVerificationCode(_verificationCodeController.text);
    if (_pendingVerificationEmail.isEmpty) {
      setState(() {
        _infoMessage = 'Missing email for verification.';
      });
      return;
    }
    if (code.length != 6) {
      setState(() {
        _infoMessage = 'Enter a valid 6-digit verification code.';
      });
      return;
    }

    setState(() {
      _busy = true;
      _infoMessage = '';
    });

    try {
      await widget.api.verifyEmail(
        email: _pendingVerificationEmail,
        code: code,
      );
      final session = await widget.api.login(
        email: _pendingVerificationEmail,
        password: _pendingVerificationPassword,
      );
      await widget.onSignedIn(session);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _infoMessage =
            error is ApiException ? error.message : 'Failed to verify email.';
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resendVerificationCode() async {
    if (_pendingVerificationEmail.isEmpty) return;

    setState(() {
      _busy = true;
      _infoMessage = '';
    });

    try {
      final response = await widget.api.resendVerification(
        email: _pendingVerificationEmail,
      );
      final debugCode = _extractDebugVerificationCode(response);
      if (!mounted) return;
      setState(() {
        if (debugCode.isNotEmpty) {
          _verificationCodeController.text = debugCode;
          _infoMessage =
              'Verification code sent again. (debug code: $debugCode)';
        } else {
          _infoMessage =
              'If the account exists, a verification code has been sent.';
        }
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _infoMessage = error is ApiException
            ? error.message
            : 'Failed to resend verification code.';
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  bool _isErrorMessage(String message) {
    final value = message.toLowerCase();
    return value.contains('failed') ||
        value.contains('invalid') ||
        value.contains('error') ||
        value.contains('unauthorized') ||
        value.contains('unable');
  }

  InputDecoration _inputDecoration(String label, IconData icon) {
    return InputDecoration(
      labelText: label,
      prefixIcon: Icon(icon),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 520),
                child: Card(
                  elevation: 2,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'SocialFlow',
                          style: TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Native Flutter app for Android APK and Flutter Web',
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                        const SizedBox(height: 18),
                        const TabBar(
                          tabs: [
                            Tab(text: 'Login'),
                            Tab(text: 'Register'),
                          ],
                        ),
                        const SizedBox(height: 16),
                        SizedBox(
                          height: _showVerificationForm ? 560 : 430,
                          child: TabBarView(
                            children: [
                              Form(
                                key: _loginFormKey,
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    TextFormField(
                                      key: const Key('login-email-field'),
                                      controller: _loginEmailController,
                                      keyboardType: TextInputType.emailAddress,
                                      decoration: _inputDecoration(
                                        'Email',
                                        Icons.alternate_email_rounded,
                                      ),
                                      validator: (value) {
                                        final input = (value ?? '').trim();
                                        if (input.isEmpty)
                                          return 'Email is required.';
                                        if (!input.contains('@'))
                                          return 'Enter a valid email.';
                                        return null;
                                      },
                                    ),
                                    const SizedBox(height: 12),
                                    TextFormField(
                                      key: const Key('login-password-field'),
                                      controller: _loginPasswordController,
                                      obscureText: true,
                                      decoration: _inputDecoration(
                                        'Password',
                                        Icons.lock_rounded,
                                      ),
                                      validator: (value) {
                                        if ((value ?? '').isEmpty)
                                          return 'Password is required.';
                                        return null;
                                      },
                                    ),
                                    const SizedBox(height: 16),
                                    SizedBox(
                                      width: double.infinity,
                                      child: FilledButton.icon(
                                        key: const Key('login-submit-button'),
                                        onPressed: _busy ? null : _submitLogin,
                                        icon: _busy
                                            ? const SizedBox(
                                                width: 16,
                                                height: 16,
                                                child:
                                                    CircularProgressIndicator(
                                                  strokeWidth: 2,
                                                ),
                                              )
                                            : const Icon(Icons.login_rounded),
                                        label: const Text('Sign In'),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              Form(
                                key: _registerFormKey,
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    TextFormField(
                                      key: const Key('register-name-field'),
                                      controller: _registerNameController,
                                      decoration: _inputDecoration(
                                        'Name',
                                        Icons.person_rounded,
                                      ),
                                      validator: (value) {
                                        final input = (value ?? '').trim();
                                        if (input.length < 2) {
                                          return 'Name must be at least 2 characters.';
                                        }
                                        return null;
                                      },
                                    ),
                                    const SizedBox(height: 12),
                                    TextFormField(
                                      key: const Key('register-email-field'),
                                      controller: _registerEmailController,
                                      keyboardType: TextInputType.emailAddress,
                                      decoration: _inputDecoration(
                                        'Email',
                                        Icons.alternate_email_rounded,
                                      ),
                                      validator: (value) {
                                        final input = (value ?? '').trim();
                                        if (input.isEmpty)
                                          return 'Email is required.';
                                        if (!input.contains('@'))
                                          return 'Enter a valid email.';
                                        return null;
                                      },
                                    ),
                                    const SizedBox(height: 12),
                                    TextFormField(
                                      key: const Key('register-password-field'),
                                      controller: _registerPasswordController,
                                      obscureText: true,
                                      decoration: _inputDecoration(
                                        'Password',
                                        Icons.lock_rounded,
                                      ),
                                      validator: (value) {
                                        final input = value ?? '';
                                        if (input.length < 8) {
                                          return 'Password must be at least 8 characters.';
                                        }
                                        return null;
                                      },
                                    ),
                                    const SizedBox(height: 16),
                                    SizedBox(
                                      width: double.infinity,
                                      child: FilledButton.icon(
                                        key:
                                            const Key('register-submit-button'),
                                        onPressed:
                                            _busy ? null : _submitRegister,
                                        icon: _busy
                                            ? const SizedBox(
                                                width: 16,
                                                height: 16,
                                                child:
                                                    CircularProgressIndicator(
                                                  strokeWidth: 2,
                                                ),
                                              )
                                            : const Icon(
                                                Icons.person_add_alt_1_rounded,
                                              ),
                                        label: const Text('Create Account'),
                                      ),
                                    ),
                                    if (_showVerificationForm) ...[
                                      const SizedBox(height: 14),
                                      TextFormField(
                                        key: const Key(
                                          'register-verification-code-field',
                                        ),
                                        controller: _verificationCodeController,
                                        keyboardType: TextInputType.number,
                                        decoration: _inputDecoration(
                                          'Verification code',
                                          Icons.mark_email_read_rounded,
                                        ),
                                        maxLength: 6,
                                        onChanged: (value) {
                                          final normalized =
                                              _normalizeVerificationCode(value);
                                          if (normalized != value) {
                                            _verificationCodeController.value =
                                                TextEditingValue(
                                              text: normalized,
                                              selection:
                                                  TextSelection.collapsed(
                                                offset: normalized.length,
                                              ),
                                            );
                                          }
                                        },
                                        validator: (value) {
                                          if (!_showVerificationForm)
                                            return null;
                                          final normalized =
                                              _normalizeVerificationCode(
                                            value ?? '',
                                          );
                                          if (normalized.isEmpty) {
                                            return 'Verification code is required.';
                                          }
                                          if (normalized.length != 6) {
                                            return 'Verification code must be 6 digits.';
                                          }
                                          return null;
                                        },
                                      ),
                                      const SizedBox(height: 8),
                                      SizedBox(
                                        width: double.infinity,
                                        child: FilledButton.icon(
                                          key: const Key(
                                            'register-verify-button',
                                          ),
                                          onPressed: _busy
                                              ? null
                                              : _submitVerificationCode,
                                          icon: _busy
                                              ? const SizedBox(
                                                  width: 16,
                                                  height: 16,
                                                  child:
                                                      CircularProgressIndicator(
                                                    strokeWidth: 2,
                                                  ),
                                                )
                                              : const Icon(
                                                  Icons.verified_rounded,
                                                ),
                                          label: const Text(
                                            'Verify Email and Sign In',
                                          ),
                                        ),
                                      ),
                                      const SizedBox(height: 8),
                                      SizedBox(
                                        width: double.infinity,
                                        child: OutlinedButton.icon(
                                          key: const Key(
                                            'register-resend-button',
                                          ),
                                          onPressed: _busy
                                              ? null
                                              : _resendVerificationCode,
                                          icon: const Icon(
                                            Icons.refresh_rounded,
                                          ),
                                          label: const Text(
                                            'Resend Verification Code',
                                          ),
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (_infoMessage.isNotEmpty) ...[
                          const SizedBox(height: 10),
                          Text(
                            _infoMessage,
                            style: TextStyle(
                              color: _isErrorMessage(_infoMessage)
                                  ? Colors.red
                                  : Colors.green,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

enum _AuthView {
  welcome,
  login,
  register,
  verifyEmail,
  forgotPassword,
}

class AuthFlow extends StatefulWidget {
  const AuthFlow({
    super.key,
    required this.state,
    required this.api,
    required this.onSignedIn,
  });

  final AppState state;
  final ApiClient api;
  final Future<void> Function(AuthSession session) onSignedIn;

  @override
  State<AuthFlow> createState() => _AuthFlowState();
}

class _AuthFlowState extends State<AuthFlow> {
  _AuthView _view = _AuthView.welcome;
  bool _ready = false;
  String _email = '';

  @override
  void initState() {
    super.initState();
    unawaited(_restoreIntroState());
  }

  Future<void> _restoreIntroState() async {
    final prefs = await SharedPreferences.getInstance();
    final seen = prefs.getString(StorageKeys.authIntroSeen) == '1';
    if (!mounted) return;
    setState(() {
      _view = seen ? _AuthView.login : _AuthView.welcome;
      _ready = true;
    });
  }

  Future<void> _completeIntro() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(StorageKeys.authIntroSeen, '1');
    if (!mounted) return;
    _go(_AuthView.login, email: _email);
  }

  void _go(_AuthView next, {String email = ''}) {
    setState(() {
      _view = next;
      if (email.trim().isNotEmpty) {
        _email = email.trim();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!_ready) {
      return const PremiumLoadingScreen(
        title: 'Preparing Authentication',
        subtitle: 'Applying secure startup checks...',
      );
    }

    switch (_view) {
      case _AuthView.welcome:
        return WelcomeIntroScreen(
          state: widget.state,
          onGetStarted: () => unawaited(_completeIntro()),
        );
      case _AuthView.login:
        return LoginScreen(
          state: widget.state,
          api: widget.api,
          prefillEmail: _email.isEmpty ? null : _email,
          onSignedIn: widget.onSignedIn,
          onGoToRegister: () => _go(_AuthView.register, email: _email),
          onGoToForgotPassword: () =>
              _go(_AuthView.forgotPassword, email: _email),
        );
      case _AuthView.register:
        return RegisterScreen(
          state: widget.state,
          api: widget.api,
          onGoToLogin: () => _go(_AuthView.login, email: _email),
          onRegisteredNeedingVerification: (email) =>
              _go(_AuthView.verifyEmail, email: email),
        );
      case _AuthView.verifyEmail:
        return VerifyEmailScreen(
          state: widget.state,
          api: widget.api,
          prefilledEmail: _email,
          onVerified: () => _go(_AuthView.login, email: _email),
        );
      case _AuthView.forgotPassword:
        return ForgotPasswordScreen(
          state: widget.state,
          api: widget.api,
          onBackToLogin: () => _go(_AuthView.login, email: _email),
        );
    }
  }
}

class SocialShell extends StatefulWidget {
  const SocialShell({
    super.key,
    required this.api,
    required this.appState,
    required this.accessToken,
    required this.userName,
    required this.userEmail,
    required this.onSignOut,
  });

  final ApiClient api;
  final AppState appState;
  final String accessToken;
  final String userName;
  final String userEmail;
  final Future<void> Function() onSignOut;

  @override
  State<SocialShell> createState() => _SocialShellState();
}

enum PanelKind { dashboard, tasks, accounts, executions, analytics, settings }

class PanelSpec {
  const PanelSpec({
    required this.kind,
    required this.labelKey,
    required this.fallbackLabel,
    required this.captionKey,
    required this.fallbackCaption,
    required this.icon,
  });

  final PanelKind kind;
  final String labelKey;
  final String fallbackLabel;
  final String captionKey;
  final String fallbackCaption;
  final IconData icon;
}

const List<PanelSpec> kPanelSpecs = <PanelSpec>[
  PanelSpec(
    kind: PanelKind.dashboard,
    labelKey: 'nav.dashboard',
    fallbackLabel: 'Dashboard',
    captionKey: 'nav.dashboard.caption',
    fallbackCaption: 'Live KPIs, health, and quick actions.',
    icon: Icons.space_dashboard_rounded,
  ),
  PanelSpec(
    kind: PanelKind.tasks,
    labelKey: 'nav.tasks',
    fallbackLabel: 'Tasks',
    captionKey: 'nav.tasks.caption',
    fallbackCaption: 'Automations, filters, and bulk actions.',
    icon: Icons.task_alt_rounded,
  ),
  PanelSpec(
    kind: PanelKind.accounts,
    labelKey: 'nav.accounts',
    fallbackLabel: 'Accounts',
    captionKey: 'nav.accounts.caption',
    fallbackCaption: 'Connections, platforms, and auth health.',
    icon: Icons.groups_rounded,
  ),
  PanelSpec(
    kind: PanelKind.executions,
    labelKey: 'nav.executions',
    fallbackLabel: 'Executions',
    captionKey: 'nav.executions.caption',
    fallbackCaption: 'Runs, failures, and diagnostics.',
    icon: Icons.list_alt_rounded,
  ),
  PanelSpec(
    kind: PanelKind.analytics,
    labelKey: 'nav.analytics',
    fallbackLabel: 'Analytics',
    captionKey: 'nav.analytics.caption',
    fallbackCaption: 'Performance insights and exports.',
    icon: Icons.query_stats_rounded,
  ),
  PanelSpec(
    kind: PanelKind.settings,
    labelKey: 'nav.settings',
    fallbackLabel: 'Settings',
    captionKey: 'nav.settings.caption',
    fallbackCaption: 'Profile, theme, credentials, and privacy.',
    icon: Icons.settings_rounded,
  ),
];

class _PanelState {
  bool loading = false;
  Map<String, dynamic>? data;
  String? error;
}

class _SocialShellState extends State<SocialShell> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  int _selectedIndex = 0;
  bool _mobileMenuOpen = false;
  String _tasksQuery = '';
  String _tasksStatusFilter = 'all';
  String _tasksPlatformFilter = 'all';
  String _tasksLastRunFilter = 'all';
  String _tasksIssueFilter = 'all';
  String _tasksSortBy = 'createdAt';
  String _tasksSortDir = 'desc';
  bool _tasksLoadingMore = false;
  Timer? _tasksDebounceTimer;
  final TextEditingController _tasksSearchController = TextEditingController();
  final TextEditingController _accountsSearchController =
      TextEditingController();
  String _accountsQuery = '';
  String _accountsStatusFilter = 'all';
  final TextEditingController _executionsSearchController =
      TextEditingController();
  String _executionsQuery = '';
  String _executionsStatusFilter = 'all';
  int _executionsOffset = 0;
  bool _executionsHasMore = false;
  bool _executionsLoadingMore = false;
  String _analyticsQuery = '';
  String _analyticsSortBy = 'successRate';
  String _analyticsSortDir = 'desc';
  int _analyticsOffset = 0;
  bool _analyticsHasMore = false;
  bool _analyticsLoadingMore = false;
  Timer? _executionsDebounceTimer;
  Timer? _analyticsDebounceTimer;
  final TextEditingController _analyticsSearchController =
      TextEditingController();
  final Map<String, String> _taskActionState = <String, String>{};
  final Map<String, String> _executionActionState = <String, String>{};
  final Map<PanelKind, DateTime> _panelUpdatedAt = <PanelKind, DateTime>{};
  Timer? _dashboardRefreshTimer;

  // Settings: profile + platform credentials drafts.
  String _settingsProfileSyncedUserId = '';
  bool _settingsSavingProfile = false;
  bool _settingsUpdatingPassword = false;
  String _settingsProfileError = '';
  final TextEditingController _settingsNameController = TextEditingController();
  final TextEditingController _settingsImageUrlController =
      TextEditingController();
  final TextEditingController _settingsCurrentPasswordController =
      TextEditingController();
  final TextEditingController _settingsNewPasswordController =
      TextEditingController();
  final TextEditingController _settingsConfirmPasswordController =
      TextEditingController();

  String _settingsSelectedPlatform = 'twitter';
  bool _settingsCredentialsLoading = false;
  bool _settingsCredentialsSaving = false;
  String _settingsCredentialsError = '';
  bool _settingsCredentialsDirty = false;
  Map<String, Map<String, String>> _settingsCredentialMap =
      <String, Map<String, String>>{};
  Map<String, String> _settingsCredentialDraft = <String, String>{};
  final Map<String, TextEditingController> _settingsCredentialControllers =
      <String, TextEditingController>{};
  final Map<String, bool> _settingsRevealSecret = <String, bool>{};

  final Map<PanelKind, _PanelState> _panelStates = {
    for (final panel in kPanelSpecs) panel.kind: _PanelState(),
  };

  @override
  void initState() {
    super.initState();
    _tasksSearchController.text = _tasksQuery;
    _accountsSearchController.text = _accountsQuery;
    _executionsSearchController.text = _executionsQuery;
    _analyticsSearchController.text = _analyticsQuery;
    unawaited(_loadCurrentPanel(force: true));

    _dashboardRefreshTimer = Timer.periodic(
      const Duration(seconds: 30),
      (_) {
        if (!mounted) return;
        if (_currentKind != PanelKind.dashboard) return;
        unawaited(_loadPanel(PanelKind.dashboard, force: true));
      },
    );
  }

  @override
  void dispose() {
    _dashboardRefreshTimer?.cancel();
    _tasksDebounceTimer?.cancel();
    _executionsDebounceTimer?.cancel();
    _analyticsDebounceTimer?.cancel();
    _tasksSearchController.dispose();
    _accountsSearchController.dispose();
    _executionsSearchController.dispose();
    _analyticsSearchController.dispose();
    _settingsNameController.dispose();
    _settingsImageUrlController.dispose();
    _settingsCurrentPasswordController.dispose();
    _settingsNewPasswordController.dispose();
    _settingsConfirmPasswordController.dispose();
    for (final c in _settingsCredentialControllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  PanelKind get _currentKind => kPanelSpecs[_selectedIndex].kind;

  Future<void> _loadCurrentPanel({bool force = false}) async {
    await _loadPanel(_currentKind, force: force);
  }

  Future<void> _loadPanel(PanelKind kind, {bool force = false}) async {
    final state = _panelStates[kind]!;
    if (!force && state.data != null && !state.loading) {
      return;
    }

    if (kind == PanelKind.executions) {
      await _loadExecutionsPage(reset: true, showPanelLoading: true);
      return;
    }

    setState(() {
      state.loading = true;
      state.error = null;
    });

    try {
      late final Map<String, dynamic> payload;
      switch (kind) {
        case PanelKind.dashboard:
          payload = await widget.api.fetchDashboard(widget.accessToken);
          break;
        case PanelKind.tasks:
          payload = await widget.api.fetchTasks(
            widget.accessToken,
            limit: 50,
            offset: 0,
            search: _tasksQuery,
            status: _tasksStatusFilter == 'all' ? null : _tasksStatusFilter,
            sortBy: _tasksSortBy,
            sortDir: _tasksSortDir,
          );
          break;
        case PanelKind.accounts:
          payload = await widget.api.fetchAccounts(
            widget.accessToken,
            limit: 60,
          );
          break;
        case PanelKind.executions:
          throw StateError('Executions are loaded via _loadExecutionsPage.');
        case PanelKind.analytics:
          payload = await widget.api.fetchAnalytics(
            widget.accessToken,
            limit: 50,
            offset: 0,
            search: _analyticsQuery,
            sortBy: _analyticsSortBy,
            sortDir: _analyticsSortDir,
          );
          break;
        case PanelKind.settings:
          payload = await widget.api.fetchProfile(widget.accessToken);
          unawaited(_loadSettingsPlatformCredentials());
          break;
      }

      if (!mounted) return;
      setState(() {
        state.loading = false;
        state.data = payload;
        state.error = null;
        _panelUpdatedAt[kind] = DateTime.now();
        if (kind == PanelKind.analytics) {
          _analyticsOffset = _readInt(payload['nextOffset'], fallback: 0);
          _analyticsHasMore = payload['hasMore'] == true;
        }
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        state.loading = false;
        final message =
            error is ApiException ? error.message : 'Failed to load panel.';
        state.error = message;
      });
    }
  }

  Future<void> _onPanelSelected(int index) async {
    if (_selectedIndex == index) {
      if (_mobileMenuOpen) setState(() => _mobileMenuOpen = false);
      return;
    }

    setState(() {
      _selectedIndex = index;
      _mobileMenuOpen = false;
    });
    await _loadPanel(_currentKind, force: _currentKind == PanelKind.dashboard);
  }

  I18n _i18n(BuildContext context) {
    try {
      final code = Localizations.localeOf(context).languageCode;
      return I18n(code == 'en' ? 'en' : 'ar');
    } catch (_) {
      return I18n('ar');
    }
  }

  void _toast(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  Future<void> _toggleSidebar({required bool wide}) async {
    if (wide) {
      if (_mobileMenuOpen) {
        setState(() => _mobileMenuOpen = false);
      }
      await widget.appState
          .setSidebarCollapsed(!widget.appState.sidebarCollapsed);
      return;
    }

    setState(() => _mobileMenuOpen = !_mobileMenuOpen);
  }

  void _openProfilePanel({required bool closeDrawer}) {
    final settingsIndex =
        kPanelSpecs.indexWhere((p) => p.kind == PanelKind.settings);
    if (settingsIndex < 0) return;
    if (closeDrawer && _mobileMenuOpen) {
      setState(() => _mobileMenuOpen = false);
    }
    unawaited(_onPanelSelected(settingsIndex));
  }

  String _buildLastUpdatedText(I18n i18n, PanelKind kind) {
    final updated = _panelUpdatedAt[kind];
    if (updated == null) {
      return i18n.isArabic ? 'لم يتم التحديث بعد' : 'Not refreshed yet';
    }
    final formatted = MaterialLocalizations.of(context).formatTimeOfDay(
      TimeOfDay.fromDateTime(updated),
      alwaysUse24HourFormat: true,
    );
    return i18n.isArabic ? 'آخر تحديث $formatted' : 'Updated $formatted';
  }

  static const int _kTasksPageSize = 50;
  static const int _kExecutionsPageSize = 50;

  int _readInt(dynamic value, {int fallback = 0}) {
    if (value is num) return value.toInt();
    return int.tryParse(value?.toString() ?? '') ?? fallback;
  }

  double _readDouble(dynamic value, {double fallback = 0}) {
    if (value is num) return value.toDouble();
    return double.tryParse(value?.toString() ?? '') ?? fallback;
  }

  void _syncProfileDraft(Map<String, dynamic> user) {
    final id = user['id']?.toString() ?? '';
    if (id.trim().isEmpty) return;
    if (_settingsProfileSyncedUserId == id) return;
    _settingsProfileSyncedUserId = id;
    _settingsProfileError = '';
    _settingsNameController.text = user['name']?.toString() ?? '';
    _settingsImageUrlController.text =
        user['profileImageUrl']?.toString() ?? '';
  }

  static const List<String> _kManagedPlatformIds = <String>[
    'twitter',
    'facebook',
    'instagram',
    'youtube',
    'tiktok',
    'linkedin',
  ];

  static const Map<String, String> _kPlatformLabels = <String, String>{
    'twitter': 'Twitter / X',
    'facebook': 'Facebook',
    'instagram': 'Instagram',
    'youtube': 'YouTube',
    'tiktok': 'TikTok',
    'linkedin': 'LinkedIn',
  };

  static const Map<String, List<Map<String, dynamic>>> _kPlatformFields =
      <String, List<Map<String, dynamic>>>{
    'twitter': [
      {
        'key': 'clientId',
        'label': 'OAuth Client ID',
        'hint': 'Twitter app client id',
        'secret': false
      },
      {
        'key': 'clientSecret',
        'label': 'OAuth Client Secret',
        'hint': 'Twitter app client secret',
        'secret': true
      },
      {
        'key': 'apiKey',
        'label': 'API Key (OAuth1)',
        'hint': 'Twitter API key',
        'secret': false
      },
      {
        'key': 'apiSecret',
        'label': 'API Secret (OAuth1)',
        'hint': 'Twitter API secret',
        'secret': true
      },
      {
        'key': 'accessToken',
        'label': 'Access Token (OAuth1)',
        'hint': 'Twitter access token',
        'secret': true
      },
      {
        'key': 'accessTokenSecret',
        'label': 'Access Token Secret (OAuth1)',
        'hint': 'Twitter access token secret',
        'secret': true
      },
      {
        'key': 'bearerToken',
        'label': 'Bearer Token (Streaming)',
        'hint': 'Twitter bearer token',
        'secret': true
      },
      {
        'key': 'webhookSecret',
        'label': 'Webhook Secret',
        'hint': 'Twitter webhook/API secret',
        'secret': true
      },
    ],
    'facebook': [
      {
        'key': 'clientId',
        'label': 'App ID / Client ID',
        'hint': 'Facebook app id',
        'secret': false
      },
      {
        'key': 'clientSecret',
        'label': 'App Secret / Client Secret',
        'hint': 'Facebook app secret',
        'secret': true
      },
    ],
    'instagram': [
      {
        'key': 'clientId',
        'label': 'Client ID',
        'hint': 'Instagram client id',
        'secret': false
      },
      {
        'key': 'clientSecret',
        'label': 'Client Secret',
        'hint': 'Instagram client secret',
        'secret': true
      },
    ],
    'youtube': [
      {
        'key': 'clientId',
        'label': 'Google Client ID',
        'hint': 'Google OAuth client id',
        'secret': false
      },
      {
        'key': 'clientSecret',
        'label': 'Google Client Secret',
        'hint': 'Google OAuth client secret',
        'secret': true
      },
    ],
    'tiktok': [
      {
        'key': 'clientId',
        'label': 'Client Key',
        'hint': 'TikTok client key',
        'secret': false
      },
      {
        'key': 'clientSecret',
        'label': 'Client Secret',
        'hint': 'TikTok client secret',
        'secret': true
      },
    ],
    'linkedin': [
      {
        'key': 'clientId',
        'label': 'Client ID',
        'hint': 'LinkedIn client id',
        'secret': false
      },
      {
        'key': 'clientSecret',
        'label': 'Client Secret',
        'hint': 'LinkedIn client secret',
        'secret': true
      },
    ],
  };

  Future<void> _loadSettingsPlatformCredentials({bool force = false}) async {
    if (_settingsCredentialsLoading) return;
    if (!force && _settingsCredentialMap.isNotEmpty) return;
    setState(() {
      _settingsCredentialsLoading = true;
      _settingsCredentialsError = '';
    });
    try {
      final payload =
          await widget.api.fetchPlatformCredentials(widget.accessToken);
      final raw = payload['credentials'];
      final map = <String, Map<String, String>>{};
      if (raw is Map) {
        for (final entry in raw.entries) {
          final platformId = entry.key?.toString() ?? '';
          if (platformId.trim().isEmpty) continue;
          final value = entry.value;
          if (value is Map) {
            map[platformId] = value
                .map((k, v) => MapEntry(k.toString(), v?.toString() ?? ''));
          }
        }
      }

      if (!mounted) return;
      setState(() {
        _settingsCredentialMap = map;
        _settingsCredentialsLoading = false;
      });

      _setSettingsSelectedPlatform(_settingsSelectedPlatform,
          allowSetState: false);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _settingsCredentialsLoading = false;
        _settingsCredentialsError = error is ApiException
            ? error.message
            : 'Failed to load platform credentials.';
      });
    }
  }

  void _setSettingsSelectedPlatform(String platformId,
      {bool allowSetState = true}) {
    final normalized = platformId.trim().toLowerCase();
    final next =
        _kManagedPlatformIds.contains(normalized) ? normalized : 'twitter';
    if (_settingsSelectedPlatform == next &&
        _settingsCredentialControllers.isNotEmpty) return;

    void apply() {
      _settingsSelectedPlatform = next;
      _settingsCredentialsDirty = false;
      _settingsCredentialDraft = Map<String, String>.from(
          _settingsCredentialMap[next] ?? const <String, String>{});
      for (final c in _settingsCredentialControllers.values) {
        c.dispose();
      }
      _settingsCredentialControllers.clear();
      for (final field
          in (_kPlatformFields[next] ?? const <Map<String, dynamic>>[])) {
        final key = field['key']?.toString() ?? '';
        if (key.isEmpty) continue;
        _settingsCredentialControllers[key] =
            TextEditingController(text: _settingsCredentialDraft[key] ?? '');
      }
    }

    if (!mounted || !allowSetState) {
      apply();
      return;
    }
    setState(apply);
  }

  Future<void> _saveSettingsPlatformCredentials() async {
    if (_settingsCredentialsSaving) return;
    final fields = _kPlatformFields[_settingsSelectedPlatform] ??
        const <Map<String, dynamic>>[];
    final payload = <String, dynamic>{};
    for (final field in fields) {
      final key = field['key']?.toString() ?? '';
      if (key.isEmpty) continue;
      final value = (_settingsCredentialControllers[key]?.text ?? '').trim();
      if (value.isNotEmpty) payload[key] = value;
    }

    setState(() {
      _settingsCredentialsSaving = true;
      _settingsCredentialsError = '';
    });
    try {
      final res = await widget.api.updatePlatformCredentials(
        widget.accessToken,
        platformId: _settingsSelectedPlatform,
        credentials: payload,
      );
      final rawCreds = res['credentials'];
      final updated = rawCreds is Map
          ? rawCreds.map((k, v) => MapEntry(k.toString(), v?.toString() ?? ''))
          : <String, String>{};

      if (!mounted) return;
      setState(() {
        _settingsCredentialMap = <String, Map<String, String>>{
          ..._settingsCredentialMap,
          _settingsSelectedPlatform: updated,
        };
        _settingsCredentialsDirty = false;
        _settingsCredentialsSaving = false;
      });
      _toast(
          '${_kPlatformLabels[_settingsSelectedPlatform] ?? _settingsSelectedPlatform} credentials saved');
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _settingsCredentialsSaving = false;
        _settingsCredentialsError = error is ApiException
            ? error.message
            : 'Failed to save credentials.';
      });
    }
  }

  Future<void> _saveSettingsProfile() async {
    if (_settingsSavingProfile) return;
    setState(() {
      _settingsSavingProfile = true;
      _settingsProfileError = '';
    });

    try {
      final name = _settingsNameController.text.trim();
      final img = _settingsImageUrlController.text.trim();
      final res = await widget.api.updateProfile(
        widget.accessToken,
        name: name.isEmpty ? null : name,
        profileImageUrl: img.isEmpty ? '' : img,
      );
      final user = res['user'] is Map<String, dynamic>
          ? res['user'] as Map<String, dynamic>
          : <String, dynamic>{};
      _syncProfileDraft(user);

      if (!mounted) return;
      setState(() {
        _settingsSavingProfile = false;
      });
      _toast('Profile saved');
      unawaited(_loadPanel(PanelKind.settings, force: true));
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _settingsSavingProfile = false;
        _settingsProfileError =
            error is ApiException ? error.message : 'Failed to save profile.';
      });
    }
  }

  Future<void> _updateSettingsPassword() async {
    if (_settingsUpdatingPassword) return;
    final current = _settingsCurrentPasswordController.text;
    final next = _settingsNewPasswordController.text;
    final confirm = _settingsConfirmPasswordController.text;

    if (next.trim().length < 8) {
      setState(() => _settingsProfileError =
          'New password must be at least 8 characters.');
      return;
    }
    if (next != confirm) {
      setState(
          () => _settingsProfileError = 'Confirm password does not match.');
      return;
    }

    setState(() {
      _settingsUpdatingPassword = true;
      _settingsProfileError = '';
    });
    try {
      await widget.api.updateProfile(
        widget.accessToken,
        currentPassword: current,
        newPassword: next,
      );
      if (!mounted) return;
      _settingsCurrentPasswordController.clear();
      _settingsNewPasswordController.clear();
      _settingsConfirmPasswordController.clear();
      setState(() {
        _settingsUpdatingPassword = false;
      });
      _toast('Password updated');
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _settingsUpdatingPassword = false;
        _settingsProfileError = error is ApiException
            ? error.message
            : 'Failed to update password.';
      });
    }
  }

  void _clearPanelCache() {
    setState(() {
      for (final state in _panelStates.values) {
        state.data = null;
        state.error = null;
        state.loading = false;
      }
      _settingsCredentialMap = <String, Map<String, String>>{};
      _settingsCredentialDraft = <String, String>{};
      _settingsCredentialsError = '';
      _settingsCredentialsDirty = false;
      _executionsOffset = 0;
      _executionsHasMore = false;
      _executionsLoadingMore = false;
    });
    unawaited(_loadCurrentPanel(force: true));
  }

  Future<void> _loadMoreTasks() async {
    if (_tasksLoadingMore) return;
    final state = _panelStates[PanelKind.tasks]!;
    final data = state.data ?? <String, dynamic>{};
    if (data['hasMore'] != true) return;

    setState(() => _tasksLoadingMore = true);
    try {
      await _loadTasksPage(reset: false, showPanelLoading: false);
    } finally {
      if (mounted) setState(() => _tasksLoadingMore = false);
    }
  }

  Future<Map<String, dynamic>?> _readCachedExecutionsPayload() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw =
          (prefs.getString(StorageKeys.cachedExecutionsPayload) ?? '').trim();
      if (raw.isEmpty) return null;
      final decoded = jsonDecode(raw);
      if (decoded is Map) {
        return decoded.map((k, v) => MapEntry(k.toString(), v));
      }
    } catch (_) {
      // Ignore cache read failures.
    }
    return null;
  }

  Future<void> _cacheExecutionsPayload(Map<String, dynamic> payload) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
          StorageKeys.cachedExecutionsPayload, jsonEncode(payload));
    } catch (_) {
      // Ignore cache write failures.
    }
  }

  Future<void> _loadExecutionsPage({
    required bool reset,
    required bool showPanelLoading,
  }) async {
    final state = _panelStates[PanelKind.executions]!;
    final currentData = state.data;
    final currentExecutions = currentData?['executions'] is List
        ? (currentData!['executions'] as List)
        : const <dynamic>[];
    final currentOffset =
        _readInt(currentData?['nextOffset'], fallback: _executionsOffset);
    final offset = reset ? 0 : currentOffset;

    if (showPanelLoading) {
      setState(() {
        state.loading = true;
        state.error = null;
      });
    }

    try {
      final payload = await widget.api.fetchExecutions(
        widget.accessToken,
        limit: _kExecutionsPageSize,
        offset: offset,
        search: _executionsQuery,
        status:
            _executionsStatusFilter == 'all' ? null : _executionsStatusFilter,
      );

      Map<String, dynamic> payloadForCache = payload;
      if (!mounted) return;
      setState(() {
        state.loading = false;
        state.error = null;
        _panelUpdatedAt[PanelKind.executions] = DateTime.now();

        final nextExecutionsRaw = payload['executions'] is List
            ? (payload['executions'] as List)
            : const <dynamic>[];
        final mergedExecutions = <dynamic>[
          if (!reset) ...currentExecutions,
          ...nextExecutionsRaw,
        ];

        final merged = Map<String, dynamic>.from(payload);
        merged['executions'] = mergedExecutions;
        state.data = merged;
        payloadForCache = merged;
        _executionsOffset =
            _readInt(payload['nextOffset'], fallback: mergedExecutions.length);
        _executionsHasMore = payload['hasMore'] == true;
      });

      await _cacheExecutionsPayload(payloadForCache);
    } catch (error) {
      final message =
          error is ApiException ? error.message : 'Failed to load executions.';
      if (!mounted) return;

      if (reset) {
        final fallbackExecutions = await _readCachedExecutionsPayload();
        if (!mounted) return;
        final i18n = _i18n(context);
        setState(() {
          state.loading = false;
          if (fallbackExecutions != null) {
            state.data = fallbackExecutions;
            state.error = i18n.isArabic
                ? '$message. عرض آخر نسخة محفوظة.'
                : '$message. Showing cached last view.';
            _executionsOffset =
                _readInt(fallbackExecutions['nextOffset'], fallback: 0);
            _executionsHasMore = fallbackExecutions['hasMore'] == true;
            return;
          }
          state.error = message;
        });
        return;
      }

      setState(() => state.loading = false);
      _toast(message);
    }
  }

  Future<void> _loadMoreExecutions() async {
    if (_executionsLoadingMore) return;
    if (!_executionsHasMore) return;

    setState(() => _executionsLoadingMore = true);
    try {
      await _loadExecutionsPage(reset: false, showPanelLoading: false);
    } finally {
      if (mounted) {
        setState(() => _executionsLoadingMore = false);
      }
    }
  }

  Future<void> _loadMoreAnalytics() async {
    if (_analyticsLoadingMore) return;
    if (!_analyticsHasMore) return;
    final state = _panelStates[PanelKind.analytics]!;
    final current = state.data ?? <String, dynamic>{};
    if (current['hasMore'] != true && _analyticsHasMore == false) return;

    setState(() => _analyticsLoadingMore = true);
    try {
      final payload = await widget.api.fetchAnalytics(
        widget.accessToken,
        limit: 50,
        offset: _analyticsOffset,
        search: _analyticsQuery,
        sortBy: _analyticsSortBy,
        sortDir: _analyticsSortDir,
      );

      final prevList = current['taskStats'];
      final prev = prevList is List ? prevList : const <dynamic>[];
      final nextList = payload['taskStats'] is List
          ? (payload['taskStats'] as List)
          : const <dynamic>[];

      final merged = <dynamic>[...prev, ...nextList];
      final mergedPayload = <String, dynamic>{
        ...payload,
        'taskStats': merged,
      };

      if (!mounted) return;
      setState(() {
        state.data = mergedPayload;
        _analyticsOffset =
            _readInt(payload['nextOffset'], fallback: merged.length);
        _analyticsHasMore = payload['hasMore'] == true;
        _analyticsLoadingMore = false;
        _panelUpdatedAt[PanelKind.analytics] = DateTime.now();
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _analyticsLoadingMore = false);
      final message =
          error is ApiException ? error.message : 'Failed to load analytics.';
      _toast(message);
    }
  }

  void _onAnalyticsQueryChanged(String value) {
    final next = value.trim();
    if (_analyticsQuery == next) return;
    _analyticsDebounceTimer?.cancel();
    setState(() => _analyticsQuery = next);
    _analyticsDebounceTimer = Timer(const Duration(milliseconds: 300), () {
      if (!mounted) return;
      unawaited(_loadPanel(PanelKind.analytics, force: true));
    });
  }

  Future<void> _loadTasksPage({
    required bool reset,
    required bool showPanelLoading,
  }) async {
    final state = _panelStates[PanelKind.tasks]!;
    final currentData = state.data;
    final currentTasks = currentData?['tasks'] is List
        ? (currentData!['tasks'] as List)
        : const <dynamic>[];
    final currentOffset = _readInt(currentData?['nextOffset'], fallback: 0);
    final offset = reset ? 0 : currentOffset;

    if (showPanelLoading) {
      setState(() {
        state.loading = true;
        state.error = null;
      });
    }

    try {
      final payload = await widget.api.fetchTasks(
        widget.accessToken,
        limit: _kTasksPageSize,
        offset: offset,
        search: _tasksQuery,
        status: _tasksStatusFilter == 'all' ? null : _tasksStatusFilter,
        sortBy: _tasksSortBy,
        sortDir: _tasksSortDir,
      );

      if (!mounted) return;
      setState(() {
        state.loading = false;
        state.error = null;
        _panelUpdatedAt[PanelKind.tasks] = DateTime.now();
        if (reset || currentData == null) {
          state.data = payload;
          return;
        }

        final nextTasksRaw = payload['tasks'] is List
            ? (payload['tasks'] as List)
            : const <dynamic>[];
        final mergedTasks = <dynamic>[
          ...currentTasks,
          ...nextTasksRaw,
        ];

        final merged = Map<String, dynamic>.from(payload);
        merged['tasks'] = mergedTasks;
        state.data = merged;
      });
    } catch (error) {
      final message =
          error is ApiException ? error.message : 'Failed to load tasks.';
      if (!mounted) return;
      setState(() {
        state.loading = false;
        state.error = message;
      });
      _toast(message);
    }
  }

  void _onTasksQueryChanged(String value) {
    final next = value.trim();
    if (_tasksQuery == next) return;
    setState(() => _tasksQuery = next);
    _tasksDebounceTimer?.cancel();
    _tasksDebounceTimer = Timer(const Duration(milliseconds: 300), () {
      if (!mounted) return;
      unawaited(_loadTasksPage(reset: true, showPanelLoading: true));
    });
  }

  void _onExecutionsQueryChanged(String value) {
    final next = value.trim();
    if (_executionsQuery == next) return;
    setState(() => _executionsQuery = next);
    _executionsDebounceTimer?.cancel();
    _executionsDebounceTimer = Timer(const Duration(milliseconds: 220), () {
      if (!mounted) return;
      unawaited(_loadExecutionsPage(reset: true, showPanelLoading: true));
    });
  }

  Future<void> _exportTasksCsv() async {
    final i18n = _i18n(context);
    try {
      final csv =
          await widget.api.exportTasksCsv(widget.accessToken, limit: 5000);
      await Clipboard.setData(ClipboardData(text: csv));
      _toast(i18n.isArabic
          ? 'تم نسخ CSV إلى الحافظة.'
          : 'CSV copied to clipboard.');
    } catch (error) {
      final message =
          error is ApiException ? error.message : 'Failed to export tasks.';
      _toast(message);
    }
  }

  Future<void> _openCreateTaskSheet() async {
    final i18n = _i18n(context);
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) {
        return TaskComposerSheet(
          api: widget.api,
          accessToken: widget.accessToken,
          i18n: i18n,
        );
      },
    );

    if (created == true) {
      await _loadPanel(PanelKind.dashboard, force: true);
      await _loadTasksPage(reset: true, showPanelLoading: true);
    }
  }

  Future<void> _openEditTaskSheet(Map<String, dynamic> task) async {
    final i18n = _i18n(context);
    final updated = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) {
        return TaskComposerSheet(
          api: widget.api,
          accessToken: widget.accessToken,
          i18n: i18n,
          initialTask: task,
        );
      },
    );

    if (updated == true) {
      await _loadPanel(PanelKind.dashboard, force: true);
      await _loadTasksPage(reset: true, showPanelLoading: true);
    }
  }

  Widget _buildMobileMenuPanel(I18n i18n) {
    final scheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Positioned.fill(
      child: Material(
        color: Color.alphaBlend(
            scheme.primary.withAlpha(isDark ? 20 : 10), scheme.surface),
        child: Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    scheme.primary
                        .withAlpha(((isDark ? 0.30 : 0.18) * 255).round()),
                    scheme.secondary
                        .withAlpha(((isDark ? 0.18 : 0.10) * 255).round()),
                    scheme.surface
                        .withAlpha(((isDark ? 0.65 : 0.92) * 255).round()),
                  ],
                ),
              ),
              child: Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(14),
                    child: Image.asset(
                      'assets/icon-192.png',
                      width: 38,
                      height: 38,
                      fit: BoxFit.cover,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      i18n.isArabic ? 'لوحة التنقل' : 'Navigation',
                      style: const TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 16,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: () => setState(() => _mobileMenuOpen = false),
                    icon: const Icon(Icons.close_rounded),
                    tooltip: i18n.isArabic ? 'إغلاق' : 'Close',
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.all(10),
                itemCount: kPanelSpecs.length,
                itemBuilder: (context, index) {
                  final panel = kPanelSpecs[index];
                  final selected = index == _selectedIndex;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: ListTile(
                      tileColor: Color.alphaBlend(
                        scheme.surface.withAlpha(isDark ? 130 : 225),
                        scheme.primary
                            .withAlpha(selected ? (isDark ? 40 : 20) : 6),
                      ),
                      leading: Icon(
                        panel.icon,
                        color: selected ? scheme.primary : null,
                      ),
                      title: Text(i18n.t(panel.labelKey, panel.fallbackLabel)),
                      subtitle: Text(
                        i18n.t(panel.captionKey, panel.fallbackCaption),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 12,
                          color: selected
                              ? scheme.primary
                              : scheme.onSurfaceVariant,
                        ),
                      ),
                      trailing: selected
                          ? Icon(
                              Icons.arrow_forward_ios_rounded,
                              size: 14,
                              color: scheme.primary,
                            )
                          : null,
                      selected: selected,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(18),
                        side: BorderSide(
                          color: selected
                              ? scheme.primary.withAlpha(isDark ? 115 : 88)
                              : scheme.outline.withAlpha(70),
                        ),
                      ),
                      selectedTileColor:
                          scheme.primary.withAlpha(isDark ? 60 : 28),
                      onTap: () => unawaited(_onPanelSelected(index)),
                    ),
                  );
                },
              ),
            ),
            const Divider(height: 1),
            ListTile(
              leading: const Icon(Icons.person_rounded),
              title: Text(i18n.t('settings.profile', 'Profile')),
              onTap: () => _openProfilePanel(closeDrawer: true),
            ),
            ListTile(
              leading: const Icon(Icons.logout_rounded),
              title: Text(i18n.t('common.signOut', 'Sign out')),
              onTap: () async {
                setState(() => _mobileMenuOpen = false);
                await widget.onSignOut();
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRail(I18n i18n) {
    final collapsed = widget.appState.sidebarCollapsed;
    final scheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Padding(
      padding: const EdgeInsets.fromLTRB(10, 0, 8, 12),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOutCubic,
        width: collapsed ? 94 : 234,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          border:
              Border.all(color: scheme.outline.withAlpha(isDark ? 104 : 116)),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color.alphaBlend(
                scheme.primary.withAlpha(isDark ? 20 : 10),
                scheme.surface.withAlpha(isDark ? 164 : 226),
              ),
              Color.alphaBlend(
                scheme.secondary.withAlpha(isDark ? 16 : 8),
                scheme.surface.withAlpha(isDark ? 146 : 214),
              ),
            ],
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withAlpha(isDark ? 54 : 18),
              blurRadius: 20,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: NavigationRail(
            backgroundColor: Colors.transparent,
            selectedIndex: _selectedIndex,
            extended: !collapsed,
            minWidth: 74,
            minExtendedWidth: 216,
            useIndicator: true,
            indicatorColor: scheme.primary.withAlpha(isDark ? 62 : 34),
            selectedIconTheme: IconThemeData(color: scheme.primary, size: 20),
            unselectedIconTheme: IconThemeData(
              color: scheme.onSurfaceVariant,
              size: 19,
            ),
            selectedLabelTextStyle: TextStyle(
              color: scheme.primary,
              fontWeight: FontWeight.w800,
            ),
            unselectedLabelTextStyle: TextStyle(
              color: scheme.onSurfaceVariant,
              fontWeight: FontWeight.w700,
            ),
            labelType: collapsed
                ? NavigationRailLabelType.selected
                : NavigationRailLabelType.none,
            leading: Padding(
              padding: const EdgeInsets.fromLTRB(10, 10, 10, 6),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(14),
                      color: scheme.surface.withAlpha(132),
                      border: Border.all(color: scheme.outline.withAlpha(84)),
                    ),
                    child: IconButton(
                      tooltip:
                          collapsed ? 'Expand sidebar' : 'Collapse sidebar',
                      onPressed: () => unawaited(_toggleSidebar(wide: true)),
                      icon: Icon(
                        collapsed
                            ? Icons.menu_open_rounded
                            : Icons.menu_rounded,
                      ),
                    ),
                  ),
                  if (!collapsed) ...[
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: Image.asset(
                            'assets/icon-192.png',
                            width: 24,
                            height: 24,
                            fit: BoxFit.cover,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'SocialFlow',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            trailing: Padding(
              padding: const EdgeInsets.only(bottom: 12, left: 8, right: 8),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (collapsed) ...[
                    IconButton(
                      tooltip: i18n.t('settings.profile', 'Profile'),
                      onPressed: () => _openProfilePanel(closeDrawer: false),
                      icon: const Icon(Icons.person_rounded),
                    ),
                    IconButton(
                      tooltip: i18n.t('common.signOut', 'Sign out'),
                      onPressed: () async {
                        await widget.onSignOut();
                      },
                      icon: const Icon(Icons.logout_rounded),
                    ),
                  ] else ...[
                    SizedBox(
                      width: 168,
                      child: OutlinedButton.icon(
                        onPressed: () => _openProfilePanel(closeDrawer: false),
                        icon: const Icon(Icons.person_rounded),
                        label: Text(i18n.t('settings.profile', 'Profile')),
                      ),
                    ),
                    const SizedBox(height: 8),
                    SizedBox(
                      width: 168,
                      child: OutlinedButton.icon(
                        onPressed: () async {
                          await widget.onSignOut();
                        },
                        icon: const Icon(Icons.logout_rounded),
                        label: Text(i18n.t('common.signOut', 'Sign out')),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            onDestinationSelected: (index) =>
                unawaited(_onPanelSelected(index)),
            destinations: kPanelSpecs
                .map(
                  (panel) => NavigationRailDestination(
                    icon: Icon(panel.icon),
                    selectedIcon: Icon(panel.icon),
                    label: Text(i18n.t(panel.labelKey, panel.fallbackLabel)),
                  ),
                )
                .toList(),
          ),
        ),
      ),
    );
  }

  Widget _skeletonBlock({
    required BuildContext context,
    double height = 16,
    double? width,
  }) {
    final scheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      height: height,
      width: width,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: scheme.outline.withAlpha(((isDark ? 0.30 : 0.20) * 255).round()),
      ),
    );
  }

  Widget _buildPanelLoadingSkeleton(PanelKind kind) {
    int cardCount = 4;
    switch (kind) {
      case PanelKind.dashboard:
        cardCount = 6;
        break;
      case PanelKind.tasks:
      case PanelKind.accounts:
      case PanelKind.executions:
        cardCount = 5;
        break;
      case PanelKind.analytics:
      case PanelKind.settings:
        cardCount = 4;
        break;
    }

    return CustomScrollView(
      physics:
          const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.all(SfTokens.pagePadding),
          sliver: SliverToBoxAdapter(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 1120),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _skeletonBlock(context: context, height: 28, width: 220),
                    const SizedBox(height: 10),
                    _skeletonBlock(context: context, height: 14, width: 340),
                    const SizedBox(height: 20),
                    ...List.generate(cardCount, (index) {
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 14),
                        child: SfPanelCard(
                          padding: const EdgeInsets.all(18),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _skeletonBlock(
                                  context: context, height: 16, width: 170),
                              const SizedBox(height: 10),
                              _skeletonBlock(context: context, height: 14),
                              const SizedBox(height: 8),
                              _skeletonBlock(
                                  context: context, height: 14, width: 240),
                            ],
                          ),
                        ),
                      );
                    }),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPanelFrame({
    required PanelKind kind,
    required I18n i18n,
    required Widget Function(Map<String, dynamic> data) builder,
  }) {
    final panelState = _panelStates[kind]!;

    if (panelState.loading && panelState.data == null) {
      return _buildPanelLoadingSkeleton(kind);
    }

    if (panelState.error != null && panelState.data == null) {
      return Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 520),
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.error_outline_rounded,
                    size: 42,
                    color: Colors.redAccent,
                  ),
                  const SizedBox(height: 10),
                  Text(panelState.error!, textAlign: TextAlign.center),
                  const SizedBox(height: 12),
                  FilledButton.icon(
                    onPressed: () => unawaited(_loadPanel(kind, force: true)),
                    icon: const Icon(Icons.refresh_rounded),
                    label: Text(i18n.t('common.retry', 'Retry')),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    final data = panelState.data ?? <String, dynamic>{};

    return RefreshIndicator(
      onRefresh: () {
        if (kind == PanelKind.tasks)
          return _loadTasksPage(reset: true, showPanelLoading: true);
        if (kind == PanelKind.executions) {
          return _loadExecutionsPage(reset: true, showPanelLoading: true);
        }
        if (kind == PanelKind.analytics) return _loadPanel(kind, force: true);
        return _loadPanel(kind, force: true);
      },
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(
            parent: BouncingScrollPhysics()),
        slivers: [
          SliverPadding(
            padding: const EdgeInsets.all(SfTokens.pagePadding),
            sliver: SliverToBoxAdapter(
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 1120),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (panelState.loading) ...[
                        const LinearProgressIndicator(),
                        const SizedBox(height: 12),
                      ],
                      builder(data),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDashboard(Map<String, dynamic> data) {
    final i18n = _i18n(context);
    final stats = data['stats'] is Map<String, dynamic>
        ? data['stats'] as Map<String, dynamic>
        : <String, dynamic>{};
    final recentTasks = data['recentTasks'] is List
        ? (data['recentTasks'] as List)
        : const <dynamic>[];
    final recentExecutions = data['recentExecutions'] is List
        ? (data['recentExecutions'] as List)
        : const <dynamic>[];
    final topTaskStats = data['topTaskStats'] is List
        ? (data['topTaskStats'] as List)
        : const <dynamic>[];
    final taskBreakdown = data['taskBreakdown'] is Map<String, dynamic>
        ? data['taskBreakdown'] as Map<String, dynamic>
        : <String, dynamic>{};
    final accountBreakdown = data['accountBreakdown'] is Map<String, dynamic>
        ? data['accountBreakdown'] as Map<String, dynamic>
        : <String, dynamic>{};
    final health = data['health'] is Map<String, dynamic>
        ? data['health'] as Map<String, dynamic>
        : <String, dynamic>{};
    final accountsById = data['accountsById'] is Map<String, dynamic>
        ? data['accountsById'] as Map<String, dynamic>
        : <String, dynamic>{};

    final totalTasks = _readInt(stats['totalTasks'], fallback: 0);
    final totalAccounts = _readInt(stats['totalAccounts'], fallback: 0);
    final totalExecutions = _readInt(stats['totalExecutions'], fallback: 0);
    final isEmptyWorkspace =
        totalTasks == 0 && totalAccounts == 0 && totalExecutions == 0;

    final activeTasks = _readInt(stats['activeTasksCount'], fallback: 0);
    final pausedTasks = _readInt(stats['pausedTasksCount'], fallback: 0);
    final errorTasks = _readInt(stats['errorTasksCount'], fallback: 0);
    final successRate = _readInt(stats['executionSuccessRate'], fallback: 0);
    final hasAuthWarnings = health['hasAuthWarnings'] == true;

    final platformBreakdown = (() {
      final byPlatform = accountBreakdown['byPlatform'];
      if (byPlatform is! Map) return const <MapEntry<String, int>>[];
      final entries = <MapEntry<String, int>>[];
      for (final entry in byPlatform.entries) {
        final key = entry.key?.toString() ?? '';
        final rawCount = entry.value;
        final count = rawCount is num
            ? rawCount.toInt()
            : int.tryParse(rawCount?.toString() ?? '0') ?? 0;
        if (key.trim().isEmpty) continue;
        entries.add(MapEntry<String, int>(key, count));
      }
      entries.sort((a, b) => b.value.compareTo(a.value));
      return entries;
    })();

    Widget pill(String text, {Color? bg, Color? fg, IconData? icon}) {
      final colorScheme = Theme.of(context).colorScheme;
      final resolvedBg =
          bg ?? colorScheme.primary.withAlpha((0.10 * 255).round());
      final resolvedFg = fg ?? colorScheme.primary;

      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: resolvedBg,
          border: Border.all(color: resolvedFg.withAlpha((0.25 * 255).round())),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 14, color: resolvedFg),
              const SizedBox(width: 6),
            ],
            Text(
              text,
              style: TextStyle(
                color: resolvedFg,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      );
    }

    Widget sectionTitle(
      String title, {
      VoidCallback? onViewAll,
      IconData? icon,
    }) {
      final scheme = Theme.of(context).colorScheme;
      return Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Row(
              children: [
                if (icon != null) ...[
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      color: scheme.primary.withAlpha((0.10 * 255).round()),
                      border: Border.all(
                          color:
                              scheme.primary.withAlpha((0.26 * 255).round())),
                    ),
                    child: Icon(icon, size: 18, color: scheme.primary),
                  ),
                  const SizedBox(width: 10),
                ],
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      height: 1.1,
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (onViewAll != null) ...[
            const SizedBox(width: 8),
            TextButton.icon(
              onPressed: onViewAll,
              icon: const Icon(Icons.arrow_forward_rounded, size: 16),
              label: Text(i18n.t('dashboard.viewAll', 'View all')),
            ),
          ],
        ],
      );
    }

    Widget frostedBlock({
      required Widget child,
      EdgeInsetsGeometry padding = const EdgeInsets.all(12),
      Color? borderColor,
    }) {
      final scheme = Theme.of(context).colorScheme;
      final resolvedBorder = borderColor ?? scheme.outline;
      return Container(
        padding: padding,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              scheme.surface.withAlpha((0.62 * 255).round()),
              scheme.surface.withAlpha((0.44 * 255).round()),
            ],
          ),
          border:
              Border.all(color: resolvedBorder.withAlpha((0.24 * 255).round())),
          boxShadow: [
            BoxShadow(
              blurRadius: 16,
              spreadRadius: 0,
              offset: const Offset(0, 7),
              color: Colors.black.withAlpha((0.04 * 255).round()),
            ),
          ],
        ),
        child: child,
      );
    }

    Widget statGrid() {
      final tiles = <Widget>[
        SfKpiTile(
          label: i18n.t('dashboard.kpi.totalTasks', 'Total tasks'),
          value: '$totalTasks',
          icon: Icons.task_rounded,
        ),
        SfKpiTile(
          label: i18n.t('dashboard.kpi.activeTasks', 'Active tasks'),
          value: '$activeTasks',
          icon: Icons.play_circle_fill_rounded,
          tone: Theme.of(context).colorScheme.primary,
        ),
        SfKpiTile(
          label:
              i18n.t('dashboard.kpi.connectedAccounts', 'Connected accounts'),
          value: '$totalAccounts',
          icon: Icons.groups_rounded,
          tone: Theme.of(context).colorScheme.secondary,
        ),
        SfKpiTile(
          label: i18n.t('dashboard.kpi.executionSuccess', 'Execution success'),
          value: '$successRate%',
          icon: Icons.query_stats_rounded,
          tone: Colors.green.shade700,
        ),
      ];

      return LayoutBuilder(
        builder: (context, constraints) {
          const gap = 12.0;
          final maxWidth =
              constraints.maxWidth.isFinite ? constraints.maxWidth : 1120.0;
          final columns = maxWidth >= 1160
              ? 4
              : maxWidth >= 760
                  ? 2
                  : 1;
          final baseWidth = columns == 1
              ? maxWidth
              : (maxWidth - (columns - 1) * gap) / columns;
          final tileWidth = columns == 1
              ? maxWidth
              : (baseWidth < 250 ? 250 : baseWidth).toDouble();

          return Wrap(
            spacing: gap,
            runSpacing: gap,
            children: [
              for (final tile in tiles) SizedBox(width: tileWidth, child: tile),
            ],
          );
        },
      );
    }

    Widget dashboardHeader() {
      final colorScheme = Theme.of(context).colorScheme;
      return SfPanelCard(
        padding: const EdgeInsets.all(18),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final wide = constraints.maxWidth >= 880;

            Widget heroMain = Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                pill(
                  i18n.t('dashboard.liveOps', 'Live Operations'),
                  icon: Icons.bolt_rounded,
                ),
                const SizedBox(height: 10),
                Text(
                  i18n.t('dashboard.title', 'SocialFlow Dashboard'),
                  style: const TextStyle(
                      fontSize: 28, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 8),
                Text(
                  i18n.t(
                    'dashboard.subtitle',
                    'Unified control center for tasks, accounts, executions, and operational health.',
                  ),
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    pill(
                        '$activeTasks ${i18n.t('dashboard.kpi.active', 'active')}'),
                    pill(
                      '$pausedTasks ${i18n.t('dashboard.kpi.paused', 'paused')}',
                      bg: colorScheme.secondary.withAlpha((0.16 * 255).round()),
                      fg: colorScheme.secondary,
                    ),
                    pill(
                      '$errorTasks ${i18n.t('dashboard.kpi.errors', 'errors')}',
                      bg: colorScheme.error.withAlpha((0.12 * 255).round()),
                      fg: colorScheme.error,
                    ),
                    pill(
                        '$successRate% ${i18n.t('dashboard.kpi.successRate', 'success rate')}'),
                    if (hasAuthWarnings)
                      pill(
                        i18n.t('dashboard.kpi.oauthAttention',
                            'OAuth attention needed'),
                        bg: Colors.orange.shade700
                            .withAlpha((0.18 * 255).round()),
                        fg: Colors.orange.shade700,
                        icon: Icons.shield_rounded,
                      ),
                  ],
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    OutlinedButton.icon(
                      onPressed: () => unawaited(
                          _loadPanel(PanelKind.dashboard, force: true)),
                      icon: const Icon(Icons.refresh_rounded),
                      label: Text(i18n.t('common.refresh', 'Refresh')),
                    ),
                    OutlinedButton.icon(
                      onPressed: () => unawaited(_onPanelSelected(kPanelSpecs
                          .indexWhere((p) => p.kind == PanelKind.accounts))),
                      icon: const Icon(Icons.groups_rounded),
                      label: Text(i18n.t('dashboard.actions.connectAccount',
                          'Connect Account')),
                    ),
                    FilledButton.icon(
                      onPressed: () async => _openCreateTaskSheet(),
                      icon: const Icon(Icons.add_rounded),
                      label: Text(i18n.t(
                          'dashboard.actions.createTask', 'Create New Task')),
                    ),
                  ],
                ),
              ],
            );

            Widget liveSummary = Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    colorScheme.primary.withAlpha((0.22 * 255).round()),
                    colorScheme.secondary.withAlpha((0.16 * 255).round()),
                  ],
                ),
                border: Border.all(
                  color: colorScheme.primary.withAlpha((0.34 * 255).round()),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    i18n.t('dashboard.liveSummary', 'Live summary'),
                    style: const TextStyle(
                        fontSize: 12, fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '$totalExecutions',
                              style: const TextStyle(
                                  fontSize: 26,
                                  fontWeight: FontWeight.w900,
                                  height: 1),
                            ),
                            Text(
                              i18n.t('dashboard.kpi.totalExecutions',
                                  'Total executions'),
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
                        ),
                      ),
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: colorScheme.primary
                              .withAlpha((0.18 * 255).round()),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(Icons.multiline_chart_rounded,
                            color: colorScheme.primary),
                      ),
                    ],
                  ),
                ],
              ),
            );

            if (!wide) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  heroMain,
                  const SizedBox(height: 12),
                  liveSummary,
                ],
              );
            }

            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(flex: 8, child: heroMain),
                const SizedBox(width: 14),
                Expanded(flex: 4, child: liveSummary),
              ],
            );
          },
        ),
      );
    }

    String normalizeTaskStatus(String raw) {
      final value = raw.trim().toLowerCase();
      if (value == 'active' || value == 'enabled' || value == 'running')
        return 'active';
      if (value == 'paused' || value == 'inactive' || value == 'disabled')
        return 'paused';
      if (value == 'completed' || value == 'done' || value == 'success')
        return 'completed';
      if (value == 'error' || value == 'failed' || value == 'failure')
        return 'error';
      return 'paused';
    }

    String statusLabel(String normalized) {
      if (normalized == 'active') return i18n.t('status.active', 'Active');
      if (normalized == 'paused') return i18n.t('status.paused', 'Paused');
      if (normalized == 'completed')
        return i18n.t('status.completed', 'Completed');
      return i18n.t('status.error', 'Error');
    }

    Color statusColor(String normalized) {
      final scheme = Theme.of(context).colorScheme;
      if (normalized == 'active') return scheme.primary;
      if (normalized == 'paused') return scheme.secondary;
      if (normalized == 'completed') return Colors.green.shade700;
      return scheme.error;
    }

    String relativeTime(dynamic value) {
      if (value == null) return i18n.t('dashboard.never', 'Never');
      DateTime? date;
      if (value is DateTime) {
        date = value;
      } else {
        date = DateTime.tryParse(value.toString());
      }
      if (date == null) return i18n.t('dashboard.never', 'Never');

      final delta = DateTime.now().difference(date);
      if (delta.inSeconds < 60) return i18n.t('dashboard.justNow', 'Just now');
      if (delta.inMinutes < 60) {
        if (i18n.isArabic) return 'قبل ${delta.inMinutes}د';
        return '${delta.inMinutes}m ago';
      }
      if (delta.inHours < 24) {
        if (i18n.isArabic) return 'قبل ${delta.inHours}س';
        return '${delta.inHours}h ago';
      }
      final days = delta.inDays;
      if (days < 7) {
        if (i18n.isArabic) return 'قبل ${days}ي';
        return '${days}d ago';
      }
      return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
    }

    List<String> uniquePlatforms(List<dynamic> accountIds) {
      final seen = <String>{};
      for (final rawId in accountIds) {
        final id = rawId?.toString() ?? '';
        if (id.isEmpty) continue;
        final account = accountsById[id];
        if (account is Map) {
          final platform = account['platformId']?.toString() ?? '';
          if (platform.trim().isNotEmpty) seen.add(platform);
        }
      }
      return seen.toList();
    }

    Widget platformChip(String platformId, int? count) {
      final theme = Theme.of(context);
      final brandColor = platformBrandColor(
        platformId,
        scheme: theme.colorScheme,
        isDark: theme.brightness == Brightness.dark,
      );
      final icon = platformBrandIcon(platformId);

      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          border: Border.all(
            color: brandColor.withAlpha((0.36 * 255).round()),
          ),
          color: brandColor.withAlpha((0.10 * 255).round()),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: brandColor),
            const SizedBox(width: 8),
            Text(
              count == null ? platformId : '$platformId $count',
              style: TextStyle(fontWeight: FontWeight.w700, color: brandColor),
            ),
          ],
        ),
      );
    }

    Future<void> toggleTask(Map<String, dynamic> task) async {
      final id = task['id']?.toString() ?? '';
      if (id.isEmpty) return;
      if (_taskActionState.containsKey(id)) return;

      final previous = normalizeTaskStatus(task['status']?.toString() ?? '');
      final next = previous == 'active' ? 'paused' : 'active';

      setState(() {
        _taskActionState[id] = 'toggle';
        final dash = _panelStates[PanelKind.dashboard]!;
        final current = dash.data;
        if (current == null) return;
        final cloned = Map<String, dynamic>.from(current);
        final list = cloned['recentTasks'];
        if (list is List) {
          cloned['recentTasks'] = list.map((raw) {
            final item = raw is Map<String, dynamic>
                ? Map<String, dynamic>.from(raw)
                : Map<String, dynamic>.from(raw as Map);
            if (item['id']?.toString() == id) {
              item['status'] = next;
            }
            return item;
          }).toList();
        }
        dash.data = cloned;
      });

      try {
        await widget.api.updateTask(
          widget.accessToken,
          id,
          body: <String, dynamic>{'status': next},
        );
        _toast(
          next == 'active'
              ? i18n.t('dashboard.toast.taskEnabled', 'Task enabled')
              : i18n.t('dashboard.toast.taskPaused', 'Task paused'),
        );
        await _loadPanel(PanelKind.dashboard, force: true);
      } catch (error) {
        setState(() {
          final dash = _panelStates[PanelKind.dashboard]!;
          final current = dash.data;
          if (current == null) return;
          final cloned = Map<String, dynamic>.from(current);
          final list = cloned['recentTasks'];
          if (list is List) {
            cloned['recentTasks'] = list.map((raw) {
              final item = raw is Map<String, dynamic>
                  ? Map<String, dynamic>.from(raw)
                  : Map<String, dynamic>.from(raw as Map);
              if (item['id']?.toString() == id) {
                item['status'] = previous;
              }
              return item;
            }).toList();
          }
          dash.data = cloned;
        });
        final message = error is ApiException
            ? error.message
            : i18n.t(
                'dashboard.toast.taskUpdateFailed', 'Failed to update task');
        _toast(message);
      } finally {
        if (!mounted) return;
        setState(() {
          _taskActionState.remove(id);
        });
      }
    }

    Future<void> runTask(Map<String, dynamic> task) async {
      final id = task['id']?.toString() ?? '';
      if (id.isEmpty) return;
      if (_taskActionState.containsKey(id)) return;
      setState(() {
        _taskActionState[id] = 'run';
      });

      try {
        await widget.api.runTask(widget.accessToken, id);
        _toast(i18n.t('dashboard.toast.taskQueued', 'Task run queued'));
        await _loadPanel(PanelKind.dashboard, force: true);
      } catch (error) {
        final message = error is ApiException
            ? error.message
            : i18n.t('dashboard.toast.taskRunFailed', 'Failed to run task');
        _toast(message);
      } finally {
        if (!mounted) return;
        setState(() {
          _taskActionState.remove(id);
        });
      }
    }

    Widget recentAutomationsCard() {
      return SfPanelCard(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            sectionTitle(
              i18n.t(
                  'dashboard.section.recentAutomations', 'Recent Automations'),
              icon: Icons.auto_awesome_rounded,
              onViewAll: () => unawaited(_onPanelSelected(
                  kPanelSpecs.indexWhere((p) => p.kind == PanelKind.tasks))),
            ),
            const SizedBox(height: 10),
            if (recentTasks.isEmpty)
              frostedBlock(
                child: Text(i18n.t('dashboard.noTasks', 'No tasks yet.')),
              )
            else
              ...recentTasks.take(6).map((raw) {
                final task = raw is Map<String, dynamic>
                    ? Map<String, dynamic>.from(raw)
                    : Map<String, dynamic>.from(raw as Map);
                final id = task['id']?.toString() ?? '';
                final normalized =
                    normalizeTaskStatus(task['status']?.toString() ?? '');
                final busy = _taskActionState.containsKey(id);

                final sources = task['sourceAccounts'] is List
                    ? (task['sourceAccounts'] as List)
                    : const <dynamic>[];
                final targets = task['targetAccounts'] is List
                    ? (task['targetAccounts'] as List)
                    : const <dynamic>[];

                final sourcePlatforms = uniquePlatforms(sources);
                final targetPlatforms = uniquePlatforms(targets);

                final pillColor = statusColor(normalized);
                final scheme = Theme.of(context).colorScheme;

                return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: frostedBlock(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Wrap(
                                    spacing: 8,
                                    runSpacing: 8,
                                    crossAxisAlignment:
                                        WrapCrossAlignment.center,
                                    children: [
                                      Text(
                                        task['name']?.toString() ??
                                            'Unnamed task',
                                        style: const TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.w900,
                                        ),
                                      ),
                                      SfBadge(
                                        statusLabel(normalized),
                                        tone: pillColor,
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    '${i18n.t('dashboard.lastRun', 'Last run')}: ${relativeTime(task['lastExecuted'])}',
                                    style:
                                        Theme.of(context).textTheme.bodySmall,
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 10),
                            Wrap(
                              spacing: 6,
                              children: [
                                IconButton(
                                  onPressed: busy
                                      ? null
                                      : () => unawaited(toggleTask(task)),
                                  tooltip: normalized == 'active'
                                      ? i18n.t(
                                          'dashboard.task.pause', 'Pause task')
                                      : i18n.t('dashboard.task.enable',
                                          'Enable task'),
                                  icon: Icon(
                                    normalized == 'active'
                                        ? Icons.pause_circle_filled_rounded
                                        : Icons.play_circle_fill_rounded,
                                  ),
                                ),
                                IconButton(
                                  onPressed: busy
                                      ? null
                                      : () => unawaited(runTask(task)),
                                  tooltip: i18n.t(
                                      'dashboard.task.runNow', 'Run task now'),
                                  icon: const Icon(Icons.bolt_rounded),
                                ),
                                IconButton(
                                  onPressed: () {
                                    unawaited(_openEditTaskSheet(task));
                                  },
                                  tooltip: i18n.t(
                                      'dashboard.task.edit', 'Edit task'),
                                  icon: const Icon(Icons.open_in_new_rounded),
                                ),
                              ],
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        frostedBlock(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 8),
                          borderColor: scheme.outline.withAlpha(90),
                          child: Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              if (sourcePlatforms.isEmpty)
                                Text(
                                  i18n.t(
                                      'dashboard.task.noSource', 'No source'),
                                  style: Theme.of(context).textTheme.bodySmall,
                                )
                              else
                                ...sourcePlatforms
                                    .map((p) => platformChip(p, null)),
                              Text(
                                '→',
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                              if (targetPlatforms.isEmpty)
                                Text(
                                  i18n.t(
                                      'dashboard.task.noTarget', 'No target'),
                                  style: Theme.of(context).textTheme.bodySmall,
                                )
                              else
                                ...targetPlatforms
                                    .map((p) => platformChip(p, null)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }),
          ],
        ),
      );
    }

    Widget systemHealthCard() {
      final scheme = Theme.of(context).colorScheme;
      final inactiveAccounts = _readInt(stats['inactiveAccounts'], fallback: 0);
      final activeAccounts = _readInt(stats['activeAccounts'], fallback: 0);

      int td(String key) => _readInt(taskBreakdown[key], fallback: 0);

      return SfPanelCard(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            sectionTitle(
              i18n.t('dashboard.section.systemHealth', 'System Health'),
              icon: Icons.health_and_safety_rounded,
            ),
            const SizedBox(height: 10),
            frostedBlock(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    i18n.t('dashboard.health.taskHealth', 'Task health'),
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      pill('Active ${td('active')}', fg: scheme.primary),
                      pill('Paused ${td('paused')}',
                          fg: scheme.secondary,
                          bg: scheme.secondary.withAlpha((0.16 * 255).round())),
                      pill('Errors ${td('error')}',
                          fg: scheme.error,
                          bg: scheme.error.withAlpha((0.12 * 255).round())),
                      pill('Done ${td('completed')}',
                          fg: Colors.green.shade700,
                          bg: Colors.green.shade700
                              .withAlpha((0.14 * 255).round())),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            frostedBlock(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        i18n.t('dashboard.health.accountReliability',
                            'Account reliability'),
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      Icon(
                        hasAuthWarnings
                            ? Icons.shield_rounded
                            : Icons.check_circle_rounded,
                        size: 16,
                        color:
                            hasAuthWarnings ? scheme.secondary : scheme.primary,
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    '$activeAccounts active / $totalAccounts total',
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    inactiveAccounts > 0
                        ? '$inactiveAccounts ${i18n.t('dashboard.health.authIssues', 'account(s) need re-authentication.')}'
                        : i18n.t('dashboard.health.noAuthIssues',
                            'No authentication issues detected.'),
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            frostedBlock(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    i18n.t(
                        'dashboard.health.platformsInUse', 'Platforms in use'),
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 10),
                  if (platformBreakdown.isEmpty)
                    Text(i18n.t('dashboard.health.noPlatforms',
                        'No connected platforms.'))
                  else
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: platformBreakdown
                          .map((entry) => platformChip(entry.key, entry.value))
                          .toList(),
                    ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    Widget recentExecutionsCard() {
      final scheme = Theme.of(context).colorScheme;
      return SfPanelCard(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            sectionTitle(
              i18n.t('dashboard.section.recentExecutions', 'Recent Executions'),
              icon: Icons.history_rounded,
              onViewAll: () => unawaited(_onPanelSelected(kPanelSpecs
                  .indexWhere((p) => p.kind == PanelKind.executions))),
            ),
            const SizedBox(height: 10),
            if (recentExecutions.isEmpty)
              frostedBlock(
                child: Text(
                    i18n.t('dashboard.noExecutions', 'No executions yet.')),
              )
            else
              ...recentExecutions.take(7).map((raw) {
                final execution = raw is Map<String, dynamic>
                    ? Map<String, dynamic>.from(raw)
                    : Map<String, dynamic>.from(raw as Map);
                final status = execution['status']?.toString() ?? 'pending';
                final normalized = status.trim().toLowerCase();
                final color = normalized == 'success'
                    ? scheme.primary
                    : normalized == 'failed'
                        ? scheme.error
                        : scheme.secondary;
                final content =
                    (execution['originalContent']?.toString() ?? '').trim();
                final preview = content.isEmpty ? 'No text content' : content;

                return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: frostedBlock(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                execution['taskName']?.toString() ??
                                    'Task execution',
                                style: const TextStyle(
                                    fontWeight: FontWeight.w900),
                              ),
                            ),
                            SfBadge(status, tone: color),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          '${execution['sourceAccountName'] ?? 'Unknown source'} → ${execution['targetAccountName'] ?? 'Unknown target'}',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        const SizedBox(height: 6),
                        Text(
                          preview,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            const Icon(Icons.access_time_rounded, size: 14),
                            const SizedBox(width: 6),
                            Text(
                              relativeTime(execution['executedAt']),
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              }),
          ],
        ),
      );
    }

    Widget topTasksCard() {
      final scheme = Theme.of(context).colorScheme;
      return SfPanelCard(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            sectionTitle(
              i18n.t('dashboard.section.topTasks', 'Top Performing Tasks'),
              icon: Icons.emoji_events_rounded,
            ),
            const SizedBox(height: 10),
            if (topTaskStats.isEmpty)
              frostedBlock(
                child: Text(i18n.t('dashboard.noPerformance',
                    'Performance data will appear after executions run.')),
              )
            else
              ...topTaskStats.take(6).map((raw) {
                final item = raw is Map<String, dynamic>
                    ? Map<String, dynamic>.from(raw)
                    : Map<String, dynamic>.from(raw as Map);
                final rate = _readDouble(item['successRate'], fallback: 0);
                final color = rate >= 90
                    ? scheme.primary
                    : rate >= 70
                        ? scheme.secondary
                        : scheme.error;

                return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: frostedBlock(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                item['taskName']?.toString() ?? 'Task',
                                style: const TextStyle(
                                    fontWeight: FontWeight.w900),
                              ),
                            ),
                            SfBadge('${rate.toStringAsFixed(0)}%', tone: color),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          '${item['totalExecutions'] ?? 0} runs • ${item['successful'] ?? 0} success • ${item['failed'] ?? 0} failed',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                );
              }),
          ],
        ),
      );
    }

    Widget emptyWorkspaceCard() {
      return SfPanelCard(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Text(
              i18n.t('dashboard.empty.title', 'Workspace is ready'),
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              i18n.t(
                'dashboard.empty.subtitle',
                'Connect your first account and create your first automation to see live dashboard insights.',
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              alignment: WrapAlignment.center,
              children: [
                OutlinedButton(
                  onPressed: () => unawaited(_onPanelSelected(kPanelSpecs
                      .indexWhere((p) => p.kind == PanelKind.accounts))),
                  child: Text(
                      i18n.t('dashboard.empty.connect', 'Connect Account')),
                ),
                FilledButton(
                  onPressed: () => unawaited(_onPanelSelected(kPanelSpecs
                      .indexWhere((p) => p.kind == PanelKind.tasks))),
                  child: Text(
                      i18n.t('dashboard.empty.create', 'Create First Task')),
                ),
              ],
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        dashboardHeader(),
        const SizedBox(height: 14),
        statGrid(),
        const SizedBox(height: 14),
        if (isEmptyWorkspace)
          emptyWorkspaceCard()
        else ...[
          LayoutBuilder(
            builder: (context, constraints) {
              final wide = constraints.maxWidth >= 1100;
              if (!wide) {
                return Column(
                  children: [
                    recentAutomationsCard(),
                    const SizedBox(height: 14),
                    systemHealthCard(),
                  ],
                );
              }
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(flex: 1, child: recentAutomationsCard()),
                  const SizedBox(width: 14),
                  Expanded(flex: 1, child: systemHealthCard()),
                ],
              );
            },
          ),
          const SizedBox(height: 14),
          LayoutBuilder(
            builder: (context, constraints) {
              final wide = constraints.maxWidth >= 1100;
              if (!wide) {
                return Column(
                  children: [
                    recentExecutionsCard(),
                    const SizedBox(height: 14),
                    topTasksCard(),
                  ],
                );
              }
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(flex: 1, child: recentExecutionsCard()),
                  const SizedBox(width: 14),
                  Expanded(flex: 1, child: topTasksCard()),
                ],
              );
            },
          ),
        ],
      ],
    );
  }

  Widget _buildTasks(Map<String, dynamic> data) {
    final i18n = _i18n(context);
    final scheme = Theme.of(context).colorScheme;

    final rawTasks =
        data['tasks'] is List ? (data['tasks'] as List) : const <dynamic>[];
    final rawAccounts = data['accountsById'] is Map
        ? (data['accountsById'] as Map)
        : const <dynamic, dynamic>{};

    String normalizeTaskStatus(String raw) {
      final value = raw.trim().toLowerCase();
      if (value == 'active' || value == 'enabled' || value == 'running')
        return 'active';
      if (value == 'paused' || value == 'inactive' || value == 'disabled')
        return 'paused';
      if (value == 'completed' || value == 'done' || value == 'success')
        return 'completed';
      if (value == 'error' || value == 'failed' || value == 'failure')
        return 'error';
      return 'paused';
    }

    String statusLabel(String normalized) {
      if (normalized == 'active') return i18n.t('status.active', 'Active');
      if (normalized == 'paused') return i18n.t('status.paused', 'Paused');
      if (normalized == 'completed')
        return i18n.t('status.completed', 'Completed');
      return i18n.t('status.error', 'Error');
    }

    Color statusTone(String normalized) {
      if (normalized == 'active') return scheme.primary;
      if (normalized == 'paused') return scheme.secondary;
      if (normalized == 'completed') return Colors.green.shade700;
      return scheme.error;
    }

    int successRate(dynamic executionCount, dynamic failureCount) {
      final total = _readInt(executionCount, fallback: 0);
      final failed = _readInt(failureCount, fallback: 0);
      if (total <= 0) return 100;
      final successful = (total - failed).clamp(0, total);
      return ((successful / total) * 100).round();
    }

    DateTime? parseLastRun(Map<String, dynamic> task) {
      final value =
          task['lastExecuted'] ?? task['lastExecutedAt'] ?? task['lastRunAt'];
      if (value == null) return null;
      if (value is DateTime) return value;
      return DateTime.tryParse(value.toString());
    }

    String relativeLastRun(Map<String, dynamic> task) {
      final date = parseLastRun(task);
      if (date == null) return i18n.t('dashboard.never', 'Never');
      final delta = DateTime.now().difference(date);
      if (delta.inSeconds < 60) return i18n.t('dashboard.justNow', 'Just now');
      if (delta.inMinutes < 60) return '${delta.inMinutes}m ago';
      if (delta.inHours < 24) return '${delta.inHours}h ago';
      final days = delta.inDays;
      if (days < 7) return '${days}d ago';
      return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
    }

    bool taskHasAuthWarning(Map<String, dynamic> task) {
      final ids = <dynamic>[
        ...(task['sourceAccounts'] is List
            ? (task['sourceAccounts'] as List)
            : const <dynamic>[]),
        ...(task['targetAccounts'] is List
            ? (task['targetAccounts'] as List)
            : const <dynamic>[]),
      ];
      for (final rawId in ids) {
        final id = rawId?.toString() ?? '';
        if (id.isEmpty) continue;
        final rawAccount = rawAccounts[id];
        if (rawAccount is Map) {
          if (rawAccount['isActive'] == false) return true;
        }
      }
      return false;
    }

    List<String> uniquePlatformsForTask(Map<String, dynamic> task) {
      final seen = <String>{};
      final ids = <dynamic>[
        ...(task['sourceAccounts'] is List
            ? (task['sourceAccounts'] as List)
            : const <dynamic>[]),
        ...(task['targetAccounts'] is List
            ? (task['targetAccounts'] as List)
            : const <dynamic>[]),
      ];
      for (final rawId in ids) {
        final id = rawId?.toString() ?? '';
        if (id.isEmpty) continue;
        final rawAccount = rawAccounts[id];
        if (rawAccount is Map) {
          final platform = rawAccount['platformId']?.toString() ?? '';
          if (platform.trim().isNotEmpty) seen.add(platform);
        }
      }
      return seen.toList();
    }

    String platformLabel(String platformId) {
      final normalized = platformId.trim().toLowerCase();
      if (normalized == 'twitter') return 'X';
      if (normalized.isEmpty) return platformId;
      return platformId[0].toUpperCase() + platformId.substring(1);
    }

    Widget badge(String text, {required Color tone, IconData? icon}) {
      return SfBadge(text, tone: tone, icon: icon);
    }

    Widget platformBadge(String platformId) {
      final theme = Theme.of(context);
      final brandColor = platformBrandColor(
        platformId,
        scheme: theme.colorScheme,
        isDark: theme.brightness == Brightness.dark,
      );
      return Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: brandColor.withAlpha((0.12 * 255).round()),
          border: Border.all(color: brandColor.withAlpha((0.42 * 255).round())),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(platformBrandIcon(platformId), size: 18, color: brandColor),
      );
    }

    Widget frostedStrip({
      required Widget child,
      EdgeInsetsGeometry padding = const EdgeInsets.all(10),
    }) {
      return Container(
        padding: padding,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              scheme.surface.withAlpha((0.62 * 255).round()),
              scheme.surface.withAlpha((0.46 * 255).round()),
            ],
          ),
          border:
              Border.all(color: scheme.outline.withAlpha((0.22 * 255).round())),
        ),
        child: child,
      );
    }

    Future<void> toggleTaskStatus(Map<String, dynamic> task) async {
      final id = task['id']?.toString() ?? '';
      if (id.isEmpty) return;
      if (_taskActionState.containsKey(id)) return;

      final previous = normalizeTaskStatus(task['status']?.toString() ?? '');
      final next = previous == 'active' ? 'paused' : 'active';

      void applyStatus(String status) {
        final panel = _panelStates[PanelKind.tasks]!;
        final current = panel.data;
        if (current == null) return;
        final cloned = Map<String, dynamic>.from(current);
        final list = cloned['tasks'];
        if (list is List) {
          cloned['tasks'] = list.map((raw) {
            final item = raw is Map<String, dynamic>
                ? Map<String, dynamic>.from(raw)
                : Map<String, dynamic>.from(raw as Map);
            if (item['id']?.toString() == id) {
              item['status'] = status;
            }
            return item;
          }).toList();
        }
        panel.data = cloned;
      }

      setState(() {
        _taskActionState[id] = 'toggle';
        applyStatus(next);
      });

      try {
        await widget.api.updateTask(
          widget.accessToken,
          id,
          body: <String, dynamic>{'status': next},
        );
        _toast(next == 'active' ? 'Task enabled' : 'Task paused');
        await _loadPanel(PanelKind.tasks, force: true);
        await _loadPanel(PanelKind.dashboard, force: true);
      } catch (error) {
        setState(() => applyStatus(previous));
        final message =
            error is ApiException ? error.message : 'Failed to update task.';
        _toast(message);
      } finally {
        if (!mounted) return;
        setState(() {
          _taskActionState.remove(id);
        });
      }
    }

    Future<void> deleteTask(Map<String, dynamic> task) async {
      final id = task['id']?.toString() ?? '';
      if (id.isEmpty) return;
      if (_taskActionState.containsKey(id)) return;

      final accepted = await showDialog<bool>(
        context: context,
        builder: (context) {
          return AlertDialog(
            title: const Text('Delete task?'),
            content:
                const Text('This action is permanent and cannot be undone.'),
            actions: [
              TextButton(
                  onPressed: () => Navigator.of(context).pop(false),
                  child: const Text('Cancel')),
              FilledButton(
                onPressed: () => Navigator.of(context).pop(true),
                style: FilledButton.styleFrom(backgroundColor: scheme.error),
                child: const Text('Delete'),
              ),
            ],
          );
        },
      );
      if (accepted != true) return;

      setState(() {
        _taskActionState[id] = 'delete';
        final panel = _panelStates[PanelKind.tasks]!;
        final current = panel.data;
        if (current == null) return;
        final cloned = Map<String, dynamic>.from(current);
        final list = cloned['tasks'];
        if (list is List) {
          cloned['tasks'] = list.where((raw) {
            final item =
                raw is Map ? raw : Map<String, dynamic>.from(raw as Map);
            return item['id']?.toString() != id;
          }).toList();
        }
        panel.data = cloned;
      });

      try {
        await widget.api.deleteTask(widget.accessToken, id);
        _toast('Task deleted');
        await _loadPanel(PanelKind.tasks, force: true);
        await _loadPanel(PanelKind.dashboard, force: true);
      } catch (error) {
        final message =
            error is ApiException ? error.message : 'Failed to delete task.';
        _toast(message);
        await _loadPanel(PanelKind.tasks, force: true);
      } finally {
        if (!mounted) return;
        setState(() {
          _taskActionState.remove(id);
        });
      }
    }

    Future<void> duplicateTask(Map<String, dynamic> task) async {
      final id = task['id']?.toString() ?? '';
      if (id.isEmpty) return;
      if (_taskActionState.containsKey(id)) return;

      final sourceIds = task['sourceAccounts'] is List
          ? (task['sourceAccounts'] as List)
              .map((e) => e?.toString() ?? '')
              .where((e) => e.trim().isNotEmpty)
              .toList()
          : <String>[];
      final targetIds = task['targetAccounts'] is List
          ? (task['targetAccounts'] as List)
              .map((e) => e?.toString() ?? '')
              .where((e) => e.trim().isNotEmpty)
              .toList()
          : <String>[];
      final name = (task['name']?.toString() ?? '').trim();
      final copyName = name.isEmpty ? 'Task (Copy)' : '$name (Copy)';

      final body = <String, dynamic>{
        'name': copyName,
        'description': task['description']?.toString() ?? '',
        'status': 'paused',
        'contentType': task['contentType']?.toString() ?? 'text',
        'content': task['content'] ?? '',
        'sourceAccounts': sourceIds,
        'targetAccounts': targetIds,
      };

      setState(() {
        _taskActionState[id] = 'duplicate';
      });
      try {
        await widget.api.createTask(widget.accessToken, body: body);
        _toast(i18n.isArabic ? 'تم نسخ المهمة.' : 'Task duplicated');
        await _loadTasksPage(reset: true, showPanelLoading: true);
        await _loadPanel(PanelKind.dashboard, force: true);
      } catch (error) {
        final message =
            error is ApiException ? error.message : 'Failed to duplicate task.';
        _toast(message);
      } finally {
        if (!mounted) return;
        setState(() {
          _taskActionState.remove(id);
        });
      }
    }

    final tasks = rawTasks
        .map((raw) => raw is Map<String, dynamic>
            ? raw
            : Map<String, dynamic>.from(raw as Map))
        .toList();

    final availablePlatforms = <String>{
      for (final task in tasks) ...uniquePlatformsForTask(task),
    }.toList()
      ..sort();

    bool matchesPlatform(Map<String, dynamic> task) {
      if (_tasksPlatformFilter == 'all') return true;
      final platforms =
          uniquePlatformsForTask(task).map((p) => p.toLowerCase()).toList();
      return platforms.contains(_tasksPlatformFilter.toLowerCase());
    }

    bool matchesLastRun(Map<String, dynamic> task) {
      if (_tasksLastRunFilter == 'all') return true;
      final date = parseLastRun(task);
      if (_tasksLastRunFilter == 'never') return date == null;
      if (date == null) return false;
      final now = DateTime.now();
      final delta = now.difference(date);
      if (_tasksLastRunFilter == '24h') return delta.inHours <= 24;
      if (_tasksLastRunFilter == '7d') return delta.inDays <= 7;
      return true;
    }

    bool matchesIssue(Map<String, dynamic> task) {
      if (_tasksIssueFilter == 'all') return true;
      final normalized = normalizeTaskStatus(task['status']?.toString() ?? '');
      if (_tasksIssueFilter == 'errors') return normalized == 'error';
      if (_tasksIssueFilter == 'warnings') return taskHasAuthWarning(task);
      return true;
    }

    final filtered = tasks.where((task) {
      return matchesPlatform(task) &&
          matchesLastRun(task) &&
          matchesIssue(task);
    }).toList();

    final activeCount = filtered
        .where((t) =>
            normalizeTaskStatus(t['status']?.toString() ?? '') == 'active')
        .length;
    final pausedCount = filtered
        .where((t) =>
            normalizeTaskStatus(t['status']?.toString() ?? '') == 'paused')
        .length;
    final errorCount = filtered
        .where((t) =>
            normalizeTaskStatus(t['status']?.toString() ?? '') == 'error')
        .length;

    final hasMore = data['hasMore'] == true;
    final hasActiveTaskFilters = _tasksQuery.isNotEmpty ||
        _tasksStatusFilter != 'all' ||
        _tasksPlatformFilter != 'all' ||
        _tasksLastRunFilter != 'all' ||
        _tasksIssueFilter != 'all' ||
        _tasksSortBy != 'createdAt' ||
        _tasksSortDir != 'desc';

    String shortenLabel(String value, {int max = 18}) {
      final v = value.trim();
      if (v.length <= max) return v;
      return '${v.substring(0, max)}...';
    }

    void clearAllTaskFilters() {
      setState(() {
        _tasksQuery = '';
        _tasksSearchController.text = '';
        _tasksStatusFilter = 'all';
        _tasksPlatformFilter = 'all';
        _tasksLastRunFilter = 'all';
        _tasksIssueFilter = 'all';
        _tasksSortBy = 'createdAt';
        _tasksSortDir = 'desc';
      });
      unawaited(_loadTasksPage(reset: true, showPanelLoading: true));
    }

    void clearTaskFilter(String key) {
      bool requiresReload = false;
      setState(() {
        if (key == 'query') {
          _tasksQuery = '';
          _tasksSearchController.text = '';
          requiresReload = true;
          return;
        }
        if (key == 'status') {
          _tasksStatusFilter = 'all';
          requiresReload = true;
          return;
        }
        if (key == 'platform') {
          _tasksPlatformFilter = 'all';
          return;
        }
        if (key == 'lastRun') {
          _tasksLastRunFilter = 'all';
          return;
        }
        if (key == 'issue') {
          _tasksIssueFilter = 'all';
          return;
        }
        if (key == 'sortBy') {
          _tasksSortBy = 'createdAt';
          requiresReload = true;
          return;
        }
        if (key == 'sortDir') {
          _tasksSortDir = 'desc';
          requiresReload = true;
        }
      });
      if (requiresReload) {
        unawaited(_loadTasksPage(reset: true, showPanelLoading: true));
      }
    }

    Widget tasksKpiGrid() {
      final width = MediaQuery.sizeOf(context).width;
      final columns = width >= 1320
          ? 4
          : width >= 980
              ? 3
              : width >= 680
                  ? 2
                  : 1;
      final aspectRatio = width >= 1320
          ? 2.9
          : width >= 980
              ? 2.55
              : width >= 680
                  ? 2.3
                  : 3.0;
      final totalVisible = filtered.length;

      return GridView.count(
        crossAxisCount: columns,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: aspectRatio,
        children: [
          SfKpiTile(
            label: i18n.isArabic ? 'المهام الظاهرة' : 'Visible Tasks',
            value: '$totalVisible',
            icon: Icons.view_agenda_rounded,
            tone: scheme.primary,
          ),
          SfKpiTile(
            label: i18n.isArabic ? 'نشطة' : 'Active',
            value: '$activeCount',
            icon: Icons.play_circle_filled_rounded,
            tone: scheme.primary,
          ),
          SfKpiTile(
            label: i18n.isArabic ? 'متوقفة' : 'Paused',
            value: '$pausedCount',
            icon: Icons.pause_circle_filled_rounded,
            tone: scheme.secondary,
          ),
          SfKpiTile(
            label: i18n.isArabic ? 'تحتاج تدخل' : 'Need Attention',
            value: '$errorCount',
            icon: Icons.error_rounded,
            tone: scheme.error,
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SfPanelCard(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              badge(
                i18n.isArabic ? 'أتمتة' : 'Automation Pipelines',
                tone: scheme.primary,
                icon: Icons.auto_awesome_rounded,
              ),
              const SizedBox(height: 10),
              Text(
                i18n.isArabic ? 'مهامي' : 'My Tasks',
                style:
                    const TextStyle(fontSize: 28, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 6),
              Text(
                i18n.isArabic
                    ? 'إدارة ومراقبة مهام الأتمتة الخاصة بك.'
                    : 'Manage and monitor your automation tasks.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  badge('$activeCount active', tone: scheme.primary),
                  badge('$pausedCount paused', tone: scheme.secondary),
                  badge('$errorCount failed', tone: scheme.error),
                  badge('${filtered.length} tasks', tone: scheme.onSurface),
                ],
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  OutlinedButton.icon(
                    onPressed: _exportTasksCsv,
                    icon: const Icon(Icons.download_rounded),
                    label: Text(i18n.isArabic ? 'تصدير CSV' : 'Export CSV'),
                  ),
                  FilledButton.icon(
                    onPressed: () => unawaited(_openCreateTaskSheet()),
                    icon: const Icon(Icons.add_rounded),
                    label:
                        Text(i18n.isArabic ? 'إنشاء مهمة' : 'Create New Task'),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        tasksKpiGrid(),
        const SizedBox(height: 14),
        SfPanelCard(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      i18n.isArabic ? 'بحث وفلاتر' : 'Task Search & Filters',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                  if (hasActiveTaskFilters)
                    OutlinedButton.icon(
                      onPressed: clearAllTaskFilters,
                      icon: const Icon(Icons.filter_alt_off_rounded),
                      label: Text(i18n.isArabic ? 'مسح الكل' : 'Clear All'),
                    ),
                ],
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _tasksSearchController,
                decoration: InputDecoration(
                  prefixIcon: const Icon(Icons.search_rounded),
                  hintText: i18n.isArabic
                      ? 'ابحث بالاسم أو الوصف...'
                      : 'Search by name or description...',
                  border: const OutlineInputBorder(),
                ),
                onChanged: _onTasksQueryChanged,
              ),
              const SizedBox(height: 12),
              LayoutBuilder(
                builder: (context, constraints) {
                  final wide = constraints.maxWidth >= 900;
                  final rowChildren = <Widget>[
                    DropdownButtonFormField<String>(
                      initialValue: _tasksStatusFilter,
                      decoration: InputDecoration(
                        labelText: i18n.isArabic ? 'الحالة' : 'Status',
                        prefixIcon: const Icon(Icons.filter_alt_rounded),
                      ),
                      items: const [
                        DropdownMenuItem(
                            value: 'all', child: Text('All statuses')),
                        DropdownMenuItem(
                            value: 'active', child: Text('Active')),
                        DropdownMenuItem(
                            value: 'paused', child: Text('Paused')),
                        DropdownMenuItem(
                            value: 'completed', child: Text('Completed')),
                        DropdownMenuItem(value: 'error', child: Text('Error')),
                      ],
                      onChanged: (value) {
                        if (value == null) return;
                        if (_tasksStatusFilter == value) return;
                        setState(() => _tasksStatusFilter = value);
                        unawaited(_loadTasksPage(
                            reset: true, showPanelLoading: true));
                      },
                    ),
                    DropdownButtonFormField<String>(
                      initialValue: _tasksPlatformFilter,
                      decoration: InputDecoration(
                        labelText: i18n.isArabic ? 'المنصة' : 'Platform',
                        prefixIcon: const Icon(Icons.public_rounded),
                      ),
                      items: [
                        const DropdownMenuItem(
                            value: 'all', child: Text('All platforms')),
                        ...availablePlatforms.map(
                          (p) => DropdownMenuItem(
                              value: p, child: Text(platformLabel(p))),
                        ),
                      ],
                      onChanged: (value) {
                        if (value == null) return;
                        setState(() => _tasksPlatformFilter = value);
                      },
                    ),
                    DropdownButtonFormField<String>(
                      initialValue: _tasksLastRunFilter,
                      decoration: InputDecoration(
                        labelText: i18n.isArabic ? 'آخر تشغيل' : 'Last run',
                        prefixIcon: const Icon(Icons.schedule_rounded),
                      ),
                      items: const [
                        DropdownMenuItem(value: 'all', child: Text('Any run')),
                        DropdownMenuItem(value: '24h', child: Text('Last 24h')),
                        DropdownMenuItem(value: '7d', child: Text('Last 7d')),
                        DropdownMenuItem(
                            value: 'never', child: Text('Never ran')),
                      ],
                      onChanged: (value) {
                        if (value == null) return;
                        setState(() => _tasksLastRunFilter = value);
                      },
                    ),
                    DropdownButtonFormField<String>(
                      initialValue: _tasksIssueFilter,
                      decoration: InputDecoration(
                        labelText: i18n.isArabic ? 'مشاكل' : 'Issues',
                        prefixIcon: const Icon(Icons.report_problem_rounded),
                      ),
                      items: const [
                        DropdownMenuItem(
                            value: 'all', child: Text('All tasks')),
                        DropdownMenuItem(
                            value: 'errors', child: Text('Errors only')),
                        DropdownMenuItem(
                            value: 'warnings', child: Text('Auth warnings')),
                      ],
                      onChanged: (value) {
                        if (value == null) return;
                        setState(() => _tasksIssueFilter = value);
                      },
                    ),
                    DropdownButtonFormField<String>(
                      initialValue: _tasksSortBy,
                      decoration: InputDecoration(
                        labelText: i18n.isArabic ? 'ترتيب حسب' : 'Sort by',
                        prefixIcon: const Icon(Icons.sort_rounded),
                      ),
                      items: const [
                        DropdownMenuItem(
                            value: 'createdAt', child: Text('Created')),
                        DropdownMenuItem(
                            value: 'status', child: Text('Status')),
                        DropdownMenuItem(value: 'name', child: Text('Name')),
                      ],
                      onChanged: (value) {
                        if (value == null) return;
                        if (_tasksSortBy == value) return;
                        setState(() => _tasksSortBy = value);
                        unawaited(_loadTasksPage(
                            reset: true, showPanelLoading: true));
                      },
                    ),
                    DropdownButtonFormField<String>(
                      initialValue: _tasksSortDir,
                      decoration: InputDecoration(
                        labelText: i18n.isArabic ? 'الاتجاه' : 'Direction',
                        prefixIcon: const Icon(Icons.swap_vert_rounded),
                      ),
                      items: const [
                        DropdownMenuItem(value: 'desc', child: Text('Desc')),
                        DropdownMenuItem(value: 'asc', child: Text('Asc')),
                      ],
                      onChanged: (value) {
                        if (value == null) return;
                        if (_tasksSortDir == value) return;
                        setState(() => _tasksSortDir = value);
                        unawaited(_loadTasksPage(
                            reset: true, showPanelLoading: true));
                      },
                    ),
                  ];

                  if (!wide) {
                    return Column(
                      children: [
                        for (final child in rowChildren) ...[
                          child,
                          const SizedBox(height: 10),
                        ],
                      ],
                    );
                  }

                  return Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    children: rowChildren
                        .map((w) => SizedBox(width: 280, child: w))
                        .toList(),
                  );
                },
              ),
              const SizedBox(height: 8),
              if (hasActiveTaskFilters)
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    if (_tasksQuery.isNotEmpty)
                      InputChip(
                        label: Text('Search: ${shortenLabel(_tasksQuery)}'),
                        onDeleted: () => clearTaskFilter('query'),
                      ),
                    if (_tasksStatusFilter != 'all')
                      InputChip(
                        label:
                            Text('Status: ${statusLabel(_tasksStatusFilter)}'),
                        onDeleted: () => clearTaskFilter('status'),
                      ),
                    if (_tasksPlatformFilter != 'all')
                      InputChip(
                        label: Text(
                            'Platform: ${platformLabel(_tasksPlatformFilter)}'),
                        onDeleted: () => clearTaskFilter('platform'),
                      ),
                    if (_tasksLastRunFilter != 'all')
                      InputChip(
                        label: Text(
                            'Last run: ${_tasksLastRunFilter.toUpperCase()}'),
                        onDeleted: () => clearTaskFilter('lastRun'),
                      ),
                    if (_tasksIssueFilter != 'all')
                      InputChip(
                        label: Text(
                            'Issue: ${_tasksIssueFilter == 'errors' ? 'Errors' : 'Warnings'}'),
                        onDeleted: () => clearTaskFilter('issue'),
                      ),
                    if (_tasksSortBy != 'createdAt')
                      InputChip(
                        label: Text(
                            'Sort: ${_tasksSortBy == 'name' ? 'Name' : (_tasksSortBy == 'status' ? 'Status' : 'Created')}'),
                        onDeleted: () => clearTaskFilter('sortBy'),
                      ),
                    if (_tasksSortDir != 'desc')
                      InputChip(
                        label:
                            Text('Direction: ${_tasksSortDir.toUpperCase()}'),
                        onDeleted: () => clearTaskFilter('sortDir'),
                      ),
                  ],
                ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        if (filtered.isEmpty)
          SfPanelCard(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 26),
              child: Column(
                children: [
                  Icon(Icons.inbox_rounded,
                      size: 40,
                      color: scheme.onSurface.withAlpha((0.55 * 255).round())),
                  const SizedBox(height: 10),
                  Text(
                    i18n.isArabic ? 'لا توجد مهام مطابقة.' : 'No tasks found.',
                    style: const TextStyle(fontWeight: FontWeight.w900),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    i18n.isArabic
                        ? 'قم بإنشاء مهمتك الأولى للبدء.'
                        : 'Create your first task to get started.',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 12),
                  FilledButton.icon(
                    onPressed: () => unawaited(_openCreateTaskSheet()),
                    icon: const Icon(Icons.add_rounded),
                    label: Text(i18n.isArabic ? 'إنشاء مهمة' : 'Create Task'),
                  ),
                ],
              ),
            ),
          )
        else
          LayoutBuilder(
            builder: (context, constraints) {
              final wide = constraints.maxWidth >= 1100;
              final cardWidth =
                  wide ? (constraints.maxWidth - 12) / 2 : constraints.maxWidth;
              return Wrap(
                spacing: 12,
                runSpacing: 12,
                children: filtered.map((task) {
                  final id = task['id']?.toString() ?? '';
                  final busy = _taskActionState.containsKey(id);
                  final normalized =
                      normalizeTaskStatus(task['status']?.toString() ?? '');
                  final tone = statusTone(normalized);
                  final rate =
                      successRate(task['executionCount'], task['failureCount']);
                  final lastRun = relativeLastRun(task);
                  final authWarning = taskHasAuthWarning(task);

                  final sourceIds = task['sourceAccounts'] is List
                      ? (task['sourceAccounts'] as List)
                      : const <dynamic>[];
                  final targetIds = task['targetAccounts'] is List
                      ? (task['targetAccounts'] as List)
                      : const <dynamic>[];
                  final routeCount =
                      (sourceIds.isEmpty ? 1 : sourceIds.length) *
                          (targetIds.isEmpty ? 1 : targetIds.length);

                  final platforms = uniquePlatformsForTask(task);
                  final description =
                      (task['description']?.toString() ?? '').trim();
                  final lastError =
                      (task['lastError']?.toString() ?? '').trim();
                  final showErrorText = normalized == 'error';
                  final descText = showErrorText
                      ? (lastError.isEmpty
                          ? 'Error: Failed to fetch data'
                          : 'Error: $lastError')
                      : description;

                  final sourcePlatforms = <String>{};
                  for (final rawId in sourceIds) {
                    final account = rawAccounts[rawId?.toString() ?? ''];
                    if (account is Map) {
                      final pid = account['platformId']?.toString() ?? '';
                      if (pid.trim().isNotEmpty) sourcePlatforms.add(pid);
                    }
                  }
                  final targetPlatforms = <String>{};
                  for (final rawId in targetIds) {
                    final account = rawAccounts[rawId?.toString() ?? ''];
                    if (account is Map) {
                      final pid = account['platformId']?.toString() ?? '';
                      if (pid.trim().isNotEmpty) targetPlatforms.add(pid);
                    }
                  }
                  final compactActionLayout = cardWidth < 520;
                  final taskActionButtons = <Widget>[
                    IconButton(
                      onPressed:
                          busy ? null : () => unawaited(toggleTaskStatus(task)),
                      tooltip: normalized == 'active'
                          ? 'Disable task'
                          : 'Enable task',
                      icon: Icon(
                        normalized == 'active'
                            ? Icons.pause_circle_filled_rounded
                            : Icons.play_circle_fill_rounded,
                        color: normalized == 'active'
                            ? scheme.secondary
                            : scheme.primary,
                      ),
                    ),
                    IconButton(
                      onPressed: busy
                          ? null
                          : () => unawaited(_openEditTaskSheet(task)),
                      tooltip: 'Edit task',
                      icon: const Icon(Icons.edit_rounded),
                    ),
                    IconButton(
                      onPressed:
                          busy ? null : () => unawaited(duplicateTask(task)),
                      tooltip: 'Duplicate task',
                      icon: const Icon(Icons.copy_all_rounded),
                    ),
                    IconButton(
                      onPressed: busy
                          ? null
                          : () {
                              final idx = kPanelSpecs.indexWhere(
                                  (p) => p.kind == PanelKind.executions);
                              if (idx < 0) return;
                              setState(() {
                                _executionsQuery =
                                    task['name']?.toString() ?? '';
                                _executionsSearchController.text =
                                    _executionsQuery;
                                _executionsStatusFilter = 'all';
                                _executionsOffset = 0;
                                _executionsHasMore = false;
                                _selectedIndex = idx;
                              });
                              unawaited(_loadPanel(PanelKind.executions,
                                  force: true));
                            },
                      tooltip: 'View logs',
                      icon: const Icon(Icons.receipt_long_rounded),
                    ),
                    IconButton(
                      onPressed:
                          busy ? null : () => unawaited(deleteTask(task)),
                      tooltip: 'Delete task',
                      icon: Icon(Icons.delete_outline_rounded,
                          color: scheme.error),
                    ),
                  ];

                  return SizedBox(
                    width: cardWidth,
                    child: SfPanelCard(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              badge(statusLabel(normalized).toUpperCase(),
                                  tone: tone),
                              badge('Success $rate%', tone: scheme.onSurface),
                              if (authWarning)
                                badge('OAuth Warning',
                                    tone: scheme.secondary,
                                    icon: Icons.shield_rounded),
                            ],
                          ),
                          const SizedBox(height: 10),
                          if (!compactActionLayout)
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        task['name']?.toString() ?? 'Task',
                                        style: const TextStyle(
                                            fontSize: 18,
                                            fontWeight: FontWeight.w900),
                                      ),
                                      if (descText.isNotEmpty) ...[
                                        const SizedBox(height: 4),
                                        Text(
                                          descText,
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                            color: showErrorText
                                                ? scheme.error
                                                : scheme.onSurface.withAlpha(
                                                    (0.75 * 255).round()),
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: taskActionButtons,
                                ),
                              ],
                            )
                          else ...[
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  task['name']?.toString() ?? 'Task',
                                  style: const TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.w900),
                                ),
                                if (descText.isNotEmpty) ...[
                                  const SizedBox(height: 4),
                                  Text(
                                    descText,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      color: showErrorText
                                          ? scheme.error
                                          : scheme.onSurface
                                              .withAlpha((0.75 * 255).round()),
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                            const SizedBox(height: 8),
                            Wrap(
                              spacing: 2,
                              runSpacing: 2,
                              children: taskActionButtons,
                            ),
                          ],
                          const SizedBox(height: 10),
                          frostedStrip(
                            child: Row(
                              children: [
                                Expanded(
                                  child: Wrap(
                                    spacing: 6,
                                    runSpacing: 6,
                                    children: sourcePlatforms.isEmpty
                                        ? [
                                            Text(i18n.isArabic
                                                ? 'بدون مصدر'
                                                : 'No source')
                                          ]
                                        : sourcePlatforms
                                            .map((p) => platformBadge(p))
                                            .toList(),
                                  ),
                                ),
                                Padding(
                                  padding:
                                      const EdgeInsets.symmetric(horizontal: 8),
                                  child: Icon(Icons.arrow_forward_rounded,
                                      color: scheme.onSurface
                                          .withAlpha((0.55 * 255).round())),
                                ),
                                Expanded(
                                  child: Wrap(
                                    spacing: 6,
                                    runSpacing: 6,
                                    children: targetPlatforms.isEmpty
                                        ? [
                                            Text(i18n.isArabic
                                                ? 'بدون هدف'
                                                : 'No target')
                                          ]
                                        : targetPlatforms
                                            .map((p) => platformBadge(p))
                                            .toList(),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 10),
                          frostedStrip(
                            padding: const EdgeInsets.all(9),
                            child: Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                badge(
                                    'Accounts: ${sourceIds.length + targetIds.length}',
                                    tone: scheme.onSurface),
                                badge(
                                    'Transfers: ${_readInt(task['executionCount'], fallback: 0)}',
                                    tone: scheme.onSurface),
                                badge('Routes: $routeCount',
                                    tone: scheme.onSurface),
                                badge('Last run: $lastRun',
                                    tone: scheme.onSurface,
                                    icon: Icons.schedule_rounded),
                                if (platforms.isNotEmpty)
                                  badge(
                                    platforms.map(platformLabel).join(', '),
                                    tone: scheme.onSurface,
                                    icon: Icons.public_rounded,
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              );
            },
          ),
        if (hasMore) ...[
          const SizedBox(height: 14),
          Center(
            child: OutlinedButton(
              onPressed:
                  _tasksLoadingMore ? null : () => unawaited(_loadMoreTasks()),
              child: Text(_tasksLoadingMore
                  ? (i18n.isArabic ? '...جاري التحميل' : 'Loading...')
                  : (i18n.isArabic ? 'تحميل المزيد' : 'Load More')),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildAccounts(Map<String, dynamic> data) {
    final i18n = _i18n(context);
    final scheme = Theme.of(context).colorScheme;
    final accountsRaw = data['accounts'] is List
        ? (data['accounts'] as List)
        : const <dynamic>[];
    final accounts = accountsRaw
        .map((raw) => raw is Map<String, dynamic>
            ? raw
            : Map<String, dynamic>.from(raw as Map))
        .toList();

    bool matchesSearch(Map<String, dynamic> item) {
      if (_accountsQuery.isEmpty) return true;
      final query = _accountsQuery.toLowerCase();
      final name = item['accountName']?.toString().toLowerCase() ?? '';
      final username = item['accountUsername']?.toString().toLowerCase() ?? '';
      final platform = item['platformId']?.toString().toLowerCase() ?? '';
      return name.contains(query) ||
          username.contains(query) ||
          platform.contains(query);
    }

    bool matchesStatus(Map<String, dynamic> item) {
      if (_accountsStatusFilter == 'all') return true;
      final active = item['isActive'] == true;
      if (_accountsStatusFilter == 'active') return active;
      if (_accountsStatusFilter == 'inactive') return !active;
      return true;
    }

    final filtered = accounts.where((item) {
      return matchesSearch(item) && matchesStatus(item);
    }).toList();

    final total = accounts.length;
    final activeCount =
        accounts.where((item) => item['isActive'] == true).length;
    final inactiveCount = (total - activeCount).clamp(0, total);
    final hasAccountFilters =
        _accountsQuery.isNotEmpty || _accountsStatusFilter != 'all';

    final groupedByPlatform = <String, List<Map<String, dynamic>>>{};
    for (final account in filtered) {
      final platformId =
          account['platformId']?.toString().trim().toLowerCase() ?? '';
      final key = platformId.isEmpty ? 'unknown' : platformId;
      groupedByPlatform
          .putIfAbsent(key, () => <Map<String, dynamic>>[])
          .add(account);
    }
    final groupedEntries = groupedByPlatform.entries.toList()
      ..sort((a, b) => _platformLabel(a.key).compareTo(_platformLabel(b.key)));

    void clearAccountFilters() {
      setState(() {
        _accountsQuery = '';
        _accountsSearchController.text = '';
        _accountsStatusFilter = 'all';
      });
    }

    Widget frostedLine({
      required Widget child,
      EdgeInsetsGeometry padding = const EdgeInsets.all(10),
    }) {
      return Container(
        padding: padding,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              scheme.surface.withAlpha((0.62 * 255).round()),
              scheme.surface.withAlpha((0.44 * 255).round()),
            ],
          ),
          border:
              Border.all(color: scheme.outline.withAlpha((0.22 * 255).round())),
        ),
        child: child,
      );
    }

    Widget searchCard() {
      return SfPanelCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SfSectionHeader(
              title: i18n.t('accounts.title', 'Accounts'),
              subtitle: i18n.t(
                'accounts.subtitle',
                'Search, monitor connection health, and review platforms.',
              ),
              trailing: IconButton(
                tooltip: i18n.t('common.refresh', 'Refresh'),
                onPressed: () =>
                    unawaited(_loadPanel(PanelKind.accounts, force: true)),
                icon: const Icon(Icons.refresh_rounded),
              ),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                SfBadge(
                  i18n.t('accounts.kpi.total', 'Total') + ': $total',
                  tone: scheme.onSurface,
                  icon: Icons.groups_rounded,
                ),
                SfBadge(
                  i18n.t('accounts.kpi.active', 'Active') + ': $activeCount',
                  tone: Colors.green.shade700,
                  icon: Icons.check_circle_rounded,
                ),
                SfBadge(
                  i18n.t('accounts.kpi.inactive', 'Inactive') +
                      ': $inactiveCount',
                  tone: scheme.error,
                  icon: Icons.cancel_rounded,
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _accountsSearchController,
              decoration: InputDecoration(
                prefixIcon: const Icon(Icons.search_rounded),
                hintText: i18n.t(
                  'accounts.searchHint',
                  'Search by platform, name, or username',
                ),
              ),
              onChanged: (value) =>
                  setState(() => _accountsQuery = value.trim()),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                ChoiceChip(
                  label: Text(i18n.isArabic ? 'الكل' : 'All'),
                  selected: _accountsStatusFilter == 'all',
                  onSelected: (_) =>
                      setState(() => _accountsStatusFilter = 'all'),
                ),
                ChoiceChip(
                  label: Text(
                      '${i18n.t('accounts.active', 'Active')} ($activeCount)'),
                  selected: _accountsStatusFilter == 'active',
                  onSelected: (_) =>
                      setState(() => _accountsStatusFilter = 'active'),
                ),
                ChoiceChip(
                  label: Text(
                      '${i18n.t('accounts.inactive', 'Inactive')} ($inactiveCount)'),
                  selected: _accountsStatusFilter == 'inactive',
                  onSelected: (_) =>
                      setState(() => _accountsStatusFilter = 'inactive'),
                ),
                if (hasAccountFilters)
                  OutlinedButton.icon(
                    onPressed: clearAccountFilters,
                    icon: const Icon(Icons.filter_alt_off_rounded),
                    label:
                        Text(i18n.isArabic ? 'مسح الفلاتر' : 'Clear Filters'),
                  ),
              ],
            ),
          ],
        ),
      );
    }

    Widget accountTile(Map<String, dynamic> account) {
      final name = account['accountName']?.toString().trim();
      final username = account['accountUsername']?.toString().trim();
      final platformId = account['platformId']?.toString().trim() ?? '';
      final profileUrl = _resolveAccountProfileUrl(account);
      final active = account['isActive'] == true;
      final title = (name == null || name.isEmpty)
          ? i18n.t('accounts.account', 'Account')
          : name;
      final handle =
          (username == null || username.isEmpty) ? '-' : '@$username';
      final platformLabel = _platformLabel(platformId);
      final tone = active ? Colors.green.shade700 : scheme.error;
      final brandColor = _platformColor(platformId);
      final created = DateTime.tryParse(account['createdAt']?.toString() ?? '');
      final createdLabel = created == null
          ? ''
          : '${created.year}-${created.month.toString().padLeft(2, '0')}-${created.day.toString().padLeft(2, '0')}';

      return Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: SfPanelCard(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(14),
                        color: brandColor.withAlpha((0.12 * 255).round()),
                        border: Border.all(
                            color: brandColor.withAlpha((0.34 * 255).round())),
                      ),
                      child: Icon(_platformIcon(platformId), color: brandColor),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(title,
                              style:
                                  const TextStyle(fontWeight: FontWeight.w900)),
                          const SizedBox(height: 2),
                          Text('$platformLabel • $handle'),
                          if (createdLabel.isNotEmpty)
                            Text(
                              i18n.isArabic
                                  ? 'أضيف $createdLabel'
                                  : 'Added $createdLabel',
                              style: TextStyle(
                                  color: scheme.onSurfaceVariant, fontSize: 12),
                            ),
                        ],
                      ),
                    ),
                    SfBadge(
                      active
                          ? i18n.t('accounts.active', 'Active')
                          : i18n.t('accounts.inactive', 'Inactive'),
                      tone: tone,
                      icon: active ? Icons.check_rounded : Icons.close_rounded,
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                frostedLine(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                  child: Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      if (profileUrl != null)
                        OutlinedButton.icon(
                          onPressed: () =>
                              unawaited(_openAccountProfile(account)),
                          icon: const Icon(Icons.open_in_new_rounded, size: 16),
                          label: Text(
                              i18n.isArabic ? 'فتح الملف' : 'Open Profile'),
                        ),
                      if (username != null && username.isNotEmpty)
                        OutlinedButton.icon(
                          onPressed: () async {
                            await Clipboard.setData(
                                ClipboardData(text: '@$username'));
                            _toast(i18n.isArabic
                                ? 'تم نسخ اسم المستخدم.'
                                : 'Username copied');
                          },
                          icon:
                              const Icon(Icons.content_copy_rounded, size: 16),
                          label: Text(
                              i18n.isArabic ? 'نسخ المعرف' : 'Copy Handle'),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        searchCard(),
        const SizedBox(height: 14),
        if (filtered.isEmpty)
          SfEmptyState(
            icon: Icons.groups_rounded,
            title: i18n.t('accounts.empty.title', 'No accounts found'),
            subtitle: i18n.t(
              'accounts.empty.subtitle',
              'Try a different query or connect accounts from the web dashboard.',
            ),
            primary: hasAccountFilters
                ? OutlinedButton(
                    onPressed: clearAccountFilters,
                    child:
                        Text(i18n.isArabic ? 'مسح الفلاتر' : 'Clear Filters'),
                  )
                : null,
          )
        else
          ...groupedEntries.map((entry) {
            final platformId = entry.key;
            final platformAccounts = entry.value;
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      children: [
                        Icon(_platformIcon(platformId),
                            size: 18, color: _platformColor(platformId)),
                        const SizedBox(width: 8),
                        Text(
                          _platformLabel(platformId),
                          style: const TextStyle(
                              fontSize: 16, fontWeight: FontWeight.w900),
                        ),
                        const SizedBox(width: 8),
                        SfBadge(
                          '${platformAccounts.length}',
                          tone: scheme.onSurfaceVariant,
                        ),
                      ],
                    ),
                  ),
                  ...platformAccounts.take(100).map(accountTile),
                ],
              ),
            );
          }),
      ],
    );
  }

  Widget _buildExecutions(Map<String, dynamic> data) {
    final i18n = _i18n(context);
    final scheme = Theme.of(context).colorScheme;
    final panelState = _panelStates[PanelKind.executions]!;
    final showingCachedView =
        panelState.error != null && panelState.data != null;
    final executionsRaw = data['executions'] is List
        ? (data['executions'] as List)
        : const <dynamic>[];
    final executions = executionsRaw
        .map((raw) => raw is Map<String, dynamic>
            ? raw
            : Map<String, dynamic>.from(raw as Map))
        .toList();

    String normalizeStatus(String status) {
      final v = status.trim().toLowerCase();
      if (v.contains('success') ||
          v.contains('completed') ||
          v.contains('done')) {
        return 'success';
      }
      if (v.contains('fail') || v.contains('error')) return 'failed';
      if (v.contains('running') ||
          v.contains('processing') ||
          v.contains('progress')) {
        return 'running';
      }
      if (v.contains('pending') || v.contains('queued') || v.contains('wait')) {
        return 'pending';
      }
      return 'other';
    }

    final filtered = executions;
    final total = _readInt(data['total'], fallback: executions.length);
    final successCount = executions
        .where(
            (e) => normalizeStatus(e['status']?.toString() ?? '') == 'success')
        .length;
    final failedCount = executions
        .where(
            (e) => normalizeStatus(e['status']?.toString() ?? '') == 'failed')
        .length;
    final runningCount = executions
        .where(
            (e) => normalizeStatus(e['status']?.toString() ?? '') == 'running')
        .length;
    final pendingCount = executions
        .where(
            (e) => normalizeStatus(e['status']?.toString() ?? '') == 'pending')
        .length;
    final hasExecutionFilters =
        _executionsQuery.isNotEmpty || _executionsStatusFilter != 'all';
    final canLoadMore =
        !showingCachedView && (data['hasMore'] == true || _executionsHasMore);
    final nextOffset =
        _readInt(data['nextOffset'], fallback: _executionsOffset);
    final processingCount = runningCount + pendingCount;
    final successRate = total > 0 ? ((successCount / total) * 100).round() : 0;

    String statusLabel(String normalized) {
      if (normalized == 'success') return i18n.isArabic ? 'نجاح' : 'Success';
      if (normalized == 'failed') return i18n.isArabic ? 'فشل' : 'Failed';
      if (normalized == 'running')
        return i18n.isArabic ? 'قيد التشغيل' : 'Running';
      if (normalized == 'pending') return i18n.isArabic ? 'معلّق' : 'Pending';
      return i18n.isArabic ? 'أخرى' : 'Other';
    }

    Color statusTone(String normalized) {
      if (normalized == 'success') return Colors.green.shade700;
      if (normalized == 'failed') return scheme.error;
      if (normalized == 'running') return scheme.primary;
      if (normalized == 'pending') return Colors.orange.shade700;
      return scheme.onSurfaceVariant;
    }

    String formatWhen(dynamic value) {
      final raw = value?.toString().trim() ?? '';
      if (raw.isEmpty) return i18n.isArabic ? 'غير متاح' : 'Unknown time';
      final date = DateTime.tryParse(raw);
      if (date == null) return raw;
      final local = date.toLocal();
      final day =
          '${local.year}-${local.month.toString().padLeft(2, '0')}-${local.day.toString().padLeft(2, '0')}';
      final time = MaterialLocalizations.of(context).formatTimeOfDay(
        TimeOfDay.fromDateTime(local),
        alwaysUse24HourFormat: true,
      );
      return '$day $time';
    }

    String formatDuration(Map<String, dynamic> execution) {
      final ms = _readInt(execution['durationMs'], fallback: -1);
      if (ms > 0) {
        if (ms < 1000) return '${ms}ms';
        final sec = ms / 1000.0;
        if (sec < 60) return '${sec.toStringAsFixed(sec >= 10 ? 0 : 1)}s';
        final minutes = (sec / 60).floor();
        final seconds = (sec % 60).round();
        return '${minutes}m ${seconds}s';
      }
      final sec = _readDouble(execution['durationSeconds'], fallback: -1);
      if (sec > 0) {
        if (sec < 60) return '${sec.toStringAsFixed(sec >= 10 ? 0 : 1)}s';
        final minutes = (sec / 60).floor();
        final seconds = (sec % 60).round();
        return '${minutes}m ${seconds}s';
      }
      return '-';
    }

    String prettyJson(dynamic value) {
      if (value == null) return '';
      if (value is String) return value;
      try {
        return const JsonEncoder.withIndent('  ').convert(value);
      } catch (_) {
        return value.toString();
      }
    }

    Future<void> retryExecution(Map<String, dynamic> execution) async {
      final executionId = execution['id']?.toString() ?? '';
      final taskId = execution['taskId']?.toString() ?? '';
      if (taskId.trim().isEmpty) {
        _toast(i18n.isArabic
            ? 'لا يمكن إعادة المحاولة لهذا التنفيذ.'
            : 'Retry is not available for this execution.');
        return;
      }
      if (executionId.isNotEmpty &&
          _executionActionState.containsKey(executionId)) return;

      if (executionId.isNotEmpty) {
        setState(() => _executionActionState[executionId] = 'retry');
      }
      try {
        await widget.api.runTask(widget.accessToken, taskId);
        _toast(i18n.isArabic
            ? 'تمت جدولة إعادة التشغيل.'
            : 'Execution retry queued');
        await _loadPanel(PanelKind.executions, force: true);
        await _loadPanel(PanelKind.dashboard, force: true);
      } catch (error) {
        final message = error is ApiException
            ? error.message
            : 'Failed to retry execution.';
        _toast(message);
      } finally {
        if (!mounted || executionId.isEmpty) return;
        setState(() => _executionActionState.remove(executionId));
      }
    }

    Future<void> openExecutionDetails(Map<String, dynamic> execution) async {
      final statusText = execution['status']?.toString() ?? 'unknown';
      final normalized = normalizeStatus(statusText);
      final tone = statusTone(normalized);
      final taskName = (execution['taskName']?.toString() ?? '').trim();
      final sourceName =
          (execution['sourceAccountName']?.toString() ?? '').trim();
      final targetName =
          (execution['targetAccountName']?.toString() ?? '').trim();
      final sourcePlatformId = execution['sourcePlatformId']?.toString() ?? '';
      final targetPlatformId = execution['targetPlatformId']?.toString() ?? '';
      final when = formatWhen(execution['executedAt'] ??
          execution['createdAt'] ??
          execution['updatedAt']);
      final duration = formatDuration(execution);

      final responseData = execution['responseData'];
      final responseMap = responseData is Map
          ? responseData.map((k, v) => MapEntry(k.toString(), v))
          : const <String, dynamic>{};
      final payloadText = prettyJson(responseData).trim();
      final logsText = prettyJson(
        execution['logs'] ??
            responseMap['logs'] ??
            responseMap['events'] ??
            responseMap['timeline'],
      ).trim();
      final stackText = (execution['errorStack'] ??
              execution['stack'] ??
              execution['trace'] ??
              responseMap['stack'] ??
              responseMap['trace'] ??
              responseMap['errorStack'])
          .toString()
          .trim();
      final errorText = (execution['error']?.toString() ??
              execution['errorMessage']?.toString() ??
              execution['lastError']?.toString() ??
              responseMap['error']?.toString() ??
              '')
          .trim();
      final originalContent =
          (execution['originalContent']?.toString() ?? '').trim();
      final transformedContent =
          (execution['transformedContent']?.toString() ?? '').trim();

      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (context) {
          final media = MediaQuery.of(context);
          final bottomInset = media.viewInsets.bottom;
          final sheetHeight =
              (media.size.height * 0.92).clamp(420.0, 920.0).toDouble();
          return SafeArea(
            child: AnimatedPadding(
              duration: const Duration(milliseconds: 180),
              curve: Curves.easeOutCubic,
              padding: EdgeInsets.only(bottom: bottomInset),
              child: SizedBox(
                height: sheetHeight,
                child: Column(
                  children: [
                    Expanded(
                      child: SingleChildScrollView(
                        keyboardDismissBehavior:
                            ScrollViewKeyboardDismissBehavior.onDrag,
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    taskName.isEmpty
                                        ? (i18n.isArabic
                                            ? 'تفاصيل التنفيذ'
                                            : 'Execution details')
                                        : taskName,
                                    style: const TextStyle(
                                        fontSize: 20,
                                        fontWeight: FontWeight.w900),
                                  ),
                                ),
                                IconButton(
                                  tooltip: i18n.isArabic
                                      ? 'نسخ الحمولة'
                                      : 'Copy payload',
                                  onPressed: payloadText.isEmpty
                                      ? null
                                      : () async {
                                          await Clipboard.setData(
                                              ClipboardData(text: payloadText));
                                          _toast(i18n.isArabic
                                              ? 'تم نسخ الحمولة.'
                                              : 'Payload copied');
                                        },
                                  icon: const Icon(Icons.copy_all_rounded),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                SfBadge(statusLabel(normalized), tone: tone),
                                SfBadge(
                                  '${i18n.isArabic ? 'المدة' : 'Duration'}: $duration',
                                  tone: scheme.onSurfaceVariant,
                                  icon: Icons.timer_outlined,
                                ),
                                SfBadge(
                                  '${i18n.isArabic ? 'الوقت' : 'When'}: $when',
                                  tone: scheme.onSurfaceVariant,
                                  icon: Icons.schedule_rounded,
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            SfPanelCard(
                              padding: const EdgeInsets.all(14),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Container(
                                      padding: const EdgeInsets.all(10),
                                      decoration: BoxDecoration(
                                        borderRadius: BorderRadius.circular(12),
                                        border: Border.all(
                                            color: scheme.outline.withAlpha(
                                                (0.24 * 255).round())),
                                      ),
                                      child: Row(
                                        children: [
                                          Icon(_platformIcon(sourcePlatformId),
                                              size: 16,
                                              color: _platformColor(
                                                  sourcePlatformId)),
                                          const SizedBox(width: 6),
                                          Expanded(
                                            child: Text(
                                              sourceName.isEmpty
                                                  ? 'Unknown source'
                                                  : sourceName,
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                  const Padding(
                                    padding:
                                        EdgeInsets.symmetric(horizontal: 8),
                                    child: Icon(Icons.arrow_forward_rounded),
                                  ),
                                  Expanded(
                                    child: Container(
                                      padding: const EdgeInsets.all(10),
                                      decoration: BoxDecoration(
                                        borderRadius: BorderRadius.circular(12),
                                        border: Border.all(
                                            color: scheme.outline.withAlpha(
                                                (0.24 * 255).round())),
                                      ),
                                      child: Row(
                                        children: [
                                          Icon(_platformIcon(targetPlatformId),
                                              size: 16,
                                              color: _platformColor(
                                                  targetPlatformId)),
                                          const SizedBox(width: 6),
                                          Expanded(
                                            child: Text(
                                              targetName.isEmpty
                                                  ? 'Unknown target'
                                                  : targetName,
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            if (errorText.isNotEmpty) ...[
                              const SizedBox(height: 12),
                              SfPanelCard(
                                padding: const EdgeInsets.all(14),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Icon(Icons.error_outline_rounded,
                                            color: scheme.error, size: 18),
                                        const SizedBox(width: 8),
                                        Text(
                                          i18n.isArabic ? 'الخطأ' : 'Error',
                                          style: TextStyle(
                                              color: scheme.error,
                                              fontWeight: FontWeight.w900),
                                        ),
                                        const Spacer(),
                                        IconButton(
                                          tooltip: i18n.isArabic
                                              ? 'نسخ الخطأ'
                                              : 'Copy error',
                                          onPressed: () async {
                                            await Clipboard.setData(
                                                ClipboardData(text: errorText));
                                            _toast(i18n.isArabic
                                                ? 'تم نسخ الخطأ.'
                                                : 'Error copied');
                                          },
                                          icon: const Icon(
                                              Icons.content_copy_rounded,
                                              size: 18),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 8),
                                    SelectableText(errorText),
                                  ],
                                ),
                              ),
                            ],
                            if (stackText.isNotEmpty &&
                                stackText != 'null') ...[
                              const SizedBox(height: 12),
                              SfPanelCard(
                                padding: const EdgeInsets.all(14),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      i18n.isArabic
                                          ? 'التتبّع (Stack Trace)'
                                          : 'Stack trace',
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w900),
                                    ),
                                    const SizedBox(height: 8),
                                    SelectableText(
                                      stackText,
                                      style: const TextStyle(
                                          fontFamily: 'monospace',
                                          fontSize: 12),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                            if (originalContent.isNotEmpty ||
                                transformedContent.isNotEmpty) ...[
                              const SizedBox(height: 12),
                              SfPanelCard(
                                padding: const EdgeInsets.all(14),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      i18n.isArabic ? 'المحتوى' : 'Content',
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w900),
                                    ),
                                    if (originalContent.isNotEmpty) ...[
                                      const SizedBox(height: 8),
                                      Text(
                                          i18n.isArabic ? 'الأصلي' : 'Original',
                                          style: TextStyle(
                                              color: scheme.onSurfaceVariant)),
                                      const SizedBox(height: 4),
                                      SelectableText(originalContent),
                                    ],
                                    if (transformedContent.isNotEmpty) ...[
                                      const SizedBox(height: 10),
                                      Text(
                                          i18n.isArabic
                                              ? 'بعد المعالجة'
                                              : 'Transformed',
                                          style: TextStyle(
                                              color: scheme.onSurfaceVariant)),
                                      const SizedBox(height: 4),
                                      SelectableText(transformedContent),
                                    ],
                                  ],
                                ),
                              ),
                            ],
                            if (logsText.isNotEmpty && logsText != 'null') ...[
                              const SizedBox(height: 12),
                              SfPanelCard(
                                padding: const EdgeInsets.all(14),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(i18n.isArabic ? 'السجلات' : 'Logs',
                                        style: const TextStyle(
                                            fontWeight: FontWeight.w900)),
                                    const SizedBox(height: 8),
                                    SelectableText(
                                      logsText,
                                      style: const TextStyle(
                                          fontFamily: 'monospace',
                                          fontSize: 12),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                            if (payloadText.isNotEmpty) ...[
                              const SizedBox(height: 12),
                              SfPanelCard(
                                padding: const EdgeInsets.all(14),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                        i18n.isArabic
                                            ? 'الحمولة (Payload)'
                                            : 'Payload',
                                        style: const TextStyle(
                                            fontWeight: FontWeight.w900)),
                                    const SizedBox(height: 8),
                                    SelectableText(
                                      payloadText,
                                      style: const TextStyle(
                                          fontFamily: 'monospace',
                                          fontSize: 12),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                      decoration: BoxDecoration(
                        color: Color.alphaBlend(
                            scheme.primary.withAlpha(10), scheme.surface),
                        border: Border(
                          top: BorderSide(color: scheme.outline.withAlpha(82)),
                        ),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () => Navigator.of(context).maybePop(),
                              icon: const Icon(Icons.close_rounded),
                              label: Text(i18n.isArabic ? 'إغلاق' : 'Close'),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: FilledButton.icon(
                              onPressed: payloadText.isEmpty
                                  ? null
                                  : () async {
                                      await Clipboard.setData(
                                          ClipboardData(text: payloadText));
                                      _toast(i18n.isArabic
                                          ? 'تم نسخ الحمولة.'
                                          : 'Payload copied');
                                    },
                              icon: const Icon(Icons.copy_all_rounded),
                              label: Text(i18n.isArabic
                                  ? 'نسخ الحمولة'
                                  : 'Copy payload'),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      );
    }

    Future<void> copyExecutionReport(Map<String, dynamic> execution) async {
      final taskName = execution['taskName']?.toString().trim();
      final statusText = execution['status']?.toString() ?? 'unknown';
      final sourceName =
          execution['sourceAccountName']?.toString() ?? 'Unknown source';
      final targetName =
          execution['targetAccountName']?.toString() ?? 'Unknown target';
      final when = formatWhen(execution['executedAt'] ??
          execution['createdAt'] ??
          execution['updatedAt']);
      final errorText = (execution['error']?.toString() ??
              execution['errorMessage']?.toString() ??
              execution['lastError']?.toString() ??
              '')
          .trim();

      final lines = <String>[
        'Task: ${(taskName == null || taskName.isEmpty) ? 'Task execution' : taskName}',
        'Status: $statusText',
        'Route: $sourceName -> $targetName',
        'When: $when',
      ];
      if (errorText.isNotEmpty) {
        lines.add('Error: $errorText');
      }
      await Clipboard.setData(ClipboardData(text: lines.join('\n')));
      _toast(
          i18n.isArabic ? 'تم نسخ تقرير التنفيذ.' : 'Execution report copied');
    }

    void applyStatusFilter(String status) {
      if (_executionsStatusFilter == status) return;
      setState(() {
        _executionsStatusFilter = status;
      });
      unawaited(_loadExecutionsPage(reset: true, showPanelLoading: true));
    }

    void clearExecutionFilters() {
      final hadFilters = hasExecutionFilters;
      setState(() {
        _executionsQuery = '';
        _executionsSearchController.text = '';
        _executionsStatusFilter = 'all';
      });
      if (hadFilters) {
        unawaited(_loadExecutionsPage(reset: true, showPanelLoading: true));
      }
    }

    Widget frostedExecution({
      required Widget child,
      EdgeInsetsGeometry padding = const EdgeInsets.all(10),
    }) {
      return Container(
        padding: padding,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              scheme.surface.withAlpha((0.62 * 255).round()),
              scheme.surface.withAlpha((0.46 * 255).round()),
            ],
          ),
          border:
              Border.all(color: scheme.outline.withAlpha((0.22 * 255).round())),
        ),
        child: child,
      );
    }

    Widget searchCard() {
      return SfPanelCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SfSectionHeader(
              title: i18n.t('executions.title', 'Executions'),
              subtitle: i18n.t(
                'executions.subtitle',
                'Search recent runs and diagnose failures quickly.',
              ),
              trailing: IconButton(
                tooltip: i18n.t('common.refresh', 'Refresh'),
                onPressed: () =>
                    unawaited(_loadPanel(PanelKind.executions, force: true)),
                icon: const Icon(Icons.refresh_rounded),
              ),
            ),
            if (showingCachedView) ...[
              const SizedBox(height: 10),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  color: Colors.orange.withAlpha((0.12 * 255).round()),
                  border: Border.all(
                      color: Colors.orange.withAlpha((0.32 * 255).round())),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.wifi_off_rounded,
                        size: 18, color: Colors.orange),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        panelState.error ??
                            (i18n.isArabic
                                ? 'عرض آخر نسخة محفوظة.'
                                : 'Showing cached last view.'),
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 14),
            TextField(
              controller: _executionsSearchController,
              decoration: InputDecoration(
                prefixIcon: const Icon(Icons.search_rounded),
                hintText: i18n.t(
                    'executions.searchHint', 'Search by task name or status'),
              ),
              onChanged: _onExecutionsQueryChanged,
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                SfBadge('${i18n.t('executions.total', 'Total')}: $total',
                    tone: scheme.onSurface),
                ChoiceChip(
                  label: Text(i18n.isArabic ? 'الكل' : 'All'),
                  selected: _executionsStatusFilter == 'all',
                  onSelected: (_) => applyStatusFilter('all'),
                ),
                ChoiceChip(
                  label: Text('${statusLabel('success')} ($successCount)'),
                  selected: _executionsStatusFilter == 'success',
                  onSelected: (_) => applyStatusFilter('success'),
                ),
                ChoiceChip(
                  label: Text('${statusLabel('failed')} ($failedCount)'),
                  selected: _executionsStatusFilter == 'failed',
                  onSelected: (_) => applyStatusFilter('failed'),
                ),
                ChoiceChip(
                  label: Text('${statusLabel('running')} ($runningCount)'),
                  selected: _executionsStatusFilter == 'running',
                  onSelected: (_) => applyStatusFilter('running'),
                ),
                ChoiceChip(
                  label: Text('${statusLabel('pending')} ($pendingCount)'),
                  selected: _executionsStatusFilter == 'pending',
                  onSelected: (_) => applyStatusFilter('pending'),
                ),
                if (hasExecutionFilters)
                  OutlinedButton.icon(
                    onPressed: clearExecutionFilters,
                    icon: const Icon(Icons.filter_alt_off_rounded),
                    label:
                        Text(i18n.isArabic ? 'مسح الفلاتر' : 'Clear Filters'),
                  ),
              ],
            ),
          ],
        ),
      );
    }

    Widget executionsKpiGrid() {
      final width = MediaQuery.sizeOf(context).width;
      final columns = width >= 1320
          ? 5
          : width >= 980
              ? 3
              : width >= 680
                  ? 2
                  : 1;
      final aspectRatio = width >= 1320
          ? 2.9
          : width >= 980
              ? 2.45
              : width >= 680
                  ? 2.25
                  : 3.0;

      return GridView.count(
        crossAxisCount: columns,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: aspectRatio,
        children: [
          SfKpiTile(
            label: i18n.isArabic ? 'إجمالي التنفيذات' : 'Total Runs',
            value: '$total',
            icon: Icons.layers_rounded,
            tone: scheme.primary,
          ),
          SfKpiTile(
            label: i18n.isArabic ? 'ناجح' : 'Successful',
            value: '$successCount',
            icon: Icons.check_circle_rounded,
            tone: Colors.green.shade700,
          ),
          SfKpiTile(
            label: i18n.isArabic ? 'فاشل' : 'Failed',
            value: '$failedCount',
            icon: Icons.error_rounded,
            tone: scheme.error,
          ),
          SfKpiTile(
            label: i18n.isArabic ? 'قيد المعالجة' : 'Processing',
            value: '$processingCount',
            icon: Icons.autorenew_rounded,
            tone: scheme.tertiary,
          ),
          SfKpiTile(
            label: i18n.isArabic ? 'نسبة النجاح' : 'Success Rate',
            value: '$successRate%',
            icon: Icons.insights_rounded,
            tone: scheme.secondary,
          ),
        ],
      );
    }

    Widget executionTile(Map<String, dynamic> execution) {
      final executionId = execution['id']?.toString() ?? '';
      final statusText = execution['status']?.toString() ?? 'unknown';
      final normalized = normalizeStatus(statusText);
      final statusColor = statusTone(normalized);
      final taskName = execution['taskName']?.toString().trim();
      final sourceName = execution['sourceAccountName']?.toString().trim();
      final targetName = execution['targetAccountName']?.toString().trim();
      final sourcePlatformId = execution['sourcePlatformId']?.toString() ?? '';
      final targetPlatformId = execution['targetPlatformId']?.toString() ?? '';
      final when = formatWhen(execution['executedAt'] ??
          execution['createdAt'] ??
          execution['updatedAt']);
      final duration = formatDuration(execution);
      final errorText = (execution['error']?.toString() ??
              execution['errorMessage']?.toString() ??
              execution['lastError']?.toString() ??
              '')
          .trim();
      final busy = executionId.isNotEmpty &&
          _executionActionState.containsKey(executionId);
      final title = (taskName == null || taskName.isEmpty)
          ? i18n.t('executions.item', 'Task execution')
          : taskName;
      final stageText = execution['responseData'] is Map
          ? ((execution['responseData'] as Map)['stage']?.toString() ?? '')
              .trim()
          : '';
      final compactActionLayout = MediaQuery.sizeOf(context).width < 760;
      final executionActionButtons = <Widget>[
        IconButton(
          tooltip: i18n.isArabic ? 'إعادة المحاولة' : 'Retry',
          onPressed: busy ? null : () => unawaited(retryExecution(execution)),
          icon: const Icon(Icons.replay_rounded),
        ),
        IconButton(
          tooltip: i18n.isArabic ? 'عرض التفاصيل' : 'View details',
          onPressed: () => unawaited(openExecutionDetails(execution)),
          icon: const Icon(Icons.info_outline_rounded),
        ),
        IconButton(
          tooltip: i18n.isArabic ? 'نسخ التقرير' : 'Copy report',
          onPressed: () => unawaited(copyExecutionReport(execution)),
          icon: const Icon(Icons.copy_all_rounded),
        ),
      ];

      String stepState(int stepIndex) {
        if (normalized == 'success') return 'done';
        if (normalized == 'failed') {
          if (stepIndex < 2) return 'done';
          return 'failed';
        }
        if (normalized == 'running') {
          if (stepIndex == 0) return 'done';
          if (stepIndex == 1) return 'active';
          return 'pending';
        }
        if (normalized == 'pending') {
          if (stepIndex == 0) return 'active';
          return 'pending';
        }
        return stepIndex == 0 ? 'active' : 'pending';
      }

      Color stepTone(int stepIndex) {
        final state = stepState(stepIndex);
        if (state == 'done') return Colors.green.shade700;
        if (state == 'active') return scheme.primary;
        if (state == 'failed') return scheme.error;
        return scheme.outline;
      }

      Color connectorTone(int fromStepIndex) {
        final fromState = stepState(fromStepIndex);
        final toState = stepState(fromStepIndex + 1);
        if (fromState == 'failed' || toState == 'failed')
          return scheme.error.withAlpha((0.45 * 255).round());
        if (toState == 'active' || toState == 'done')
          return scheme.primary.withAlpha((0.45 * 255).round());
        return scheme.outline.withAlpha((0.32 * 255).round());
      }

      return Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: SfPanelCard(
            padding: EdgeInsets.zero,
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (!compactActionLayout)
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(14),
                            color: statusColor.withAlpha((0.12 * 255).round()),
                            border: Border.all(
                                color: statusColor
                                    .withAlpha((0.26 * 255).round())),
                          ),
                          child:
                              Icon(Icons.history_rounded, color: statusColor),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(title,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w900)),
                              const SizedBox(height: 4),
                              Wrap(
                                spacing: 8,
                                runSpacing: 8,
                                children: [
                                  SfBadge(
                                    statusLabel(normalized),
                                    tone: statusColor,
                                    icon: normalized == 'failed'
                                        ? Icons.error_outline_rounded
                                        : (normalized == 'success'
                                            ? Icons.check_circle_outline_rounded
                                            : Icons.hourglass_top_rounded),
                                  ),
                                  SfBadge(
                                    '${i18n.isArabic ? 'المدة' : 'Duration'}: $duration',
                                    tone: scheme.onSurfaceVariant,
                                    icon: Icons.timer_outlined,
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: executionActionButtons,
                        ),
                      ],
                    )
                  else ...[
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(14),
                            color: statusColor.withAlpha((0.12 * 255).round()),
                            border: Border.all(
                                color: statusColor
                                    .withAlpha((0.26 * 255).round())),
                          ),
                          child:
                              Icon(Icons.history_rounded, color: statusColor),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(title,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w900)),
                              const SizedBox(height: 4),
                              Wrap(
                                spacing: 8,
                                runSpacing: 8,
                                children: [
                                  SfBadge(
                                    statusLabel(normalized),
                                    tone: statusColor,
                                    icon: normalized == 'failed'
                                        ? Icons.error_outline_rounded
                                        : (normalized == 'success'
                                            ? Icons.check_circle_outline_rounded
                                            : Icons.hourglass_top_rounded),
                                  ),
                                  SfBadge(
                                    '${i18n.isArabic ? 'المدة' : 'Duration'}: $duration',
                                    tone: scheme.onSurfaceVariant,
                                    icon: Icons.timer_outlined,
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 2,
                      runSpacing: 2,
                      children: executionActionButtons,
                    ),
                  ],
                  const SizedBox(height: 10),
                  frostedExecution(
                    child: Column(
                      children: [
                        Row(
                          children: [
                            Icon(Icons.compare_arrows_rounded,
                                size: 16, color: scheme.onSurfaceVariant),
                            const SizedBox(width: 6),
                            Flexible(
                              child: Wrap(
                                spacing: 6,
                                runSpacing: 6,
                                crossAxisAlignment: WrapCrossAlignment.center,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 8, vertical: 5),
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(999),
                                      border: Border.all(
                                          color: scheme.outline
                                              .withAlpha((0.20 * 255).round())),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(_platformIcon(sourcePlatformId),
                                            size: 14,
                                            color: _platformColor(
                                                sourcePlatformId)),
                                        const SizedBox(width: 5),
                                        ConstrainedBox(
                                          constraints: const BoxConstraints(
                                              maxWidth: 220),
                                          child: Text(
                                            sourceName == null ||
                                                    sourceName.isEmpty
                                                ? 'Unknown source'
                                                : sourceName,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: TextStyle(
                                                color: scheme.onSurfaceVariant,
                                                fontWeight: FontWeight.w700),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Icon(Icons.arrow_forward_rounded,
                                      size: 14, color: scheme.onSurfaceVariant),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 8, vertical: 5),
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(999),
                                      border: Border.all(
                                          color: scheme.outline
                                              .withAlpha((0.20 * 255).round())),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(_platformIcon(targetPlatformId),
                                            size: 14,
                                            color: _platformColor(
                                                targetPlatformId)),
                                        const SizedBox(width: 5),
                                        ConstrainedBox(
                                          constraints: const BoxConstraints(
                                              maxWidth: 220),
                                          child: Text(
                                            targetName == null ||
                                                    targetName.isEmpty
                                                ? 'Unknown target'
                                                : targetName,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: TextStyle(
                                                color: scheme.onSurfaceVariant,
                                                fontWeight: FontWeight.w700),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Icon(Icons.schedule_rounded,
                                size: 16, color: scheme.onSurfaceVariant),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                when,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style:
                                    TextStyle(color: scheme.onSurfaceVariant),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 10),
                  frostedExecution(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              width: 16,
                              height: 16,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color:
                                    stepTone(0).withAlpha((0.14 * 255).round()),
                                border:
                                    Border.all(color: stepTone(0), width: 1.4),
                              ),
                            ),
                            Expanded(
                              child:
                                  Container(height: 2, color: connectorTone(0)),
                            ),
                            Container(
                              width: 16,
                              height: 16,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color:
                                    stepTone(1).withAlpha((0.14 * 255).round()),
                                border:
                                    Border.all(color: stepTone(1), width: 1.4),
                              ),
                            ),
                            Expanded(
                              child:
                                  Container(height: 2, color: connectorTone(1)),
                            ),
                            Container(
                              width: 16,
                              height: 16,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color:
                                    stepTone(2).withAlpha((0.14 * 255).round()),
                                border:
                                    Border.all(color: stepTone(2), width: 1.4),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                i18n.isArabic ? 'مجدول' : 'Queued',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: stepTone(0),
                                ),
                              ),
                            ),
                            Expanded(
                              child: Text(
                                i18n.isArabic ? 'جارٍ التنفيذ' : 'Running',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: stepTone(1),
                                ),
                              ),
                            ),
                            Expanded(
                              child: Text(
                                i18n.isArabic ? 'مكتمل' : 'Done',
                                textAlign: TextAlign.end,
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: stepTone(2),
                                ),
                              ),
                            ),
                          ],
                        ),
                        if (stageText.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(
                            '${i18n.isArabic ? 'المرحلة' : 'Stage'}: $stageText',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                                color: scheme.onSurfaceVariant, fontSize: 12),
                          ),
                        ],
                      ],
                    ),
                  ),
                  if (errorText.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    frostedExecution(
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(2),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(Icons.error_outline_rounded,
                                color: scheme.error, size: 18),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                errorText,
                                maxLines: 3,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                    color: scheme.error,
                                    fontWeight: FontWeight.w700),
                              ),
                            ),
                            IconButton(
                              tooltip:
                                  i18n.isArabic ? 'نسخ الخطأ' : 'Copy error',
                              onPressed: () async {
                                await Clipboard.setData(
                                    ClipboardData(text: errorText));
                                _toast(i18n.isArabic
                                    ? 'تم نسخ الخطأ.'
                                    : 'Error copied');
                              },
                              icon: const Icon(Icons.content_copy_rounded,
                                  size: 18),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        searchCard(),
        const SizedBox(height: 12),
        executionsKpiGrid(),
        const SizedBox(height: 14),
        if (filtered.isEmpty)
          SfEmptyState(
            icon: Icons.history_rounded,
            title: i18n.t('executions.empty.title', 'No executions found'),
            subtitle: i18n.t(
              'executions.empty.subtitle',
              'Once tasks run, execution history will appear here.',
            ),
            primary: hasExecutionFilters
                ? OutlinedButton(
                    onPressed: clearExecutionFilters,
                    child:
                        Text(i18n.isArabic ? 'مسح الفلاتر' : 'Clear Filters'),
                  )
                : null,
          )
        else
          ...filtered.map(executionTile),
        if (canLoadMore) ...[
          const SizedBox(height: 10),
          Align(
            alignment: Alignment.center,
            child: OutlinedButton.icon(
              onPressed: _executionsLoadingMore
                  ? null
                  : () => unawaited(_loadMoreExecutions()),
              icon: _executionsLoadingMore
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.expand_more_rounded),
              label: Text(
                _executionsLoadingMore
                    ? (i18n.isArabic ? 'جارٍ التحميل...' : 'Loading...')
                    : (i18n.isArabic
                        ? 'تحميل المزيد (${filtered.length}/$total)'
                        : 'Load more (${filtered.length}/$total)'),
              ),
            ),
          ),
          if (nextOffset > 0)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                '${i18n.isArabic ? 'الإزاحة التالية' : 'Next offset'}: $nextOffset',
                style: TextStyle(
                    color: scheme.onSurfaceVariant,
                    fontWeight: FontWeight.w700),
              ),
            ),
        ],
      ],
    );
  }

  Widget _buildAnalytics(Map<String, dynamic> data) {
    final i18n = _i18n(context);
    final scheme = Theme.of(context).colorScheme;
    final totals = data['totals'] is Map<String, dynamic>
        ? data['totals'] as Map<String, dynamic>
        : <String, dynamic>{};
    final taskStats = data['taskStats'] is List
        ? (data['taskStats'] as List)
        : const <dynamic>[];

    final totalExecutions = _readDouble(totals['executions'], fallback: 0);
    final successfulExecutions =
        _readDouble(totals['successfulExecutions'], fallback: 0);
    final successRate =
        totalExecutions > 0 ? successfulExecutions / totalExecutions : 0.0;

    final top = taskStats.take(8).map((raw) {
      final item = raw is Map<String, dynamic>
          ? raw
          : Map<String, dynamic>.from(raw as Map);
      final label = (item['taskName']?.toString() ?? '').trim();
      final v = _readDouble(item['successRate'], fallback: 0);
      return <String, dynamic>{
        'label': label.isEmpty ? i18n.t('tasks.task', 'Task') : label,
        'value': v.clamp(0.0, 100.0),
      };
    }).toList();

    final canLoadMore = data['hasMore'] == true || _analyticsHasMore;
    final nextOffset = _readInt(data['nextOffset'], fallback: _analyticsOffset);

    Future<void> exportCsv() async {
      try {
        final csv = await widget.api.exportAnalyticsCsv(widget.accessToken);
        await Clipboard.setData(ClipboardData(text: csv));
        _toast(
            i18n.isArabic ? 'تم نسخ CSV للحافظة.' : 'CSV copied to clipboard.');
      } catch (error) {
        final message = error is ApiException
            ? error.message
            : 'Failed to export analytics.';
        _toast(message);
      }
    }

    Widget analyticsSurface({
      required Widget child,
      EdgeInsetsGeometry padding = const EdgeInsets.all(12),
      Color? borderTone,
    }) {
      final tone = borderTone ?? scheme.outline;
      return Container(
        padding: padding,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              scheme.surface.withAlpha((0.62 * 255).round()),
              scheme.surface.withAlpha((0.44 * 255).round()),
            ],
          ),
          border: Border.all(color: tone.withAlpha((0.24 * 255).round())),
        ),
        child: child,
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SfPanelCard(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SfBadge(
                i18n.t('analytics.title', 'Analytics'),
                tone: scheme.primary,
                icon: Icons.insights_rounded,
              ),
              const SizedBox(height: 10),
              Text(
                i18n.t('analytics.title', 'Analytics'),
                style:
                    const TextStyle(fontSize: 28, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 6),
              Text(
                i18n.t(
                  'analytics.subtitle',
                  'Monitor task performance and execution statistics.',
                ),
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  SfBadge(
                    '${i18n.t('analytics.kpi.totalExecutions', 'Total executions')}: ${totals['executions'] ?? 0}',
                    tone: scheme.onSurface,
                    icon: Icons.sync_rounded,
                  ),
                  SfBadge(
                    '${i18n.t('analytics.kpi.successRate', 'Success rate')}: ${(successRate * 100).toStringAsFixed(2)}%',
                    tone: scheme.tertiary,
                    icon: Icons.trending_up_rounded,
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  OutlinedButton.icon(
                    onPressed: () =>
                        unawaited(_loadPanel(PanelKind.analytics, force: true)),
                    icon: const Icon(Icons.refresh_rounded),
                    label: Text(i18n.t('common.refresh', 'Refresh')),
                  ),
                  FilledButton.icon(
                    onPressed: exportCsv,
                    icon: const Icon(Icons.download_rounded),
                    label: Text(i18n.t('analytics.exportCsv', 'Export CSV')),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        LayoutBuilder(
          builder: (context, constraints) {
            const gap = 12.0;
            final maxWidth =
                constraints.maxWidth.isFinite ? constraints.maxWidth : 1120.0;
            final cols = maxWidth >= 1160
                ? 4
                : maxWidth >= 760
                    ? 2
                    : 1;
            final tileWidth = cols == 1
                ? maxWidth
                : ((maxWidth - ((cols - 1) * gap)) / cols)
                    .clamp(250, 600)
                    .toDouble();
            final tiles = <Widget>[
              SfKpiTile(
                label:
                    i18n.t('analytics.kpi.totalExecutions', 'Total executions'),
                value: '${totals['executions'] ?? 0}',
                icon: Icons.sync_rounded,
              ),
              SfKpiTile(
                label: i18n.t('analytics.kpi.successful', 'Successful'),
                value: '${totals['successfulExecutions'] ?? 0}',
                icon: Icons.check_circle_rounded,
                tone: Colors.green.shade700,
              ),
              SfKpiTile(
                label: i18n.t('analytics.kpi.failed', 'Failed'),
                value: '${totals['failedExecutions'] ?? 0}',
                icon: Icons.error_rounded,
                tone: scheme.error,
              ),
              SfKpiTile(
                label: i18n.t('analytics.kpi.successRate', 'Success rate'),
                value: '${(successRate * 100).toStringAsFixed(2)}%',
                icon: Icons.trending_up_rounded,
                tone: scheme.tertiary,
              ),
            ];
            return Wrap(
              spacing: gap,
              runSpacing: gap,
              children: tiles
                  .map((t) => SizedBox(width: tileWidth, child: t))
                  .toList(),
            );
          },
        ),
        const SizedBox(height: 14),
        SfPanelCard(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                i18n.t('analytics.chart.title', 'Success Rate by Task (Top 8)'),
                style:
                    const TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 4),
              Text(
                i18n.t('analytics.chart.subtitle',
                    'Sorted by your current ordering.'),
                style: TextStyle(
                    color: scheme.onSurfaceVariant,
                    fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 12),
              if (top.isEmpty)
                analyticsSurface(
                  child:
                      Text(i18n.t('analytics.empty', 'No analytics data yet.')),
                )
              else
                SfBarChart(
                  title: i18n.t(
                      'analytics.chart.title', 'Success Rate by Task (Top 8)'),
                  subtitle: i18n.t('analytics.chart.subtitle',
                      'Sorted by your current ordering.'),
                  values: top.map((e) => (e['value'] as double)).toList(),
                  labels: top.map((e) => (e['label'] as String)).toList(),
                  maxValue: 100,
                ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        SfPanelCard(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                i18n.t('analytics.table.title', 'Performance by Task'),
                style:
                    const TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 4),
              Text(
                i18n.t(
                  'analytics.table.subtitle',
                  'Search, sort, and review task-level execution KPIs.',
                ),
                style: TextStyle(
                    color: scheme.onSurfaceVariant,
                    fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 12),
              LayoutBuilder(
                builder: (context, constraints) {
                  final wide = constraints.maxWidth >= 760;
                  final w = wide
                      ? (constraints.maxWidth - 12) / 2
                      : constraints.maxWidth;
                  return Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    children: [
                      SizedBox(
                        width: w,
                        child: TextField(
                          controller: _analyticsSearchController,
                          decoration: InputDecoration(
                            prefixIcon: const Icon(Icons.search_rounded),
                            hintText: i18n.t(
                                'analytics.searchHint', 'Search tasks...'),
                          ),
                          onChanged: _onAnalyticsQueryChanged,
                        ),
                      ),
                      SizedBox(
                        width: w,
                        child: DropdownButtonFormField<String>(
                          initialValue: '$_analyticsSortBy:$_analyticsSortDir',
                          decoration: InputDecoration(
                            labelText: i18n.t('analytics.sortBy', 'Sort by'),
                            prefixIcon: const Icon(Icons.sort_rounded),
                          ),
                          items: const [
                            DropdownMenuItem(
                                value: 'successRate:desc',
                                child: Text('Success Rate (High)')),
                            DropdownMenuItem(
                                value: 'successRate:asc',
                                child: Text('Success Rate (Low)')),
                            DropdownMenuItem(
                                value: 'totalExecutions:desc',
                                child: Text('Total Runs (High)')),
                            DropdownMenuItem(
                                value: 'totalExecutions:asc',
                                child: Text('Total Runs (Low)')),
                            DropdownMenuItem(
                                value: 'failed:desc',
                                child: Text('Failures (High)')),
                            DropdownMenuItem(
                                value: 'failed:asc',
                                child: Text('Failures (Low)')),
                            DropdownMenuItem(
                                value: 'taskName:asc',
                                child: Text('Task (A→Z)')),
                            DropdownMenuItem(
                                value: 'taskName:desc',
                                child: Text('Task (Z→A)')),
                          ],
                          onChanged: (value) {
                            if (value == null) return;
                            final parts = value.split(':');
                            if (parts.length != 2) return;
                            final by = parts[0];
                            final dir = parts[1];
                            setState(() {
                              _analyticsSortBy = by;
                              _analyticsSortDir = dir;
                              _analyticsOffset = 0;
                              _analyticsHasMore = false;
                            });
                            unawaited(
                                _loadPanel(PanelKind.analytics, force: true));
                          },
                        ),
                      ),
                    ],
                  );
                },
              ),
              const SizedBox(height: 12),
              if (taskStats.isEmpty)
                analyticsSurface(
                  child:
                      Text(i18n.t('analytics.empty', 'No analytics data yet.')),
                )
              else
                ...taskStats.take(80).map((raw) {
                  final item = raw is Map<String, dynamic>
                      ? raw
                      : Map<String, dynamic>.from(raw as Map);
                  final taskName = item['taskName']?.toString() ??
                      i18n.t('tasks.task', 'Task');
                  final total = _readInt(item['totalExecutions'], fallback: 0);
                  final ok = _readInt(item['successful'], fallback: 0);
                  final fail = _readInt(item['failed'], fallback: 0);
                  final rate = _readDouble(item['successRate'], fallback: 0);
                  final rateColor = rate >= 90
                      ? Colors.green.shade700
                      : rate >= 70
                          ? scheme.secondary
                          : scheme.error;

                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: analyticsSurface(
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(14),
                              color: rateColor.withAlpha((0.12 * 255).round()),
                              border: Border.all(
                                  color: rateColor
                                      .withAlpha((0.22 * 255).round())),
                            ),
                            child:
                                Icon(Icons.analytics_rounded, color: rateColor),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(taskName,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w900)),
                                const SizedBox(height: 6),
                                Wrap(
                                  spacing: 8,
                                  runSpacing: 8,
                                  children: [
                                    SfBadge(
                                        '${i18n.t('analytics.executions', 'Executions')}: $total',
                                        tone: scheme.onSurface),
                                    SfBadge(
                                        '${i18n.t('analytics.kpi.successful', 'Successful')}: $ok',
                                        tone: Colors.green.shade700),
                                    SfBadge(
                                        '${i18n.t('analytics.kpi.failed', 'Failed')}: $fail',
                                        tone: scheme.error),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 10),
                          SfBadge('${rate.toStringAsFixed(2)}%',
                              tone: rateColor, icon: Icons.trending_up_rounded),
                        ],
                      ),
                    ),
                  );
                }),
              if (canLoadMore) ...[
                const SizedBox(height: 8),
                Center(
                  child: OutlinedButton.icon(
                    onPressed: _analyticsLoadingMore
                        ? null
                        : () => unawaited(_loadMoreAnalytics()),
                    icon: _analyticsLoadingMore
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.expand_more_rounded),
                    label: Text(
                      _analyticsLoadingMore
                          ? (i18n.isArabic ? '...جاري التحميل' : 'Loading...')
                          : i18n.t('analytics.loadMore', 'Load more'),
                    ),
                  ),
                ),
                if (nextOffset > 0)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(
                      '${i18n.t('analytics.nextOffset', 'Next offset')}: $nextOffset',
                      style: TextStyle(
                          color: scheme.onSurfaceVariant,
                          fontWeight: FontWeight.w700),
                    ),
                  ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildSettings(Map<String, dynamic> data) {
    final i18n = _i18n(context);
    final user = data['user'] is Map<String, dynamic>
        ? data['user'] as Map<String, dynamic>
        : <String, dynamic>{};

    final isDark = widget.appState.themeMode == AppThemeMode.dark;
    final isArabic = widget.appState.locale == 'ar';
    final scheme = Theme.of(context).colorScheme;

    final profileName = user['name']?.toString() ?? widget.userName;
    final profileEmail = user['email']?.toString() ?? widget.userEmail;
    final profileImageUrl = user['profileImageUrl']?.toString() ?? '';

    _syncProfileDraft(user);

    final presetOptions = <Map<String, dynamic>>[
      {
        'id': 'orbit',
        'name': 'Orbit',
        'desc': i18n.t('settings.preset.orbit', 'Formal enterprise palette.'),
        'swatches': const <Color>[
          Color(0xFF0F62FE),
          Color(0xFF0052CC),
          Color(0xFF57606A)
        ],
      },
      {
        'id': 'graphite',
        'name': 'Graphite',
        'desc': i18n.t('settings.preset.graphite',
            'Minimal neutral scheme with subtle accents.'),
        'swatches': const <Color>[
          Color(0xFF667086),
          Color(0xFF7F8EA4),
          Color(0xFFA6B0C2)
        ],
      },
      {
        'id': 'sunrise',
        'name': 'Sunrise',
        'desc': i18n.t('settings.preset.sunrise',
            'Warm editorial palette with high contrast.'),
        'swatches': const <Color>[
          Color(0xFFE57A39),
          Color(0xFFEDB84C),
          Color(0xFF46B8A8)
        ],
      },
      {
        'id': 'nord',
        'name': 'Nord',
        'desc': i18n.t('settings.preset.nord',
            'Cool arctic blue-gray with clean contrast.'),
        'swatches': const <Color>[
          Color(0xFF5E81AC),
          Color(0xFF88C0D0),
          Color(0xFF81A1C1)
        ],
      },
      {
        'id': 'ocean',
        'name': 'Ocean',
        'desc': i18n.t('settings.preset.ocean',
            'Airy blue-gray background with frost surfaces.'),
        'swatches': const <Color>[
          Color(0xFF3AA8FF),
          Color(0xFF66BCEB),
          Color(0xFF2F84D4)
        ],
      },
      {
        'id': 'warmlux',
        'name': 'Warm Luxe',
        'desc': i18n.t('settings.preset.warmlux',
            'Warm corporate beige with golden accents.'),
        'swatches': const <Color>[
          Color(0xFFE9E6DF),
          Color(0xFFE5B73B),
          Color(0xFF2C2C2C)
        ],
      },
    ];

    Widget settingsSurface({
      required Widget child,
      EdgeInsetsGeometry padding = const EdgeInsets.all(12),
      Color? borderTone,
    }) {
      final tone = borderTone ?? scheme.outline;
      return Container(
        padding: padding,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              scheme.surface.withAlpha(((isDark ? 0.50 : 0.62) * 255).round()),
              scheme.surface.withAlpha(((isDark ? 0.36 : 0.46) * 255).round()),
            ],
          ),
          border: Border.all(
              color: tone.withAlpha(((isDark ? 0.62 : 0.24) * 255).round())),
        ),
        child: child,
      );
    }

    Widget toggleRow({
      required String title,
      required String subtitle,
      required bool value,
      required ValueChanged<bool> onChanged,
      required IconData icon,
    }) {
      return settingsSurface(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                color: scheme.primary
                    .withAlpha(((isDark ? 0.18 : 0.10) * 255).round()),
                border: Border.all(
                    color: scheme.primary
                        .withAlpha(((isDark ? 0.26 : 0.18) * 255).round())),
              ),
              child: Icon(icon, color: scheme.primary, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: const TextStyle(fontWeight: FontWeight.w900)),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: TextStyle(
                        color: scheme.onSurfaceVariant,
                        fontWeight: FontWeight.w700),
                  ),
                ],
              ),
            ),
            SfPillSwitch(
              value: value,
              onChanged: onChanged,
            ),
          ],
        ),
      );
    }

    Widget presetCard(Map<String, dynamic> opt, {required bool selected}) {
      final swatches = (opt['swatches'] as List).cast<Color>();
      final border = selected
          ? scheme.primary.withAlpha(((isDark ? 0.55 : 0.50) * 255).round())
          : scheme.outline.withAlpha(((isDark ? 0.65 : 0.70) * 255).round());

      return InkWell(
        onTap: () => unawaited(
            widget.appState.setThemePreset(opt['id']?.toString() ?? 'orbit')),
        borderRadius: BorderRadius.circular(18),
        child: AnimatedContainer(
          duration: widget.appState.reducedMotion
              ? Duration.zero
              : const Duration(milliseconds: 180),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: border, width: selected ? 1.4 : 1.0),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: selected
                  ? [
                      scheme.primary
                          .withAlpha(((isDark ? 0.16 : 0.12) * 255).round()),
                      scheme.primary
                          .withAlpha(((isDark ? 0.08 : 0.06) * 255).round()),
                    ]
                  : [
                      scheme.surface
                          .withAlpha(((isDark ? 0.48 : 0.60) * 255).round()),
                      scheme.surface
                          .withAlpha(((isDark ? 0.34 : 0.44) * 255).round()),
                    ],
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      opt['name']?.toString() ?? '',
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                  ),
                  if (selected)
                    SfBadge(
                      i18n.t('settings.active', 'Active'),
                      tone: scheme.primary,
                      icon: Icons.check_rounded,
                    ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  for (final c in swatches) ...[
                    Container(
                      width: 14,
                      height: 14,
                      margin: const EdgeInsets.only(right: 6),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: c,
                        border: Border.all(
                            color: scheme.outline.withAlpha(
                                ((isDark ? 0.55 : 0.70) * 255).round())),
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 10),
              Text(
                opt['desc']?.toString() ?? '',
                style: TextStyle(
                    color: scheme.onSurfaceVariant,
                    fontWeight: FontWeight.w700),
              ),
            ],
          ),
        ),
      );
    }

    Widget credentialsCard() {
      final platformLabel = _kPlatformLabels[_settingsSelectedPlatform] ??
          _settingsSelectedPlatform;
      final fields = _kPlatformFields[_settingsSelectedPlatform] ??
          const <Map<String, dynamic>>[];

      Widget content;
      if (_settingsCredentialsLoading) {
        content = Text(
            i18n.t('settings.loadingCredentials', 'Loading credentials...'));
      } else if (_settingsCredentialsError.trim().isNotEmpty) {
        content = Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _settingsCredentialsError,
              style:
                  TextStyle(color: scheme.error, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: () =>
                  unawaited(_loadSettingsPlatformCredentials(force: true)),
              icon: const Icon(Icons.refresh_rounded),
              label: Text(i18n.t('common.retry', 'Retry')),
            ),
          ],
        );
      } else {
        content = LayoutBuilder(
          builder: (context, constraints) {
            final wide = constraints.maxWidth >= 760;
            final width =
                wide ? (constraints.maxWidth - 12) / 2 : constraints.maxWidth;
            return Wrap(
              spacing: 12,
              runSpacing: 12,
              children: fields.map((field) {
                final key = field['key']?.toString() ?? '';
                final label = field['label']?.toString() ?? key;
                final hint = field['hint']?.toString() ?? '';
                final secret = field['secret'] == true;
                final revealKey = '${_settingsSelectedPlatform}.$key';
                final revealed = _settingsRevealSecret[revealKey] == true;

                final controller = _settingsCredentialControllers[key] ??
                    TextEditingController();
                _settingsCredentialControllers[key] = controller;

                return SizedBox(
                  width: width,
                  child: TextField(
                    controller: controller,
                    obscureText: secret && !revealed,
                    onChanged: (_) =>
                        setState(() => _settingsCredentialsDirty = true),
                    decoration: InputDecoration(
                      labelText: label,
                      hintText: hint,
                      suffixIcon: secret
                          ? IconButton(
                              tooltip: revealed ? 'Hide' : 'Show',
                              onPressed: () => setState(() {
                                _settingsRevealSecret[revealKey] = !revealed;
                              }),
                              icon: Icon(
                                revealed
                                    ? Icons.visibility_off_rounded
                                    : Icons.visibility_rounded,
                              ),
                            )
                          : null,
                    ),
                  ),
                );
              }).toList(),
            );
          },
        );
      }

      return SfPanelCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SfSectionHeader(
              title: i18n.t(
                  'settings.platformCredentials', 'Platform API Credentials'),
              subtitle: i18n.t(
                'settings.platformCredentials.subtitle',
                'OAuth and API keys are stored per-user on the server. Keep them private.',
              ),
              trailing: IconButton(
                tooltip: i18n.t('common.refresh', 'Refresh'),
                onPressed: () =>
                    unawaited(_loadSettingsPlatformCredentials(force: true)),
                icon: const Icon(Icons.refresh_rounded),
              ),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _settingsSelectedPlatform,
              decoration: InputDecoration(
                labelText: i18n.t('settings.platform', 'Platform'),
                prefixIcon: const Icon(Icons.key_rounded),
              ),
              items: _kManagedPlatformIds
                  .map((id) => DropdownMenuItem(
                      value: id, child: Text(_kPlatformLabels[id] ?? id)))
                  .toList(),
              onChanged: (value) {
                if (value == null) return;
                _setSettingsSelectedPlatform(value);
              },
            ),
            const SizedBox(height: 12),
            Text(
              '${i18n.t('settings.selected', 'Selected')}: $platformLabel',
              style: TextStyle(
                  color: scheme.onSurfaceVariant, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 12),
            content,
            const SizedBox(height: 12),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                FilledButton.icon(
                  onPressed: (_settingsCredentialsLoading ||
                          _settingsCredentialsSaving)
                      ? null
                      : () => unawaited(_saveSettingsPlatformCredentials()),
                  icon: _settingsCredentialsSaving
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.save_rounded),
                  label: Text(_settingsCredentialsSaving
                      ? i18n.t('settings.saving', 'Saving...')
                      : i18n.t('settings.saveCredentials',
                          'Save Platform Credentials')),
                ),
                OutlinedButton.icon(
                  onPressed: _settingsCredentialsDirty
                      ? () => _setSettingsSelectedPlatform(
                          _settingsSelectedPlatform)
                      : null,
                  icon: const Icon(Icons.refresh_rounded),
                  label: Text(i18n.t('settings.resetDraft', 'Reset draft')),
                ),
              ],
            ),
          ],
        ),
      );
    }

    Widget profileCard() {
      final image = _settingsImageUrlController.text.trim().isNotEmpty
          ? _settingsImageUrlController.text.trim()
          : profileImageUrl;

      return SfPanelCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SfSectionHeader(
              title: i18n.t('settings.profile', 'Account & Profile'),
              subtitle: i18n.t(
                'settings.profile.subtitle',
                'Update your name, profile image, and password.',
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                CircleAvatar(
                  radius: 26,
                  backgroundColor: scheme.surfaceContainerHighest,
                  foregroundImage:
                      image.trim().isEmpty ? null : NetworkImage(image),
                  child: const Icon(Icons.person_rounded),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(profileName,
                          style: const TextStyle(fontWeight: FontWeight.w900)),
                      const SizedBox(height: 4),
                      Text(profileEmail,
                          style: TextStyle(
                              color: scheme.onSurfaceVariant,
                              fontWeight: FontWeight.w700)),
                    ],
                  ),
                ),
              ],
            ),
            if (_settingsProfileError.trim().isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(_settingsProfileError,
                  style: TextStyle(
                      color: scheme.error, fontWeight: FontWeight.w800)),
            ],
            const SizedBox(height: 12),
            TextField(
              controller: _settingsNameController,
              decoration: InputDecoration(
                labelText: i18n.t('settings.name', 'Name'),
                prefixIcon: const Icon(Icons.badge_rounded),
                hintText: i18n.t('settings.nameHint', 'Your display name'),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _settingsImageUrlController,
              decoration: InputDecoration(
                labelText:
                    i18n.t('settings.profileImageUrl', 'Profile image URL'),
                prefixIcon: const Icon(Icons.image_rounded),
                hintText: i18n.t('settings.profileImageUrlHint', 'https://...'),
              ),
            ),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: _settingsSavingProfile
                  ? null
                  : () => unawaited(_saveSettingsProfile()),
              icon: _settingsSavingProfile
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.save_rounded),
              label: Text(_settingsSavingProfile
                  ? i18n.t('settings.saving', 'Saving...')
                  : i18n.t('settings.saveProfile', 'Save Profile')),
            ),
            const SizedBox(height: 16),
            const Divider(height: 1),
            const SizedBox(height: 16),
            Text(
              i18n.t('settings.changePassword', 'Change Password'),
              style: const TextStyle(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _settingsCurrentPasswordController,
              obscureText: true,
              decoration: InputDecoration(
                labelText:
                    i18n.t('settings.currentPassword', 'Current password'),
                prefixIcon: const Icon(Icons.lock_rounded),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _settingsNewPasswordController,
              obscureText: true,
              decoration: InputDecoration(
                labelText: i18n.t('settings.newPassword', 'New password'),
                prefixIcon: const Icon(Icons.lock_reset_rounded),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _settingsConfirmPasswordController,
              obscureText: true,
              decoration: InputDecoration(
                labelText:
                    i18n.t('settings.confirmPassword', 'Confirm new password'),
                prefixIcon: const Icon(Icons.lock_outline_rounded),
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _settingsUpdatingPassword
                  ? null
                  : () => unawaited(_updateSettingsPassword()),
              icon: _settingsUpdatingPassword
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.check_rounded),
              label: Text(_settingsUpdatingPassword
                  ? i18n.t('settings.updating', 'Updating...')
                  : i18n.t('settings.updatePassword', 'Update Password')),
            ),
          ],
        ),
      );
    }

    Widget appearanceCard() {
      return SfPanelCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SfSectionHeader(
              title: i18n.t('settings.appearance', 'Appearance'),
              subtitle: i18n.t('settings.appearance.subtitle',
                  'Theme mode and preset palette (mirrors web presets).'),
            ),
            const SizedBox(height: 12),
            toggleRow(
              title: i18n.t('settings.darkMode', 'Dark mode'),
              subtitle: i18n.t('settings.darkMode.subtitle',
                  'Use the dark color scheme across the app.'),
              value: isDark,
              onChanged: (_) => unawaited(widget.appState.toggleThemeMode()),
              icon: Icons.dark_mode_rounded,
            ),
            const SizedBox(height: 12),
            settingsSurface(
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(14),
                      color: scheme.secondary
                          .withAlpha(((isDark ? 0.18 : 0.10) * 255).round()),
                      border: Border.all(
                          color: scheme.secondary.withAlpha(
                              ((isDark ? 0.26 : 0.18) * 255).round())),
                    ),
                    child: Icon(Icons.language_rounded,
                        color: scheme.secondary, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(i18n.t('settings.language', 'Language'),
                            style:
                                const TextStyle(fontWeight: FontWeight.w900)),
                        const SizedBox(height: 4),
                        Text(
                          isArabic ? 'العربية' : 'English',
                          style: TextStyle(
                              color: scheme.onSurfaceVariant,
                              fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
                  ),
                  OutlinedButton(
                    onPressed: () => unawaited(widget.appState.toggleLocale()),
                    child: Text(isArabic ? 'EN' : 'AR'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Text(
              i18n.t('settings.themePreset', 'Theme preset'),
              style: const TextStyle(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 10),
            LayoutBuilder(
              builder: (context, constraints) {
                final cols = constraints.maxWidth >= 980
                    ? 3
                    : (constraints.maxWidth >= 620 ? 2 : 1);
                final w = (constraints.maxWidth - ((cols - 1) * 12)) / cols;
                return Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: presetOptions.map((opt) {
                    final selected = widget.appState.themePreset == opt['id'];
                    return SizedBox(
                        width: w, child: presetCard(opt, selected: selected));
                  }).toList(),
                );
              },
            ),
          ],
        ),
      );
    }

    Widget experienceCard() {
      return SfPanelCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SfSectionHeader(
              title: i18n.t('settings.experience', 'Workspace Experience'),
              subtitle: i18n.t('settings.experience.subtitle',
                  'Motion, navigation density, and ergonomics.'),
            ),
            const SizedBox(height: 12),
            toggleRow(
              title: i18n.t('settings.reducedMotion', 'Reduced motion'),
              subtitle: i18n.t('settings.reducedMotion.subtitle',
                  'Minimize animation and transition effects.'),
              value: widget.appState.reducedMotion,
              onChanged: (v) => unawaited(widget.appState.setReducedMotion(v)),
              icon: Icons.motion_photos_off_rounded,
            ),
            const SizedBox(height: 12),
            toggleRow(
              title:
                  i18n.t('settings.compactNav', 'Collapsed sidebar by default'),
              subtitle: i18n.t('settings.compactNav.subtitle',
                  'Keep navigation compact on large screens.'),
              value: widget.appState.sidebarCollapsed,
              onChanged: (v) =>
                  unawaited(widget.appState.setSidebarCollapsed(v)),
              icon: Icons.space_dashboard_outlined,
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: widget.appState.density,
              decoration: InputDecoration(
                labelText: i18n.t('settings.density', 'Density'),
                prefixIcon: const Icon(Icons.format_line_spacing_rounded),
              ),
              items: const [
                DropdownMenuItem(
                    value: 'comfortable', child: Text('Comfortable')),
                DropdownMenuItem(value: 'compact', child: Text('Compact')),
              ],
              onChanged: (value) {
                if (value == null) return;
                unawaited(widget.appState.setDensity(value));
              },
            ),
          ],
        ),
      );
    }

    Widget notificationsCard() {
      return SfPanelCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SfSectionHeader(
              title: i18n.t('settings.notifications', 'Notifications'),
              subtitle: i18n.t('settings.notifications.subtitle',
                  'Local preferences for alerts and notices.'),
            ),
            const SizedBox(height: 12),
            toggleRow(
              title:
                  i18n.t('settings.notifications.success', 'Email on success'),
              subtitle: i18n.t('settings.notifications.success.subtitle',
                  'Get notified when tasks complete successfully.'),
              value: widget.appState.emailOnSuccess,
              onChanged: (v) => unawaited(
                  widget.appState.setNotifications(emailOnSuccessValue: v)),
              icon: Icons.mark_email_read_rounded,
            ),
            const SizedBox(height: 12),
            toggleRow(
              title: i18n.t('settings.notifications.error', 'Email on error'),
              subtitle: i18n.t('settings.notifications.error.subtitle',
                  'Get notified when tasks fail.'),
              value: widget.appState.emailOnError,
              onChanged: (v) => unawaited(
                  widget.appState.setNotifications(emailOnErrorValue: v)),
              icon: Icons.mark_email_unread_rounded,
            ),
            const SizedBox(height: 12),
            toggleRow(
              title:
                  i18n.t('settings.notifications.push', 'Push notifications'),
              subtitle: i18n.t('settings.notifications.push.subtitle',
                  'Receive push notifications (if enabled).'),
              value: widget.appState.pushNotifications,
              onChanged: (v) => unawaited(
                  widget.appState.setNotifications(pushNotificationsValue: v)),
              icon: Icons.notifications_active_rounded,
            ),
          ],
        ),
      );
    }

    Widget privacyCard() {
      return SfPanelCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SfSectionHeader(
              title: i18n.t('settings.privacy', 'Privacy & Data'),
              subtitle: i18n.t('settings.privacy.subtitle',
                  'Control analytics and error sharing.'),
            ),
            const SizedBox(height: 12),
            toggleRow(
              title: i18n.t('settings.privacy.analytics', 'Usage analytics'),
              subtitle: i18n.t('settings.privacy.analytics.subtitle',
                  'Help improve the product by sharing anonymous usage data.'),
              value: widget.appState.allowAnalytics,
              onChanged: (v) =>
                  unawaited(widget.appState.setPrivacy(allowAnalyticsValue: v)),
              icon: Icons.analytics_rounded,
            ),
            const SizedBox(height: 12),
            toggleRow(
              title: i18n.t('settings.privacy.errors', 'Share error logs'),
              subtitle: i18n.t('settings.privacy.errors.subtitle',
                  'Share error logs to help debug issues faster.'),
              value: widget.appState.shareErrorLogs,
              onChanged: (v) =>
                  unawaited(widget.appState.setPrivacy(shareErrorLogsValue: v)),
              icon: Icons.bug_report_rounded,
            ),
          ],
        ),
      );
    }

    Widget systemCard() {
      return SfPanelCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SfSectionHeader(
              title: i18n.t('settings.system', 'System'),
              subtitle: i18n.t('settings.system.subtitle',
                  'Diagnostics and storage actions.'),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: widget.appState.timezone,
              decoration: InputDecoration(
                labelText: i18n.t('settings.timezone', 'Timezone'),
                prefixIcon: const Icon(Icons.public_rounded),
              ),
              items: const [
                DropdownMenuItem(value: 'UTC', child: Text('UTC')),
                DropdownMenuItem(value: 'EST', child: Text('EST (Eastern)')),
                DropdownMenuItem(value: 'CST', child: Text('CST (Central)')),
                DropdownMenuItem(value: 'MST', child: Text('MST (Mountain)')),
                DropdownMenuItem(value: 'PST', child: Text('PST (Pacific)')),
                DropdownMenuItem(value: 'GMT', child: Text('GMT')),
                DropdownMenuItem(value: 'CET', child: Text('CET')),
                DropdownMenuItem(value: 'IST', child: Text('IST')),
                DropdownMenuItem(value: 'JST', child: Text('JST')),
                DropdownMenuItem(value: 'AEST', child: Text('AEST')),
              ],
              onChanged: (value) {
                if (value == null) return;
                unawaited(widget.appState.setTimezone(value));
              },
            ),
            const SizedBox(height: 12),
            settingsSurface(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.link_rounded),
                title: Text(i18n.t('settings.apiBaseUrl', 'API Base URL')),
                subtitle: Text(AppConfig.baseUri.toString()),
              ),
            ),
            const SizedBox(height: 10),
            settingsSurface(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.security_rounded),
                title: Text(i18n.t('settings.authMode', 'Auth mode')),
                subtitle: Text(i18n.t('settings.authModeValue',
                    'Bearer token via /api/mobile/login')),
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                OutlinedButton.icon(
                  onPressed: _exportTasksCsv,
                  icon: const Icon(Icons.download_rounded),
                  label: Text(i18n.t('settings.exportData', 'Export Data')),
                ),
                OutlinedButton.icon(
                  onPressed: _clearPanelCache,
                  icon: const Icon(Icons.cleaning_services_rounded),
                  label: Text(i18n.t('settings.clearCache', 'Clear Cache')),
                ),
              ],
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SfPanelCard(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SfBadge(
                i18n.t('settings.title', 'Settings'),
                tone: scheme.primary,
                icon: Icons.tune_rounded,
              ),
              const SizedBox(height: 10),
              Text(
                i18n.t('settings.title', 'Settings'),
                style:
                    const TextStyle(fontSize: 28, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 6),
              Text(
                i18n.t(
                  'settings.subtitle',
                  'Manage your account, themes, and platform API credentials.',
                ),
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  SfBadge(
                    '${i18n.t('settings.language', 'Language')}: ${isArabic ? 'AR' : 'EN'}',
                    tone: scheme.secondary,
                    icon: Icons.language_rounded,
                  ),
                  SfBadge(
                    '${i18n.t('settings.themePreset', 'Theme preset')}: ${widget.appState.themePreset}',
                    tone: scheme.onSurface,
                    icon: Icons.palette_rounded,
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        credentialsCard(),
        const SizedBox(height: 14),
        profileCard(),
        const SizedBox(height: 14),
        appearanceCard(),
        const SizedBox(height: 14),
        experienceCard(),
        const SizedBox(height: 14),
        notificationsCard(),
        const SizedBox(height: 14),
        privacyCard(),
        const SizedBox(height: 14),
        systemCard(),
        const SizedBox(height: 14),
        SfPanelCard(
          padding: const EdgeInsets.all(14),
          child: Align(
            alignment: Alignment.centerLeft,
            child: FilledButton.icon(
              onPressed: () async {
                await widget.onSignOut();
              },
              icon: const Icon(Icons.logout_rounded),
              label: Text(i18n.t('common.signOut', 'Sign out')),
            ),
          ),
        ),
      ],
    );
  }

  String _normalizeProfileHandle(String value) {
    var normalized = value.trim();
    if (normalized.isEmpty) return '';
    if (normalized.startsWith('@')) {
      normalized = normalized.substring(1);
    }
    normalized = normalized.replaceAll(RegExp(r'^/+|/+$'), '');
    return normalized;
  }

  String? _extractAbsoluteUrl(dynamic value) {
    final raw = value?.toString().trim() ?? '';
    if (raw.isEmpty) return null;
    final uri = Uri.tryParse(raw);
    if (uri == null) return null;
    final scheme = uri.scheme.toLowerCase();
    if ((scheme == 'http' || scheme == 'https') && uri.host.isNotEmpty) {
      return uri.toString();
    }
    return null;
  }

  String? _buildPlatformProfileUrl({
    required String platformId,
    String? username,
    String? accountId,
  }) {
    final normalizedPlatform = platformId.trim().toLowerCase();
    final handle = _normalizeProfileHandle(username ?? '');
    final id = (accountId ?? '').trim();

    if (normalizedPlatform.contains('twitter') ||
        normalizedPlatform == 'x' ||
        normalizedPlatform.contains('x.com')) {
      if (handle.isEmpty) return null;
      return 'https://x.com/$handle';
    }
    if (normalizedPlatform.contains('threads')) {
      if (handle.isEmpty) return null;
      return 'https://www.threads.net/@$handle';
    }
    if (normalizedPlatform.contains('instagram')) {
      if (handle.isEmpty) return null;
      return 'https://www.instagram.com/$handle';
    }
    if (normalizedPlatform.contains('facebook')) {
      if (handle.isNotEmpty) return 'https://www.facebook.com/$handle';
      if (id.isNotEmpty) return 'https://www.facebook.com/profile.php?id=$id';
      return null;
    }
    if (normalizedPlatform.contains('youtube')) {
      if (handle.isNotEmpty) {
        if (handle.startsWith('UC') && handle.length >= 20) {
          return 'https://www.youtube.com/channel/$handle';
        }
        return 'https://www.youtube.com/@$handle';
      }
      if (id.isNotEmpty) return 'https://www.youtube.com/channel/$id';
      return null;
    }
    if (normalizedPlatform.contains('telegram')) {
      if (handle.isEmpty) return null;
      return 'https://t.me/$handle';
    }
    if (normalizedPlatform.contains('tiktok')) {
      if (handle.isEmpty) return null;
      return 'https://www.tiktok.com/@$handle';
    }
    if (normalizedPlatform.contains('linkedin')) {
      if (handle.isEmpty) return null;
      return 'https://www.linkedin.com/in/$handle';
    }
    if (normalizedPlatform.contains('reddit')) {
      if (handle.isEmpty) return null;
      return 'https://www.reddit.com/user/$handle';
    }
    if (normalizedPlatform.contains('pinterest')) {
      if (handle.isEmpty) return null;
      return 'https://www.pinterest.com/$handle';
    }
    if (normalizedPlatform.contains('snap')) {
      if (handle.isEmpty) return null;
      return 'https://www.snapchat.com/add/$handle';
    }

    return null;
  }

  String? _resolveAccountProfileUrl(Map<String, dynamic> account) {
    final credentials = account['credentials'] is Map
        ? Map<String, dynamic>.from(account['credentials'] as Map)
        : <String, dynamic>{};
    final accountInfo = credentials['accountInfo'] is Map
        ? Map<String, dynamic>.from(credentials['accountInfo'] as Map)
        : <String, dynamic>{};

    final explicitUrl = _extractAbsoluteUrl(account['profileUrl']) ??
        _extractAbsoluteUrl(account['url']) ??
        _extractAbsoluteUrl(account['link']) ??
        _extractAbsoluteUrl(credentials['profileUrl']) ??
        _extractAbsoluteUrl(credentials['url']) ??
        _extractAbsoluteUrl(accountInfo['profileUrl']) ??
        _extractAbsoluteUrl(accountInfo['url']);

    if (explicitUrl != null) return explicitUrl;

    final username = (account['accountUsername']?.toString() ??
            accountInfo['username']?.toString() ??
            accountInfo['screenName']?.toString() ??
            '')
        .trim();
    final accountId = (account['accountId']?.toString() ??
            accountInfo['id']?.toString() ??
            '')
        .trim();
    final platformId = account['platformId']?.toString() ?? '';
    return _buildPlatformProfileUrl(
      platformId: platformId,
      username: username,
      accountId: accountId,
    );
  }

  Future<void> _openAccountProfile(Map<String, dynamic> account) async {
    final i18n = _i18n(context);
    final profileUrl = _resolveAccountProfileUrl(account);
    if (profileUrl == null) {
      _toast(i18n.isArabic
          ? 'لا يوجد رابط ملف شخصي لهذا الحساب.'
          : 'No profile URL available for this account.');
      return;
    }

    final uri = Uri.tryParse(profileUrl);
    if (uri == null) {
      _toast(i18n.isArabic
          ? 'رابط الملف الشخصي غير صالح.'
          : 'Invalid profile URL.');
      return;
    }

    try {
      final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (opened) return;
    } catch (_) {
      // Fall back to clipboard.
    }

    await Clipboard.setData(ClipboardData(text: profileUrl));
    _toast(i18n.isArabic
        ? 'تعذر فتح الرابط. تم نسخه إلى الحافظة.'
        : 'Could not open profile. URL copied to clipboard.');
  }

  IconData _platformIcon(String platformId) {
    return platformBrandIcon(platformId);
  }

  Color _platformColor(String platformId) {
    final theme = Theme.of(context);
    return platformBrandColor(
      platformId,
      scheme: theme.colorScheme,
      isDark: theme.brightness == Brightness.dark,
    );
  }

  String _platformLabel(String platformId) {
    final normalized = platformId.trim().toLowerCase();
    if (normalized.isEmpty) return 'Unknown';
    if (normalized.contains('telegram')) return 'Telegram';
    if (normalized.contains('twitter') ||
        normalized == 'x' ||
        normalized.contains('x.com')) return 'X';
    if (normalized.contains('youtube')) return 'YouTube';
    if (normalized.contains('tiktok')) return 'TikTok';
    if (normalized.contains('instagram')) return 'Instagram';
    if (normalized.contains('facebook')) return 'Facebook';
    if (normalized.contains('linkedin')) return 'LinkedIn';
    if (normalized.contains('snap')) return 'Snapchat';
    if (normalized.contains('threads')) return 'Threads';
    if (normalized.contains('reddit')) return 'Reddit';
    if (normalized.contains('pinterest')) return 'Pinterest';
    return platformId.trim().isEmpty ? 'Unknown' : platformId.trim();
  }

  Widget _buildCurrentPanel() {
    final i18n = _i18n(context);
    switch (_currentKind) {
      case PanelKind.dashboard:
        return _buildPanelFrame(
          kind: PanelKind.dashboard,
          i18n: i18n,
          builder: _buildDashboard,
        );
      case PanelKind.tasks:
        return _buildPanelFrame(
            kind: PanelKind.tasks, i18n: i18n, builder: _buildTasks);
      case PanelKind.accounts:
        return _buildPanelFrame(
          kind: PanelKind.accounts,
          i18n: i18n,
          builder: _buildAccounts,
        );
      case PanelKind.executions:
        return _buildPanelFrame(
          kind: PanelKind.executions,
          i18n: i18n,
          builder: _buildExecutions,
        );
      case PanelKind.analytics:
        return _buildPanelFrame(
          kind: PanelKind.analytics,
          i18n: i18n,
          builder: _buildAnalytics,
        );
      case PanelKind.settings:
        return _buildPanelFrame(
          kind: PanelKind.settings,
          i18n: i18n,
          builder: _buildSettings,
        );
    }
  }

  Widget _buildHeaderActionButton({
    required IconData icon,
    required String tooltip,
    required VoidCallback? onPressed,
    bool showDot = false,
    bool compact = false,
  }) {
    final scheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Tooltip(
      message: tooltip,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onPressed,
          child: Container(
            width: compact ? 34 : 38,
            height: compact ? 34 : 38,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Color.alphaBlend(
                    scheme.surface.withAlpha(isDark ? 122 : 210),
                    scheme.primary.withAlpha(isDark ? 18 : 10),
                  ),
                  Color.alphaBlend(
                    scheme.surface.withAlpha(isDark ? 108 : 198),
                    scheme.secondary.withAlpha(isDark ? 14 : 8),
                  ),
                ],
              ),
              border: Border.all(color: scheme.outline.withAlpha(82)),
            ),
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Center(
                  child: Icon(
                    icon,
                    size: compact ? 16 : 17,
                    color: scheme.onSurfaceVariant,
                  ),
                ),
                if (showDot)
                  Positioned(
                    right: 9,
                    top: 9,
                    child: Container(
                      width: 7,
                      height: 7,
                      decoration: BoxDecoration(
                        color: scheme.secondary,
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildShellHeader({
    required I18n i18n,
    required PanelSpec currentPanel,
    required String panelLabel,
    required String lastUpdated,
    required bool wide,
    required bool mobileMenuOpen,
  }) {
    final scheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final collapsed = widget.appState.sidebarCollapsed;
    final caption =
        i18n.t(currentPanel.captionKey, currentPanel.fallbackCaption);
    final isDarkTheme = widget.appState.themeMode == AppThemeMode.dark;
    final compact = !wide;
    final crumbs = <String>[
      i18n.t('breadcrumb.workspace', 'Workspace'),
      panelLabel,
    ];

    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 10),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 14, sigmaY: 14),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: scheme.outline.withAlpha(95)),
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Color.alphaBlend(
                    scheme.surface.withAlpha(isDark ? 118 : 235),
                    scheme.primary.withAlpha(isDark ? 14 : 7),
                  ),
                  Color.alphaBlend(
                    scheme.surface.withAlpha(isDark ? 100 : 225),
                    scheme.secondary.withAlpha(isDark ? 10 : 6),
                  ),
                ],
              ),
              boxShadow: [
                BoxShadow(
                  blurRadius: 18,
                  offset: const Offset(0, 8),
                  color: Colors.black.withAlpha(isDark ? 48 : 16),
                ),
              ],
            ),
            padding: EdgeInsets.fromLTRB(
                compact ? 10 : 12, 10, compact ? 10 : 12, 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    _buildHeaderActionButton(
                      icon: wide
                          ? (collapsed
                              ? Icons.menu_open_rounded
                              : Icons.menu_rounded)
                          : (mobileMenuOpen
                              ? Icons.close_rounded
                              : Icons.menu_rounded),
                      tooltip: wide
                          ? (collapsed ? 'Expand sidebar' : 'Collapse sidebar')
                          : (mobileMenuOpen
                              ? 'Close navigation menu'
                              : 'Open navigation menu'),
                      onPressed: () => unawaited(_toggleSidebar(wide: wide)),
                      compact: compact,
                    ),
                    const SizedBox(width: 10),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(9),
                      child: Image.asset(
                        'assets/icon-192.png',
                        width: compact ? 26 : 30,
                        height: compact ? 26 : 30,
                        fit: BoxFit.cover,
                      ),
                    ),
                    if (wide) ...[
                      const SizedBox(width: 8),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'SocialFlow',
                            style: TextStyle(
                              fontSize: compact ? 13 : 14,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.1,
                            ),
                          ),
                          Text(
                            i18n.t('header.controlSuite', 'Control Suite'),
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.8,
                              color: scheme.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                    ],
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (wide)
                            Wrap(
                              spacing: 4,
                              runSpacing: 4,
                              crossAxisAlignment: WrapCrossAlignment.center,
                              children: [
                                for (int i = 0; i < crumbs.length; i++) ...[
                                  if (i > 0)
                                    Icon(
                                      Icons.chevron_right_rounded,
                                      size: 14,
                                      color: scheme.onSurfaceVariant,
                                    ),
                                  Text(
                                    crumbs[i],
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                      color: scheme.onSurfaceVariant,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          Text(
                            panelLabel,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: compact ? 15 : 17,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.1,
                            ),
                          ),
                          Text(
                            lastUpdated,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w700,
                              color: scheme.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (wide)
                      _buildHeaderActionButton(
                        icon: widget.appState.locale == 'ar'
                            ? Icons.translate_rounded
                            : Icons.g_translate_rounded,
                        tooltip: i18n.t('settings.language', 'Language'),
                        onPressed: () =>
                            unawaited(widget.appState.toggleLocale()),
                      ),
                    if (wide) const SizedBox(width: 6),
                    _buildHeaderActionButton(
                      icon: isDarkTheme
                          ? Icons.light_mode_rounded
                          : Icons.dark_mode_rounded,
                      tooltip: isDarkTheme
                          ? i18n.t('auth.themeLight', 'Light mode')
                          : i18n.t('auth.themeDark', 'Dark mode'),
                      onPressed: () =>
                          unawaited(widget.appState.toggleThemeMode()),
                      compact: compact,
                    ),
                    const SizedBox(width: 6),
                    _buildHeaderActionButton(
                      icon: Icons.refresh_rounded,
                      tooltip:
                          i18n.t('common.refresh', 'Refresh current panel'),
                      onPressed: () =>
                          unawaited(_loadCurrentPanel(force: true)),
                      compact: compact,
                    ),
                    const SizedBox(width: 6),
                    _buildHeaderActionButton(
                      icon: Icons.notifications_none_rounded,
                      tooltip: i18n.t('header.notifications', 'Notifications'),
                      onPressed: () => _toast(
                          i18n.t('header.notifications', 'Notifications')),
                      showDot: true,
                      compact: compact,
                    ),
                    const SizedBox(width: 6),
                    _buildHeaderActionButton(
                      icon: Icons.person_outline_rounded,
                      tooltip: i18n.t('settings.profile', 'Profile'),
                      onPressed: () => _openProfilePanel(closeDrawer: !wide),
                      compact: compact,
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: Container(
                        height: compact ? 36 : 40,
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(15),
                          color: Color.alphaBlend(
                            scheme.surface.withAlpha(isDark ? 112 : 210),
                            scheme.primary.withAlpha(isDark ? 10 : 4),
                          ),
                          border:
                              Border.all(color: scheme.outline.withAlpha(84)),
                        ),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(12),
                          onTap: () => _toast(
                            i18n.t('header.quickSearch', 'Quick Search'),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                Icons.search_rounded,
                                size: 16,
                                color: scheme.onSurfaceVariant,
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  i18n.t('header.searchPlaceholder',
                                      'Search tasks, accounts, logs...'),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: scheme.onSurfaceVariant,
                                  ),
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(9),
                                  border: Border.all(
                                      color: scheme.outline.withAlpha(76)),
                                  color: scheme.surface
                                      .withAlpha(isDark ? 120 : 220),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      Icons.keyboard_command_key_rounded,
                                      size: 12,
                                      color: scheme.onSurfaceVariant,
                                    ),
                                    const SizedBox(width: 2),
                                    Text(
                                      'K',
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w800,
                                        color: scheme.onSurfaceVariant,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    if (wide) ...[
                      const SizedBox(width: 8),
                      Flexible(
                        child: Container(
                          constraints: const BoxConstraints(maxWidth: 360),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 8),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(14),
                            border:
                                Border.all(color: scheme.outline.withAlpha(70)),
                            color: scheme.surface.withAlpha(isDark ? 108 : 208),
                          ),
                          child: Text(
                            caption,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: scheme.onSurfaceVariant,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final currentPanel = kPanelSpecs[_selectedIndex];
    final i18n = _i18n(context);
    final panelLabel =
        i18n.t(currentPanel.labelKey, currentPanel.fallbackLabel);
    final lastUpdated = _buildLastUpdatedText(i18n, _currentKind);
    return LayoutBuilder(
      builder: (context, constraints) {
        // Material guidance: switch to rail for larger screens/tablets.
        final wide = constraints.maxWidth >= 840;
        final reducedMotion = widget.appState.reducedMotion;
        if (wide && _mobileMenuOpen) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (!mounted || !_mobileMenuOpen) return;
            setState(() => _mobileMenuOpen = false);
          });
        }
        final mobileMenuOpen = !wide && _mobileMenuOpen;

        return Scaffold(
          key: _scaffoldKey,
          body: SfAppBackground(
            child: SafeArea(
              child: Stack(
                children: [
                  Column(
                    children: [
                      _buildShellHeader(
                        i18n: i18n,
                        currentPanel: currentPanel,
                        panelLabel: panelLabel,
                        lastUpdated: lastUpdated,
                        wide: wide,
                        mobileMenuOpen: mobileMenuOpen,
                      ),
                      Expanded(
                        child: Row(
                          children: [
                            if (wide) _buildRail(i18n),
                            Expanded(
                              child: AnimatedSwitcher(
                                duration: reducedMotion
                                    ? Duration.zero
                                    : const Duration(milliseconds: 220),
                                switchInCurve: Curves.easeOutCubic,
                                switchOutCurve: Curves.easeInCubic,
                                transitionBuilder: (child, anim) {
                                  if (reducedMotion) {
                                    return FadeTransition(
                                        opacity: anim, child: child);
                                  }
                                  return FadeTransition(
                                    opacity: anim,
                                    child: SlideTransition(
                                      position: Tween<Offset>(
                                        begin: const Offset(0.02, 0),
                                        end: Offset.zero,
                                      ).animate(anim),
                                      child: child,
                                    ),
                                  );
                                },
                                child: KeyedSubtree(
                                  key: ValueKey<PanelKind>(_currentKind),
                                  child: _buildCurrentPanel(),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  if (mobileMenuOpen) _buildMobileMenuPanel(i18n),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
