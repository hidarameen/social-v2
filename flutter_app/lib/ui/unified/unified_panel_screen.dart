import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../app_config.dart';
import 'web_redirect_stub.dart' if (dart.library.html) 'web_redirect_web.dart';

class UnifiedPanelScreen extends StatefulWidget {
  const UnifiedPanelScreen({super.key});

  @override
  State<UnifiedPanelScreen> createState() => _UnifiedPanelScreenState();
}

class _UnifiedPanelScreenState extends State<UnifiedPanelScreen> {
  WebViewController? _controller;
  bool _loading = true;
  String _targetUrl = '';

  @override
  void initState() {
    super.initState();
    final uri = AppConfig.resolvePath('/dashboard');
    _targetUrl = uri.toString();

    if (kIsWeb) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        redirectBrowserTo(_targetUrl);
      });
      return;
    }

    final controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.transparent)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (_) {
            if (!mounted) return;
            setState(() => _loading = false);
          },
        ),
      )
      ..loadRequest(uri);
    _controller = controller;
  }

  @override
  Widget build(BuildContext context) {
    if (kIsWeb) {
      return Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const CircularProgressIndicator(),
                const SizedBox(height: 16),
                const Text(
                  'Opening SocialPanel...',
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      );
    }

    final controller = _controller;
    if (controller == null) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Stack(
          children: [
            WebViewWidget(controller: controller),
            if (_loading)
              const Align(
                alignment: Alignment.topCenter,
                child: LinearProgressIndicator(minHeight: 2),
              ),
          ],
        ),
      ),
    );
  }
}
