#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"
[[ $# -eq 1 ]] || die 'Usage: restore-mysql.sh BACKUP.sql[.gz]'
archive=$1
case "$archive" in *.sql|*.sql.gz) ;; *) die 'Expected a .sql or .sql.gz backup' ;; esac
load_backup_config
mysql_credentials
command -v mysql >/dev/null || die 'mysql is required'
"$SCRIPT_DIR/verify-backup.sh" "$archive"
init_backup_dir
acquire_backup_lock
trap release_backup_lock EXIT
mysql "${MYSQL_AUTH_ARGS[@]}" --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" \
  --default-character-set=utf8mb4 "$DB_NAME" -e 'SELECT 1' >/dev/null || die 'Target database connection failed'
printf 'Source: %s\nTarget MySQL: %s:%s/%s (user %s)\n' "$archive" "$DB_HOST" "$DB_PORT" "$DB_NAME" "$DB_USER"
printf 'Restoration can replace existing tables and data. Stop application writes and use a maintenance window.\n'
confirm_twice 'RESTORE MYSQL' "$DB_NAME"
if [[ "$archive" == *.gz ]]; then
  gzip -cd -- "$archive" | mysql "${MYSQL_AUTH_ARGS[@]}" --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" --default-character-set=utf8mb4 "$DB_NAME"
else
  mysql "${MYSQL_AUTH_ARGS[@]}" --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" --default-character-set=utf8mb4 "$DB_NAME" < "$archive"
fi
printf 'MySQL restore complete: %s -> %s\n' "$archive" "$DB_NAME"
