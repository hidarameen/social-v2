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
        ),
      )
      ..loadRequest(Uri.parse(AppConfig.appUrl));
  }

  @override
  void dispose() {
    super.dispose();
  }

  Future<bool> _handleBack() async {
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
              if (_progress < 100)
                LinearProgressIndicator(
                  value: _progress / 100.0,
                  backgroundColor: const Color(0xFF0D1422),
                ),
              if (_isOffline)
                Positioned.fill(
                  child: Container(
                    color: const Color(0xCC0D1422),
                    alignment: Alignment.center,
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 420),
                      child: Card(
                        margin: const EdgeInsets.all(16),
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Text(
                                'Offline',
                                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                              ),
                              const SizedBox(height: 8),
                              const Text(
                                'No internet connection. Reconnect and try again.',
                                textAlign: TextAlign.center,
                              ),
                              const SizedBox(height: 12),
                              FilledButton(
                                onPressed: () async {
                                  setState(() => _isOffline = false);
                                  await _controller.reload();
                                },
                                child: const Text('Retry'),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
