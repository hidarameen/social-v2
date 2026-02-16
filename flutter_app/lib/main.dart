import 'dart:async';

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

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
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0D1422)),
      ),
      home: const WebShell(),
    );
  }
}

class WebShell extends StatefulWidget {
  const WebShell({super.key});

  @override
  State<WebShell> createState() => _WebShellState();
}

class _WebShellState extends State<WebShell> {
  late final WebViewController _controller;

  bool _isOffline = false;
  int _progress = 0;

  @override
  void initState() {
    super.initState();

    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFF0D1422))
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (p) => setState(() => _progress = p),
          onWebResourceError: (_) => setState(() => _isOffline = true),
          onPageFinished: (_) => setState(() => _isOffline = false),
        ),
      )
      ..loadRequest(Uri.parse(AppConfig.appUrl));
  }

  @override
  void dispose() {
    super.dispose();
  }

  Future<bool> _handleBack() async {
    if (_isOffline) return true;
    final canGoBack = await _controller.canGoBack();
    if (canGoBack) {
      await _controller.goBack();
      return false;
    }
    return true;
  }

  @override
  Widget build(BuildContext context) {
    return WillPopScope(
      onWillPop: _handleBack,
      child: Scaffold(
        body: SafeArea(
          child: Stack(
            children: [
              WebViewWidget(controller: _controller),
              if (_progress < 100 && !_isOffline)
                LinearProgressIndicator(
                  value: _progress / 100.0,
                  backgroundColor: const Color(0xFF0D1422),
                ),
              if (_isOffline)
                Positioned.fill(
                  child: _OfflineAuthOverlay(
                    onRetry: () async {
                      setState(() => _isOffline = false);
                      await _controller.reload();
                    },
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _OfflineAuthOverlay extends StatefulWidget {
  const _OfflineAuthOverlay({required this.onRetry});

  final Future<void> Function() onRetry;

  @override
  State<_OfflineAuthOverlay> createState() => _OfflineAuthOverlayState();
}

class _OfflineAuthOverlayState extends State<_OfflineAuthOverlay> {
  final _loginEmail = TextEditingController();
  final _loginPassword = TextEditingController();
  final _registerName = TextEditingController();
  final _registerEmail = TextEditingController();
  final _registerPassword = TextEditingController();
  final _registerPasswordConfirm = TextEditingController();

  @override
  void dispose() {
    _loginEmail.dispose();
    _loginPassword.dispose();
    _registerName.dispose();
    _registerEmail.dispose();
    _registerPassword.dispose();
    _registerPasswordConfirm.dispose();
    super.dispose();
  }

  void _show(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  void _submitLogin() {
    if (_loginEmail.text.trim().isEmpty || _loginPassword.text.isEmpty) {
      _show('Please enter email and password.');
      return;
    }
    _show('Offline mode: login form is ready. Connect internet to sign in.');
  }

  void _submitRegister() {
    if (_registerName.text.trim().isEmpty ||
        _registerEmail.text.trim().isEmpty ||
        _registerPassword.text.isEmpty ||
        _registerPasswordConfirm.text.isEmpty) {
      _show('Please complete all fields.');
      return;
    }
    if (_registerPassword.text != _registerPasswordConfirm.text) {
      _show('Passwords do not match.');
      return;
    }
    _show('Offline mode: registration form is ready. Connect internet to create account.');
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xCC0D1422),
      alignment: Alignment.center,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 460),
        child: Card(
          margin: const EdgeInsets.all(16),
          child: DefaultTabController(
            length: 2,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    'Offline Mode',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'You can fill login or registration details now. Submission requires internet.',
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 14),
                  const TabBar(
                    tabs: [
                      Tab(text: 'Login'),
                      Tab(text: 'Register'),
                    ],
                  ),
                  SizedBox(
                    height: 290,
                    child: TabBarView(
                      children: [
                        _AuthFormLogin(
                          email: _loginEmail,
                          password: _loginPassword,
                          onSubmit: _submitLogin,
                        ),
                        _AuthFormRegister(
                          name: _registerName,
                          email: _registerEmail,
                          password: _registerPassword,
                          confirmPassword: _registerPasswordConfirm,
                          onSubmit: _submitRegister,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton(
                    onPressed: widget.onRetry,
                    child: const Text('Retry Connection'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _AuthFormLogin extends StatelessWidget {
  const _AuthFormLogin({
    required this.email,
    required this.password,
    required this.onSubmit,
  });

  final TextEditingController email;
  final TextEditingController password;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.only(top: 10),
      child: Column(
        children: [
          TextField(
            controller: email,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(
              labelText: 'Email',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: password,
            obscureText: true,
            decoration: const InputDecoration(
              labelText: 'Password',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: onSubmit,
              child: const Text('Login'),
            ),
          ),
        ],
      ),
    );
  }
}

class _AuthFormRegister extends StatelessWidget {
  const _AuthFormRegister({
    required this.name,
    required this.email,
    required this.password,
    required this.confirmPassword,
    required this.onSubmit,
  });

  final TextEditingController name;
  final TextEditingController email;
  final TextEditingController password;
  final TextEditingController confirmPassword;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.only(top: 10),
      child: Column(
        children: [
          TextField(
            controller: name,
            decoration: const InputDecoration(
              labelText: 'Full Name',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: email,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(
              labelText: 'Email',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: password,
            obscureText: true,
            decoration: const InputDecoration(
              labelText: 'Password',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: confirmPassword,
            obscureText: true,
            decoration: const InputDecoration(
              labelText: 'Confirm Password',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: onSubmit,
              child: const Text('Create Account'),
            ),
          ),
        ],
      ),
    );
  }
}
