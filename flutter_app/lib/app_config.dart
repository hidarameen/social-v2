class AppConfig {
  // Set the target web app URL via build:
  // `flutter build apk --dart-define=APP_URL=https://...`
  static const String appUrl =
      String.fromEnvironment('APP_URL', defaultValue: 'https://example.com/');
}

