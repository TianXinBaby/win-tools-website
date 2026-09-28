#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"
[[ $# -eq 0 ]] || die 'Usage: file-backup.sh'
load_backup_config
[[ -s "$BACKEND_DIR/backend.jar" && ! -L "$BACKEND_DIR/backend.jar" ]] || die 'Backend Jar is missing or a symlink'
[[ -s "$FRONTEND_DIR/index.html" && -d "$FRONTEND_DIR" ]] || die 'Frontend static directory is incomplete'
[[ -d "$NGINX_CONFIG_DIR" && -f "$SYSTEMD_SERVICE_FILE" && ! -L "$SYSTEMD_SERVICE_FILE" && -d "$APP_CONFIG_DIR" ]] || die 'A required configuration source is missing'
validate_tree_links "$FRONTEND_DIR" "$FRONTEND_DIR"
validate_tree_links "$NGINX_CONFIG_DIR" "$NGINX_CONFIG_DIR"
validate_tree_links "$APP_CONFIG_DIR" "$APP_CONFIG_DIR"
init_backup_dir
acquire_backup_lock
trap release_backup_lock EXIT
stage=
archive_tmp=
archive=
published=0
verified=0
cleanup() {
  local status=$?
  [[ -z "$stage" ]] || rm -rf -- "$stage"
  [[ -z "$archive_tmp" ]] || rm -f -- "$archive_tmp"
  if (( published && ! verified )); then rm -f -- "$archive" "$archive.sha256"; fi
  release_backup_lock
  exit "$status"
}
trap cleanup EXIT
folder="$BACKUP_DIR/files"
mkdir -p -- "$folder"
chmod 0700 -- "$folder"
stage=$(mktemp -d "$folder/.stage.XXXXXXXX")
archive_tmp=$(mktemp "$folder/.archive.XXXXXXXX")
archive="$folder/win_tools_files_$(date +%Y-%m-%d-%H%M%S)-$$.tar.gz"
[[ ! -e "$archive" ]] || die "Backup name already exists: $archive"

mkdir -p -- "$stage/backend" "$stage/config/systemd"
cp -p -- "$BACKEND_DIR/backend.jar" "$stage/backend/backend.jar"
cp -a -- "$FRONTEND_DIR" "$stage/frontend"
cp -a -- "$NGINX_CONFIG_DIR" "$stage/config/nginx"
cp -p -- "$SYSTEMD_SERVICE_FILE" "$stage/config/systemd/win-tools-backend.service"
cp -a -- "$APP_CONFIG_DIR" "$stage/config/app"
tar -czf "$archive_tmp" -C "$stage" backend frontend config
[[ -s "$archive_tmp" ]] || die 'File backup archive is empty'
mv -- "$archive_tmp" "$archive"
published=1
write_checksum "$archive"
"$SCRIPT_DIR/verify-backup.sh" "$archive"
verified=1
printf 'File backup complete: %s\n' "$archive"
prune_backups "$folder" 'win_tools_files_*.tar.gz'
