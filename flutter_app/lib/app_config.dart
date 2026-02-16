class AppConfig {
  // Set by build arg:
  // flutter build apk --dart-define=APP_URL=https://your-domain/
  static const String _rawAppUrl = String.fromEnvironment('APP_URL', defaultValue: '');

  // Local fallback for debug only. Production Docker build should pass APP_URL.
  static const String _debugFallbackUrl = 'http://127.0.0.1:5000/';

  static String _normalizeUrl(String input) {
    final trimmed = input.trim();
    if (trimmed.isEmpty) return '';
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    return 'https://$trimmed';
  }

  static String get appUrl {
    final value = _rawAppUrl.trim();
    if (value.isEmpty) return _normalizeUrl(_debugFallbackUrl);
    return _normalizeUrl(value);
  }

  static Uri get baseUri {
    return Uri.parse(appUrl);
  }

  static Uri resolvePath(String path) {
    final normalizedPath = path.startsWith('/') ? path : '/$path';
    final base = baseUri;
    final trimmedBasePath = base.path == '/' ? '' : base.path.replaceAll(RegExp(r'/+$'), '');
    final fullPath = '$trimmedBasePath$normalizedPath';
    return base.replace(path: fullPath, query: null, fragment: null);
  }
}
