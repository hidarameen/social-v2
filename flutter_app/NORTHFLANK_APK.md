# Northflank: Build APK With Docker

If your GitHub Actions is blocked, you can still build and download the Flutter APK using Northflank by deploying a container that serves the APK over HTTP.

## What you get

- A URL like `https://your-northflank-service/.../app-release.apk`
- You download the APK directly and install it (no Google Play needed)

## Prerequisites

- Your SocialFlow web app must be hosted on HTTPS (the Flutter app loads it in a WebView).
- You know your hosted URL, for example:
  - `https://bc26eb03-4b04-4690-b4c7-fba18b5b1c36-00-1d71ogh8n44b9.sisko.replit.dev/`

## Northflank setup

1. Create a new **Deployment Service**.
2. Build type: **Dockerfile**
3. Dockerfile path: `flutter_app/Dockerfile.apk`
4. Exposed port: `80`
5. Add build arguments:
   - `APP_URL` = your hosted URL (must end with `/`)
   - Optional `ANDROID_ORG` = e.g. `com.yourname.socialflow`
6. Deploy.

## Download

Open your service URL and download:

- `/app-release.apk`

Example:

- `https://your-service-url/app-release.apk`

## Notes

- This container only serves the APK file; it is not your Next.js backend.
- If you change `APP_URL`, you must rebuild/redeploy to bake it into the APK.
