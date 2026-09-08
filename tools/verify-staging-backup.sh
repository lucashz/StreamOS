#!/bin/sh
set -eu

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
backup_root=${BACKUP_ROOT:-"$project_root/.runtime/staging-backups"}
backup_path=${1:-$(find "$backup_root" -mindepth 1 -maxdepth 1 -type d | sort | tail -n 1)}
test -n "$backup_path"

case "$backup_path" in
  "$project_root"/.runtime/staging-backups/*) ;;
  *) echo "Backup path outside the allowed directory" >&2; exit 1 ;;
esac

cd "$backup_path"
sha256sum -c SHA256SUMS
cd "$project_root"
: "${STAGING_ENV_FILE:=.env.staging}"
compose="docker compose --env-file $STAGING_ENV_FILE -f compose.staging.yaml"
database="streamos_restore_test_$(date +%s)"

cleanup() { $compose exec -T postgres dropdb -U streamos --if-exists "$database" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
$compose exec -T postgres createdb -U streamos "$database"
$compose exec -T postgres psql -v ON_ERROR_STOP=1 -U streamos -d "$database" < "$backup_path/database.sql" >/dev/null
tables=$($compose exec -T postgres psql -U streamos -d "$database" -tAc "select count(*) from information_schema.tables where table_schema='public'")
test "$tables" -ge 10
echo "restore-ok tables=$tables"
