import 'dart:convert';
import 'dart:async';
import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app_config.dart';
import 'app_state.dart';
import 'storage_keys.dart';
import 'api/api_client.dart';
import 'i18n.dart';
import 'ui/auth/check_email_screen.dart';
import 'ui/auth/forgot_password_screen.dart';
import 'ui/auth/login_screen.dart';
import 'ui/auth/register_screen.dart';
import 'ui/auth/reset_password_screen.dart';
import 'ui/auth/verify_email_screen.dart';
import 'ui/sf_theme.dart';
import 'ui/widgets/sf_ui.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
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
        home: Scaffold(body: Center(child: CircularProgressIndicator())),
      );
    }

    return AnimatedBuilder(
      animation: state,
      builder: (context, _) {
        final themeMode =
            state.themeMode == AppThemeMode.dark ? ThemeMode.dark : ThemeMode.light;

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
    final savedToken = (prefs.getString(StorageKeys.mobileAccessToken) ?? '').trim();
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
    await prefs.setString(StorageKeys.mobileAccessToken, session.accessToken);
    await prefs.setString(StorageKeys.mobileUserName, session.name);
    await prefs.setString(StorageKeys.mobileUserEmail, session.email);

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
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (_token == null || _token!.isEmpty) {
      return AuthFlow(state: widget.state, api: _api, onSignedIn: _handleSignedIn);
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
  login,
  register,
  checkEmail,
  verifyEmail,
  forgotPassword,
  resetPassword,
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
  _AuthView _view = _AuthView.login;
  String _email = '';

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
    switch (_view) {
      case _AuthView.login:
        return LoginScreen(
          state: widget.state,
          api: widget.api,
          prefillEmail: _email.isEmpty ? null : _email,
          onSignedIn: widget.onSignedIn,
          onGoToRegister: () => _go(_AuthView.register, email: _email),
          onGoToForgotPassword: () => _go(_AuthView.forgotPassword, email: _email),
        );
      case _AuthView.register:
        return RegisterScreen(
          state: widget.state,
          api: widget.api,
          onGoToLogin: () => _go(_AuthView.login, email: _email),
          onRegisteredNeedingVerification: (email) =>
              _go(_AuthView.checkEmail, email: email),
        );
      case _AuthView.checkEmail:
        return CheckEmailScreen(
          state: widget.state,
          api: widget.api,
          email: _email,
          onEnterVerificationCode: () =>
              _go(_AuthView.verifyEmail, email: _email),
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
          onGoToResetPassword: (email) => _go(_AuthView.resetPassword, email: email),
        );
      case _AuthView.resetPassword:
        return ResetPasswordScreen(
          state: widget.state,
          api: widget.api,
          onDone: () => _go(_AuthView.login, email: _email),
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
  final TextEditingController _accountsSearchController = TextEditingController();
  String _accountsQuery = '';
  String _accountsStatusFilter = 'all';
  final TextEditingController _executionsSearchController = TextEditingController();
  String _executionsQuery = '';
  String _executionsStatusFilter = 'all';
  String _analyticsQuery = '';
  String _analyticsSortBy = 'successRate';
  String _analyticsSortDir = 'desc';
  int _analyticsOffset = 0;
  bool _analyticsHasMore = false;
  bool _analyticsLoadingMore = false;
  Timer? _executionsDebounceTimer;
  Timer? _analyticsDebounceTimer;
  final TextEditingController _analyticsSearchController = TextEditingController();
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
  final TextEditingController _settingsImageUrlController = TextEditingController();
  final TextEditingController _settingsCurrentPasswordController = TextEditingController();
  final TextEditingController _settingsNewPasswordController = TextEditingController();
  final TextEditingController _settingsConfirmPasswordController = TextEditingController();

  String _settingsSelectedPlatform = 'twitter';
  bool _settingsCredentialsLoading = false;
  bool _settingsCredentialsSaving = false;
  String _settingsCredentialsError = '';
  bool _settingsCredentialsDirty = false;
  Map<String, Map<String, String>> _settingsCredentialMap = <String, Map<String, String>>{};
  Map<String, String> _settingsCredentialDraft = <String, String>{};
  final Map<String, TextEditingController> _settingsCredentialControllers = <String, TextEditingController>{};
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
          payload = await widget.api.fetchExecutions(
            widget.accessToken,
            limit: 60,
          );
          break;
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
        state.error =
            error is ApiException ? error.message : 'Failed to load panel.';
      });
    }
  }

  Future<void> _onPanelSelected(int index) async {
    if (_selectedIndex == index) return;

    setState(() => _selectedIndex = index);
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
      await widget.appState.setSidebarCollapsed(!widget.appState.sidebarCollapsed);
      return;
    }

    final state = _scaffoldKey.currentState;
    if (state == null) return;
    if (state.isDrawerOpen) {
      Navigator.of(context).maybePop();
      return;
    }
    state.openDrawer();
  }

  void _openProfilePanel({required bool closeDrawer}) {
    final settingsIndex = kPanelSpecs.indexWhere((p) => p.kind == PanelKind.settings);
    if (settingsIndex < 0) return;
    if (closeDrawer) {
      Navigator.of(context).maybePop();
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
    _settingsImageUrlController.text = user['profileImageUrl']?.toString() ?? '';
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
      {'key': 'clientId', 'label': 'OAuth Client ID', 'hint': 'Twitter app client id', 'secret': false},
      {'key': 'clientSecret', 'label': 'OAuth Client Secret', 'hint': 'Twitter app client secret', 'secret': true},
      {'key': 'apiKey', 'label': 'API Key (OAuth1)', 'hint': 'Twitter API key', 'secret': false},
      {'key': 'apiSecret', 'label': 'API Secret (OAuth1)', 'hint': 'Twitter API secret', 'secret': true},
      {'key': 'accessToken', 'label': 'Access Token (OAuth1)', 'hint': 'Twitter access token', 'secret': true},
      {'key': 'accessTokenSecret', 'label': 'Access Token Secret (OAuth1)', 'hint': 'Twitter access token secret', 'secret': true},
      {'key': 'bearerToken', 'label': 'Bearer Token (Streaming)', 'hint': 'Twitter bearer token', 'secret': true},
      {'key': 'webhookSecret', 'label': 'Webhook Secret', 'hint': 'Twitter webhook/API secret', 'secret': true},
    ],
    'facebook': [
      {'key': 'clientId', 'label': 'App ID / Client ID', 'hint': 'Facebook app id', 'secret': false},
      {'key': 'clientSecret', 'label': 'App Secret / Client Secret', 'hint': 'Facebook app secret', 'secret': true},
    ],
    'instagram': [
      {'key': 'clientId', 'label': 'Client ID', 'hint': 'Instagram client id', 'secret': false},
      {'key': 'clientSecret', 'label': 'Client Secret', 'hint': 'Instagram client secret', 'secret': true},
    ],
    'youtube': [
      {'key': 'clientId', 'label': 'Google Client ID', 'hint': 'Google OAuth client id', 'secret': false},
      {'key': 'clientSecret', 'label': 'Google Client Secret', 'hint': 'Google OAuth client secret', 'secret': true},
    ],
    'tiktok': [
      {'key': 'clientId', 'label': 'Client Key', 'hint': 'TikTok client key', 'secret': false},
      {'key': 'clientSecret', 'label': 'Client Secret', 'hint': 'TikTok client secret', 'secret': true},
    ],
    'linkedin': [
      {'key': 'clientId', 'label': 'Client ID', 'hint': 'LinkedIn client id', 'secret': false},
      {'key': 'clientSecret', 'label': 'Client Secret', 'hint': 'LinkedIn client secret', 'secret': true},
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
      final payload = await widget.api.fetchPlatformCredentials(widget.accessToken);
      final raw = payload['credentials'];
      final map = <String, Map<String, String>>{};
      if (raw is Map) {
        for (final entry in raw.entries) {
          final platformId = entry.key?.toString() ?? '';
          if (platformId.trim().isEmpty) continue;
          final value = entry.value;
          if (value is Map) {
            map[platformId] = value.map((k, v) => MapEntry(k.toString(), v?.toString() ?? ''));
          }
        }
      }

      if (!mounted) return;
      setState(() {
        _settingsCredentialMap = map;
        _settingsCredentialsLoading = false;
      });

      _setSettingsSelectedPlatform(_settingsSelectedPlatform, allowSetState: false);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _settingsCredentialsLoading = false;
        _settingsCredentialsError =
            error is ApiException ? error.message : 'Failed to load platform credentials.';
      });
    }
  }

  void _setSettingsSelectedPlatform(String platformId, {bool allowSetState = true}) {
    final normalized = platformId.trim().toLowerCase();
    final next = _kManagedPlatformIds.contains(normalized) ? normalized : 'twitter';
    if (_settingsSelectedPlatform == next && _settingsCredentialControllers.isNotEmpty) return;

    void apply() {
      _settingsSelectedPlatform = next;
      _settingsCredentialsDirty = false;
      _settingsCredentialDraft = Map<String, String>.from(_settingsCredentialMap[next] ?? const <String, String>{});
      for (final c in _settingsCredentialControllers.values) {
        c.dispose();
      }
      _settingsCredentialControllers.clear();
      for (final field in (_kPlatformFields[next] ?? const <Map<String, dynamic>>[])) {
        final key = field['key']?.toString() ?? '';
        if (key.isEmpty) continue;
        _settingsCredentialControllers[key] = TextEditingController(text: _settingsCredentialDraft[key] ?? '');
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
    final fields = _kPlatformFields[_settingsSelectedPlatform] ?? const <Map<String, dynamic>>[];
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
      _toast('${_kPlatformLabels[_settingsSelectedPlatform] ?? _settingsSelectedPlatform} credentials saved');
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _settingsCredentialsSaving = false;
        _settingsCredentialsError =
            error is ApiException ? error.message : 'Failed to save credentials.';
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
      setState(() => _settingsProfileError = 'New password must be at least 8 characters.');
      return;
    }
    if (next != confirm) {
      setState(() => _settingsProfileError = 'Confirm password does not match.');
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
        _settingsProfileError =
            error is ApiException ? error.message : 'Failed to update password.';
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
      final nextList = payload['taskStats'] is List ? (payload['taskStats'] as List) : const <dynamic>[];

      final merged = <dynamic>[...prev, ...nextList];
      final mergedPayload = <String, dynamic>{
        ...payload,
        'taskStats': merged,
      };

      if (!mounted) return;
      setState(() {
        state.data = mergedPayload;
        _analyticsOffset = _readInt(payload['nextOffset'], fallback: merged.length);
        _analyticsHasMore = payload['hasMore'] == true;
        _analyticsLoadingMore = false;
        _panelUpdatedAt[PanelKind.analytics] = DateTime.now();
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _analyticsLoadingMore = false);
      final message = error is ApiException ? error.message : 'Failed to load analytics.';
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

        final nextTasksRaw =
            payload['tasks'] is List ? (payload['tasks'] as List) : const <dynamic>[];
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
    _executionsDebounceTimer?.cancel();
    _executionsDebounceTimer = Timer(const Duration(milliseconds: 220), () {
      if (!mounted) return;
      if (_executionsQuery == next) return;
      setState(() => _executionsQuery = next);
    });
  }

  Future<void> _exportTasksCsv() async {
    final i18n = _i18n(context);
    try {
      final csv = await widget.api.exportTasksCsv(widget.accessToken, limit: 5000);
      await Clipboard.setData(ClipboardData(text: csv));
      _toast(i18n.isArabic ? 'تم نسخ CSV إلى الحافظة.' : 'CSV copied to clipboard.');
    } catch (error) {
      final message = error is ApiException ? error.message : 'Failed to export tasks.';
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
        return _TaskComposerSheet(
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
        return _TaskComposerSheet(
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

  Widget _buildDrawer(I18n i18n) {
    final scheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Drawer(
      child: SafeArea(
        child: Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(16, 18, 16, 16),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    scheme.primary.withOpacity(isDark ? 0.30 : 0.18),
                    scheme.secondary.withOpacity(isDark ? 0.18 : 0.10),
                    scheme.surface.withOpacity(isDark ? 0.65 : 0.92),
                  ],
                ),
              ),
              child: Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(14),
                    child: Image.asset(
                      'assets/icon-192.png',
                      width: 42,
                      height: 42,
                      fit: BoxFit.cover,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.userName.trim().isEmpty ? 'SocialFlow' : widget.userName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          widget.userEmail,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(color: scheme.onSurfaceVariant, fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
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
                      leading: Icon(panel.icon),
                      title: Text(i18n.t(panel.labelKey, panel.fallbackLabel)),
                      selected: selected,
                      selectedTileColor: scheme.primary.withOpacity(isDark ? 0.20 : 0.10),
                      onTap: () {
                        Navigator.of(context).maybePop();
                        unawaited(_onPanelSelected(index));
                      },
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
                Navigator.of(context).maybePop();
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
    return NavigationRail(
      selectedIndex: _selectedIndex,
      extended: !collapsed,
      labelType: collapsed ? NavigationRailLabelType.selected : NavigationRailLabelType.none,
      leading: Padding(
        padding: const EdgeInsets.only(top: 8),
        child: IconButton(
          tooltip: collapsed ? 'Expand sidebar' : 'Collapse sidebar',
          onPressed: () => unawaited(_toggleSidebar(wide: true)),
          icon: Icon(collapsed ? Icons.menu_open_rounded : Icons.menu_rounded),
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
      onDestinationSelected: (index) => unawaited(_onPanelSelected(index)),
      destinations: kPanelSpecs
          .map(
            (panel) => NavigationRailDestination(
              icon: Icon(panel.icon),
              selectedIcon: Icon(panel.icon),
              label: Text(i18n.t(panel.labelKey, panel.fallbackLabel)),
            ),
          )
          .toList(),
    );
  }

  Widget _buildBottomNavigation(I18n i18n) {
    return NavigationBar(
      selectedIndex: _selectedIndex,
      onDestinationSelected: (index) => unawaited(_onPanelSelected(index)),
      destinations: kPanelSpecs
          .map(
            (panel) => NavigationDestination(
              icon: Icon(panel.icon),
              label: i18n.t(panel.labelKey, panel.fallbackLabel),
            ),
          )
          .toList(),
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
        color: scheme.outline.withOpacity(isDark ? 0.30 : 0.20),
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
      physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
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
                              _skeletonBlock(context: context, height: 16, width: 170),
                              const SizedBox(height: 10),
                              _skeletonBlock(context: context, height: 14),
                              const SizedBox(height: 8),
                              _skeletonBlock(context: context, height: 14, width: 240),
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
        if (kind == PanelKind.tasks) return _loadTasksPage(reset: true, showPanelLoading: true);
        if (kind == PanelKind.analytics) return _loadPanel(kind, force: true);
        return _loadPanel(kind, force: true);
      },
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
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
        final count = rawCount is num ? rawCount.toInt() : int.tryParse(rawCount?.toString() ?? '0') ?? 0;
        if (key.trim().isEmpty) continue;
        entries.add(MapEntry<String, int>(key, count));
      }
      entries.sort((a, b) => b.value.compareTo(a.value));
      return entries;
    })();

    Widget pill(String text, {Color? bg, Color? fg, IconData? icon}) {
      final colorScheme = Theme.of(context).colorScheme;
      final resolvedBg = bg ?? colorScheme.primary.withAlpha((0.10 * 255).round());
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

    Widget sectionTitle(String title, {VoidCallback? onViewAll}) {
      return Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            title,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
          ),
          if (onViewAll != null)
            TextButton(
              onPressed: onViewAll,
              child: Text(i18n.t('dashboard.viewAll', 'View all')),
            ),
        ],
      );
    }

    Widget statGrid() {
      return Wrap(
        spacing: 12,
        runSpacing: 12,
        children: [
          SizedBox(
            width: 280,
            child: SfKpiTile(
              label: i18n.t('dashboard.kpi.totalTasks', 'Total tasks'),
              value: '$totalTasks',
              icon: Icons.task_rounded,
            ),
          ),
          SizedBox(
            width: 280,
            child: SfKpiTile(
              label: i18n.t('dashboard.kpi.activeTasks', 'Active tasks'),
              value: '$activeTasks',
              icon: Icons.play_circle_fill_rounded,
              tone: Theme.of(context).colorScheme.primary,
            ),
          ),
          SizedBox(
            width: 280,
            child: SfKpiTile(
              label: i18n.t('dashboard.kpi.connectedAccounts', 'Connected accounts'),
              value: '$totalAccounts',
              icon: Icons.groups_rounded,
              tone: Theme.of(context).colorScheme.secondary,
            ),
          ),
          SizedBox(
            width: 280,
            child: SfKpiTile(
              label: i18n.t('dashboard.kpi.executionSuccess', 'Execution success'),
              value: '$successRate%',
              icon: Icons.query_stats_rounded,
              tone: Colors.green.shade700,
            ),
          ),
        ],
      );
    }

    Widget dashboardHeader() {
      final colorScheme = Theme.of(context).colorScheme;
      return SfPanelCard(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            pill(
              i18n.t('dashboard.liveOps', 'Live Operations'),
              icon: Icons.bolt_rounded,
            ),
            const SizedBox(height: 10),
            Text(
              i18n.t('dashboard.title', 'SocialFlow Dashboard'),
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 6),
            Text(
              i18n.t(
                'dashboard.subtitle',
                'Unified control center for tasks, accounts, executions, and operational health.',
              ),
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                pill('$activeTasks ${i18n.t('dashboard.kpi.active', 'active')}'),
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
                pill('$successRate% ${i18n.t('dashboard.kpi.successRate', 'success rate')}'),
                if (hasAuthWarnings)
                  pill(
                    i18n.t('dashboard.kpi.oauthAttention', 'OAuth attention needed'),
                    bg: Colors.orange.shade700.withAlpha((0.18 * 255).round()),
                    fg: Colors.orange.shade700,
                    icon: Icons.shield_rounded,
                  ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                OutlinedButton.icon(
                  onPressed: () => unawaited(_loadPanel(PanelKind.dashboard, force: true)),
                  icon: const Icon(Icons.refresh_rounded),
                  label: Text(i18n.t('common.refresh', 'Refresh')),
                ),
                OutlinedButton.icon(
                  onPressed: () => unawaited(_onPanelSelected(kPanelSpecs.indexWhere((p) => p.kind == PanelKind.accounts))),
                  icon: const Icon(Icons.groups_rounded),
                  label: Text(i18n.t('dashboard.actions.connectAccount', 'Connect Account')),
                ),
                FilledButton.icon(
                  onPressed: () async => _openCreateTaskSheet(),
                  icon: const Icon(Icons.add_rounded),
                  label: Text(i18n.t('dashboard.actions.createTask', 'Create New Task')),
                ),
              ],
            ),
          ],
        ),
      );
    }

    String normalizeTaskStatus(String raw) {
      final value = raw.trim().toLowerCase();
      if (value == 'active' || value == 'enabled' || value == 'running') return 'active';
      if (value == 'paused' || value == 'inactive' || value == 'disabled') return 'paused';
      if (value == 'completed' || value == 'done' || value == 'success') return 'completed';
      if (value == 'error' || value == 'failed' || value == 'failure') return 'error';
      return 'paused';
    }

    String statusLabel(String normalized) {
      if (normalized == 'active') return i18n.t('status.active', 'Active');
      if (normalized == 'paused') return i18n.t('status.paused', 'Paused');
      if (normalized == 'completed') return i18n.t('status.completed', 'Completed');
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
      final normalized = platformId.trim().toLowerCase();
      final icon = (() {
        if (normalized.contains('telegram')) return Icons.send_rounded;
        if (normalized.contains('twitter')) return Icons.alternate_email_rounded;
        if (normalized.contains('youtube')) return Icons.ondemand_video_rounded;
        if (normalized.contains('tiktok')) return Icons.music_note_rounded;
        if (normalized.contains('instagram')) return Icons.camera_alt_rounded;
        if (normalized.contains('facebook')) return Icons.facebook_rounded;
        return Icons.public_rounded;
      })();

      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          border: Border.all(
            color: Theme.of(context).colorScheme.onSurface.withAlpha((0.12 * 255).round()),
          ),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16),
            const SizedBox(width: 8),
            Text(
              count == null ? platformId : '$platformId $count',
              style: const TextStyle(fontWeight: FontWeight.w700),
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
        final message = error is ApiException ? error.message : i18n.t('dashboard.toast.taskUpdateFailed', 'Failed to update task');
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
        final message = error is ApiException ? error.message : i18n.t('dashboard.toast.taskRunFailed', 'Failed to run task');
        _toast(message);
      } finally {
        if (!mounted) return;
        setState(() {
          _taskActionState.remove(id);
        });
      }
    }

    Widget recentAutomationsCard() {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              sectionTitle(
                i18n.t('dashboard.section.recentAutomations', 'Recent Automations'),
                onViewAll: () => unawaited(_onPanelSelected(kPanelSpecs.indexWhere((p) => p.kind == PanelKind.tasks))),
              ),
              const SizedBox(height: 8),
              if (recentTasks.isEmpty)
                Text(i18n.t('dashboard.noTasks', 'No tasks yet.'))
              else
                ...recentTasks.take(6).map((raw) {
                  final task = raw is Map<String, dynamic>
                      ? Map<String, dynamic>.from(raw)
                      : Map<String, dynamic>.from(raw as Map);
                  final id = task['id']?.toString() ?? '';
                  final normalized = normalizeTaskStatus(task['status']?.toString() ?? '');
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

                  return Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: scheme.surface.withAlpha((0.45 * 255).round()),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: scheme.onSurface.withAlpha((0.12 * 255).round())),
                    ),
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
                                    crossAxisAlignment: WrapCrossAlignment.center,
                                    children: [
                                      Text(
                                        task['name']?.toString() ?? 'Unnamed task',
                                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                                      ),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: pillColor.withAlpha((0.14 * 255).round()),
                                          border: Border.all(color: pillColor.withAlpha((0.32 * 255).round())),
                                          borderRadius: BorderRadius.circular(999),
                                        ),
                                        child: Text(
                                          statusLabel(normalized),
                                          style: TextStyle(color: pillColor, fontWeight: FontWeight.w800),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    '${i18n.t('dashboard.lastRun', 'Last run')}: ${relativeTime(task['lastExecuted'])}',
                                    style: Theme.of(context).textTheme.bodySmall,
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 10),
                            Wrap(
                              spacing: 6,
                              children: [
                                IconButton(
                                  onPressed: busy ? null : () => unawaited(toggleTask(task)),
                                  tooltip: normalized == 'active'
                                      ? i18n.t('dashboard.task.pause', 'Pause task')
                                      : i18n.t('dashboard.task.enable', 'Enable task'),
                                  icon: Icon(
                                    normalized == 'active'
                                        ? Icons.pause_circle_filled_rounded
                                        : Icons.play_circle_fill_rounded,
                                  ),
                                ),
                                IconButton(
                                  onPressed: busy ? null : () => unawaited(runTask(task)),
                                  tooltip: i18n.t('dashboard.task.runNow', 'Run task now'),
                                  icon: const Icon(Icons.bolt_rounded),
                                ),
                                IconButton(
                                  onPressed: () {
                                    unawaited(_openEditTaskSheet(task));
                                  },
                                  tooltip: i18n.t('dashboard.task.edit', 'Edit task'),
                                  icon: const Icon(Icons.open_in_new_rounded),
                                ),
                              ],
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                          decoration: BoxDecoration(
                            color: scheme.surface.withAlpha((0.55 * 255).round()),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: scheme.onSurface.withAlpha((0.12 * 255).round())),
                          ),
                          child: Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              if (sourcePlatforms.isEmpty)
                                Text(
                                  i18n.t('dashboard.task.noSource', 'No source'),
                                  style: Theme.of(context).textTheme.bodySmall,
                                )
                              else
                                ...sourcePlatforms.map((p) => platformChip(p, null)),
                              Text(
                                '→',
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                              if (targetPlatforms.isEmpty)
                                Text(
                                  i18n.t('dashboard.task.noTarget', 'No target'),
                                  style: Theme.of(context).textTheme.bodySmall,
                                )
                              else
                                ...targetPlatforms.map((p) => platformChip(p, null)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  );
                }),
            ],
          ),
        ),
      );
    }

    Widget systemHealthCard() {
      final scheme = Theme.of(context).colorScheme;
      final inactiveAccounts = _readInt(stats['inactiveAccounts'], fallback: 0);
      final activeAccounts = _readInt(stats['activeAccounts'], fallback: 0);

      int td(String key) => _readInt(taskBreakdown[key], fallback: 0);

      return Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                i18n.t('dashboard.section.systemHealth', 'System Health'),
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: scheme.onSurface.withAlpha((0.12 * 255).round())),
                  color: scheme.surface.withAlpha((0.40 * 255).round()),
                ),
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
                        pill('Paused ${td('paused')}', fg: scheme.secondary, bg: scheme.secondary.withAlpha((0.16 * 255).round())),
                        pill('Errors ${td('error')}', fg: scheme.error, bg: scheme.error.withAlpha((0.12 * 255).round())),
                        pill('Done ${td('completed')}', fg: Colors.green.shade700, bg: Colors.green.shade700.withAlpha((0.14 * 255).round())),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: scheme.onSurface.withAlpha((0.12 * 255).round())),
                  color: scheme.surface.withAlpha((0.40 * 255).round()),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          i18n.t('dashboard.health.accountReliability', 'Account reliability'),
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        Icon(
                          hasAuthWarnings ? Icons.shield_rounded : Icons.check_circle_rounded,
                          size: 16,
                          color: hasAuthWarnings ? scheme.secondary : scheme.primary,
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
                          : i18n.t('dashboard.health.noAuthIssues', 'No authentication issues detected.'),
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: scheme.onSurface.withAlpha((0.12 * 255).round())),
                  color: scheme.surface.withAlpha((0.40 * 255).round()),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      i18n.t('dashboard.health.platformsInUse', 'Platforms in use'),
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 10),
                    if (platformBreakdown.isEmpty)
                      Text(i18n.t('dashboard.health.noPlatforms', 'No connected platforms.'))
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
        ),
      );
    }

    Widget recentExecutionsCard() {
      final scheme = Theme.of(context).colorScheme;
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              sectionTitle(
                i18n.t('dashboard.section.recentExecutions', 'Recent Executions'),
                onViewAll: () => unawaited(_onPanelSelected(kPanelSpecs.indexWhere((p) => p.kind == PanelKind.executions))),
              ),
              const SizedBox(height: 8),
              if (recentExecutions.isEmpty)
                Text(i18n.t('dashboard.noExecutions', 'No executions yet.'))
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
                  final content = (execution['originalContent']?.toString() ?? '').trim();
                  final preview = content.isEmpty ? 'No text content' : content;

                    return Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: scheme.onSurface.withAlpha((0.12 * 255).round())),
                        color: scheme.surface.withAlpha((0.40 * 255).round()),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                execution['taskName']?.toString() ?? 'Task execution',
                                style: const TextStyle(fontWeight: FontWeight.w800),
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: color.withAlpha((0.14 * 255).round()),
                                border: Border.all(color: color.withAlpha((0.32 * 255).round())),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                status,
                                style: TextStyle(color: color, fontWeight: FontWeight.w800),
                              ),
                            ),
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
                  );
                }),
            ],
          ),
        ),
      );
    }

    Widget topTasksCard() {
      final scheme = Theme.of(context).colorScheme;
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                i18n.t('dashboard.section.topTasks', 'Top Performing Tasks'),
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 8),
              if (topTaskStats.isEmpty)
                Text(i18n.t('dashboard.noPerformance', 'Performance data will appear after executions run.'))
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

                    return Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: scheme.onSurface.withAlpha((0.12 * 255).round())),
                        color: scheme.surface.withAlpha((0.40 * 255).round()),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                item['taskName']?.toString() ?? 'Task',
                                style: const TextStyle(fontWeight: FontWeight.w800),
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: color.withAlpha((0.14 * 255).round()),
                                border: Border.all(color: color.withAlpha((0.32 * 255).round())),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                '${rate.toStringAsFixed(0)}%',
                                style: TextStyle(color: color, fontWeight: FontWeight.w800),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          '${item['totalExecutions'] ?? 0} runs • ${item['successful'] ?? 0} success • ${item['failed'] ?? 0} failed',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  );
                }),
            ],
          ),
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
                  onPressed: () => unawaited(_onPanelSelected(kPanelSpecs.indexWhere((p) => p.kind == PanelKind.accounts))),
                  child: Text(i18n.t('dashboard.empty.connect', 'Connect Account')),
                ),
                FilledButton(
                  onPressed: () => unawaited(_onPanelSelected(kPanelSpecs.indexWhere((p) => p.kind == PanelKind.tasks))),
                  child: Text(i18n.t('dashboard.empty.create', 'Create First Task')),
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
        const SizedBox(height: 12),
        statGrid(),
        const SizedBox(height: 12),
        if (isEmptyWorkspace) emptyWorkspaceCard() else ...[
          LayoutBuilder(
            builder: (context, constraints) {
              final wide = constraints.maxWidth >= 1100;
              if (!wide) {
                return Column(
                  children: [
                    recentAutomationsCard(),
                    const SizedBox(height: 12),
                    systemHealthCard(),
                  ],
                );
              }
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(flex: 8, child: recentAutomationsCard()),
                  const SizedBox(width: 12),
                  Expanded(flex: 4, child: systemHealthCard()),
                ],
              );
            },
          ),
          const SizedBox(height: 12),
          LayoutBuilder(
            builder: (context, constraints) {
              final wide = constraints.maxWidth >= 1100;
              if (!wide) {
                return Column(
                  children: [
                    recentExecutionsCard(),
                    const SizedBox(height: 12),
                    topTasksCard(),
                  ],
                );
              }
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(flex: 7, child: recentExecutionsCard()),
                  const SizedBox(width: 12),
                  Expanded(flex: 5, child: topTasksCard()),
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
      if (value == 'active' || value == 'enabled' || value == 'running') return 'active';
      if (value == 'paused' || value == 'inactive' || value == 'disabled') return 'paused';
      if (value == 'completed' || value == 'done' || value == 'success') return 'completed';
      if (value == 'error' || value == 'failed' || value == 'failure') return 'error';
      return 'paused';
    }

    String statusLabel(String normalized) {
      if (normalized == 'active') return i18n.t('status.active', 'Active');
      if (normalized == 'paused') return i18n.t('status.paused', 'Paused');
      if (normalized == 'completed') return i18n.t('status.completed', 'Completed');
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
      final value = task['lastExecuted'] ?? task['lastExecutedAt'] ?? task['lastRunAt'];
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
        ...(task['sourceAccounts'] is List ? (task['sourceAccounts'] as List) : const <dynamic>[]),
        ...(task['targetAccounts'] is List ? (task['targetAccounts'] as List) : const <dynamic>[]),
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
        ...(task['sourceAccounts'] is List ? (task['sourceAccounts'] as List) : const <dynamic>[]),
        ...(task['targetAccounts'] is List ? (task['targetAccounts'] as List) : const <dynamic>[]),
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

    IconData platformIcon(String platformId) {
      final normalized = platformId.trim().toLowerCase();
      if (normalized.contains('telegram')) return Icons.send_rounded;
      if (normalized.contains('twitter')) return Icons.alternate_email_rounded;
      if (normalized.contains('youtube')) return Icons.ondemand_video_rounded;
      if (normalized.contains('tiktok')) return Icons.music_note_rounded;
      if (normalized.contains('instagram')) return Icons.camera_alt_rounded;
      if (normalized.contains('facebook')) return Icons.facebook_rounded;
      if (normalized.contains('linkedin')) return Icons.work_rounded;
      return Icons.public_rounded;
    }

    Widget badge(String text, {required Color tone, IconData? icon}) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: tone.withAlpha((0.12 * 255).round()),
          border: Border.all(color: tone.withAlpha((0.24 * 255).round())),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) Icon(icon, size: 14, color: tone),
            if (icon != null) const SizedBox(width: 6),
            Text(
              text,
              style: TextStyle(color: tone, fontWeight: FontWeight.w900, letterSpacing: 0.3),
            ),
          ],
        ),
      );
    }

    Widget platformBadge(String platformId) {
      final tone = scheme.onSurface.withAlpha((0.10 * 255).round());
      return Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: scheme.surface,
          border: Border.all(color: tone),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(platformIcon(platformId), size: 18),
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
        final message = error is ApiException ? error.message : 'Failed to update task.';
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
            content: const Text('This action is permanent and cannot be undone.'),
            actions: [
              TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
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
            final item = raw is Map ? raw : Map<String, dynamic>.from(raw as Map);
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
        final message = error is ApiException ? error.message : 'Failed to delete task.';
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
        final message = error is ApiException ? error.message : 'Failed to duplicate task.';
        _toast(message);
      } finally {
        if (!mounted) return;
        setState(() {
          _taskActionState.remove(id);
        });
      }
    }

    final tasks = rawTasks
        .map((raw) => raw is Map<String, dynamic> ? raw : Map<String, dynamic>.from(raw as Map))
        .toList();

    final availablePlatforms = <String>{
      for (final task in tasks) ...uniquePlatformsForTask(task),
    }.toList()
      ..sort();

    bool matchesPlatform(Map<String, dynamic> task) {
      if (_tasksPlatformFilter == 'all') return true;
      final platforms = uniquePlatformsForTask(task).map((p) => p.toLowerCase()).toList();
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
      return matchesPlatform(task) && matchesLastRun(task) && matchesIssue(task);
    }).toList();

    final activeCount = filtered.where((t) => normalizeTaskStatus(t['status']?.toString() ?? '') == 'active').length;
    final pausedCount = filtered.where((t) => normalizeTaskStatus(t['status']?.toString() ?? '') == 'paused').length;
    final errorCount = filtered.where((t) => normalizeTaskStatus(t['status']?.toString() ?? '') == 'error').length;

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

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Card(
          elevation: 0,
          color: scheme.surface.withAlpha((0.55 * 255).round()),
          child: Padding(
            padding: const EdgeInsets.all(14),
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
                  style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 6),
                Text(
                  i18n.isArabic ? 'إدارة ومراقبة مهام الأتمتة الخاصة بك.' : 'Manage and monitor your automation tasks.',
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
                      label: Text(i18n.isArabic ? 'إنشاء مهمة' : 'Create New Task'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  i18n.isArabic ? 'بحث وفلاتر' : 'Task Search & Filters',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _tasksSearchController,
                  decoration: InputDecoration(
                    prefixIcon: const Icon(Icons.search_rounded),
                    hintText: i18n.isArabic ? 'ابحث بالاسم أو الوصف...' : 'Search by name or description...',
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
                          DropdownMenuItem(value: 'all', child: Text('All statuses')),
                          DropdownMenuItem(value: 'active', child: Text('Active')),
                          DropdownMenuItem(value: 'paused', child: Text('Paused')),
                          DropdownMenuItem(value: 'completed', child: Text('Completed')),
                          DropdownMenuItem(value: 'error', child: Text('Error')),
                        ],
                        onChanged: (value) {
                          if (value == null) return;
                          if (_tasksStatusFilter == value) return;
                          setState(() => _tasksStatusFilter = value);
                          unawaited(_loadTasksPage(reset: true, showPanelLoading: true));
                        },
                      ),
                      DropdownButtonFormField<String>(
                        initialValue: _tasksPlatformFilter,
                        decoration: InputDecoration(
                          labelText: i18n.isArabic ? 'المنصة' : 'Platform',
                          prefixIcon: const Icon(Icons.public_rounded),
                        ),
                        items: [
                          const DropdownMenuItem(value: 'all', child: Text('All platforms')),
                          ...availablePlatforms.map(
                            (p) => DropdownMenuItem(value: p, child: Text(platformLabel(p))),
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
                          DropdownMenuItem(value: 'never', child: Text('Never ran')),
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
                          DropdownMenuItem(value: 'all', child: Text('All tasks')),
                          DropdownMenuItem(value: 'errors', child: Text('Errors only')),
                          DropdownMenuItem(value: 'warnings', child: Text('Auth warnings')),
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
                          DropdownMenuItem(value: 'createdAt', child: Text('Created')),
                          DropdownMenuItem(value: 'status', child: Text('Status')),
                          DropdownMenuItem(value: 'name', child: Text('Name')),
                        ],
                        onChanged: (value) {
                          if (value == null) return;
                          if (_tasksSortBy == value) return;
                          setState(() => _tasksSortBy = value);
                          unawaited(_loadTasksPage(reset: true, showPanelLoading: true));
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
                          unawaited(_loadTasksPage(reset: true, showPanelLoading: true));
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
                          label: Text('Status: ${statusLabel(_tasksStatusFilter)}'),
                          onDeleted: () => clearTaskFilter('status'),
                        ),
                      if (_tasksPlatformFilter != 'all')
                        InputChip(
                          label: Text('Platform: ${platformLabel(_tasksPlatformFilter)}'),
                          onDeleted: () => clearTaskFilter('platform'),
                        ),
                      if (_tasksLastRunFilter != 'all')
                        InputChip(
                          label: Text('Last run: ${_tasksLastRunFilter.toUpperCase()}'),
                          onDeleted: () => clearTaskFilter('lastRun'),
                        ),
                      if (_tasksIssueFilter != 'all')
                        InputChip(
                          label: Text('Issue: ${_tasksIssueFilter == 'errors' ? 'Errors' : 'Warnings'}'),
                          onDeleted: () => clearTaskFilter('issue'),
                        ),
                      if (_tasksSortBy != 'createdAt')
                        InputChip(
                          label: Text('Sort: ${_tasksSortBy == 'name' ? 'Name' : (_tasksSortBy == 'status' ? 'Status' : 'Created')}'),
                          onDeleted: () => clearTaskFilter('sortBy'),
                        ),
                      if (_tasksSortDir != 'desc')
                        InputChip(
                          label: Text('Direction: ${_tasksSortDir.toUpperCase()}'),
                          onDeleted: () => clearTaskFilter('sortDir'),
                        ),
                      OutlinedButton.icon(
                        onPressed: clearAllTaskFilters,
                        icon: const Icon(Icons.filter_alt_off_rounded),
                        label: Text(i18n.isArabic ? 'مسح الفلاتر' : 'Clear Filters'),
                      ),
                    ],
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        if (filtered.isEmpty)
          Card(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 26),
              child: Column(
                children: [
                  Icon(Icons.inbox_rounded, size: 40, color: scheme.onSurface.withAlpha((0.55 * 255).round())),
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
              final cardWidth = wide ? (constraints.maxWidth - 12) / 2 : constraints.maxWidth;
              return Wrap(
                spacing: 12,
                runSpacing: 12,
                children: filtered.map((task) {
                  final id = task['id']?.toString() ?? '';
                  final busy = _taskActionState.containsKey(id);
                  final normalized = normalizeTaskStatus(task['status']?.toString() ?? '');
                  final tone = statusTone(normalized);
                  final rate = successRate(task['executionCount'], task['failureCount']);
                  final lastRun = relativeLastRun(task);
                  final authWarning = taskHasAuthWarning(task);

                  final sourceIds = task['sourceAccounts'] is List ? (task['sourceAccounts'] as List) : const <dynamic>[];
                  final targetIds = task['targetAccounts'] is List ? (task['targetAccounts'] as List) : const <dynamic>[];
                  final routeCount = (sourceIds.isEmpty ? 1 : sourceIds.length) * (targetIds.isEmpty ? 1 : targetIds.length);

                  final platforms = uniquePlatformsForTask(task);
                  final description = (task['description']?.toString() ?? '').trim();
                  final lastError = (task['lastError']?.toString() ?? '').trim();
                  final showErrorText = normalized == 'error';
                  final descText = showErrorText
                      ? (lastError.isEmpty ? 'Error: Failed to fetch data' : 'Error: $lastError')
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

                  return SizedBox(
                    width: cardWidth,
                    child: Card(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              crossAxisAlignment: WrapCrossAlignment.center,
                              children: [
                                badge(statusLabel(normalized).toUpperCase(), tone: tone),
                                badge('Success $rate%', tone: scheme.onSurface),
                                if (authWarning) badge('OAuth Warning', tone: scheme.secondary, icon: Icons.shield_rounded),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        task['name']?.toString() ?? 'Task',
                                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
                                      ),
                                      if (descText.isNotEmpty) ...[
                                        const SizedBox(height: 4),
                                        Text(
                                          descText,
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                            color: showErrorText ? scheme.error : scheme.onSurface.withAlpha((0.75 * 255).round()),
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
                                  children: [
                                    IconButton(
                                      onPressed: busy ? null : () => unawaited(toggleTaskStatus(task)),
                                      tooltip: normalized == 'active' ? 'Disable task' : 'Enable task',
                                      icon: Icon(
                                        normalized == 'active' ? Icons.pause_circle_filled_rounded : Icons.play_circle_fill_rounded,
                                        color: normalized == 'active' ? scheme.secondary : scheme.primary,
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
                                      onPressed: busy
                                          ? null
                                          : () => unawaited(duplicateTask(task)),
                                      tooltip: 'Duplicate task',
                                      icon: const Icon(Icons.copy_all_rounded),
                                    ),
                                    IconButton(
                                      onPressed: busy
                                          ? null
                                          : () {
                                              final idx = kPanelSpecs.indexWhere((p) => p.kind == PanelKind.executions);
                                              if (idx < 0) return;
                                              setState(() {
                                                _executionsQuery = task['name']?.toString() ?? '';
                                                _executionsSearchController.text = _executionsQuery;
                                                _selectedIndex = idx;
                                              });
                                              unawaited(_loadPanel(PanelKind.executions, force: true));
                                            },
                                      tooltip: 'View logs',
                                      icon: const Icon(Icons.receipt_long_rounded),
                                    ),
                                    IconButton(
                                      onPressed: busy ? null : () => unawaited(deleteTask(task)),
                                      tooltip: 'Delete task',
                                      icon: Icon(Icons.delete_outline_rounded, color: scheme.error),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: scheme.surface.withAlpha((0.50 * 255).round()),
                                border: Border.all(color: scheme.onSurface.withAlpha((0.12 * 255).round())),
                                borderRadius: BorderRadius.circular(14),
                              ),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Wrap(
                                      spacing: 6,
                                      runSpacing: 6,
                                      children: sourcePlatforms.isEmpty
                                          ? [Text(i18n.isArabic ? 'بدون مصدر' : 'No source')]
                                          : sourcePlatforms.map((p) => platformBadge(p)).toList(),
                                    ),
                                  ),
                                  Padding(
                                    padding: const EdgeInsets.symmetric(horizontal: 8),
                                    child: Icon(Icons.arrow_forward_rounded, color: scheme.onSurface.withAlpha((0.55 * 255).round())),
                                  ),
                                  Expanded(
                                    child: Wrap(
                                      spacing: 6,
                                      runSpacing: 6,
                                      children: targetPlatforms.isEmpty
                                          ? [Text(i18n.isArabic ? 'بدون هدف' : 'No target')]
                                          : targetPlatforms.map((p) => platformBadge(p)).toList(),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 10),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                badge('Accounts: ${sourceIds.length + targetIds.length}', tone: scheme.onSurface),
                                badge('Transfers: ${_readInt(task['executionCount'], fallback: 0)}', tone: scheme.onSurface),
                                badge('Routes: $routeCount', tone: scheme.onSurface),
                                badge('Last run: $lastRun', tone: scheme.onSurface, icon: Icons.schedule_rounded),
                                if (platforms.isNotEmpty)
                                  badge(
                                    platforms.map(platformLabel).join(', '),
                                    tone: scheme.onSurface,
                                    icon: Icons.public_rounded,
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                }).toList(),
              );
            },
          ),
        if (hasMore) ...[
          const SizedBox(height: 12),
          Center(
            child: OutlinedButton(
              onPressed: _tasksLoadingMore ? null : () => unawaited(_loadMoreTasks()),
              child: Text(_tasksLoadingMore ? (i18n.isArabic ? '...جاري التحميل' : 'Loading...') : (i18n.isArabic ? 'تحميل المزيد' : 'Load More')),
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
        .map((raw) => raw is Map<String, dynamic> ? raw : Map<String, dynamic>.from(raw as Map))
        .toList();

    bool matchesSearch(Map<String, dynamic> item) {
      if (_accountsQuery.isEmpty) return true;
      final query = _accountsQuery.toLowerCase();
      final name = item['accountName']?.toString().toLowerCase() ?? '';
      final username = item['accountUsername']?.toString().toLowerCase() ?? '';
      final platform = item['platformId']?.toString().toLowerCase() ?? '';
      return name.contains(query) || username.contains(query) || platform.contains(query);
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
    final activeCount = accounts.where((item) => item['isActive'] == true).length;
    final inactiveCount = (total - activeCount).clamp(0, total);
    final hasAccountFilters = _accountsQuery.isNotEmpty || _accountsStatusFilter != 'all';

    final groupedByPlatform = <String, List<Map<String, dynamic>>>{};
    for (final account in filtered) {
      final platformId = account['platformId']?.toString().trim().toLowerCase() ?? '';
      final key = platformId.isEmpty ? 'unknown' : platformId;
      groupedByPlatform.putIfAbsent(key, () => <Map<String, dynamic>>[]).add(account);
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
                onPressed: () => unawaited(_loadPanel(PanelKind.accounts, force: true)),
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
                  i18n.t('accounts.kpi.inactive', 'Inactive') + ': $inactiveCount',
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
              onChanged: (value) => setState(() => _accountsQuery = value.trim()),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                ChoiceChip(
                  label: Text(i18n.isArabic ? 'الكل' : 'All'),
                  selected: _accountsStatusFilter == 'all',
                  onSelected: (_) => setState(() => _accountsStatusFilter = 'all'),
                ),
                ChoiceChip(
                  label: Text('${i18n.t('accounts.active', 'Active')} ($activeCount)'),
                  selected: _accountsStatusFilter == 'active',
                  onSelected: (_) => setState(() => _accountsStatusFilter = 'active'),
                ),
                ChoiceChip(
                  label: Text('${i18n.t('accounts.inactive', 'Inactive')} ($inactiveCount)'),
                  selected: _accountsStatusFilter == 'inactive',
                  onSelected: (_) => setState(() => _accountsStatusFilter = 'inactive'),
                ),
                if (hasAccountFilters)
                  OutlinedButton.icon(
                    onPressed: clearAccountFilters,
                    icon: const Icon(Icons.filter_alt_off_rounded),
                    label: Text(i18n.isArabic ? 'مسح الفلاتر' : 'Clear Filters'),
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
      final active = account['isActive'] == true;
      final title = (name == null || name.isEmpty) ? i18n.t('accounts.account', 'Account') : name;
      final handle = (username == null || username.isEmpty) ? '-' : '@$username';
      final platformLabel = _platformLabel(platformId);
      final tone = active ? Colors.green.shade700 : scheme.error;
      final created = DateTime.tryParse(account['createdAt']?.toString() ?? '');
      final createdLabel = created == null
          ? ''
          : '${created.year}-${created.month.toString().padLeft(2, '0')}-${created.day.toString().padLeft(2, '0')}';

      return Card(
        margin: const EdgeInsets.only(bottom: 10),
        child: ListTile(
          leading: Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              color: scheme.surface.withOpacity(0.55),
              border: Border.all(color: scheme.onSurface.withOpacity(0.10)),
            ),
            child: Icon(_platformIcon(platformId), color: scheme.onSurfaceVariant),
          ),
          title: Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
          subtitle: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('$platformLabel • $handle'),
              if (createdLabel.isNotEmpty)
                Text(
                  i18n.isArabic ? 'أضيف $createdLabel' : 'Added $createdLabel',
                  style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 12),
                ),
            ],
          ),
          trailing: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (username != null && username.isNotEmpty)
                IconButton(
                  tooltip: i18n.isArabic ? 'نسخ اسم المستخدم' : 'Copy username',
                  onPressed: () async {
                    await Clipboard.setData(ClipboardData(text: '@$username'));
                    _toast(i18n.isArabic ? 'تم نسخ اسم المستخدم.' : 'Username copied');
                  },
                  icon: const Icon(Icons.content_copy_rounded, size: 18),
                ),
              SfBadge(
                active ? i18n.t('accounts.active', 'Active') : i18n.t('accounts.inactive', 'Inactive'),
                tone: tone,
                icon: active ? Icons.check_rounded : Icons.close_rounded,
              ),
            ],
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        searchCard(),
        const SizedBox(height: 12),
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
                    child: Text(i18n.isArabic ? 'مسح الفلاتر' : 'Clear Filters'),
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
                        Icon(_platformIcon(platformId), size: 18, color: scheme.onSurfaceVariant),
                        const SizedBox(width: 8),
                        Text(
                          _platformLabel(platformId),
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
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
    final executionsRaw = data['executions'] is List
        ? (data['executions'] as List)
        : const <dynamic>[];
    final executions = executionsRaw
        .map((raw) => raw is Map<String, dynamic> ? raw : Map<String, dynamic>.from(raw as Map))
        .toList();

    String normalizeStatus(String status) {
      final v = status.trim().toLowerCase();
      if (v.contains('success') || v.contains('completed') || v.contains('done')) {
        return 'success';
      }
      if (v.contains('fail') || v.contains('error')) return 'failed';
      if (v.contains('running') || v.contains('processing') || v.contains('progress')) {
        return 'running';
      }
      if (v.contains('pending') || v.contains('queued') || v.contains('wait')) {
        return 'pending';
      }
      return 'other';
    }

    bool matchesStatus(Map<String, dynamic> item) {
      if (_executionsStatusFilter == 'all') return true;
      final normalized = normalizeStatus(item['status']?.toString() ?? '');
      return normalized == _executionsStatusFilter;
    }

    bool matchesQuery(Map<String, dynamic> item) {
      if (_executionsQuery.isEmpty) return true;
      final query = _executionsQuery.toLowerCase();
      final taskName = item['taskName']?.toString().toLowerCase() ?? '';
      final status = item['status']?.toString().toLowerCase() ?? '';
      final source = item['sourceAccountName']?.toString().toLowerCase() ?? '';
      final target = item['targetAccountName']?.toString().toLowerCase() ?? '';
      return taskName.contains(query) ||
          status.contains(query) ||
          source.contains(query) ||
          target.contains(query);
    }

    final filtered = executions.where((item) {
      return matchesQuery(item) && matchesStatus(item);
    }).toList();

    final total = executions.length;
    final successCount =
        executions.where((e) => normalizeStatus(e['status']?.toString() ?? '') == 'success').length;
    final failedCount =
        executions.where((e) => normalizeStatus(e['status']?.toString() ?? '') == 'failed').length;
    final runningCount =
        executions.where((e) => normalizeStatus(e['status']?.toString() ?? '') == 'running').length;
    final pendingCount =
        executions.where((e) => normalizeStatus(e['status']?.toString() ?? '') == 'pending').length;
    final hasExecutionFilters = _executionsQuery.isNotEmpty || _executionsStatusFilter != 'all';

    String statusLabel(String normalized) {
      if (normalized == 'success') return i18n.isArabic ? 'نجاح' : 'Success';
      if (normalized == 'failed') return i18n.isArabic ? 'فشل' : 'Failed';
      if (normalized == 'running') return i18n.isArabic ? 'قيد التشغيل' : 'Running';
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
      final day = '${local.year}-${local.month.toString().padLeft(2, '0')}-${local.day.toString().padLeft(2, '0')}';
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
        _toast(i18n.isArabic ? 'لا يمكن إعادة المحاولة لهذا التنفيذ.' : 'Retry is not available for this execution.');
        return;
      }
      if (executionId.isNotEmpty && _executionActionState.containsKey(executionId)) return;

      if (executionId.isNotEmpty) {
        setState(() => _executionActionState[executionId] = 'retry');
      }
      try {
        await widget.api.runTask(widget.accessToken, taskId);
        _toast(i18n.isArabic ? 'تمت جدولة إعادة التشغيل.' : 'Execution retry queued');
        await _loadPanel(PanelKind.executions, force: true);
        await _loadPanel(PanelKind.dashboard, force: true);
      } catch (error) {
        final message = error is ApiException ? error.message : 'Failed to retry execution.';
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
      final sourceName = (execution['sourceAccountName']?.toString() ?? '').trim();
      final targetName = (execution['targetAccountName']?.toString() ?? '').trim();
      final sourcePlatformId = execution['sourcePlatformId']?.toString() ?? '';
      final targetPlatformId = execution['targetPlatformId']?.toString() ?? '';
      final when = formatWhen(execution['executedAt'] ?? execution['createdAt'] ?? execution['updatedAt']);
      final duration = formatDuration(execution);

      final responseData = execution['responseData'];
      final responseMap = responseData is Map
          ? responseData.map((k, v) => MapEntry(k.toString(), v))
          : const <String, dynamic>{};
      final payloadText = prettyJson(responseData).trim();
      final logsText = prettyJson(
        execution['logs'] ?? responseMap['logs'] ?? responseMap['events'] ?? responseMap['timeline'],
      ).trim();
      final stackText = (
        execution['errorStack'] ??
            execution['stack'] ??
            execution['trace'] ??
            responseMap['stack'] ??
            responseMap['trace'] ??
            responseMap['errorStack']
      ).toString().trim();
      final errorText = (execution['error']?.toString() ??
              execution['errorMessage']?.toString() ??
              execution['lastError']?.toString() ??
              responseMap['error']?.toString() ??
              '')
          .trim();
      final originalContent = (execution['originalContent']?.toString() ?? '').trim();
      final transformedContent = (execution['transformedContent']?.toString() ?? '').trim();

      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (context) {
          return SafeArea(
            child: FractionallySizedBox(
              heightFactor: 0.92,
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            taskName.isEmpty
                                ? (i18n.isArabic ? 'تفاصيل التنفيذ' : 'Execution details')
                                : taskName,
                            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
                          ),
                        ),
                        IconButton(
                          tooltip: i18n.isArabic ? 'نسخ الحمولة' : 'Copy payload',
                          onPressed: payloadText.isEmpty
                              ? null
                              : () async {
                                  await Clipboard.setData(ClipboardData(text: payloadText));
                                  _toast(i18n.isArabic ? 'تم نسخ الحمولة.' : 'Payload copied');
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
                                border: Border.all(color: scheme.outline.withAlpha((0.24 * 255).round())),
                              ),
                              child: Row(
                                children: [
                                  Icon(_platformIcon(sourcePlatformId), size: 16),
                                  const SizedBox(width: 6),
                                  Expanded(
                                    child: Text(
                                      sourceName.isEmpty ? 'Unknown source' : sourceName,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const Padding(
                            padding: EdgeInsets.symmetric(horizontal: 8),
                            child: Icon(Icons.arrow_forward_rounded),
                          ),
                          Expanded(
                            child: Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: scheme.outline.withAlpha((0.24 * 255).round())),
                              ),
                              child: Row(
                                children: [
                                  Icon(_platformIcon(targetPlatformId), size: 16),
                                  const SizedBox(width: 6),
                                  Expanded(
                                    child: Text(
                                      targetName.isEmpty ? 'Unknown target' : targetName,
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
                                Icon(Icons.error_outline_rounded, color: scheme.error, size: 18),
                                const SizedBox(width: 8),
                                Text(
                                  i18n.isArabic ? 'الخطأ' : 'Error',
                                  style: TextStyle(color: scheme.error, fontWeight: FontWeight.w900),
                                ),
                                const Spacer(),
                                IconButton(
                                  tooltip: i18n.isArabic ? 'نسخ الخطأ' : 'Copy error',
                                  onPressed: () async {
                                    await Clipboard.setData(ClipboardData(text: errorText));
                                    _toast(i18n.isArabic ? 'تم نسخ الخطأ.' : 'Error copied');
                                  },
                                  icon: const Icon(Icons.content_copy_rounded, size: 18),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            SelectableText(errorText),
                          ],
                        ),
                      ),
                    ],
                    if (stackText.isNotEmpty && stackText != 'null') ...[
                      const SizedBox(height: 12),
                      SfPanelCard(
                        padding: const EdgeInsets.all(14),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              i18n.isArabic ? 'التتبّع (Stack Trace)' : 'Stack trace',
                              style: const TextStyle(fontWeight: FontWeight.w900),
                            ),
                            const SizedBox(height: 8),
                            SelectableText(
                              stackText,
                              style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                    ],
                    if (originalContent.isNotEmpty || transformedContent.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      SfPanelCard(
                        padding: const EdgeInsets.all(14),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              i18n.isArabic ? 'المحتوى' : 'Content',
                              style: const TextStyle(fontWeight: FontWeight.w900),
                            ),
                            if (originalContent.isNotEmpty) ...[
                              const SizedBox(height: 8),
                              Text(i18n.isArabic ? 'الأصلي' : 'Original', style: TextStyle(color: scheme.onSurfaceVariant)),
                              const SizedBox(height: 4),
                              SelectableText(originalContent),
                            ],
                            if (transformedContent.isNotEmpty) ...[
                              const SizedBox(height: 10),
                              Text(i18n.isArabic ? 'بعد المعالجة' : 'Transformed', style: TextStyle(color: scheme.onSurfaceVariant)),
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
                            Text(i18n.isArabic ? 'السجلات' : 'Logs', style: const TextStyle(fontWeight: FontWeight.w900)),
                            const SizedBox(height: 8),
                            SelectableText(
                              logsText,
                              style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
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
                            Text(i18n.isArabic ? 'الحمولة (Payload)' : 'Payload', style: const TextStyle(fontWeight: FontWeight.w900)),
                            const SizedBox(height: 8),
                            SelectableText(
                              payloadText,
                              style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                    ],
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
      final sourceName = execution['sourceAccountName']?.toString() ?? 'Unknown source';
      final targetName = execution['targetAccountName']?.toString() ?? 'Unknown target';
      final when = formatWhen(execution['executedAt'] ?? execution['createdAt'] ?? execution['updatedAt']);
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
      _toast(i18n.isArabic ? 'تم نسخ تقرير التنفيذ.' : 'Execution report copied');
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
                onPressed: () => unawaited(_loadPanel(PanelKind.executions, force: true)),
                icon: const Icon(Icons.refresh_rounded),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _executionsSearchController,
              decoration: InputDecoration(
                prefixIcon: const Icon(Icons.search_rounded),
                hintText: i18n.t('executions.searchHint', 'Search by task name or status'),
              ),
              onChanged: _onExecutionsQueryChanged,
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                SfBadge('${i18n.t('executions.total', 'Total')}: $total', tone: scheme.onSurface),
                ChoiceChip(
                  label: Text(i18n.isArabic ? 'الكل' : 'All'),
                  selected: _executionsStatusFilter == 'all',
                  onSelected: (_) => setState(() => _executionsStatusFilter = 'all'),
                ),
                ChoiceChip(
                  label: Text('${statusLabel('success')} ($successCount)'),
                  selected: _executionsStatusFilter == 'success',
                  onSelected: (_) => setState(() => _executionsStatusFilter = 'success'),
                ),
                ChoiceChip(
                  label: Text('${statusLabel('failed')} ($failedCount)'),
                  selected: _executionsStatusFilter == 'failed',
                  onSelected: (_) => setState(() => _executionsStatusFilter = 'failed'),
                ),
                ChoiceChip(
                  label: Text('${statusLabel('running')} ($runningCount)'),
                  selected: _executionsStatusFilter == 'running',
                  onSelected: (_) => setState(() => _executionsStatusFilter = 'running'),
                ),
                ChoiceChip(
                  label: Text('${statusLabel('pending')} ($pendingCount)'),
                  selected: _executionsStatusFilter == 'pending',
                  onSelected: (_) => setState(() => _executionsStatusFilter = 'pending'),
                ),
                if (hasExecutionFilters)
                  OutlinedButton.icon(
                    onPressed: () {
                      setState(() {
                        _executionsQuery = '';
                        _executionsSearchController.text = '';
                        _executionsStatusFilter = 'all';
                      });
                    },
                    icon: const Icon(Icons.filter_alt_off_rounded),
                    label: Text(i18n.isArabic ? 'مسح الفلاتر' : 'Clear Filters'),
                  ),
              ],
            ),
          ],
        ),
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
      final when = formatWhen(execution['executedAt'] ?? execution['createdAt'] ?? execution['updatedAt']);
      final duration = formatDuration(execution);
      final errorText = (execution['error']?.toString() ??
              execution['errorMessage']?.toString() ??
              execution['lastError']?.toString() ??
              '')
          .trim();
      final busy = executionId.isNotEmpty && _executionActionState.containsKey(executionId);
      final title = (taskName == null || taskName.isEmpty)
          ? i18n.t('executions.item', 'Task execution')
          : taskName;

      return Card(
        margin: const EdgeInsets.only(bottom: 10),
        child: Padding(
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
                      color: statusColor.withOpacity(0.12),
                      border: Border.all(color: statusColor.withOpacity(0.26)),
                    ),
                    child: Icon(Icons.history_rounded, color: statusColor),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
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
                    children: [
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
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Icon(Icons.compare_arrows_rounded, size: 16, color: scheme.onSurfaceVariant),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(color: scheme.outline.withAlpha((0.20 * 255).round())),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(_platformIcon(sourcePlatformId), size: 14),
                              const SizedBox(width: 5),
                              SizedBox(
                                width: 130,
                                child: Text(
                                  sourceName == null || sourceName.isEmpty ? 'Unknown source' : sourceName,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(color: scheme.onSurfaceVariant, fontWeight: FontWeight.w700),
                                ),
                              ),
                            ],
                          ),
                        ),
                        Icon(Icons.arrow_forward_rounded, size: 14, color: scheme.onSurfaceVariant),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(color: scheme.outline.withAlpha((0.20 * 255).round())),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(_platformIcon(targetPlatformId), size: 14),
                              const SizedBox(width: 5),
                              SizedBox(
                                width: 130,
                                child: Text(
                                  targetName == null || targetName.isEmpty ? 'Unknown target' : targetName,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(color: scheme.onSurfaceVariant, fontWeight: FontWeight.w700),
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
              const SizedBox(height: 6),
              Row(
                children: [
                  Icon(Icons.schedule_rounded, size: 16, color: scheme.onSurfaceVariant),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      when,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: scheme.onSurfaceVariant),
                    ),
                  ),
                ],
              ),
              if (errorText.isNotEmpty) ...[
                const SizedBox(height: 10),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    color: scheme.error.withAlpha((0.10 * 255).round()),
                    border: Border.all(color: scheme.error.withAlpha((0.22 * 255).round())),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.error_outline_rounded, color: scheme.error, size: 18),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          errorText,
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(color: scheme.error, fontWeight: FontWeight.w700),
                        ),
                      ),
                      IconButton(
                        tooltip: i18n.isArabic ? 'نسخ الخطأ' : 'Copy error',
                        onPressed: () async {
                          await Clipboard.setData(ClipboardData(text: errorText));
                          _toast(i18n.isArabic ? 'تم نسخ الخطأ.' : 'Error copied');
                        },
                        icon: const Icon(Icons.content_copy_rounded, size: 18),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        searchCard(),
        const SizedBox(height: 12),
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
                    onPressed: () {
                      setState(() {
                        _executionsQuery = '';
                        _executionsSearchController.text = '';
                        _executionsStatusFilter = 'all';
                      });
                    },
                    child: Text(i18n.isArabic ? 'مسح الفلاتر' : 'Clear Filters'),
                  )
                : null,
          )
        else
          ...filtered.take(120).map(executionTile),
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
    final successfulExecutions = _readDouble(totals['successfulExecutions'], fallback: 0);
    final successRate = totalExecutions > 0 ? successfulExecutions / totalExecutions : 0.0;

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
        _toast(i18n.isArabic ? 'تم نسخ CSV للحافظة.' : 'CSV copied to clipboard.');
      } catch (error) {
        final message = error is ApiException ? error.message : 'Failed to export analytics.';
        _toast(message);
      }
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SfPanelCard(
          child: SfSectionHeader(
            title: i18n.t('analytics.title', 'Analytics'),
            subtitle: i18n.t(
              'analytics.subtitle',
              'Monitor task performance and execution statistics.',
            ),
            trailing: OutlinedButton.icon(
              onPressed: exportCsv,
              icon: const Icon(Icons.download_rounded),
              label: Text(i18n.t('analytics.exportCsv', 'Export CSV')),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            SizedBox(
              width: 280,
              child: SfKpiTile(
                label: i18n.t('analytics.kpi.totalExecutions', 'Total executions'),
                value: '${totals['executions'] ?? 0}',
                icon: Icons.sync_rounded,
              ),
            ),
            SizedBox(
              width: 280,
              child: SfKpiTile(
                label: i18n.t('analytics.kpi.successful', 'Successful'),
                value: '${totals['successfulExecutions'] ?? 0}',
                icon: Icons.check_circle_rounded,
                tone: Colors.green.shade700,
              ),
            ),
            SizedBox(
              width: 280,
              child: SfKpiTile(
                label: i18n.t('analytics.kpi.failed', 'Failed'),
                value: '${totals['failedExecutions'] ?? 0}',
                icon: Icons.error_rounded,
                tone: scheme.error,
              ),
            ),
            SizedBox(
              width: 280,
              child: SfKpiTile(
                label: i18n.t('analytics.kpi.successRate', 'Success rate'),
                value: '${(successRate * 100).toStringAsFixed(2)}%',
                icon: Icons.trending_up_rounded,
                tone: scheme.tertiary,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        SfBarChart(
          title: i18n.t('analytics.chart.title', 'Success Rate by Task (Top 8)'),
          subtitle: i18n.t('analytics.chart.subtitle', 'Sorted by your current ordering.'),
          values: top.map((e) => (e['value'] as double)).toList(),
          labels: top.map((e) => (e['label'] as String)).toList(),
          maxValue: 100,
        ),
        const SizedBox(height: 12),
        SfPanelCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SfSectionHeader(
                title: i18n.t('analytics.table.title', 'Performance by Task'),
                subtitle: i18n.t('analytics.table.subtitle', 'Search, sort, and review task-level execution KPIs.'),
              ),
              const SizedBox(height: 12),
              LayoutBuilder(
                builder: (context, constraints) {
                  final wide = constraints.maxWidth >= 760;
                  final w = wide ? (constraints.maxWidth - 12) / 2 : constraints.maxWidth;
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
                            hintText: i18n.t('analytics.searchHint', 'Search tasks...'),
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
                            DropdownMenuItem(value: 'successRate:desc', child: Text('Success Rate (High)')),
                            DropdownMenuItem(value: 'successRate:asc', child: Text('Success Rate (Low)')),
                            DropdownMenuItem(value: 'totalExecutions:desc', child: Text('Total Runs (High)')),
                            DropdownMenuItem(value: 'totalExecutions:asc', child: Text('Total Runs (Low)')),
                            DropdownMenuItem(value: 'failed:desc', child: Text('Failures (High)')),
                            DropdownMenuItem(value: 'failed:asc', child: Text('Failures (Low)')),
                            DropdownMenuItem(value: 'taskName:asc', child: Text('Task (A→Z)')),
                            DropdownMenuItem(value: 'taskName:desc', child: Text('Task (Z→A)')),
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
                            unawaited(_loadPanel(PanelKind.analytics, force: true));
                          },
                        ),
                      ),
                    ],
                  );
                },
              ),
              const SizedBox(height: 12),
              if (taskStats.isEmpty)
                Text(i18n.t('analytics.empty', 'No analytics data yet.'))
              else
                ...taskStats.take(80).map((raw) {
                  final item = raw is Map<String, dynamic>
                      ? raw
                      : Map<String, dynamic>.from(raw as Map);
                  final taskName = item['taskName']?.toString() ?? i18n.t('tasks.task', 'Task');
                  final total = _readInt(item['totalExecutions'], fallback: 0);
                  final ok = _readInt(item['successful'], fallback: 0);
                  final fail = _readInt(item['failed'], fallback: 0);
                  final rate = _readDouble(item['successRate'], fallback: 0);
                  final rateColor = rate >= 90
                      ? Colors.green.shade700
                      : rate >= 70
                          ? scheme.secondary
                          : scheme.error;

                  return Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: scheme.outline.withOpacity(0.55)),
                      color: scheme.surface.withOpacity(0.35),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(14),
                            color: rateColor.withOpacity(0.12),
                            border: Border.all(color: rateColor.withOpacity(0.22)),
                          ),
                          child: Icon(Icons.analytics_rounded, color: rateColor),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(taskName, style: const TextStyle(fontWeight: FontWeight.w900)),
                              const SizedBox(height: 6),
                              Wrap(
                                spacing: 8,
                                runSpacing: 8,
                                children: [
                                  SfBadge('${i18n.t('analytics.executions', 'Executions')}: $total', tone: scheme.onSurface),
                                  SfBadge('${i18n.t('analytics.kpi.successful', 'Successful')}: $ok', tone: Colors.green.shade700),
                                  SfBadge('${i18n.t('analytics.kpi.failed', 'Failed')}: $fail', tone: scheme.error),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 10),
                        SfBadge('${rate.toStringAsFixed(2)}%', tone: rateColor, icon: Icons.trending_up_rounded),
                      ],
                    ),
                  );
                }),
              if (canLoadMore) ...[
                const SizedBox(height: 8),
                Center(
                  child: OutlinedButton(
                    onPressed: _analyticsLoadingMore ? null : () => unawaited(_loadMoreAnalytics()),
                    child: Text(
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
                      style: TextStyle(color: scheme.onSurfaceVariant, fontWeight: FontWeight.w700),
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
        'swatches': const <Color>[Color(0xFF0F62FE), Color(0xFF0052CC), Color(0xFF57606A)],
      },
      {
        'id': 'graphite',
        'name': 'Graphite',
        'desc': i18n.t('settings.preset.graphite', 'Minimal neutral scheme with subtle accents.'),
        'swatches': const <Color>[Color(0xFF667086), Color(0xFF7F8EA4), Color(0xFFA6B0C2)],
      },
      {
        'id': 'sunrise',
        'name': 'Sunrise',
        'desc': i18n.t('settings.preset.sunrise', 'Warm editorial palette with high contrast.'),
        'swatches': const <Color>[Color(0xFFE57A39), Color(0xFFEDB84C), Color(0xFF46B8A8)],
      },
      {
        'id': 'nord',
        'name': 'Nord',
        'desc': i18n.t('settings.preset.nord', 'Cool arctic blue-gray with clean contrast.'),
        'swatches': const <Color>[Color(0xFF5E81AC), Color(0xFF88C0D0), Color(0xFF81A1C1)],
      },
      {
        'id': 'ocean',
        'name': 'Ocean',
        'desc': i18n.t('settings.preset.ocean', 'Airy blue-gray background with frost surfaces.'),
        'swatches': const <Color>[Color(0xFFEEF3F8), Color(0xFFF8F8FA), Color(0xFF2F84D4)],
      },
      {
        'id': 'warmlux',
        'name': 'Warm Luxe',
        'desc': i18n.t('settings.preset.warmlux', 'Warm corporate beige with golden accents.'),
        'swatches': const <Color>[Color(0xFFE9E6DF), Color(0xFFE5B73B), Color(0xFF2C2C2C)],
      },
    ];

    Widget toggleRow({
      required String title,
      required String subtitle,
      required bool value,
      required ValueChanged<bool> onChanged,
      required IconData icon,
    }) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: scheme.outline.withOpacity(isDark ? 0.65 : 0.70)),
          color: scheme.surface.withOpacity(isDark ? 0.35 : 0.55),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                color: scheme.primary.withOpacity(isDark ? 0.18 : 0.10),
                border: Border.all(color: scheme.primary.withOpacity(isDark ? 0.26 : 0.18)),
              ),
              child: Icon(icon, color: scheme.primary, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: TextStyle(color: scheme.onSurfaceVariant, fontWeight: FontWeight.w700),
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
          ? scheme.primary.withOpacity(isDark ? 0.55 : 0.50)
          : scheme.outline.withOpacity(isDark ? 0.65 : 0.70);

      return InkWell(
        onTap: () => unawaited(widget.appState.setThemePreset(opt['id']?.toString() ?? 'orbit')),
        borderRadius: BorderRadius.circular(18),
        child: AnimatedContainer(
          duration: widget.appState.reducedMotion ? Duration.zero : const Duration(milliseconds: 180),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: border, width: selected ? 1.4 : 1.0),
            color: selected
                ? scheme.primary.withOpacity(isDark ? 0.14 : 0.10)
                : scheme.surface.withOpacity(isDark ? 0.35 : 0.55),
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
                        border: Border.all(color: scheme.outline.withOpacity(isDark ? 0.55 : 0.70)),
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 10),
              Text(
                opt['desc']?.toString() ?? '',
                style: TextStyle(color: scheme.onSurfaceVariant, fontWeight: FontWeight.w700),
              ),
            ],
          ),
        ),
      );
    }

    Widget credentialsCard() {
      final platformLabel = _kPlatformLabels[_settingsSelectedPlatform] ?? _settingsSelectedPlatform;
      final fields = _kPlatformFields[_settingsSelectedPlatform] ?? const <Map<String, dynamic>>[];

      Widget content;
      if (_settingsCredentialsLoading) {
        content = Text(i18n.t('settings.loadingCredentials', 'Loading credentials...'));
      } else if (_settingsCredentialsError.trim().isNotEmpty) {
        content = Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _settingsCredentialsError,
              style: TextStyle(color: scheme.error, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: () => unawaited(_loadSettingsPlatformCredentials(force: true)),
              icon: const Icon(Icons.refresh_rounded),
              label: Text(i18n.t('common.retry', 'Retry')),
            ),
          ],
        );
      } else {
        content = LayoutBuilder(
          builder: (context, constraints) {
            final wide = constraints.maxWidth >= 760;
            final width = wide ? (constraints.maxWidth - 12) / 2 : constraints.maxWidth;
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

                final controller = _settingsCredentialControllers[key] ?? TextEditingController();
                _settingsCredentialControllers[key] = controller;

                return SizedBox(
                  width: width,
                  child: TextField(
                    controller: controller,
                    obscureText: secret && !revealed,
                    onChanged: (_) => setState(() => _settingsCredentialsDirty = true),
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
                                revealed ? Icons.visibility_off_rounded : Icons.visibility_rounded,
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
              title: i18n.t('settings.platformCredentials', 'Platform API Credentials'),
              subtitle: i18n.t(
                'settings.platformCredentials.subtitle',
                'OAuth and API keys are stored per-user on the server. Keep them private.',
              ),
              trailing: IconButton(
                tooltip: i18n.t('common.refresh', 'Refresh'),
                onPressed: () => unawaited(_loadSettingsPlatformCredentials(force: true)),
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
                  .map((id) => DropdownMenuItem(value: id, child: Text(_kPlatformLabels[id] ?? id)))
                  .toList(),
              onChanged: (value) {
                if (value == null) return;
                _setSettingsSelectedPlatform(value);
              },
            ),
            const SizedBox(height: 12),
            Text(
              '${i18n.t('settings.selected', 'Selected')}: $platformLabel',
              style: TextStyle(color: scheme.onSurfaceVariant, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 12),
            content,
            const SizedBox(height: 12),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                FilledButton.icon(
                  onPressed: (_settingsCredentialsLoading || _settingsCredentialsSaving)
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
                      : i18n.t('settings.saveCredentials', 'Save Platform Credentials')),
                ),
                OutlinedButton.icon(
                  onPressed: _settingsCredentialsDirty
                      ? () => _setSettingsSelectedPlatform(_settingsSelectedPlatform)
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
                  foregroundImage: image.trim().isEmpty ? null : NetworkImage(image),
                  child: const Icon(Icons.person_rounded),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(profileName, style: const TextStyle(fontWeight: FontWeight.w900)),
                      const SizedBox(height: 4),
                      Text(profileEmail, style: TextStyle(color: scheme.onSurfaceVariant, fontWeight: FontWeight.w700)),
                    ],
                  ),
                ),
              ],
            ),
            if (_settingsProfileError.trim().isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(_settingsProfileError, style: TextStyle(color: scheme.error, fontWeight: FontWeight.w800)),
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
                labelText: i18n.t('settings.profileImageUrl', 'Profile image URL'),
                prefixIcon: const Icon(Icons.image_rounded),
                hintText: i18n.t('settings.profileImageUrlHint', 'https://...'),
              ),
            ),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: _settingsSavingProfile ? null : () => unawaited(_saveSettingsProfile()),
              icon: _settingsSavingProfile
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.save_rounded),
              label: Text(_settingsSavingProfile ? i18n.t('settings.saving', 'Saving...') : i18n.t('settings.saveProfile', 'Save Profile')),
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
                labelText: i18n.t('settings.currentPassword', 'Current password'),
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
                labelText: i18n.t('settings.confirmPassword', 'Confirm new password'),
                prefixIcon: const Icon(Icons.lock_outline_rounded),
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _settingsUpdatingPassword ? null : () => unawaited(_updateSettingsPassword()),
              icon: _settingsUpdatingPassword
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.check_rounded),
              label: Text(_settingsUpdatingPassword ? i18n.t('settings.updating', 'Updating...') : i18n.t('settings.updatePassword', 'Update Password')),
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
              subtitle: i18n.t('settings.appearance.subtitle', 'Theme mode and preset palette (mirrors web presets).'),
            ),
            const SizedBox(height: 12),
            toggleRow(
              title: i18n.t('settings.darkMode', 'Dark mode'),
              subtitle: i18n.t('settings.darkMode.subtitle', 'Use the dark color scheme across the app.'),
              value: isDark,
              onChanged: (_) => unawaited(widget.appState.toggleThemeMode()),
              icon: Icons.dark_mode_rounded,
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: scheme.outline.withOpacity(isDark ? 0.65 : 0.70)),
                color: scheme.surface.withOpacity(isDark ? 0.35 : 0.55),
              ),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(14),
                      color: scheme.secondary.withOpacity(isDark ? 0.18 : 0.10),
                      border: Border.all(color: scheme.secondary.withOpacity(isDark ? 0.26 : 0.18)),
                    ),
                    child: Icon(Icons.language_rounded, color: scheme.secondary, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(i18n.t('settings.language', 'Language'), style: const TextStyle(fontWeight: FontWeight.w900)),
                        const SizedBox(height: 4),
                        Text(
                          isArabic ? 'العربية' : 'English',
                          style: TextStyle(color: scheme.onSurfaceVariant, fontWeight: FontWeight.w700),
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
                final cols = constraints.maxWidth >= 980 ? 3 : (constraints.maxWidth >= 620 ? 2 : 1);
                final w = (constraints.maxWidth - ((cols - 1) * 12)) / cols;
                return Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: presetOptions.map((opt) {
                    final selected = widget.appState.themePreset == opt['id'];
                    return SizedBox(width: w, child: presetCard(opt, selected: selected));
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
              subtitle: i18n.t('settings.experience.subtitle', 'Motion, navigation density, and ergonomics.'),
            ),
            const SizedBox(height: 12),
            toggleRow(
              title: i18n.t('settings.reducedMotion', 'Reduced motion'),
              subtitle: i18n.t('settings.reducedMotion.subtitle', 'Minimize animation and transition effects.'),
              value: widget.appState.reducedMotion,
              onChanged: (v) => unawaited(widget.appState.setReducedMotion(v)),
              icon: Icons.motion_photos_off_rounded,
            ),
            const SizedBox(height: 12),
            toggleRow(
              title: i18n.t('settings.compactNav', 'Collapsed sidebar by default'),
              subtitle: i18n.t('settings.compactNav.subtitle', 'Keep navigation compact on large screens.'),
              value: widget.appState.sidebarCollapsed,
              onChanged: (v) => unawaited(widget.appState.setSidebarCollapsed(v)),
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
                DropdownMenuItem(value: 'comfortable', child: Text('Comfortable')),
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
              subtitle: i18n.t('settings.notifications.subtitle', 'Local preferences for alerts and notices.'),
            ),
            const SizedBox(height: 12),
            toggleRow(
              title: i18n.t('settings.notifications.success', 'Email on success'),
              subtitle: i18n.t('settings.notifications.success.subtitle', 'Get notified when tasks complete successfully.'),
              value: widget.appState.emailOnSuccess,
              onChanged: (v) => unawaited(widget.appState.setNotifications(emailOnSuccessValue: v)),
              icon: Icons.mark_email_read_rounded,
            ),
            const SizedBox(height: 12),
            toggleRow(
              title: i18n.t('settings.notifications.error', 'Email on error'),
              subtitle: i18n.t('settings.notifications.error.subtitle', 'Get notified when tasks fail.'),
              value: widget.appState.emailOnError,
              onChanged: (v) => unawaited(widget.appState.setNotifications(emailOnErrorValue: v)),
              icon: Icons.mark_email_unread_rounded,
            ),
            const SizedBox(height: 12),
            toggleRow(
              title: i18n.t('settings.notifications.push', 'Push notifications'),
              subtitle: i18n.t('settings.notifications.push.subtitle', 'Receive push notifications (if enabled).'),
              value: widget.appState.pushNotifications,
              onChanged: (v) => unawaited(widget.appState.setNotifications(pushNotificationsValue: v)),
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
              subtitle: i18n.t('settings.privacy.subtitle', 'Control analytics and error sharing.'),
            ),
            const SizedBox(height: 12),
            toggleRow(
              title: i18n.t('settings.privacy.analytics', 'Usage analytics'),
              subtitle: i18n.t('settings.privacy.analytics.subtitle', 'Help improve the product by sharing anonymous usage data.'),
              value: widget.appState.allowAnalytics,
              onChanged: (v) => unawaited(widget.appState.setPrivacy(allowAnalyticsValue: v)),
              icon: Icons.analytics_rounded,
            ),
            const SizedBox(height: 12),
            toggleRow(
              title: i18n.t('settings.privacy.errors', 'Share error logs'),
              subtitle: i18n.t('settings.privacy.errors.subtitle', 'Share error logs to help debug issues faster.'),
              value: widget.appState.shareErrorLogs,
              onChanged: (v) => unawaited(widget.appState.setPrivacy(shareErrorLogsValue: v)),
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
              subtitle: i18n.t('settings.system.subtitle', 'Diagnostics and storage actions.'),
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
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.link_rounded),
              title: Text(i18n.t('settings.apiBaseUrl', 'API Base URL')),
              subtitle: Text(AppConfig.baseUri.toString()),
            ),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.security_rounded),
              title: Text(i18n.t('settings.authMode', 'Auth mode')),
              subtitle: Text(i18n.t('settings.authModeValue', 'Bearer token via /api/mobile/login')),
            ),
            const Divider(height: 18),
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
          child: SfSectionHeader(
            title: i18n.t('settings.title', 'Settings'),
            subtitle: i18n.t(
              'settings.subtitle',
              'Manage your account, themes, and platform API credentials.',
            ),
          ),
        ),
        const SizedBox(height: 12),
        credentialsCard(),
        const SizedBox(height: 12),
        profileCard(),
        const SizedBox(height: 12),
        appearanceCard(),
        const SizedBox(height: 12),
        experienceCard(),
        const SizedBox(height: 12),
        notificationsCard(),
        const SizedBox(height: 12),
        privacyCard(),
        const SizedBox(height: 12),
        systemCard(),
        const SizedBox(height: 12),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            FilledButton.icon(
              onPressed: () async {
                await widget.onSignOut();
              },
              icon: const Icon(Icons.logout_rounded),
              label: Text(i18n.t('common.signOut', 'Sign out')),
            ),
          ],
        ),
      ],
    );
  }

  IconData _platformIcon(String platformId) {
    final normalized = platformId.trim().toLowerCase();
    if (normalized.isEmpty) return Icons.public_rounded;
    if (normalized.contains('telegram')) return Icons.send_rounded;
    if (normalized.contains('twitter') || normalized == 'x' || normalized.contains('x.com')) {
      return Icons.alternate_email_rounded;
    }
    if (normalized.contains('youtube')) return Icons.ondemand_video_rounded;
    if (normalized.contains('tiktok')) return Icons.music_note_rounded;
    if (normalized.contains('instagram')) return Icons.camera_alt_rounded;
    if (normalized.contains('facebook')) return Icons.facebook_rounded;
    if (normalized.contains('linkedin')) return Icons.work_rounded;
    if (normalized.contains('snap')) return Icons.chat_bubble_rounded;
    if (normalized.contains('threads')) return Icons.forum_rounded;
    if (normalized.contains('reddit')) return Icons.forum_rounded;
    if (normalized.contains('pinterest')) return Icons.push_pin_rounded;
    return Icons.public_rounded;
  }

  String _platformLabel(String platformId) {
    final normalized = platformId.trim().toLowerCase();
    if (normalized.isEmpty) return 'Unknown';
    if (normalized.contains('telegram')) return 'Telegram';
    if (normalized.contains('twitter') || normalized == 'x' || normalized.contains('x.com')) return 'X';
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
        return _buildPanelFrame(kind: PanelKind.tasks, i18n: i18n, builder: _buildTasks);
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

  @override
  Widget build(BuildContext context) {
    final currentPanel = kPanelSpecs[_selectedIndex];
    final i18n = _i18n(context);
    final panelLabel = i18n.t(currentPanel.labelKey, currentPanel.fallbackLabel);
    final lastUpdated = _buildLastUpdatedText(i18n, _currentKind);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final scheme = Theme.of(context).colorScheme;

    return LayoutBuilder(
      builder: (context, constraints) {
        // Material guidance: switch to rail for larger screens/tablets.
        final wide = constraints.maxWidth >= 840;
        final reducedMotion = widget.appState.reducedMotion;
        final collapsed = widget.appState.sidebarCollapsed;

        return Scaffold(
          key: _scaffoldKey,
          extendBodyBehindAppBar: true,
          appBar: AppBar(
            automaticallyImplyLeading: false,
            leading: IconButton(
              icon: Icon(
                wide
                    ? (collapsed ? Icons.menu_open_rounded : Icons.menu_rounded)
                    : Icons.menu_rounded,
              ),
              tooltip: wide
                  ? (collapsed ? 'Expand sidebar' : 'Collapse sidebar')
                  : 'Open sidebar',
              onPressed: () => unawaited(_toggleSidebar(wide: wide)),
            ),
            title: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(panelLabel),
                Text(
                  lastUpdated,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: scheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
            flexibleSpace: ClipRect(
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 14, sigmaY: 14),
                child: Container(
                  color: scheme.surface.withOpacity(isDark ? 0.30 : 0.72),
                ),
              ),
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.refresh_rounded),
                tooltip: i18n.t('common.refresh', 'Refresh current panel'),
                onPressed: () => unawaited(_loadCurrentPanel(force: true)),
              ),
            ],
          ),
          drawer: wide ? null : _buildDrawer(i18n),
          body: SfAppBackground(
            child: SafeArea(
              child: Row(
                children: [
                  if (wide) _buildRail(i18n),
                  Expanded(
                    child: AnimatedSwitcher(
                      duration: reducedMotion ? Duration.zero : const Duration(milliseconds: 220),
                      switchInCurve: Curves.easeOutCubic,
                      switchOutCurve: Curves.easeInCubic,
                      transitionBuilder: (child, anim) {
                        if (reducedMotion) {
                          return FadeTransition(opacity: anim, child: child);
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
          ),
          bottomNavigationBar: wide ? null : _buildBottomNavigation(i18n),
        );
      },
    );
  }
}

// API client lives in lib/api/api_client.dart

class _TaskComposerSheet extends StatefulWidget {
  const _TaskComposerSheet({
    required this.api,
    required this.accessToken,
    required this.i18n,
    this.initialTask,
  });

  final ApiClient api;
  final String accessToken;
  final I18n i18n;
  final Map<String, dynamic>? initialTask;

  @override
  State<_TaskComposerSheet> createState() => _TaskComposerSheetState();
}

class _TaskComposerSheetState extends State<_TaskComposerSheet> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _descController = TextEditingController();

  bool _loadingAccounts = true;
  bool _submitting = false;
  String _error = '';

  String _status = 'active';
  String _contentType = 'text';

  List<Map<String, dynamic>> _accounts = <Map<String, dynamic>>[];
  final Set<String> _sourceAccountIds = <String>{};
  final Set<String> _targetAccountIds = <String>{};

  bool get _isEdit {
    final id = widget.initialTask?['id']?.toString() ?? '';
    return id.trim().isNotEmpty;
  }

  String get _taskId {
    return widget.initialTask?['id']?.toString() ?? '';
  }

  @override
  void initState() {
    super.initState();
    final initial = widget.initialTask;
    if (initial != null) {
      _nameController.text = initial['name']?.toString() ?? '';
      _descController.text = initial['description']?.toString() ?? '';
      final status = initial['status']?.toString() ?? '';
      final normalizedStatus = status.trim().toLowerCase();
      if (normalizedStatus == 'active' ||
          normalizedStatus == 'paused' ||
          normalizedStatus == 'completed' ||
          normalizedStatus == 'error') {
        _status = normalizedStatus;
      }
      final contentType = initial['contentType']?.toString() ?? '';
      final normalizedContent = contentType.trim().toLowerCase();
      if (normalizedContent == 'text' ||
          normalizedContent == 'image' ||
          normalizedContent == 'video' ||
          normalizedContent == 'link') {
        _contentType = normalizedContent;
      }

      final sources = initial['sourceAccounts'] is List ? (initial['sourceAccounts'] as List) : const <dynamic>[];
      final targets = initial['targetAccounts'] is List ? (initial['targetAccounts'] as List) : const <dynamic>[];
      _sourceAccountIds.addAll(sources.map((e) => e?.toString() ?? '').where((e) => e.trim().isNotEmpty));
      _targetAccountIds.addAll(targets.map((e) => e?.toString() ?? '').where((e) => e.trim().isNotEmpty));
    }
    unawaited(_loadAccounts());
  }

  @override
  void dispose() {
    _nameController.dispose();
    _descController.dispose();
    super.dispose();
  }

  IconData _platformIcon(String platformId) {
    final normalized = platformId.trim().toLowerCase();
    if (normalized.contains('telegram')) return Icons.send_rounded;
    if (normalized.contains('twitter')) return Icons.alternate_email_rounded;
    if (normalized.contains('youtube')) return Icons.ondemand_video_rounded;
    if (normalized.contains('tiktok')) return Icons.music_note_rounded;
    if (normalized.contains('instagram')) return Icons.camera_alt_rounded;
    if (normalized.contains('facebook')) return Icons.facebook_rounded;
    if (normalized.contains('linkedin')) return Icons.work_rounded;
    return Icons.public_rounded;
  }

  Future<void> _loadAccounts() async {
    setState(() {
      _loadingAccounts = true;
      _error = '';
    });

    try {
      final payload = await widget.api.fetchAccounts(
        widget.accessToken,
        limit: 200,
      );
      final raw = payload['accounts'];
      final list = raw is List ? raw : const <dynamic>[];
      final accounts = list.map((entry) {
        final item = entry is Map<String, dynamic>
            ? entry
            : Map<String, dynamic>.from(entry as Map);
        return <String, dynamic>{
          'id': item['id']?.toString() ?? '',
          'platformId': item['platformId']?.toString() ?? 'unknown',
          'accountName': item['accountName']?.toString() ?? '',
          'accountUsername': item['accountUsername']?.toString() ?? '',
          'isActive': item['isActive'] == true,
        };
      }).where((a) => (a['id']?.toString() ?? '').trim().isNotEmpty).toList();

      accounts.sort((a, b) {
        final ap = (a['platformId']?.toString() ?? '').compareTo(b['platformId']?.toString() ?? '');
        if (ap != 0) return ap;
        return (a['accountName']?.toString() ?? '').compareTo(b['accountName']?.toString() ?? '');
      });

      if (!mounted) return;
      setState(() {
        _accounts = accounts;
        _loadingAccounts = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loadingAccounts = false;
        _error = error is ApiException ? error.message : 'Failed to load accounts.';
      });
    }
  }

  String _accountLabel(Map<String, dynamic> account) {
    final name = (account['accountName']?.toString() ?? '').trim();
    final username = (account['accountUsername']?.toString() ?? '').trim();
    if (name.isNotEmpty) return name;
    if (username.isNotEmpty) return '@$username';
    return account['id']?.toString() ?? 'Account';
  }

  bool _validateSelections() {
    final overlap = _sourceAccountIds.intersection(_targetAccountIds);
    if (_sourceAccountIds.isEmpty) {
      setState(() => _error = widget.i18n.isArabic ? 'اختر حساب مصدر واحد على الأقل.' : 'Select at least one source account.');
      return false;
    }
    if (_targetAccountIds.isEmpty) {
      setState(() => _error = widget.i18n.isArabic ? 'اختر حساب هدف واحد على الأقل.' : 'Select at least one target account.');
      return false;
    }
    if (overlap.isNotEmpty) {
      setState(() => _error = widget.i18n.isArabic ? 'لا يمكن أن يكون نفس الحساب مصدرًا وهدفًا.' : 'A single account cannot be both source and target.');
      return false;
    }
    return true;
  }

  Future<void> _submit() async {
    if (_submitting) return;
    setState(() => _error = '');

    if (!_formKey.currentState!.validate()) return;
    if (!_validateSelections()) return;

    setState(() => _submitting = true);
    try {
      final body = <String, dynamic>{
        'name': _nameController.text.trim(),
        'description': _descController.text.trim(),
        'sourceAccounts': _sourceAccountIds.toList(),
        'targetAccounts': _targetAccountIds.toList(),
        'status': _status,
        'contentType': _contentType,
      };

      if (_isEdit) {
        final id = _taskId.trim();
        if (id.isEmpty) throw const ApiException('Missing task id.');
        await widget.api.updateTask(widget.accessToken, id, body: body);
      } else {
        body['executionType'] = 'immediate';
        await widget.api.createTask(widget.accessToken, body: body);
      }
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error is ApiException
            ? error.message
            : _isEdit
                ? 'Failed to update task.'
                : 'Failed to create task.';
      });
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          top: 8,
          bottom: 16 + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      _isEdit
                          ? (widget.i18n.isArabic ? 'تعديل مهمة' : 'Edit Task')
                          : (widget.i18n.isArabic ? 'إنشاء مهمة' : 'Create Task'),
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
                    ),
                  ),
                  IconButton(
                    onPressed: _submitting ? null : () => Navigator.of(context).maybePop(),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              if (_error.trim().isNotEmpty)
                Card(
                  color: scheme.error.withAlpha((0.12 * 255).round()),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      children: [
                        Icon(Icons.error_outline_rounded, color: scheme.error),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            _error,
                            style: TextStyle(color: scheme.error, fontWeight: FontWeight.w700),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              if (_error.trim().isNotEmpty) const SizedBox(height: 10),
              Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    TextFormField(
                      controller: _nameController,
                      textInputAction: TextInputAction.next,
                      decoration: InputDecoration(
                        labelText: widget.i18n.isArabic ? 'اسم المهمة' : 'Task name',
                        prefixIcon: const Icon(Icons.task_alt_rounded),
                      ),
                      validator: (value) {
                        if ((value ?? '').trim().isEmpty) {
                          return widget.i18n.isArabic ? 'اسم المهمة مطلوب.' : 'Task name is required.';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _descController,
                      minLines: 2,
                      maxLines: 4,
                      decoration: InputDecoration(
                        labelText: widget.i18n.isArabic ? 'الوصف (اختياري)' : 'Description (optional)',
                        prefixIcon: const Icon(Icons.notes_rounded),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            initialValue: _status,
                            decoration: InputDecoration(
                              labelText: widget.i18n.isArabic ? 'الحالة' : 'Status',
                              prefixIcon: const Icon(Icons.toggle_on_rounded),
                            ),
                            items: const [
                              DropdownMenuItem(value: 'active', child: Text('Active')),
                              DropdownMenuItem(value: 'paused', child: Text('Paused')),
                              DropdownMenuItem(value: 'completed', child: Text('Completed')),
                              DropdownMenuItem(value: 'error', child: Text('Error')),
                            ],
                            onChanged: _submitting ? null : (value) {
                              if (value == null) return;
                              setState(() => _status = value);
                            },
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            initialValue: _contentType,
                            decoration: InputDecoration(
                              labelText: widget.i18n.isArabic ? 'نوع المحتوى' : 'Content type',
                              prefixIcon: const Icon(Icons.article_rounded),
                            ),
                            items: const [
                              DropdownMenuItem(value: 'text', child: Text('Text')),
                              DropdownMenuItem(value: 'image', child: Text('Image')),
                              DropdownMenuItem(value: 'video', child: Text('Video')),
                              DropdownMenuItem(value: 'link', child: Text('Link')),
                            ],
                            onChanged: _submitting ? null : (value) {
                              if (value == null) return;
                              setState(() => _contentType = value);
                            },
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Icon(Icons.input_rounded),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    widget.i18n.isArabic ? 'حسابات المصدر' : 'Source accounts',
                                    style: const TextStyle(fontWeight: FontWeight.w800),
                                  ),
                                ),
                                Text('${_sourceAccountIds.length}'),
                              ],
                            ),
                            const SizedBox(height: 8),
                            if (_loadingAccounts)
                              const Center(child: Padding(padding: EdgeInsets.all(10), child: CircularProgressIndicator()))
                            else if (_accounts.isEmpty)
                              Text(widget.i18n.isArabic ? 'لا توجد حسابات.' : 'No accounts found.')
                            else
                              ..._accounts.map((account) {
                                final id = account['id']?.toString() ?? '';
                                final selected = _sourceAccountIds.contains(id);
                                return CheckboxListTile(
                                  value: selected,
                                  dense: true,
                                  contentPadding: EdgeInsets.zero,
                                  onChanged: _submitting
                                      ? null
                                      : (value) {
                                          setState(() {
                                            if (value == true) {
                                              _sourceAccountIds.add(id);
                                            } else {
                                              _sourceAccountIds.remove(id);
                                            }
                                          });
                                        },
                                  secondary: Icon(_platformIcon(account['platformId']?.toString() ?? '')),
                                  title: Text(_accountLabel(account)),
                                  subtitle: Text(
                                    '${account['platformId'] ?? 'unknown'} • @${account['accountUsername'] ?? '-'}',
                                  ),
                                );
                              }),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Icon(Icons.output_rounded),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    widget.i18n.isArabic ? 'حسابات الهدف' : 'Target accounts',
                                    style: const TextStyle(fontWeight: FontWeight.w800),
                                  ),
                                ),
                                Text('${_targetAccountIds.length}'),
                              ],
                            ),
                            const SizedBox(height: 8),
                            if (_loadingAccounts)
                              const Center(child: Padding(padding: EdgeInsets.all(10), child: CircularProgressIndicator()))
                            else if (_accounts.isEmpty)
                              Text(widget.i18n.isArabic ? 'لا توجد حسابات.' : 'No accounts found.')
                            else
                              ..._accounts.map((account) {
                                final id = account['id']?.toString() ?? '';
                                final selected = _targetAccountIds.contains(id);
                                return CheckboxListTile(
                                  value: selected,
                                  dense: true,
                                  contentPadding: EdgeInsets.zero,
                                  onChanged: _submitting
                                      ? null
                                      : (value) {
                                          setState(() {
                                            if (value == true) {
                                              _targetAccountIds.add(id);
                                            } else {
                                              _targetAccountIds.remove(id);
                                            }
                                          });
                                        },
                                  secondary: Icon(_platformIcon(account['platformId']?.toString() ?? '')),
                                  title: Text(_accountLabel(account)),
                                  subtitle: Text(
                                    '${account['platformId'] ?? 'unknown'} • @${account['accountUsername'] ?? '-'}',
                                  ),
                                );
                              }),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    FilledButton.icon(
                      onPressed: _submitting ? null : () => unawaited(_submit()),
                      icon: _submitting
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Icon(_isEdit ? Icons.save_rounded : Icons.add_rounded),
                      label: Text(
                        _isEdit
                            ? (widget.i18n.isArabic ? 'حفظ' : 'Save')
                            : (widget.i18n.isArabic ? 'إنشاء' : 'Create'),
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
  }
}
