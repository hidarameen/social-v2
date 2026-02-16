import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'app_config.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const SocialFlowApp());
}

class SocialFlowApp extends StatelessWidget {
  const SocialFlowApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SocialFlow',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0D1422)),
      ),
      home: const AppBootstrap(),
    );
  }
}

class AppBootstrap extends StatefulWidget {
  const AppBootstrap({super.key});

  @override
  State<AppBootstrap> createState() => _AppBootstrapState();
}

class _AppBootstrapState extends State<AppBootstrap> {
  static const String _tokenKey = 'flutter_mobile_access_token';
  static const String _nameKey = 'flutter_mobile_user_name';
  static const String _emailKey = 'flutter_mobile_user_email';

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
    final savedToken = (prefs.getString(_tokenKey) ?? '').trim();
    final savedName = prefs.getString(_nameKey) ?? '';
    final savedEmail = prefs.getString(_emailKey) ?? '';

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
      await prefs.remove(_tokenKey);
      await prefs.remove(_nameKey);
      await prefs.remove(_emailKey);
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
    await prefs.setString(_tokenKey, session.accessToken);
    await prefs.setString(_nameKey, session.name);
    await prefs.setString(_emailKey, session.email);

    if (!mounted) return;
    setState(() {
      _token = session.accessToken;
      _name = session.name;
      _email = session.email;
    });
  }

  Future<void> _handleSignOut() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_nameKey);
    await prefs.remove(_emailKey);

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
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (_token == null || _token!.isEmpty) {
      return AuthScreen(api: _api, onSignedIn: _handleSignedIn);
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
  const AuthScreen({
    super.key,
    required this.api,
    required this.onSignedIn,
  });

  final ApiClient api;
  final Future<void> Function(AuthSession session) onSignedIn;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final GlobalKey<FormState> _loginFormKey = GlobalKey<FormState>();
  final GlobalKey<FormState> _registerFormKey = GlobalKey<FormState>();

  final TextEditingController _loginEmailController = TextEditingController();
  final TextEditingController _loginPasswordController = TextEditingController();

  final TextEditingController _registerNameController = TextEditingController();
  final TextEditingController _registerEmailController = TextEditingController();
  final TextEditingController _registerPasswordController = TextEditingController();

  bool _busy = false;
  String _infoMessage = '';

  @override
  void dispose() {
    _loginEmailController.dispose();
    _loginPasswordController.dispose();
    _registerNameController.dispose();
    _registerEmailController.dispose();
    _registerPasswordController.dispose();
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
        _infoMessage = error is ApiException ? error.message : 'Failed to sign in.';
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _submitRegister() async {
    if (!_registerFormKey.currentState!.validate()) return;

    setState(() {
      _busy = true;
      _infoMessage = '';
    });

    try {
      final registerResponse = await widget.api.register(
        name: _registerNameController.text.trim(),
        email: _registerEmailController.text.trim(),
        password: _registerPasswordController.text,
      );

      final verificationRequired = registerResponse['verificationRequired'] == true;
      if (verificationRequired) {
        setState(() {
          _infoMessage =
              'Account created. Email verification is required before sign-in.';
        });
        return;
      }

      final session = await widget.api.login(
        email: _registerEmailController.text.trim(),
        password: _registerPasswordController.text,
      );
      await widget.onSignedIn(session);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _infoMessage = error is ApiException ? error.message : 'Failed to register.';
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
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
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'SocialFlow',
                          style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800),
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
                          height: 430,
                          child: TabBarView(
                            children: [
                              Form(
                                key: _loginFormKey,
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    TextFormField(
                                      controller: _loginEmailController,
                                      keyboardType: TextInputType.emailAddress,
                                      decoration:
                                          _inputDecoration('Email', Icons.alternate_email_rounded),
                                      validator: (value) {
                                        final input = (value ?? '').trim();
                                        if (input.isEmpty) return 'Email is required.';
                                        if (!input.contains('@')) return 'Enter a valid email.';
                                        return null;
                                      },
                                    ),
                                    const SizedBox(height: 12),
                                    TextFormField(
                                      controller: _loginPasswordController,
                                      obscureText: true,
                                      decoration: _inputDecoration('Password', Icons.lock_rounded),
                                      validator: (value) {
                                        if ((value ?? '').isEmpty) return 'Password is required.';
                                        return null;
                                      },
                                    ),
                                    const SizedBox(height: 16),
                                    SizedBox(
                                      width: double.infinity,
                                      child: FilledButton.icon(
                                        onPressed: _busy ? null : _submitLogin,
                                        icon: _busy
                                            ? const SizedBox(
                                                width: 16,
                                                height: 16,
                                                child: CircularProgressIndicator(strokeWidth: 2),
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
                                      controller: _registerNameController,
                                      decoration: _inputDecoration('Name', Icons.person_rounded),
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
                                      controller: _registerEmailController,
                                      keyboardType: TextInputType.emailAddress,
                                      decoration:
                                          _inputDecoration('Email', Icons.alternate_email_rounded),
                                      validator: (value) {
                                        final input = (value ?? '').trim();
                                        if (input.isEmpty) return 'Email is required.';
                                        if (!input.contains('@')) return 'Enter a valid email.';
                                        return null;
                                      },
                                    ),
                                    const SizedBox(height: 12),
                                    TextFormField(
                                      controller: _registerPasswordController,
                                      obscureText: true,
                                      decoration: _inputDecoration('Password', Icons.lock_rounded),
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
                                        onPressed: _busy ? null : _submitRegister,
                                        icon: _busy
                                            ? const SizedBox(
                                                width: 16,
                                                height: 16,
                                                child: CircularProgressIndicator(strokeWidth: 2),
                                              )
                                            : const Icon(Icons.person_add_alt_1_rounded),
                                        label: const Text('Create Account'),
                                      ),
                                    ),
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
                              color: _infoMessage.toLowerCase().contains('failed') ||
                                      _infoMessage.toLowerCase().contains('invalid')
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

enum PanelKind {
  dashboard,
  tasks,
  accounts,
  executions,
  analytics,
  settings,
}

class PanelSpec {
  const PanelSpec({required this.kind, required this.label, required this.icon});

  final PanelKind kind;
  final String label;
  final IconData icon;
}

const List<PanelSpec> kPanelSpecs = <PanelSpec>[
  PanelSpec(kind: PanelKind.dashboard, label: 'Dashboard', icon: Icons.space_dashboard_rounded),
  PanelSpec(kind: PanelKind.tasks, label: 'Tasks', icon: Icons.task_alt_rounded),
  PanelSpec(kind: PanelKind.accounts, label: 'Accounts', icon: Icons.groups_rounded),
  PanelSpec(kind: PanelKind.executions, label: 'Executions', icon: Icons.list_alt_rounded),
  PanelSpec(kind: PanelKind.analytics, label: 'Analytics', icon: Icons.query_stats_rounded),
  PanelSpec(kind: PanelKind.settings, label: 'Settings', icon: Icons.settings_rounded),
];

class _PanelState {
  _PanelState({
    this.loading = false,
    this.data,
    this.error,
  });

  bool loading;
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
          payload = await widget.api.fetchAccounts(widget.accessToken, limit: 60);
          break;
        case PanelKind.executions:
          payload = await widget.api.fetchExecutions(widget.accessToken, limit: 60);
          break;
        case PanelKind.analytics:
          payload = await widget.api.fetchAnalytics(widget.accessToken, limit: 60);
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
        state.error = error is ApiException ? error.message : 'Failed to load panel.';
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

  Widget _buildStatCard({required String title, required String value, required IconData icon}) {
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
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 3),
                  Text(value, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
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
                  const Icon(Icons.error_outline_rounded, size: 42, color: Colors.redAccent),
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
    final recentTasks = data['recentTasks'] is List ? (data['recentTasks'] as List) : const <dynamic>[];

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
                const Text('Recent Tasks', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
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
    final tasks = data['tasks'] is List ? (data['tasks'] as List) : const <dynamic>[];

    final filtered = tasks.where((raw) {
      final item = raw is Map<String, dynamic> ? raw : Map<String, dynamic>.from(raw as Map);
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
            const Text('Tasks', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
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
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: statusColor.withOpacity(0.16),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(statusText, style: TextStyle(color: statusColor)),
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
    final accounts = data['accounts'] is List ? (data['accounts'] as List) : const <dynamic>[];

    final filtered = accounts.where((raw) {
      final item = raw is Map<String, dynamic> ? raw : Map<String, dynamic>.from(raw as Map);
      if (_accountsQuery.isEmpty) return true;
      final query = _accountsQuery.toLowerCase();
      final name = item['accountName']?.toString().toLowerCase() ?? '';
      final username = item['accountUsername']?.toString().toLowerCase() ?? '';
      final platform = item['platformId']?.toString().toLowerCase() ?? '';
      return name.contains(query) || username.contains(query) || platform.contains(query);
    }).toList();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Accounts', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 10),
            TextField(
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search_rounded),
                hintText: 'Search accounts by platform/name/username',
                border: OutlineInputBorder(),
              ),
              onChanged: (value) => setState(() => _accountsQuery = value.trim()),
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
                      active ? Icons.check_circle_rounded : Icons.cancel_rounded,
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
    final executions = data['executions'] is List ? (data['executions'] as List) : const <dynamic>[];

    final filtered = executions.where((raw) {
      final item = raw is Map<String, dynamic> ? raw : Map<String, dynamic>.from(raw as Map);
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
            const Text('Executions', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 10),
            TextField(
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search_rounded),
                hintText: 'Search executions by task or status',
                border: OutlineInputBorder(),
              ),
              onChanged: (value) => setState(() => _executionsQuery = value.trim()),
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
                    title: Text(item['taskName']?.toString() ?? 'Task execution'),
                    subtitle: Text(item['executedAt']?.toString() ?? ''),
                    trailing: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: statusColor.withOpacity(0.16),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(statusText, style: TextStyle(color: statusColor)),
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
    final taskStats = data['taskStats'] is List ? (data['taskStats'] as List) : const <dynamic>[];

    final totalExecutions = (totals['executions'] as num?)?.toDouble() ?? 0;
    final successfulExecutions = (totals['successfulExecutions'] as num?)?.toDouble() ?? 0;
    final successRate = totalExecutions > 0 ? successfulExecutions / totalExecutions : 0.0;

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
                const Text('Success Rate', style: TextStyle(fontWeight: FontWeight.w700)),
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
                const Text('Top Task Stats', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                if (taskStats.isEmpty)
                  const Text('No analytics data yet.')
                else
                  ...taskStats.take(50).map((raw) {
                    final item = raw is Map<String, dynamic>
                        ? raw
                        : Map<String, dynamic>.from(raw as Map);
                    final itemRate = (item['successRate'] as num?)?.toDouble() ?? 0;
                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(Icons.bar_chart_rounded),
                      title: Text(item['taskName']?.toString() ?? 'Task'),
                      subtitle: Text('Executions: ${item['totalExecutions'] ?? 0}'),
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
            const Text('Settings', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
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
    if (normalized.contains('success') || normalized.contains('active') || normalized.contains('completed')) {
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
        return _buildPanelFrame(kind: PanelKind.dashboard, builder: _buildDashboard);
      case PanelKind.tasks:
        return _buildPanelFrame(kind: PanelKind.tasks, builder: _buildTasks);
      case PanelKind.accounts:
        return _buildPanelFrame(kind: PanelKind.accounts, builder: _buildAccounts);
      case PanelKind.executions:
        return _buildPanelFrame(kind: PanelKind.executions, builder: _buildExecutions);
      case PanelKind.analytics:
        return _buildPanelFrame(kind: PanelKind.analytics, builder: _buildAnalytics);
      case PanelKind.settings:
        return _buildPanelFrame(kind: PanelKind.settings, builder: _buildSettings);
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

class AuthSession {
  const AuthSession({
    required this.accessToken,
    required this.name,
    required this.email,
    required this.userId,
  });

  final String accessToken;
  final String name;
  final String email;
  final String userId;
}

class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => 'ApiException($statusCode): $message';
}

class ApiClient {
  ApiClient({required this.baseUri});

  final Uri baseUri;

  Uri _resolve(String path, [Map<String, String>? query]) {
    final target = AppConfig.resolvePath(path);
    return target.replace(queryParameters: query);
  }

  Future<Map<String, dynamic>> _request({
    required String method,
    required String path,
    String? token,
    Map<String, String>? query,
    Map<String, dynamic>? body,
  }) async {
    final uri = _resolve(path, query);
    final headers = <String, String>{
      'accept': 'application/json',
      'content-type': 'application/json',
    };

    if (token != null && token.trim().isNotEmpty) {
      headers['authorization'] = 'Bearer ${token.trim()}';
    }

    late final http.Response response;

    if (method == 'GET') {
      response = await http.get(uri, headers: headers);
    } else if (method == 'POST') {
      response = await http.post(uri, headers: headers, body: jsonEncode(body ?? <String, dynamic>{}));
    } else if (method == 'PATCH') {
      response = await http.patch(uri, headers: headers, body: jsonEncode(body ?? <String, dynamic>{}));
    } else {
      throw const ApiException('Unsupported request method');
    }

    Map<String, dynamic> decoded = <String, dynamic>{};
    if (response.body.trim().isNotEmpty) {
      try {
        final raw = jsonDecode(response.body);
        if (raw is Map<String, dynamic>) {
          decoded = raw;
        }
      } catch (_) {
        decoded = <String, dynamic>{};
      }
    }

    if (response.statusCode >= 400 || decoded['success'] == false) {
      final message = decoded['error']?.toString() ?? 'Request failed (${response.statusCode}).';
      throw ApiException(message, statusCode: response.statusCode);
    }

    return decoded;
  }

  Future<AuthSession> login({required String email, required String password}) async {
    final payload = await _request(
      method: 'POST',
      path: '/api/mobile/login',
      body: <String, dynamic>{
        'email': email,
        'password': password,
      },
    );

    final user = payload['user'] is Map<String, dynamic>
        ? payload['user'] as Map<String, dynamic>
        : <String, dynamic>{};

    return AuthSession(
      accessToken: payload['accessToken']?.toString() ?? '',
      userId: user['id']?.toString() ?? '',
      email: user['email']?.toString() ?? '',
      name: user['name']?.toString() ?? '',
    );
  }

  Future<Map<String, dynamic>> register({
    required String name,
    required String email,
    required String password,
  }) async {
    return _request(
      method: 'POST',
      path: '/api/auth/register',
      body: <String, dynamic>{
        'name': name,
        'email': email,
        'password': password,
      },
    );
  }

  Future<Map<String, dynamic>> fetchMobileMe(String token) async {
    final payload = await _request(
      method: 'GET',
      path: '/api/mobile/me',
      token: token,
    );

    final user = payload['user'] is Map<String, dynamic>
        ? payload['user'] as Map<String, dynamic>
        : <String, dynamic>{};

    return user;
  }

  Future<Map<String, dynamic>> fetchDashboard(String token) {
    return _request(method: 'GET', path: '/api/dashboard', token: token);
  }

  Future<Map<String, dynamic>> fetchTasks(String token, {int limit = 30}) {
    return _request(
      method: 'GET',
      path: '/api/tasks',
      token: token,
      query: {'limit': '$limit'},
    );
  }

  Future<Map<String, dynamic>> fetchAccounts(String token, {int limit = 30}) {
    return _request(
      method: 'GET',
      path: '/api/accounts',
      token: token,
      query: {'limit': '$limit'},
    );
  }

  Future<Map<String, dynamic>> fetchExecutions(String token, {int limit = 30}) {
    return _request(
      method: 'GET',
      path: '/api/executions',
      token: token,
      query: {'limit': '$limit'},
    );
  }

  Future<Map<String, dynamic>> fetchAnalytics(String token, {int limit = 30}) {
    return _request(
      method: 'GET',
      path: '/api/analytics',
      token: token,
      query: {'limit': '$limit'},
    );
  }

  Future<Map<String, dynamic>> fetchProfile(String token) {
    return _request(method: 'GET', path: '/api/profile', token: token);
  }
}
