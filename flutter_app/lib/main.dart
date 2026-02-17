import 'dart:async';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app_config.dart';
import 'app_state.dart';
import 'storage_keys.dart';
import 'api/api_client.dart';
import 'ui/auth/check_email_screen.dart';
import 'ui/auth/forgot_password_screen.dart';
import 'ui/auth/login_screen.dart';
import 'ui/auth/register_screen.dart';
import 'ui/auth/reset_password_screen.dart';
import 'ui/auth/verify_email_screen.dart';

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

    final lightScheme = ColorScheme.fromSeed(
      seedColor: const Color(0xFF0D1422),
      brightness: Brightness.light,
    );
    final darkScheme = ColorScheme.fromSeed(
      seedColor: const Color(0xFF0D1422),
      brightness: Brightness.dark,
      surface: const Color(0xFF0F162A),
    );

    return AnimatedBuilder(
      animation: state,
      builder: (context, _) {
        final themeMode =
            state.themeMode == AppThemeMode.dark ? ThemeMode.dark : ThemeMode.light;

        return MaterialApp(
          title: 'SocialFlow',
          debugShowCheckedModeBanner: false,
          themeMode: themeMode,
          theme: ThemeData(
            useMaterial3: true,
            colorScheme: lightScheme,
            inputDecorationTheme: InputDecorationTheme(
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
            ),
          ),
          darkTheme: ThemeData(
            useMaterial3: true,
            colorScheme: darkScheme,
            inputDecorationTheme: InputDecorationTheme(
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
            ),
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
    required this.accessToken,
    required this.userName,
    required this.userEmail,
    required this.onSignOut,
  });

  final ApiClient api;
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
    required this.label,
    required this.icon,
  });

  final PanelKind kind;
  final String label;
  final IconData icon;
}

const List<PanelSpec> kPanelSpecs = <PanelSpec>[
  PanelSpec(
    kind: PanelKind.dashboard,
    label: 'Dashboard',
    icon: Icons.space_dashboard_rounded,
  ),
  PanelSpec(
    kind: PanelKind.tasks,
    label: 'Tasks',
    icon: Icons.task_alt_rounded,
  ),
  PanelSpec(
    kind: PanelKind.accounts,
    label: 'Accounts',
    icon: Icons.groups_rounded,
  ),
  PanelSpec(
    kind: PanelKind.executions,
    label: 'Executions',
    icon: Icons.list_alt_rounded,
  ),
  PanelSpec(
    kind: PanelKind.analytics,
    label: 'Analytics',
    icon: Icons.query_stats_rounded,
  ),
  PanelSpec(
    kind: PanelKind.settings,
    label: 'Settings',
    icon: Icons.settings_rounded,
  ),
];

class _PanelState {
  bool loading = false;
  Map<String, dynamic>? data;
  String? error;
}

class _SocialShellState extends State<SocialShell> {
  int _selectedIndex = 0;
  String _tasksQuery = '';
  String _accountsQuery = '';
  String _executionsQuery = '';

  final Map<PanelKind, _PanelState> _panelStates = {
    for (final panel in kPanelSpecs) panel.kind: _PanelState(),
  };

  @override
  void initState() {
    super.initState();
    unawaited(_loadCurrentPanel(force: true));
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
          payload = await widget.api.fetchTasks(widget.accessToken, limit: 60);
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
            limit: 60,
          );
          break;
        case PanelKind.settings:
          payload = await widget.api.fetchProfile(widget.accessToken);
          break;
      }

      if (!mounted) return;
      setState(() {
        state.loading = false;
        state.data = payload;
        state.error = null;
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
    await _loadCurrentPanel();
  }

  Widget _buildDrawer() {
    return Drawer(
      child: SafeArea(
        child: Column(
          children: [
            ListTile(
              leading: const Icon(Icons.apps_rounded),
              title: const Text('SocialFlow'),
              subtitle: Text(widget.userEmail),
            ),
            const Divider(height: 1),
            Expanded(
              child: ListView.builder(
                itemCount: kPanelSpecs.length,
                itemBuilder: (context, index) {
                  final panel = kPanelSpecs[index];
                  final selected = index == _selectedIndex;
                  return ListTile(
                    leading: Icon(panel.icon),
                    title: Text(panel.label),
                    selected: selected,
                    onTap: () {
                      Navigator.of(context).maybePop();
                      unawaited(_onPanelSelected(index));
                    },
                  );
                },
              ),
            ),
            const Divider(height: 1),
            ListTile(
              leading: const Icon(Icons.logout_rounded),
              title: const Text('Sign out'),
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

  Widget _buildRail() {
    return NavigationRail(
      selectedIndex: _selectedIndex,
      labelType: NavigationRailLabelType.all,
      onDestinationSelected: (index) => unawaited(_onPanelSelected(index)),
      destinations: kPanelSpecs
          .map(
            (panel) => NavigationRailDestination(
              icon: Icon(panel.icon),
              selectedIcon: Icon(panel.icon),
              label: Text(panel.label),
            ),
          )
          .toList(),
    );
  }

  Widget _buildBottomNavigation() {
    return NavigationBar(
      selectedIndex: _selectedIndex,
      onDestinationSelected: (index) => unawaited(_onPanelSelected(index)),
      destinations: kPanelSpecs
          .map(
            (panel) => NavigationDestination(
              icon: Icon(panel.icon),
              label: panel.label,
            ),
          )
          .toList(),
    );
  }

  Widget _buildStatCard({
    required String title,
    required String value,
    required IconData icon,
  }) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            CircleAvatar(child: Icon(icon)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    value,
                    style: const TextStyle(
                      fontSize: 19,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPanelFrame({
    required PanelKind kind,
    required Widget Function(Map<String, dynamic> data) builder,
  }) {
    final panelState = _panelStates[kind]!;

    if (panelState.loading && panelState.data == null) {
      return const Center(child: CircularProgressIndicator());
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
                    label: const Text('Retry'),
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
      onRefresh: () => _loadPanel(kind, force: true),
      child: ListView(
        padding: const EdgeInsets.all(14),
        children: [
          if (panelState.loading)
            const Padding(
              padding: EdgeInsets.only(bottom: 10),
              child: LinearProgressIndicator(),
            ),
          builder(data),
        ],
      ),
    );
  }

  Widget _buildDashboard(Map<String, dynamic> data) {
    final stats = data['stats'] is Map<String, dynamic>
        ? data['stats'] as Map<String, dynamic>
        : <String, dynamic>{};
    final recentTasks = data['recentTasks'] is List
        ? (data['recentTasks'] as List)
        : const <dynamic>[];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            SizedBox(
              width: 260,
              child: _buildStatCard(
                title: 'Total Tasks',
                value: '${stats['totalTasks'] ?? 0}',
                icon: Icons.task_rounded,
              ),
            ),
            SizedBox(
              width: 260,
              child: _buildStatCard(
                title: 'Active Tasks',
                value: '${stats['activeTasksCount'] ?? 0}',
                icon: Icons.play_circle_fill_rounded,
              ),
            ),
            SizedBox(
              width: 260,
              child: _buildStatCard(
                title: 'Total Accounts',
                value: '${stats['totalAccounts'] ?? 0}',
                icon: Icons.groups_rounded,
              ),
            ),
            SizedBox(
              width: 260,
              child: _buildStatCard(
                title: 'Executions',
                value: '${stats['totalExecutions'] ?? 0}',
                icon: Icons.sync_rounded,
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Recent Tasks',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 8),
                if (recentTasks.isEmpty)
                  const Text('No tasks found.')
                else
                  ...recentTasks.take(10).map((task) {
                    final item = task is Map<String, dynamic>
                        ? task
                        : Map<String, dynamic>.from(task as Map);
                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(Icons.task_alt_rounded),
                      title: Text(item['name']?.toString() ?? 'Unnamed task'),
                      subtitle: Text('Status: ${item['status'] ?? 'unknown'}'),
                    );
                  }),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildTasks(Map<String, dynamic> data) {
    final tasks =
        data['tasks'] is List ? (data['tasks'] as List) : const <dynamic>[];

    final filtered = tasks.where((raw) {
      final item = raw is Map<String, dynamic>
          ? raw
          : Map<String, dynamic>.from(raw as Map);
      if (_tasksQuery.isEmpty) return true;
      final query = _tasksQuery.toLowerCase();
      final name = item['name']?.toString().toLowerCase() ?? '';
      final status = item['status']?.toString().toLowerCase() ?? '';
      return name.contains(query) || status.contains(query);
    }).toList();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Tasks',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 10),
            TextField(
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search_rounded),
                hintText: 'Search tasks by name or status',
                border: OutlineInputBorder(),
              ),
              onChanged: (value) => setState(() => _tasksQuery = value.trim()),
            ),
            const SizedBox(height: 10),
            if (filtered.isEmpty)
              const Text('No tasks match your search.')
            else
              ...filtered.take(80).map((raw) {
                final item = raw is Map<String, dynamic>
                    ? raw
                    : Map<String, dynamic>.from(raw as Map);
                final statusText = item['status']?.toString() ?? 'unknown';
                final statusColor = _statusColor(statusText);

                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: const Icon(Icons.task_alt_rounded),
                    title: Text(item['name']?.toString() ?? 'Unnamed task'),
                    subtitle: Text(item['description']?.toString() ?? ''),
                    trailing: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: statusColor.withAlpha((0.16 * 255).round()),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        statusText,
                        style: TextStyle(color: statusColor),
                      ),
                    ),
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }

  Widget _buildAccounts(Map<String, dynamic> data) {
    final accounts = data['accounts'] is List
        ? (data['accounts'] as List)
        : const <dynamic>[];

    final filtered = accounts.where((raw) {
      final item = raw is Map<String, dynamic>
          ? raw
          : Map<String, dynamic>.from(raw as Map);
      if (_accountsQuery.isEmpty) return true;
      final query = _accountsQuery.toLowerCase();
      final name = item['accountName']?.toString().toLowerCase() ?? '';
      final username = item['accountUsername']?.toString().toLowerCase() ?? '';
      final platform = item['platformId']?.toString().toLowerCase() ?? '';
      return name.contains(query) ||
          username.contains(query) ||
          platform.contains(query);
    }).toList();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Accounts',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 10),
            TextField(
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search_rounded),
                hintText: 'Search accounts by platform/name/username',
                border: OutlineInputBorder(),
              ),
              onChanged: (value) =>
                  setState(() => _accountsQuery = value.trim()),
            ),
            const SizedBox(height: 10),
            if (filtered.isEmpty)
              const Text('No accounts found.')
            else
              ...filtered.take(100).map((raw) {
                final item = raw is Map<String, dynamic>
                    ? raw
                    : Map<String, dynamic>.from(raw as Map);
                final active = item['isActive'] == true;

                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: const Icon(Icons.account_circle_rounded),
                    title: Text(item['accountName']?.toString() ?? 'Account'),
                    subtitle: Text(
                      '${item['platformId'] ?? 'unknown'} • @${item['accountUsername'] ?? '-'}',
                    ),
                    trailing: Icon(
                      active
                          ? Icons.check_circle_rounded
                          : Icons.cancel_rounded,
                      color: active ? Colors.green : Colors.red,
                    ),
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }

  Widget _buildExecutions(Map<String, dynamic> data) {
    final executions = data['executions'] is List
        ? (data['executions'] as List)
        : const <dynamic>[];

    final filtered = executions.where((raw) {
      final item = raw is Map<String, dynamic>
          ? raw
          : Map<String, dynamic>.from(raw as Map);
      if (_executionsQuery.isEmpty) return true;
      final query = _executionsQuery.toLowerCase();
      final taskName = item['taskName']?.toString().toLowerCase() ?? '';
      final status = item['status']?.toString().toLowerCase() ?? '';
      return taskName.contains(query) || status.contains(query);
    }).toList();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Executions',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 10),
            TextField(
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search_rounded),
                hintText: 'Search executions by task or status',
                border: OutlineInputBorder(),
              ),
              onChanged: (value) =>
                  setState(() => _executionsQuery = value.trim()),
            ),
            const SizedBox(height: 10),
            if (filtered.isEmpty)
              const Text('No executions found.')
            else
              ...filtered.take(120).map((raw) {
                final item = raw is Map<String, dynamic>
                    ? raw
                    : Map<String, dynamic>.from(raw as Map);
                final statusText = item['status']?.toString() ?? 'unknown';
                final statusColor = _statusColor(statusText);

                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: const Icon(Icons.history_rounded),
                    title: Text(
                      item['taskName']?.toString() ?? 'Task execution',
                    ),
                    subtitle: Text(item['executedAt']?.toString() ?? ''),
                    trailing: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: statusColor.withAlpha((0.16 * 255).round()),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        statusText,
                        style: TextStyle(color: statusColor),
                      ),
                    ),
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }

  Widget _buildAnalytics(Map<String, dynamic> data) {
    final totals = data['totals'] is Map<String, dynamic>
        ? data['totals'] as Map<String, dynamic>
        : <String, dynamic>{};
    final taskStats = data['taskStats'] is List
        ? (data['taskStats'] as List)
        : const <dynamic>[];

    final totalExecutions = (totals['executions'] as num?)?.toDouble() ?? 0;
    final successfulExecutions =
        (totals['successfulExecutions'] as num?)?.toDouble() ?? 0;
    final successRate =
        totalExecutions > 0 ? successfulExecutions / totalExecutions : 0.0;

    return Column(
      children: [
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            SizedBox(
              width: 260,
              child: _buildStatCard(
                title: 'Total Executions',
                value: '${totals['executions'] ?? 0}',
                icon: Icons.sync_rounded,
              ),
            ),
            SizedBox(
              width: 260,
              child: _buildStatCard(
                title: 'Successful',
                value: '${totals['successfulExecutions'] ?? 0}',
                icon: Icons.check_circle_rounded,
              ),
            ),
            SizedBox(
              width: 260,
              child: _buildStatCard(
                title: 'Failed',
                value: '${totals['failedExecutions'] ?? 0}',
                icon: Icons.error_rounded,
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Success Rate',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 8),
                LinearProgressIndicator(value: successRate.clamp(0.0, 1.0)),
                const SizedBox(height: 6),
                Text('${(successRate * 100).toStringAsFixed(1)}%'),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Top Task Stats',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 8),
                if (taskStats.isEmpty)
                  const Text('No analytics data yet.')
                else
                  ...taskStats.take(50).map((raw) {
                    final item = raw is Map<String, dynamic>
                        ? raw
                        : Map<String, dynamic>.from(raw as Map);
                    final itemRate =
                        (item['successRate'] as num?)?.toDouble() ?? 0;
                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(Icons.bar_chart_rounded),
                      title: Text(item['taskName']?.toString() ?? 'Task'),
                      subtitle: Text(
                        'Executions: ${item['totalExecutions'] ?? 0}',
                      ),
                      trailing: Text('${itemRate.toStringAsFixed(1)}%'),
                    );
                  }),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSettings(Map<String, dynamic> data) {
    final user = data['user'] is Map<String, dynamic>
        ? data['user'] as Map<String, dynamic>
        : <String, dynamic>{};

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Settings',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 10),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const CircleAvatar(child: Icon(Icons.person_rounded)),
              title: Text(user['name']?.toString() ?? widget.userName),
              subtitle: Text(user['email']?.toString() ?? widget.userEmail),
            ),
            const Divider(),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.link_rounded),
              title: const Text('API Base URL'),
              subtitle: Text(AppConfig.baseUri.toString()),
            ),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.security_rounded),
              title: const Text('Auth Mode'),
              subtitle: const Text('Bearer token via /api/mobile/login'),
            ),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: () async {
                await widget.onSignOut();
              },
              icon: const Icon(Icons.logout_rounded),
              label: const Text('Sign Out'),
            ),
          ],
        ),
      ),
    );
  }

  Color _statusColor(String status) {
    final normalized = status.toLowerCase();
    if (normalized.contains('success') ||
        normalized.contains('active') ||
        normalized.contains('completed')) {
      return Colors.green;
    }
    if (normalized.contains('error') || normalized.contains('failed')) {
      return Colors.red;
    }
    if (normalized.contains('paused')) {
      return Colors.orange;
    }
    return Colors.blueGrey;
  }

  Widget _buildCurrentPanel() {
    switch (_currentKind) {
      case PanelKind.dashboard:
        return _buildPanelFrame(
          kind: PanelKind.dashboard,
          builder: _buildDashboard,
        );
      case PanelKind.tasks:
        return _buildPanelFrame(kind: PanelKind.tasks, builder: _buildTasks);
      case PanelKind.accounts:
        return _buildPanelFrame(
          kind: PanelKind.accounts,
          builder: _buildAccounts,
        );
      case PanelKind.executions:
        return _buildPanelFrame(
          kind: PanelKind.executions,
          builder: _buildExecutions,
        );
      case PanelKind.analytics:
        return _buildPanelFrame(
          kind: PanelKind.analytics,
          builder: _buildAnalytics,
        );
      case PanelKind.settings:
        return _buildPanelFrame(
          kind: PanelKind.settings,
          builder: _buildSettings,
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentPanel = kPanelSpecs[_selectedIndex];

    return LayoutBuilder(
      builder: (context, constraints) {
        final wide = constraints.maxWidth >= 1024;

        return Scaffold(
          appBar: AppBar(
            title: Text(currentPanel.label),
            actions: [
              IconButton(
                icon: const Icon(Icons.refresh_rounded),
                tooltip: 'Refresh',
                onPressed: () => unawaited(_loadCurrentPanel(force: true)),
              ),
              IconButton(
                icon: const Icon(Icons.logout_rounded),
                tooltip: 'Sign out',
                onPressed: () async {
                  await widget.onSignOut();
                },
              ),
            ],
          ),
          drawer: wide ? null : _buildDrawer(),
          body: Row(
            children: [
              if (wide) _buildRail(),
              Expanded(child: _buildCurrentPanel()),
            ],
          ),
          bottomNavigationBar: wide ? null : _buildBottomNavigation(),
        );
      },
    );
  }
}

// API client lives in lib/api/api_client.dart
