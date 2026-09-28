#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"
[[ $# -eq 0 ]] || die 'Usage: mysql-backup.sh'
load_backup_config
mysql_credentials
command -v mysqldump >/dev/null || die 'mysqldump is required'
init_backup_dir
acquire_backup_lock
trap release_backup_lock EXIT
raw_tmp=
archive_tmp=
archive=
published=0
verified=0
cleanup() {
  local status=$?
  [[ -z "$raw_tmp" ]] || rm -f -- "$raw_tmp"
  [[ -z "$archive_tmp" ]] || rm -f -- "$archive_tmp"
  if (( published && ! verified )); then rm -f -- "$archive" "$archive.sha256"; fi
  release_backup_lock
  exit "$status"
}
trap cleanup EXIT
folder="$BACKUP_DIR/mysql"
mkdir -p -- "$folder"
chmod 0700 -- "$folder"
raw_tmp=$(mktemp "$folder/.sql.XXXXXXXX")
archive_tmp=$(mktemp "$folder/.archive.XXXXXXXX")
suffix=sql
[[ "$MYSQL_COMPRESS" == 0 ]] || suffix=sql.gz
archive="$folder/${DB_NAME}_$(date +%Y-%m-%d-%H%M%S)-$$.$suffix"
[[ ! -e "$archive" ]] || die "Backup name already exists: $archive"

# No --databases: the dump is restored only into the explicitly selected DB_NAME.
mysqldump "${MYSQL_AUTH_ARGS[@]}" --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" \
  --default-character-set=utf8mb4 --single-transaction --quick --skip-lock-tables --routines --triggers \
  --events --hex-blob --no-tablespaces --set-gtid-purged=OFF --add-drop-table \
  "$DB_NAME" > "$raw_tmp"
[[ -s "$raw_tmp" ]] || die 'mysqldump produced an empty file'
if [[ "$MYSQL_COMPRESS" == 1 ]]; then
  gzip -c -- "$raw_tmp" > "$archive_tmp"
else
  cp -- "$raw_tmp" "$archive_tmp"
fi
[[ -s "$archive_tmp" ]] || die 'Backup archive is empty'
mv -- "$archive_tmp" "$archive"
published=1
write_checksum "$archive"
"$SCRIPT_DIR/verify-backup.sh" "$archive"
verified=1
printf 'MySQL backup complete: %s\n' "$archive"
prune_backups "$folder" "${DB_NAME}_*.sql*"
