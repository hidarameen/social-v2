import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';

import 'app_state.dart';
import 'firebase_options.dart';
import 'ui/sf_theme.dart';
import 'ui/unified/premium_loading_screen.dart';
import 'ui/unified/unified_panel_screen.dart';

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
    _load();
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
          title: 'Launching SocialFlow v2',
          subtitle: 'Preparing unified panel...',
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
          title: 'SocialFlow v2',
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
          home: UnifiedPanelScreen(state: state),
        );
      },
    );
  }
}
