# SocialFlow Flutter App (Native UI)

This Flutter app is now a **real native UI** (no WebView). It supports:
- Android APK
- Flutter Web

It connects directly to the existing SocialFlow backend APIs.

## Architecture

- Native Flutter screens: Login, Register, Dashboard, Tasks, Accounts, Executions, Analytics, Settings.
- API authentication uses bearer token from:
  - `POST /api/mobile/login`
- Authenticated API calls use:
  - `Authorization: Bearer <token>`
- Backend compatibility:
  - Existing API routes continue to work.
  - `getAuthUser()` now accepts either NextAuth session (web) or mobile bearer token (Flutter).

## Required Build Variable

- `APP_URL` (required in production)
  - Example: `https://your-socialflow-domain.example.com/`

## Build Android APK

```bash
flutter pub get
flutter build apk --release --dart-define=APP_URL=https://your-socialflow-domain.example.com/
```

## Build Flutter Web

```bash
flutter pub get
flutter build web --release --dart-define=APP_URL=https://your-socialflow-domain.example.com/
```

## Docker APK build

```bash
docker build -f flutter_app/Dockerfile.apk --build-arg APP_URL=https://your-socialflow-domain.example.com/ -t socialflow-apk .
```

Then copy the artifact from the image (`app-release.apk`) or serve it from nginx as configured in the Dockerfile.
