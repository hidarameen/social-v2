# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile

FROM cirrusci/flutter:stable AS apk_builder
ARG ANDROID_ORG=com.socialflow.app
ARG APP_URL
ENV CI=true
ENV GRADLE_USER_HOME=/tmp/nf-gradle
ENV GRADLE_OPTS="-Dorg.gradle.daemon=false -Dorg.gradle.parallel=false -Dorg.gradle.caching=false"

WORKDIR /src
RUN flutter create --platforms=android,web --org "${ANDROID_ORG}" app

WORKDIR /src/app
RUN if [ -f android/gradle.properties ]; then \
      printf '\norg.gradle.daemon=false\norg.gradle.parallel=false\norg.gradle.caching=false\n' >> android/gradle.properties; \
    fi

# Ensure the generated Android app can make network requests in release builds.
# Some Flutter templates/environments may not include INTERNET permission by default.
RUN if [ -f android/app/src/main/AndroidManifest.xml ]; then \
      if ! grep -q 'android.permission.INTERNET' android/app/src/main/AndroidManifest.xml; then \
        awk 'BEGIN{done=0} {print; if(!done && $0 ~ /<manifest/){print "    <uses-permission android:name=\\"android.permission.INTERNET\\"/>"; done=1}}' \
          android/app/src/main/AndroidManifest.xml > /tmp/AndroidManifest.xml && \
        mv /tmp/AndroidManifest.xml android/app/src/main/AndroidManifest.xml; \
      fi; \
    fi

COPY flutter_app/pubspec.yaml ./pubspec.yaml
COPY flutter_app/analysis_options.yaml ./analysis_options.yaml
COPY flutter_app/lib ./lib

RUN --mount=type=cache,id=flutter-pub-cache,target=/root/.pub-cache flutter pub get
RUN test -n "${APP_URL}"
RUN --mount=type=cache,id=flutter-gradle-cache,target=/tmp/nf-gradle \
  --mount=type=cache,id=flutter-pub-cache,target=/root/.pub-cache \
  flutter build apk --release --dart-define=APP_URL="${APP_URL}"
RUN --mount=type=cache,id=flutter-gradle-cache,target=/tmp/nf-gradle \
  --mount=type=cache,id=flutter-pub-cache,target=/root/.pub-cache \
  flutter build web --release --dart-define=APP_URL="${APP_URL}"
RUN (cd android && ./gradlew --stop || true) && rm -rf /root/.gradle /src/app/.gradle || true

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=apk_builder /src/app/build/app/outputs/flutter-apk/app-release.apk ./public/app-release.apk
COPY --from=apk_builder /src/app/build/web ./public/flutter-web
RUN --mount=type=cache,id=next-cache,target=/app/.next/cache pnpm build
RUN pnpm prune --prod

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=5000
ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV YTDLP_PATH=/app/bin/yt-dlp
ENV HOME=/home/nextjs
ENV XDG_CACHE_HOME=/home/nextjs/.cache
ENV COREPACK_HOME=/home/nextjs/.cache/node/corepack

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

RUN mkdir -p /home/nextjs/.cache \
  && chown -R nextjs:nodejs /home/nextjs

COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/next.config.mjs ./next.config.mjs
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs --chmod=0755 /app/bin/yt-dlp ./bin/yt-dlp
COPY --from=builder --chown=nextjs:nodejs --chmod=0755 /app/bin/ffmpeg ./bin/ffmpeg

USER nextjs

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=5 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/login" >/dev/null || exit 1

# Avoid invoking Corepack/pnpm at runtime. This prevents crashes when the runtime
# environment has a non-writable home/cache directory.
CMD ["sh", "-c", "node node_modules/next/dist/bin/next start -H 0.0.0.0 -p ${PORT}"]
