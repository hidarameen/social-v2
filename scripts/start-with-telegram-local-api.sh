#!/usr/bin/env bash
set -euo pipefail

API_BASE="${TELEGRAM_LOCAL_API_BASE_URL:-http://127.0.0.1:8081}"
API_BIN="${TELEGRAM_LOCAL_API_BIN:-telegram-bot-api}"
API_DIR="${TELEGRAM_LOCAL_API_DIR:-/tmp/telegram-bot-api}"
API_IP="${TELEGRAM_LOCAL_API_HTTP_IP_ADDRESS:-127.0.0.1}"
API_MODE="${TELEGRAM_LOCAL_API_MODE:-auto}"
API_PORT="$(echo "$API_BASE" | sed -E 's#^https?://[^:]+:([0-9]+).*$#\1#')"
if [[ ! "$API_PORT" =~ ^[0-9]+$ ]]; then
  API_PORT="8081"
fi

AUTOSTART="${TELEGRAM_LOCAL_API_AUTOSTART:-true}"
if [[ "$AUTOSTART" != "false" ]]; then
  if [[ "$API_MODE" == "binary" ]]; then
    pkill -f 'scripts/telegram-local-api-proxy.js' >/dev/null 2>&1 || true
  fi

  if ! curl -fsS -m 1 "$API_BASE/" >/dev/null 2>&1; then
    mkdir -p "$API_DIR" || true
    if [[ -x "$API_BIN" ]] || command -v "$API_BIN" >/dev/null 2>&1; then
      echo "[telegram-local-api] starting on $API_BASE"
      "$API_BIN" \
        --api-id="${API_ID:-${TELEGRAM_API_ID:-}}" \
        --api-hash="${API_HASH:-${TELEGRAM_API_HASH:-}}" \
        --local \
        --http-port="$API_PORT" \
        --http-ip-address="$API_IP" \
        --dir="$API_DIR" \
        >/tmp/telegram-bot-api.log 2>&1 &
      sleep 1 || true
      if curl -fsS -m 2 "$API_BASE/" >/dev/null 2>&1; then
        echo "[telegram-local-api] ready"
      else
        echo "[telegram-local-api] not reachable, app will rely on runtime fallback"
      fi
    else
      echo "[telegram-local-api] binary not found: $API_BIN"
    fi
  fi
fi

if [[ "$#" -eq 0 ]]; then
  exec pnpm start
else
  exec "$@"
fi
