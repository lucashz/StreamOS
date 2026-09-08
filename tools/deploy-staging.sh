#!/bin/sh
set -eu

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$project_root"
: "${STAGING_ENV_FILE:=.env.staging}"
test -f "$STAGING_ENV_FILE"
node tools/preflight-staging.mjs "$STAGING_ENV_FILE"

compose="docker compose --env-file $STAGING_ENV_FILE -f compose.staging.yaml"
$compose config --quiet
$compose build --pull
$compose up -d --remove-orphans --wait

set -a
. "$STAGING_ENV_FILE"
set +a
APP_URL="https://$APP_DOMAIN" \
API_URL="https://$API_DOMAIN" \
REALTIME_URL="wss://$REALTIME_DOMAIN" \
OVERLAY_URL="https://$OVERLAY_DOMAIN" \
METRICS_TOKEN="$METRICS_TOKEN" \
  corepack pnpm smoke:staging

$compose ps
