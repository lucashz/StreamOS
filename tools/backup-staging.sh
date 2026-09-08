#!/bin/sh
set -eu

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
backup_root=${BACKUP_ROOT:-"$project_root/.runtime/staging-backups"}
retention_days=${BACKUP_RETENTION_DAYS:-14}
timestamp=$(date -u +%Y%m%d-%H%M%S)
target="$backup_root/streamos-$timestamp"

case "$backup_root" in
  "$project_root"/.runtime/*) ;;
  *) echo "BACKUP_ROOT must stay inside $project_root/.runtime" >&2; exit 1 ;;
esac

mkdir -p "$target"
cd "$project_root"
: "${STAGING_ENV_FILE:=.env.staging}"
compose="docker compose --env-file $STAGING_ENV_FILE -f compose.staging.yaml"

$compose exec -T postgres pg_dump -U streamos -d streamos \
  --clean --if-exists --no-owner --no-privileges > "$target/database.sql"
test -s "$target/database.sql"

mkdir -p "$target/uploads"
$compose cp api:/app/.runtime/uploads/. "$target/uploads" >/dev/null 2>&1 || true
tar -czf "$target/uploads.tar.gz" -C "$target" uploads
rm -rf "$target/uploads"

(cd "$target" && sha256sum database.sql uploads.tar.gz > SHA256SUMS)
find "$backup_root" -mindepth 1 -maxdepth 1 -type d -mtime "+$retention_days" -exec rm -rf -- {} +
echo "$target"
