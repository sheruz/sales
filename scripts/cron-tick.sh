#!/usr/bin/env bash
# Phase 2 — reliable cron tick for Sales Platform / Autopilot
# Installed at: /var/www/html/sales/scripts/cron-tick.sh
# Crontab should call this script with flock (see docs/CRON_SETUP_PM2.md)

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/html/sales}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env}"
LOG_FILE="${LOG_FILE:-/var/log/sales-cron.log}"
LOCK_FILE="${LOCK_FILE:-/var/lock/sales-cron.lock}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) ERROR missing env $ENV_FILE" >>"$LOG_FILE"
  exit 1
fi

# shellcheck disable=SC1090
set -a
# Load only KEY=VALUE lines (ignore comments / blanks)
# Prefer CRON_SECRET and APP_URL from .env
# Using grep+export to avoid sourcing arbitrary shell
while IFS= read -r line; do
  case "$line" in
    CRON_SECRET=*|APP_URL=*|NEXT_PUBLIC_APP_URL=*)
      key="${line%%=*}"
      val="${line#*=}"
      val="${val%\"}"
      val="${val#\"}"
      val="${val%\'}"
      val="${val#\'}"
      export "$key=$val"
      ;;
  esac
done < <(grep -E '^(CRON_SECRET|APP_URL|NEXT_PUBLIC_APP_URL)=' "$ENV_FILE" || true)
set +a

if [[ -z "${CRON_SECRET:-}" ]]; then
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) ERROR CRON_SECRET not set in $ENV_FILE" >>"$LOG_FILE"
  exit 1
fi

BASE_URL="${APP_URL:-${NEXT_PUBLIC_APP_URL:-}}"
if [[ -z "$BASE_URL" ]]; then
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) ERROR APP_URL not set in $ENV_FILE" >>"$LOG_FILE"
  exit 1
fi

# Trim trailing slash
BASE_URL="${BASE_URL%/}"
ENDPOINT="$BASE_URL/api/cron/automation"

# Size-cap log (~5MB)
if [[ -f "$LOG_FILE" ]]; then
  size=$(wc -c <"$LOG_FILE" || echo 0)
  if [[ "$size" -gt 5242880 ]]; then
    mv "$LOG_FILE" "${LOG_FILE}.1" || true
  fi
fi

echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) START $ENDPOINT" >>"$LOG_FILE"

# flock prevents overlapping ticks at OS level (DB advisory lock is a second layer)
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) SKIP lock held" >>"$LOG_FILE"
  exit 0
fi

HTTP_CODE=$(curl -sS -o /tmp/sales-cron-body.json -w "%{http_code}" \
  -X POST \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  --max-time 240 \
  "$ENDPOINT" || echo "000")

echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) HTTP $HTTP_CODE $(head -c 400 /tmp/sales-cron-body.json 2>/dev/null || true)" >>"$LOG_FILE"

if [[ "$HTTP_CODE" != "200" ]]; then
  exit 1
fi
exit 0
