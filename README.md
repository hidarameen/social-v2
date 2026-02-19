# SocialFlow Platform Report

Updated: February 16, 2026

## 1) Executive Summary
SocialFlow is a social automation platform with:
- A Next.js web application for full product operations.
- A real Flutter application (no WebView) for Android APK and Flutter Web.
- A shared backend API layer used by both web and Flutter clients.
- Docker-first deployment targeting Northflank.

The current architecture supports two production outputs from one repository:
- Web platform runtime.
- Android APK artifact generation.

## 2) Product Scope
### Core Capabilities
- User authentication and account management.
- Social account connections and credential handling.
- Task creation and scheduling workflows.
- Execution tracking and operational history.
- Analytics and reporting pages.
- Settings and profile management.

### Clients
- Web client: Next.js app routes and API routes.
- Flutter client: Native UI panels for login, register, dashboard, tasks, accounts, executions, analytics, and settings.

## 3) Technical Architecture
### Web Application
- Framework: Next.js (App Router).
- Language: TypeScript.
- Styling/UI: component-based React UI system.
- Auth: NextAuth (session-based for web).

### Flutter Application
- Framework: Flutter.
- Mode: Native widgets (not WebView).
- State and persistence: `shared_preferences`.
- Networking: `http` package calling backend APIs directly.

### Shared Backend
- API: Next.js API routes under `app/api/*`.
- Database access: internal `lib/db` layer.
- Runtime services: background processing, execution services, platform integrations.

### Mobile Token Bridge
To support Flutter without cookie/session dependence:
- Added `POST /api/mobile/login` for bearer token issuance.
- Added `GET /api/mobile/me` for token validation and profile bootstrap.
- Extended `getAuthUser()` to accept both auth modes:
1. NextAuth session (web).
2. Bearer token (Flutter).

## 4) Repository Layout
- `app/` Next.js pages and API routes.
- `components/` reusable web UI components.
- `lib/` shared services, auth, utilities, data access.
- `db/` SQL schema and database artifacts.
- `flutter_app/` Flutter source used for APK/Web builds.
- `Dockerfile` single unified multi-stage build for web runtime + APK artifact + Flutter web output.

## 5) Deployment Model (Northflank)
### Unified Build Pipeline
The root `Dockerfile` performs multi-stage steps:
1. Install web dependencies.
2. Build Flutter APK.
3. Build Flutter Web bundle.
4. Copy APK into web public assets.
5. Build Next.js runtime image.

### Runtime Outputs
- Web app served from Next.js runtime.
- APK downloadable from web public path.
- Flutter Web static bundle published at `/flutter-web/index.html`.

## 6) Environment Configuration
### Required
- `APP_URL`: Public HTTPS base URL used by Flutter build-time config.

### Recommended Security
- `MOBILE_AUTH_SECRET`: Signing secret for mobile bearer tokens.
- Standard app secrets for web auth and provider integrations.

## 7) Build and Run
### Web (Local)
```bash
pnpm install
pnpm dev
```

### Production Web Build
```bash
pnpm build
pnpm start
```

### Flutter APK (Local)
```bash
cd flutter_app
flutter pub get
flutter build apk --release --dart-define=APP_URL=https://your-domain.example.com/
```

### Flutter Web (Local)
```bash
cd flutter_app
flutter pub get
flutter build web --release --dart-define=APP_URL=https://your-domain.example.com/
```

### Unified Docker Build (Single Dockerfile)
```bash
docker build --build-arg APP_URL=https://your-domain.example.com/ -t socialflow .
```

## 8) API Overview for Flutter
### Authentication
- `POST /api/mobile/login`
- Request: email, password.
- Response: bearer token + user payload.

### Session Bootstrap
- `GET /api/mobile/me`
- Header: `Authorization: Bearer <token>`

### Core Data Panels
- `/api/dashboard`
- `/api/tasks`
- `/api/accounts`
- `/api/executions`
- `/api/analytics`
- `/api/profile`

## 9) Current Status
### Completed
- WebView removed from Flutter client.
- Native Flutter panel shell implemented.
- Mobile bearer-token auth bridge implemented.
- Unified Docker build enhanced for APK + Flutter Web output.

### In Progress / Next Expansion
- Full feature parity for every advanced web flow in Flutter.
- Deeper Flutter forms for create/edit task and platform-specific credentials.
- Additional UX polish for perfect parity across web and mobile.

## 10) Quality and Validation
### Performed
- Web build validation (`pnpm build`).
- TypeScript validation (`pnpm exec tsc --noEmit`).

### Notes
- Docker daemon availability depends on environment runtime.
- Flutter CLI availability depends on build environment image.

## 11) Recent Delivered Changes
- Native Flutter conversion from WebView architecture.
- New mobile auth token issuance and resolution paths.
- Unified container output includes Flutter Web static build.

## 12) Operational Guidance
When changing production domain:
1. Update `APP_URL` in build environment.
2. Rebuild deployment image.
3. Re-generate APK from the updated build.
4. Redeploy service and verify API reachability from client.

## 13) Conclusion
SocialFlow now has a dual-client foundation with a shared backend contract:
- Web platform remains fully operational on Next.js.
- Flutter is now a real native app path for APK and web builds.

This report replaces previous fragmented README files with a single organized technical reference.

## 14) تقرير فحص شامل E2E (العربية) - 2026-02-19

### نطاق الفحص
تم تنفيذ فحص شامل على:
- واجهة الويب `Next.js` (صفحات + مكونات + API Routes).
- تطبيق `Flutter` (تحليل + اختبارات).
- البناء والإعداد (`build`, `tsc`, `lint`, Dockerfile, CI).
- منطق الأمان والتحقق والحد من المعدل.

### أوامر التحقق التي تم تشغيلها
- `pnpm lint`  -> فشل.
- `pnpm exec tsc --noEmit` -> ناجح.
- `pnpm build` -> ناجح مع تحذيرات مهمة.
- `cd flutter_app && flutter analyze --no-fatal-infos` -> ناجح مع 86 ملاحظة Deprecated.
- `cd flutter_app && flutter test` -> ناجح.
- `docker --version` -> غير متاح في البيئة الحالية (لا يمكن تنفيذ Docker E2E فعلي هنا).

### نتائج حرجة (Confirmed Defects)
1. كسر خط جودة Lint بالكامل:
   - لا يوجد `eslint.config.*` مع ESLint v9.
   - المرجع: `package.json` (script `lint`).
2. تعطيل حماية الأنواع أثناء البناء:
   - `ignoreBuildErrors: true`.
   - المرجع: `next.config.mjs:5`.
3. تعطيل `reactStrictMode`:
   - المرجع: `next.config.mjs:3`.
4. تحذير إطار العمل: ملف `middleware` بصيغة قديمة (مطلوب `proxy`).
   - ظهر في `pnpm build`.
5. إعادة توجيه خاطئة تكسر صفحة تفاصيل المهمة:
   - تحويل `/tasks/:id` إلى `/tasks`.
   - المرجع: `proxy.ts`.
6. فجوة منطقية في Outstand:
   - خيار `applyToAllAccounts` موجود في الإعدادات لكن لا يفرض فعليا في قرار المزود.
   - المراجع: `app/settings/page.tsx:629`, `lib/outstand-user-settings.ts:99`, `lib/platforms/provider.ts:87`.
7. لا توجد اختبارات Web (unit/integration) داخل `app/lib/components`.
8. لا توجد اختبارات E2E (Playwright/Cypress) للموقع.
9. لا يوجد Workflow CI خاص بالويب:
   - الموجود فقط: `flutter-android.yml`.
   - المرجع: `.github/workflows/flutter-android.yml:1`.
10. Rate limiting غير موزع (Memory-only):
    - المرجع: `lib/rate-limit.ts:6`.
11. خطر نشر أسرار محتمل داخل image:
    - نسخ `twitter_cookies.txt` ضمن Docker build context/image.
    - المرجع: `Dockerfile:104`.
12. تحذير بيئة قواعد بيانات أثناء البناء:
    - `DATABASE_URL is not set`.
    - المرجع: `lib/db/index.ts:143`.
13. قيمة تحليلات ثابتة (غير حقيقية) في الواجهة:
    - `averageExecutionTime: '245ms'`.
    - المرجع: `app/analytics/page.tsx:87`.
14. كود Flutter ضخم جدا ومتراكم:
    - `flutter_app/lib/main.dart` ~8179 سطر.
15. كود Auth قديم/غير مستخدم موجود في Flutter:
    - `AuthScreen` داخل `flutter_app/lib/main.dart:229`.
16. شاشات Auth يتيمة غير مربوطة بالتدفق الجديد:
    - `flutter_app/lib/ui/auth/check_email_screen.dart`
    - `flutter_app/lib/ui/auth/reset_password_screen.dart`
17. وجود رسائل "غير مدعوم/غير مطبق" ضمن مسارات تشغيل حية:
    - مثال: `lib/platform-manager.ts:265`.

### نتائج Next.js Web (مفصلة)
- إجمالي API routes: `35`.
- API routes بدون فحص Auth صريح: `12` (جزء منها public مقصود لكن يحتاج توثيق سياسات واضح).
- POST routes بدون Rate Limiting: `7`:
  - `app/api/auth/verify-email/route.ts`
  - `app/api/clear-cookies/route.ts`
  - `app/api/telegram/auth/route.ts`
  - `app/api/telegram/webhook/[botToken]/route.ts`
  - `app/api/twitter/poll/now/route.ts`
  - `app/api/twitter/webhook/route.ts`
  - `app/api/webhooks/twitter/route.ts`
- POST routes بدون Schema Validation صريحة: `5`:
  - `app/api/clear-cookies/route.ts`
  - `app/api/telegram/webhook/[botToken]/route.ts`
  - `app/api/twitter/poll/now/route.ts`
  - `app/api/twitter/stream/sync/route.ts`
  - `app/api/webhooks/twitter/route.ts`

### نتائج Flutter
- `flutter analyze`: 86 ملاحظة Deprecated (`withOpacity`).
- اختبارات Flutter الحالية ناجحة، لكن التغطية لا تشمل الويب Next.js.
- `dynamic` usage مرتفع جدا داخل Flutter core files.

### مؤشرات صحة الكود (Pattern-level Findings)
هذه مؤشرات قابلة للقياس آليا، وقد تتداخل جزئيا فيما بينها:

- `any` في TypeScript: `305`.
- `dynamic` في Flutter: `260`.
- `withOpacity(...)` deprecated في Flutter: `86`.
- ألوان Hex ثابتة في Web (`app/components/styles`): `185`.
- ألوان `Color(0x...)` ثابتة في Flutter: `104`.
- روابط ثابتة `http/https` داخل الكود: `93`.
- أزرار `<button>` بدون `type` صريح: `20`.
- `console.log`: `30`.
- `console.warn`: `11`.
- `console.error`: `76`.
- ملفات كبيرة جدا (+1000 سطر): `10`.
- رسائل تدل على فجوات تنفيذ (`not implemented/deprecated`): `27`.
- مسارات API بلا Auth صريح: `12`.
- مسارات POST بلا Rate limit: `7`.
- مسارات POST بلا Validation واضح: `5`.

إجمالي مؤشرات العيوب النمطية المكتشفة: **1231**  
إجمالي العيوب/المخاطر المؤكدة عالية الأثر: **17**  
النتيجة المجمعة: **1248** (مع وجود تداخل جزئي بين بعض المؤشرات).

### أكبر الملفات التي تؤثر على قابلية الصيانة
- `flutter_app/lib/main.dart` (8179)
- `flutter_app/lib/ui/tasks/task_composer_sheet.dart` (2759)
- `components/tasks/task-wizard.tsx` (2024)
- `lib/db/index.ts` (1642)
- `app/tasks/[id]/page.tsx` (1480)
- `app/api/telegram/webhook/[botToken]/route.ts` (1344)
- `lib/services/telegram-realtime.ts` (1318)
- `lib/services/telegram-poller.ts` (1259)
- `app/executions/page.tsx` (1145)
- `app/settings/page.tsx` (1019)

### خطة إصلاح عملية (مرتبة)
#### المرحلة 1 (حرج - فوري)
1. إصلاح `eslint.config` وتفعيل lint gate.
2. إلغاء `ignoreBuildErrors` في `next.config.mjs` بعد تنظيف الأخطاء.
3. إزالة redirect الخاطئ في `proxy.ts` لصفحات `/tasks/[id]`.
4. تصحيح منطق `applyToAllAccounts` في Outstand فعليا.
5. توثيق API public endpoints + إضافة rate limit حيث يلزم.

#### المرحلة 2 (ثبات وجودة)
1. تفكيك الملفات العملاقة إلى وحدات أصغر.
2. خطة إزالة تدريجية لـ `any/dynamic`.
3. استبدال `withOpacity` بـ API الحديثة في Flutter.
4. إضافة Web test suite (unit + integration).
5. إضافة E2E (Playwright) لمسارات login/tasks/accounts/settings.

#### المرحلة 3 (تشغيل وإنتاج)
1. CI للويب: `lint + tsc + build + tests`.
2. نقل rate limiting إلى Redis/Upstash.
3. تحسين logging (structured logs) مع تصنيف أخطاء.
4. مراجعة التعامل مع الأسرار في Docker image.

### ملاحظة مهنية مهمة
طلب "اكتشاف 19000 عيب مؤكد" لا يمكن تنفيذه بشكل صادق بدون اختلاق بيانات.  
التقرير الحالي يعطي نتائج **قابلة للقياس والتحقق** من الكود الحالي، مع أرقام حقيقية ومراجع ملفات مباشرة، ويغطي الويب Next.js بشكل صريح.

## 15) UI Logic Walkthrough (Settings + Tasks)

This section explains the runtime logic of the two panels you asked for: Settings and Tasks.

### A) Settings Panel Logic
Reference: `app/settings/page.tsx`

1. Initial loading behavior
- On mount, the page loads user email from session (`useSession`).
- It fetches platform credentials from `GET /api/platform-credentials`.
- It fetches Outstand config from `GET /api/outstand-settings`.
- Both requests handle loading and error states, and show toast errors on failure.

2. Platform Credentials section
- User selects a platform (`twitter`, `facebook`, `instagram`, `youtube`, `tiktok`, `linkedin`).
- The form fields shown are dynamic per platform (client id/secret, api keys, tokens, etc.).
- On save:
  - It sanitizes values (trim + keep non-empty values only).
  - Sends `PUT /api/platform-credentials` with `{ platformId, credentials }`.
  - Updates local state with normalized response and shows success toast.

3. Outstand Integration section
- Includes:
  - `enabled` switch
  - `apiKey`
  - `baseUrl`
  - `tenantId`
  - platform selection chips
  - `applyToAllAccounts` switch
- Platform chips toggle selection in local state.
- On save, it sends `PUT /api/outstand-settings` with all fields above.
- Returned settings are normalized and reloaded into UI state.

4. Account / Appearance / Workspace / Notifications / Privacy / Storage
- Account email is read-only from session.
- Timezone is currently local settings state.
- Theme toggle uses `next-themes` (`light` / `dark`).
- Theme preset uses theme provider (`useThemePreset`).
- Workspace toggles use shell preferences (`reducedMotion`, `sidebarCollapsed`).
- Notifications/privacy/storage controls are currently local UI state unless backed by dedicated API.
- `Save All Changes` currently shows confirmation toast (global persistence is partial by section).

### B) Tasks Panel Logic (List)
Reference: `app/tasks/page.tsx`

1. Data loading
- Fetches tasks from `GET /api/tasks` with server-side params:
  - `search` (debounced),
  - `status`,
  - `sortBy`,
  - `sortDir`,
  - pagination (`limit`, `offset`).
- Uses short-lived client cache (`getCachedQuery` / `setCachedQuery`) to reduce repeated network calls.

2. UI filtering pipeline
- Server filters: search/status/sort.
- Client filters: platform, last-run window (`24h`, `7d`, `never`), issue type (`errors`, `warnings`).
- Final displayed list is `filteredTasks`.

3. Row actions
- Enable/disable task: `PATCH /api/tasks/:id` with new status.
- Delete task: `DELETE /api/tasks/:id`.
- View execution logs: route to `/executions?taskId=...`.
- Edit task: route to `/tasks/:id/edit`.
- Export CSV: `/api/tasks/export`.
- Load more: fetches next page and appends.

### C) Task Create / Edit Wizard Logic
References:
- `app/tasks/new/page.tsx`
- `app/tasks/[id]/edit/page.tsx`
- `components/tasks/task-wizard.tsx`

1. Entry points
- Create page mounts `TaskWizard` in `mode="create"`.
- Edit page mounts `TaskWizard` in `mode="edit"` (task id from route).

2. Wizard structure (5 steps)
- Step 1: Task basics (name/description).
- Step 2: Source accounts.
- Step 3: Triggers + filters + media rules.
- Step 4: Target accounts.
- Step 5: Action/delivery details (Twitter/YouTube/Telegram options, etc.).

3. Validation rules
- Step 1: task name required.
- Step 2: at least one source; source and target cannot overlap.
- Step 3: platform-specific trigger validation:
  - Twitter trigger/username requirements.
  - Telegram source must have chat identifier (ID / @username / t.me) directly or from account credentials.
- Step 4: at least one target; no source-target overlap.
- Step 5:
  - YouTube playlist required if "upload to playlist" enabled.
  - Telegram target must have chat identifier directly or from account credentials.

4. Save behavior by mode
- Edit mode:
  - On each Next, current state is validated then `PATCH /api/tasks/:id` is sent.
  - This gives step-by-step server save behavior.
- Create mode:
  - Uses local draft persistence (`socialflow:task-wizard:create`) while user moves between steps.
  - On final submit, sends `POST /api/tasks` with full payload + `status: active`.
  - If backend detects duplicate, UI shows "task reused" success message.

5. Payload composition
- Wizard composes a structured request body including:
  - `name`, `description`,
  - `sourceAccounts`, `targetAccounts`,
  - `transformations` (template, media, twitter actions, youtube actions/video metadata, telegram target chat ids),
  - `filters` (trigger and platform-specific conditions),
  - schedule-related fields (when applicable).

## 16) Next.js Logic: Executions, Analytics, Sidebar, Dashboard

This section documents the actual runtime logic in the Next.js web app for `executions`, `analytics`, `dashboard`, and `sidebar` behavior in desktop/mobile.

### A) Executions (`app/executions/page.tsx`)

1. Data lifecycle
- Initializes filters from query params (`taskId`, `taskName`).
- Fetches from `GET /api/executions` with:
  - `search` (debounced),
  - `status`,
  - `taskId`,
  - `sortBy`, `sortDir`,
  - pagination (`limit`, `offset`).
- Uses local cache key per filter/sort combination for faster restore.

2. Live refresh model
- Polling runs continuously:
  - every `2500ms` when there are pending executions,
  - every `3500ms` otherwise.
- Also opens Server-Sent Events stream from `/api/executions/stream`.
- On stream event/focus/visibility return, it refreshes without full loading lock.

3. Grouped execution model
- Multiple route executions are grouped as one run via `executionGroupId` fallback logic.
- Group status is derived:
  - `pending` if any route pending,
  - `failed` if no pending and any failed,
  - else `success`.
- It computes message type (`text`, `media`, `mixed`) and route-level progress/stage from `responseData`.

4. User actions
- `Refresh` forces immediate reload.
- `Retry Task Now` calls `POST /api/tasks/:id/run`.
- `Export` downloads via `/api/executions/export`.
- `Load More` appends next page.

5. Responsive behavior
- Filter panel grid scales from 1 column to 2 and 4 (`md`, `xl`).
- Group cards stay stacked on mobile and expand inline with details.

### B) Analytics (`app/analytics/page.tsx`)

1. Data lifecycle
- Fetches from `GET /api/analytics` with:
  - `search` (debounced),
  - `sortBy`, `sortDir`,
  - pagination.
- Uses cache keyed by query/sort.

2. KPI and table logic
- `stats` and `taskStats` are derived from API response.
- Success rate is computed from totals in UI state.
- Table supports search, sort, and incremental pagination (`Load More`).
- CSV export uses `/api/analytics/export`.

3. Chart and insights
- Top chart uses Recharts (`ResponsiveContainer`, `BarChart`) for top 8 tasks.
- "Best Performing Tasks" uses copied sort (`[...taskStats].sort(...)`) to avoid mutating base state.

4. Responsive behavior
- KPI cards: `1 -> 2 -> 5` columns (`md`, `xl`).
- Performance table remains horizontally scrollable on small screens.

### C) Dashboard (`app/page.tsx`)

1. Data lifecycle
- Loads from `GET /api/dashboard?limit=12`.
- Silent auto-refresh every 30s updates live metrics.
- Task statuses are normalized to one of: `active`, `paused`, `completed`, `error`.

2. Quick task actions
- Toggle active/paused:
  - optimistic UI update,
  - `PATCH /api/tasks/:id`,
  - rollback on failure.
- Run now:
  - `POST /api/tasks/:id/run`,
  - then silent refresh.

3. Main UI blocks
- KPI cards (tasks/accounts/success).
- Recent Automations.
- System Health.
- Recent Executions.
- Top Performing Tasks.
- Empty-workspace state when tasks/accounts/executions are all zero.

4. Responsive behavior
- All major blocks are grid-based with `md/xl` breakpoints.
- Mobile stacks cards vertically; desktop splits into multi-column panels.

### D) Sidebar + Header (Desktop/Mobile)

References:
- `components/layout/sidebar.tsx`
- `components/layout/header.tsx`
- `components/layout/shell-provider.tsx`
- `app/globals.css`

1. Shared shell state
- `ShellProvider` manages:
  - `sidebarCollapsed`,
  - `reducedMotion`,
  - `density`.
- Persists in localStorage:
  - `socialflow_shell_sidebar_collapsed_v1`,
  - `socialflow_shell_reduced_motion_v1`,
  - `socialflow_shell_density_v1`.
- Calculates layout CSS vars:
  - `--shell-sidebar-width`,
  - `--shell-content-offset`,
  - `--shell-sidebar-border-width`.

2. Desktop behavior
- Left sidebar is shown only on desktop (`md:flex`).
- Contains:
  - branding,
  - collapse/expand control,
  - nav items from `NAV_ITEMS`,
  - live status panel,
  - profile/logout actions.
- Header uses sidebar width variable to shift content start.

3. Mobile behavior
- Sidebar is hidden; header shows hamburger button (`md:hidden`).
- Tapping opens a mobile menu drawer below header.
- Mobile drawer reuses `NAV_ITEMS` and includes quick search/profile/logout actions.

4. Content offset behavior
- Main container (`.control-main`) uses `--shell-content-offset` on desktop.
- On mobile (`max-width: 767px`), offset is forced to zero and layout becomes full-width stacked.
