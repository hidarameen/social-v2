import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'storage_keys.dart';

enum AppThemeMode { light, dark }

// Keep in sync with Next.js presets: components/theme-provider.tsx
const List<String> kThemePresets = <String>[
  'orbit',
  'graphite',
  'sunrise',
  'nord',
  'ocean',
  'warmlux',
];

const List<String> kShellDensities = <String>['comfortable', 'compact'];

class AppState extends ChangeNotifier {
  AppState({
    required this.locale,
    required this.dir,
    required this.themeMode,
    required this.themePreset,
    required this.sidebarCollapsed,
    required this.reducedMotion,
    required this.density,
    required this.timezone,
    required this.emailOnSuccess,
    required this.emailOnError,
    required this.pushNotifications,
    required this.allowAnalytics,
    required this.shareErrorLogs,
  });

  String locale; // 'ar' | 'en'
  TextDirection dir;
  AppThemeMode themeMode;
  String themePreset; // kThemePresets

  bool sidebarCollapsed;
  bool reducedMotion;
  String density; // kShellDensities

  String timezone;

  bool emailOnSuccess;
  bool emailOnError;
  bool pushNotifications;

  bool allowAnalytics;
  bool shareErrorLogs;

  static Future<AppState> load() async {
    final prefs = await SharedPreferences.getInstance();

    final rawLocale = (prefs.getString(StorageKeys.locale) ?? '').trim();
    final locale = rawLocale == 'en' || rawLocale == 'ar' ? rawLocale : 'ar';

    final rawTheme = (prefs.getString(StorageKeys.themeMode) ?? '').trim();
    final themeMode = rawTheme == 'dark' ? AppThemeMode.dark : AppThemeMode.light;

    final rawPreset = (prefs.getString(StorageKeys.themePreset) ?? '').trim();
    final themePreset = kThemePresets.contains(rawPreset) ? rawPreset : 'orbit';

    final rawCollapsed = (prefs.getString(StorageKeys.shellSidebarCollapsed) ?? '').trim();
    final sidebarCollapsed = rawCollapsed == '1';

    final rawReducedMotion = (prefs.getString(StorageKeys.shellReducedMotion) ?? '').trim();
    final reducedMotion = rawReducedMotion == '1';

    final rawDensity = (prefs.getString(StorageKeys.shellDensity) ?? '').trim();
    final density = kShellDensities.contains(rawDensity) ? rawDensity : 'comfortable';

    final timezone = (prefs.getString(StorageKeys.timezone) ?? 'UTC').trim();

    bool readBoolKey(String key, {required bool fallback}) {
      final raw = (prefs.getString(key) ?? '').trim();
      if (raw == '1') return true;
      if (raw == '0') return false;
      return fallback;
    }

    return AppState(
      locale: locale,
      dir: locale == 'ar' ? TextDirection.rtl : TextDirection.ltr,
      themeMode: themeMode,
      themePreset: themePreset,
      sidebarCollapsed: sidebarCollapsed,
      reducedMotion: reducedMotion,
      density: density,
      timezone: timezone.isEmpty ? 'UTC' : timezone,
      emailOnSuccess: readBoolKey(StorageKeys.notificationsEmailOnSuccess, fallback: true),
      emailOnError: readBoolKey(StorageKeys.notificationsEmailOnError, fallback: true),
      pushNotifications: readBoolKey(StorageKeys.notificationsPushEnabled, fallback: false),
      allowAnalytics: readBoolKey(StorageKeys.privacyAllowAnalytics, fallback: true),
      shareErrorLogs: readBoolKey(StorageKeys.privacyShareErrorLogs, fallback: false),
    );
  }

  Future<void> toggleLocale() async {
    locale = locale == 'en' ? 'ar' : 'en';
    dir = locale == 'ar' ? TextDirection.rtl : TextDirection.ltr;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(StorageKeys.locale, locale);
    notifyListeners();
  }

  Future<void> toggleThemeMode() async {
    themeMode = themeMode == AppThemeMode.dark ? AppThemeMode.light : AppThemeMode.dark;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(StorageKeys.themeMode, themeMode == AppThemeMode.dark ? 'dark' : 'light');
    notifyListeners();
  }

  Future<void> setThemePreset(String value) async {
    final normalized = value.trim().toLowerCase();
    if (!kThemePresets.contains(normalized)) return;
    if (themePreset == normalized) return;
    themePreset = normalized;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(StorageKeys.themePreset, themePreset);
    notifyListeners();
  }

  Future<void> setSidebarCollapsed(bool value) async {
    if (sidebarCollapsed == value) return;
    sidebarCollapsed = value;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(StorageKeys.shellSidebarCollapsed, sidebarCollapsed ? '1' : '0');
    notifyListeners();
  }

  Future<void> setReducedMotion(bool value) async {
    if (reducedMotion == value) return;
    reducedMotion = value;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(StorageKeys.shellReducedMotion, reducedMotion ? '1' : '0');
    notifyListeners();
  }

  Future<void> setDensity(String value) async {
    final normalized = value.trim().toLowerCase();
    if (!kShellDensities.contains(normalized)) return;
    if (density == normalized) return;
    density = normalized;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(StorageKeys.shellDensity, density);
    notifyListeners();
  }

  Future<void> setTimezone(String value) async {
    final normalized = value.trim();
    if (normalized.isEmpty) return;
    if (timezone == normalized) return;
    timezone = normalized;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(StorageKeys.timezone, timezone);
    notifyListeners();
  }

  Future<void> setNotifications({
    bool? emailOnSuccessValue,
    bool? emailOnErrorValue,
    bool? pushNotificationsValue,
  }) async {
    final nextEmailOnSuccess = emailOnSuccessValue ?? emailOnSuccess;
    final nextEmailOnError = emailOnErrorValue ?? emailOnError;
    final nextPush = pushNotificationsValue ?? pushNotifications;

    final prefs = await SharedPreferences.getInstance();
    emailOnSuccess = nextEmailOnSuccess;
    emailOnError = nextEmailOnError;
    pushNotifications = nextPush;
    await prefs.setString(StorageKeys.notificationsEmailOnSuccess, emailOnSuccess ? '1' : '0');
    await prefs.setString(StorageKeys.notificationsEmailOnError, emailOnError ? '1' : '0');
    await prefs.setString(StorageKeys.notificationsPushEnabled, pushNotifications ? '1' : '0');
    notifyListeners();
  }

  Future<void> setPrivacy({
    bool? allowAnalyticsValue,
    bool? shareErrorLogsValue,
  }) async {
    final nextAllow = allowAnalyticsValue ?? allowAnalytics;
    final nextShare = shareErrorLogsValue ?? shareErrorLogs;

    final prefs = await SharedPreferences.getInstance();
    allowAnalytics = nextAllow;
    shareErrorLogs = nextShare;
    await prefs.setString(StorageKeys.privacyAllowAnalytics, allowAnalytics ? '1' : '0');
    await prefs.setString(StorageKeys.privacyShareErrorLogs, shareErrorLogs ? '1' : '0');
    notifyListeners();
  }
}
