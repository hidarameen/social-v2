import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:socialflow_flutter/app_state.dart';
import 'package:socialflow_flutter/api/api_client.dart';
import 'package:socialflow_flutter/main.dart';

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
    SharedPreferences.setMockInitialValues({});
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
    SharedPreferences.setMockInitialValues({});
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

    await tester.tap(find.textContaining('Create one'));
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

    final button = tester.widget<FilledButton>(
      find.byKey(const Key('register-submit-button')),
    );
    expect(button.onPressed, isNull);
  });
}
