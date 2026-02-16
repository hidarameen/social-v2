# SocialFlow Flutter Wrapper

This is a minimal Flutter app that loads the hosted SocialFlow web app inside an Android WebView.

## Build (GitHub Actions)

Workflow: `.github/workflows/flutter-android.yml`

Required GitHub secret:
- `FLUTTER_APP_URL`: your hosted HTTPS URL (example: `https://your-app.example.com/`)

Optional GitHub secret:
- `FLUTTER_ANDROID_ORG`: Android package org (default `com.socialflow.app`)

After the workflow succeeds, download the artifact:
- `socialflow-flutter-apk` -> `app-release.apk`

## Local build

```bash
flutter pub get
flutter build apk --release --dart-define=APP_URL=https://your-app.example.com/
```

