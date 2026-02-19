import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:socialflow_flutter/app_state.dart';
import 'package:socialflow_flutter/api/api_client.dart';
import 'package:socialflow_flutter/main.dart';
import 'package:socialflow_flutter/storage_keys.dart';

class FakeAuthApiClient extends ApiClient {
  FakeAuthApiClient({
    required this.onRegister,
    required this.onLogin,
  }) : super(baseUri: Uri.parse('https://example.test'));

  final Future<Map<String, dynamic>> Function({
    required String name,
    required String email,
    required String password,
  }) onRegister;

  final Future<AuthSession> Function({
    required String email,
    required String password,
  }) onLogin;

  @override
  Future<Map<String, dynamic>> register({
    required String name,
    required String email,
    required String password,
  }) {
    return onRegister(name: name, email: email, password: password);
  }

  @override
  Future<AuthSession> login({required String email, required String password}) {
    return onLogin(email: email, password: password);
  }
}

void main() {
  testWidgets('login screen calls onSignedIn on success', (tester) async {
    SharedPreferences.setMockInitialValues(
      {StorageKeys.authIntroSeen: '1'},
    );
    late AuthSession signedIn;

    final api = FakeAuthApiClient(
      onRegister: ({required name, required email, required password}) async {
        return {'success': true, 'verificationRequired': true};
      },
      onLogin: ({required email, required password}) async {
        return const AuthSession(
          accessToken: 'token-1',
          userId: 'u1',
          email: 'user@example.com',
          name: 'Test User',
        );
      },
    );

    final state = AppState(
      locale: 'en',
      dir: TextDirection.ltr,
      themeMode: AppThemeMode.light,
      themePreset: 'orbit',
      sidebarCollapsed: false,
      reducedMotion: false,
      density: 'comfortable',
      timezone: 'UTC',
      emailOnSuccess: true,
      emailOnError: true,
      pushNotifications: false,
      allowAnalytics: true,
      shareErrorLogs: false,
    );

    await tester.pumpWidget(
      MaterialApp(
        home: AuthFlow(
          state: state,
          api: api,
          onSignedIn: (session) async {
            signedIn = session;
          },
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byKey(const Key('login-email-field')),
      'user@example.com',
    );
    await tester.enterText(
      find.byKey(const Key('login-password-field')),
      'password123',
    );
    await tester.tap(find.byKey(const Key('login-submit-button')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));

    expect(signedIn.accessToken, 'token-1');
    expect(signedIn.email, 'user@example.com');
  });

  testWidgets('register requires terms checkbox', (tester) async {
    var registerCallCount = 0;
    SharedPreferences.setMockInitialValues(
      {StorageKeys.authIntroSeen: '1'},
    );
    final api = FakeAuthApiClient(
      onRegister: ({required name, required email, required password}) async {
        registerCallCount += 1;
        return {'success': true, 'verificationRequired': true};
      },
      onLogin: ({required email, required password}) async {
        return const AuthSession(
          accessToken: 'token-1',
          userId: 'u1',
          email: 'user@example.com',
          name: 'Test User',
        );
      },
    );

    final state = AppState(
      locale: 'en',
      dir: TextDirection.ltr,
      themeMode: AppThemeMode.light,
      themePreset: 'orbit',
      sidebarCollapsed: false,
      reducedMotion: false,
      density: 'comfortable',
      timezone: 'UTC',
      emailOnSuccess: true,
      emailOnError: true,
      pushNotifications: false,
      allowAnalytics: true,
      shareErrorLogs: false,
    );

    await tester.pumpWidget(
      MaterialApp(
        home: AuthFlow(
          state: state,
          api: api,
          onSignedIn: (_) async {},
        ),
      ),
    );
    await tester.pumpAndSettle();

    final createAccountLink = find.textContaining('Create Account').first;
    await tester.ensureVisible(createAccountLink);
    await tester.tap(createAccountLink);
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byKey(const Key('register-name-field')),
      'Test User',
    );
    await tester.enterText(
      find.byKey(const Key('register-email-field')),
      'test@example.com',
    );
    await tester.enterText(
      find.byKey(const Key('register-password-field')),
      'Password123!',
    );
    await tester.enterText(
      find.byKey(const Key('register-confirm-password-field')),
      'Password123!',
    );

    final submitButton = find.byKey(const Key('register-submit-button'));
    await tester.ensureVisible(submitButton);
    await tester.tap(submitButton);
    await tester.pump();

    expect(registerCallCount, 0);
  });
}
