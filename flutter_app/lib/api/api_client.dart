import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../app_config.dart';

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
  ApiClient({required this.baseUri, http.Client? httpClient})
      : _httpClient = httpClient ?? http.Client();

  final Uri baseUri;
  final http.Client _httpClient;
  static const Duration _requestTimeout = Duration(seconds: 20);

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
    try {
      if (method == 'GET') {
        response = await _httpClient
            .get(uri, headers: headers)
            .timeout(_requestTimeout);
      } else if (method == 'POST') {
        response = await _httpClient
            .post(
              uri,
              headers: headers,
              body: jsonEncode(body ?? <String, dynamic>{}),
            )
            .timeout(_requestTimeout);
      } else if (method == 'PATCH') {
        response = await _httpClient
            .patch(
              uri,
              headers: headers,
              body: jsonEncode(body ?? <String, dynamic>{}),
            )
            .timeout(_requestTimeout);
      } else {
        throw const ApiException('Unsupported request method');
      }
    } catch (error) {
      final raw = error.toString().toLowerCase();
      if (raw.contains('timed out')) {
        throw const ApiException(
          'Request timed out. Please check your server and network.',
        );
      }
      if (raw.contains('socketexception') ||
          raw.contains('failed host lookup') ||
          raw.contains('connection refused') ||
          raw.contains('clientexception') ||
          raw.contains('handshake') ||
          raw.contains('certificate') ||
          raw.contains('permission denied') ||
          raw.contains('operation not permitted')) {
        final permissionHint = (raw.contains('permission denied') ||
                raw.contains('operation not permitted'))
            ? ' Android may be blocking network access (missing INTERNET permission).'
            : '';
        throw ApiException(
          'Unable to reach ${baseUri.toString()}. '
          'If testing on Android emulator locally, use APP_URL or 10.0.2.2.'
          '$permissionHint',
        );
      }
      if (error is ApiException) rethrow;
      throw ApiException('Network request failed: $error');
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
      final message = decoded['error']?.toString() ??
          'Request failed (${response.statusCode}).';
      throw ApiException(message, statusCode: response.statusCode);
    }

    return decoded;
  }

  Future<AuthSession> login({
    required String email,
    required String password,
  }) async {
    final payload = await _request(
      method: 'POST',
      path: '/api/mobile/login',
      body: <String, dynamic>{'email': email, 'password': password},
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

  Future<Map<String, dynamic>> forgotPassword({required String email}) {
    return _request(
      method: 'POST',
      path: '/api/auth/forgot-password',
      body: <String, dynamic>{'email': email.toLowerCase().trim()},
    );
  }

  Future<Map<String, dynamic>> resetPassword({
    String? token,
    String? email,
    String? code,
    required String password,
  }) {
    final normalizedToken = (token ?? '').trim();
    final normalizedEmail = (email ?? '').trim().toLowerCase();
    final normalizedCode = (code ?? '').trim();

    final payload = normalizedToken.isNotEmpty
        ? <String, dynamic>{'token': normalizedToken, 'password': password}
        : <String, dynamic>{
            'email': normalizedEmail,
            'code': normalizedCode,
            'password': password,
          };

    return _request(
      method: 'POST',
      path: '/api/auth/reset-password',
      body: payload,
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

  Future<Map<String, dynamic>> verifyEmail({
    String? token,
    String? email,
    String? code,
  }) {
    final normalizedToken = (token ?? '').trim();
    final normalizedEmail = (email ?? '').trim().toLowerCase();
    final normalizedCode = (code ?? '').trim();

    final payload = normalizedToken.isNotEmpty
        ? <String, dynamic>{'token': normalizedToken}
        : <String, dynamic>{'email': normalizedEmail, 'code': normalizedCode};

    return _request(
      method: 'POST',
      path: '/api/auth/verify-email',
      body: payload,
    );
  }

  Future<Map<String, dynamic>> resendVerification({required String email}) {
    return _request(
      method: 'POST',
      path: '/api/auth/resend-verification',
      body: <String, dynamic>{'email': email.toLowerCase().trim()},
    );
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

