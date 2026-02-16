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
ARG APP_URL=https://example.com/

WORKDIR /src
RUN flutter create --platforms=android --org "${ANDROID_ORG}" app

WORKDIR /src/app
RUN if [ -f android/local.properties ]; then \
      grep -q '^flutter.minSdkVersion=' android/local.properties && \
      sed -i -E 's/^flutter\\.minSdkVersion=.*/flutter.minSdkVersion=19/' android/local.properties || \
      echo 'flutter.minSdkVersion=19' >> android/local.properties; \
    fi
RUN sed -i -E 's/minSdkVersion.*/minSdkVersion 19/g; s/minSdk[[:space:]]+flutter\\.minSdkVersion/minSdk 19/g; s/minSdk[[:space:]]+16/minSdk 19/g' android/app/build.gradle || true
RUN sed -i -E 's/minSdk[[:space:]]*=.*/minSdk = 19/g' android/app/build.gradle.kts || true
RUN sed -i -E 's/android:minSdkVersion=\"[0-9]+\"/android:minSdkVersion=\"19\"/g' android/app/src/main/AndroidManifest.xml || true

COPY flutter_app/pubspec.yaml ./pubspec.yaml
COPY flutter_app/analysis_options.yaml ./analysis_options.yaml
COPY flutter_app/lib ./lib

RUN flutter pub get
RUN flutter build apk --release --dart-define=APP_URL="${APP_URL}"

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=apk_builder /src/app/build/app/outputs/flutter-apk/app-release.apk ./public/app-release.apk
RUN pnpm build
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

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/bin ./bin

RUN chmod +x /app/bin/yt-dlp /app/bin/ffmpeg || true \
  && chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=5 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/login" >/dev/null || exit 1

# Avoid invoking Corepack/pnpm at runtime. This prevents crashes when the runtime
# environment has a non-writable home/cache directory.
CMD ["sh", "-c", "node node_modules/next/dist/bin/next start -H 0.0.0.0 -p ${PORT}"]
