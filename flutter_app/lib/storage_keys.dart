class StorageKeys {
  static const String mobileAccessToken = 'flutter_mobile_access_token';
  static const String mobileUserName = 'flutter_mobile_user_name';
  static const String mobileUserEmail = 'flutter_mobile_user_email';

  // Match web keys where possible so behavior is consistent across platforms.
  static const String authRememberEmail = 'socialflow_auth_remember_email';
  static const String authRememberEnabled = 'socialflow_auth_remember_enabled';
  static const String authIntroSeen = 'socialflow_auth_intro_seen_v1';
  static const String locale = 'socialflow_locale_v1';
  static const String themeMode = 'theme'; // 'light' | 'dark'
  static const String themePreset = 'socialflow_theme_preset_v1';

  static const String shellSidebarCollapsed =
      'socialflow_shell_sidebar_collapsed_v1'; // '1' | '0'
  static const String shellReducedMotion =
      'socialflow_shell_reduced_motion_v1'; // '1' | '0'
  static const String shellDensity =
      'socialflow_shell_density_v1'; // 'comfortable' | 'compact'

  static const String notificationsEmailOnSuccess =
      'socialflow_notifications_email_success_v1'; // '1' | '0'
  static const String notificationsEmailOnError =
      'socialflow_notifications_email_error_v1'; // '1' | '0'
  static const String notificationsPushEnabled =
      'socialflow_notifications_push_v1'; // '1' | '0'
  static const String privacyAllowAnalytics =
      'socialflow_privacy_allow_analytics_v1'; // '1' | '0'
  static const String privacyShareErrorLogs =
      'socialflow_privacy_share_error_logs_v1'; // '1' | '0'
  static const String timezone = 'socialflow_timezone_v1'; // e.g. 'UTC'

  static const String cachedExecutionsPayload =
      'socialflow_cached_executions_payload_v1';
}
