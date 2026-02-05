# Environment Variables

This app uses OAuth for supported platforms. Set these in `.env.local` (or your deployment environment).

Required:
- `DATABASE_URL`
- `NEXTAUTH_SECRET`

OAuth redirect base URL:
- `APP_URL` (e.g., `http://localhost:5000`)

Twitter / X:
- `TWITTER_CLIENT_ID`
- `TWITTER_CLIENT_SECRET`

Facebook:
- `FACEBOOK_CLIENT_ID`
- `FACEBOOK_CLIENT_SECRET`

Instagram (Basic Display):
- `INSTAGRAM_CLIENT_ID`
- `INSTAGRAM_CLIENT_SECRET`

Google / YouTube:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

TikTok:
- `TIKTOK_CLIENT_KEY`
- `TIKTOK_CLIENT_SECRET`

Telegram (no OAuth):
- `TELEGRAM_BOT_TOKEN` (manual setup)

Redirect URIs (add in each provider console):
- `APP_URL/api/oauth/twitter/callback`
- `APP_URL/api/oauth/facebook/callback`
- `APP_URL/api/oauth/instagram/callback`
- `APP_URL/api/oauth/youtube/callback`
- `APP_URL/api/oauth/tiktok/callback`
