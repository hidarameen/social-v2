import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:socialflow_flutter/api/api_client.dart';

void main() {
  group('ApiClient auth flow', () {
    test('logs in and parses session payload', () async {
      final client = ApiClient(
        baseUri: Uri.parse('http://127.0.0.1:5000'),
        httpClient: MockClient((request) async {
          expect(request.method, 'POST');
          expect(request.url.path, '/api/mobile/login');
          final body = jsonDecode(request.body) as Map<String, dynamic>;
          expect(body['email'], 'user@example.com');
          expect(body['password'], 'password123');

          return http.Response(
            jsonEncode({
              'success': true,
              'accessToken': 'token-1',
              'user': {
                'id': 'u1',
                'email': 'user@example.com',
                'name': 'Test User',
              },
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }),
      );

      final session = await client.login(
        email: 'user@example.com',
        password: 'password123',
      );

      expect(session.accessToken, 'token-1');
      expect(session.userId, 'u1');
      expect(session.email, 'user@example.com');
      expect(session.name, 'Test User');
    });

    test('verifies email and resends code', () async {
      final requestedPaths = <String>[];

      final client = ApiClient(
        baseUri: Uri.parse('http://127.0.0.1:5000'),
        httpClient: MockClient((request) async {
          requestedPaths.add(request.url.path);
          if (request.url.path == '/api/auth/verify-email') {
            final body = jsonDecode(request.body) as Map<String, dynamic>;
            expect(body['email'], 'user@example.com');
            expect(body['code'], '123456');
            return http.Response(jsonEncode({'success': true}), 200);
          }

          if (request.url.path == '/api/auth/resend-verification') {
            final body = jsonDecode(request.body) as Map<String, dynamic>;
            expect(body['email'], 'user@example.com');
            return http.Response(
              jsonEncode({
                'success': true,
                'message': 'Code sent',
                'debug': {'verificationCode': '654321'},
              }),
              200,
            );
          }

          return http.Response(
            jsonEncode({'success': false, 'error': 'Unexpected route'}),
            400,
          );
        }),
      );

      final verifyResponse = await client.verifyEmail(
        email: 'user@example.com',
        code: '123456',
      );
      expect(verifyResponse['success'], true);

      final resendResponse = await client.resendVerification(
        email: 'user@example.com',
      );
      final debug = resendResponse['debug'] as Map<String, dynamic>;
      expect(debug['verificationCode'], '654321');
      expect(requestedPaths, [
        '/api/auth/verify-email',
        '/api/auth/resend-verification',
      ]);
    });

    test('fetches current mobile user using bearer token', () async {
      final client = ApiClient(
        baseUri: Uri.parse('http://127.0.0.1:5000'),
        httpClient: MockClient((request) async {
          expect(request.method, 'GET');
          expect(request.url.path, '/api/mobile/me');
          expect(request.headers['authorization'], 'Bearer token-abc');

          return http.Response(
            jsonEncode({
              'success': true,
              'user': {
                'id': 'u1',
                'email': 'user@example.com',
                'name': 'Test User',
              },
            }),
            200,
          );
        }),
      );

      final me = await client.fetchMobileMe('token-abc');
      expect(me['id'], 'u1');
      expect(me['email'], 'user@example.com');
    });

    test('returns friendly message on network connectivity failures', () async {
      final client = ApiClient(
        baseUri: Uri.parse('http://127.0.0.1:5000'),
        httpClient: MockClient((_) async {
          throw http.ClientException('Connection refused');
        }),
      );

      expect(
        () => client.login(email: 'user@example.com', password: 'password123'),
        throwsA(
          isA<ApiException>().having(
            (e) => e.message,
            'message',
            contains('Unable to reach'),
          ),
        ),
      );
    });
  });
}
