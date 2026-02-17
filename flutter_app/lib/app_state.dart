import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'storage_keys.dart';

enum AppThemeMode { light, dark }

class AppState extends ChangeNotifier {
  AppState({
    required this.locale,
    required this.dir,
    required this.themeMode,
  });

  String locale; // 'ar' | 'en'
  TextDirection dir;
  AppThemeMode themeMode;

  static Future<AppState> load() async {
    final prefs = await SharedPreferences.getInstance();

    final rawLocale = (prefs.getString(StorageKeys.locale) ?? '').trim();
    final locale = rawLocale == 'en' || rawLocale == 'ar' ? rawLocale : 'ar';

    final rawTheme = (prefs.getString(StorageKeys.themeMode) ?? '').trim();
    final themeMode = rawTheme == 'dark' ? AppThemeMode.dark : AppThemeMode.light;

    return AppState(
      locale: locale,
      dir: locale == 'ar' ? TextDirection.rtl : TextDirection.ltr,
      themeMode: themeMode,
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
}

