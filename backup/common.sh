#!/usr/bin/env bash
# Shared validation and retention for operator-controlled backup scripts.
set -euo pipefail
BACKUP_SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
umask 077

die() { printf 'Error: %s\n' "$*" >&2; exit 1; }

load_backup_config() {
  local config=${WIN_TOOLS_BACKUP_CONFIG:-$BACKUP_SCRIPT_DIR/backup-config.sh}
  [[ -f "$config" && ! -L "$config" ]] || die "Missing trusted $config; copy backup-config.example.sh to backup-config.sh"
  # The trusted operator file is shell code. Never source the systemd env file.
  # shellcheck source=/dev/null
  source "$config"

  local name value other other_value
  for name in BACKUP_DIR DB_HOST DB_PORT DB_NAME DB_USER BACKEND_DIR FRONTEND_DIR NGINX_CONFIG_DIR SYSTEMD_SERVICE_FILE APP_CONFIG_DIR BACKUP_KEEP MYSQL_COMPRESS; do
    value=${!name:-}
    [[ -n "$value" ]] || die "Missing config value: $name"
  done
  for name in BACKUP_DIR BACKEND_DIR FRONTEND_DIR NGINX_CONFIG_DIR SYSTEMD_SERVICE_FILE APP_CONFIG_DIR; do
    value=${!name}
    [[ "$value" == /* && "$value" != / && ! -L "$value" ]] || die "$name must be an absolute, non-root, non-symlink path"
    printf -v "$name" '%s' "$(realpath -m -- "$value")"
  done
  [[ "$DB_NAME" =~ ^[a-zA-Z0-9_]+$ && "$DB_USER" =~ ^[a-zA-Z0-9_]+$ ]] || die 'Invalid database name or user'
  [[ "$DB_HOST" =~ ^[a-zA-Z0-9.:-]+$ && "$DB_PORT" =~ ^[0-9]+$ ]] || die 'Invalid database host or port'
  (( 10#$DB_PORT >= 1 && 10#$DB_PORT <= 65535 )) || die 'DB_PORT is out of range'
  [[ "$BACKUP_KEEP" =~ ^[1-9][0-9]*$ && "$MYSQL_COMPRESS" =~ ^[01]$ ]] || die 'BACKUP_KEEP must be positive and MYSQL_COMPRESS must be 0 or 1'
  for name in BACKEND_DIR FRONTEND_DIR NGINX_CONFIG_DIR APP_CONFIG_DIR; do
    value=${!name}
    [[ "$BACKUP_DIR" != "$value" && "$BACKUP_DIR" != "$value"/* && "$value" != "$BACKUP_DIR"/* ]] || die "BACKUP_DIR overlaps $name"
    [[ "$SYSTEMD_SERVICE_FILE" != "$value"/* ]] || die "SYSTEMD_SERVICE_FILE overlaps $name"
    for other in BACKEND_DIR FRONTEND_DIR NGINX_CONFIG_DIR APP_CONFIG_DIR; do
      [[ "$other" == "$name" ]] && continue
      other_value=${!other}
      [[ "$value" != "$other_value" && "$value" != "$other_value"/* ]] || die "$name overlaps $other"
    done
  done
  [[ "$BACKUP_DIR" != "$(dirname -- "$SYSTEMD_SERVICE_FILE")" && "$SYSTEMD_SERVICE_FILE" != "$BACKUP_DIR"/* ]] || die 'BACKUP_DIR overlaps SYSTEMD_SERVICE_FILE'
}

validate_tree_links() {
  local tree=$1 target_root=$2 link destination mapped
  while IFS= read -r -d '' link; do
    destination=$(readlink -- "$link") || die "Unreadable symlink: $link"
    if [[ "$destination" == /* ]]; then
      destination=$(realpath -m -- "$destination")
      if [[ "$destination" != "$target_root"/* ]]; then
        printf 'Warning: external symlink target is not included in this backup: %s\n' "$link" >&2
        continue
      fi
      mapped="$tree/${destination#"$target_root"/}"
    else
      mapped=$(realpath -m -- "$(dirname -- "$link")/$destination")
      if [[ "$mapped" != "$tree"/* ]]; then
        printf 'Warning: external symlink target is not included in this backup: %s\n' "$link" >&2
        continue
      fi
    fi
    [[ -e "$mapped" ]] || die "Archive symlink is broken: $link"
  done < <(find "$tree" -type l -print0)
}

mysql_credentials() {
  MYSQL_AUTH_ARGS=()
  if [[ -n ${MYSQL_CREDENTIALS_FILE:-} ]]; then
    [[ "$MYSQL_CREDENTIALS_FILE" == /* && -f "$MYSQL_CREDENTIALS_FILE" && ! -L "$MYSQL_CREDENTIALS_FILE" ]] || die 'MYSQL_CREDENTIALS_FILE must be an existing absolute regular file'
    local mode
    mode=$(stat -c %a -- "$MYSQL_CREDENTIALS_FILE")
    (( (8#$mode & 077) == 0 )) || die 'MYSQL_CREDENTIALS_FILE must not be readable by group or others'
    MYSQL_AUTH_ARGS=("--defaults-extra-file=$MYSQL_CREDENTIALS_FILE")
  else
    [[ -n ${MYSQL_PWD:-} ]] || die 'Set MYSQL_CREDENTIALS_FILE or MYSQL_PWD; no password is stored in the template'
  fi
}

init_backup_dir() {
  [[ ! -L "$BACKUP_DIR" ]] || die 'BACKUP_DIR must not be a symlink'
  mkdir -p -- "$BACKUP_DIR"
  chmod 0700 -- "$BACKUP_DIR"
}

acquire_backup_lock() {
  LOCK_DIR="$BACKUP_DIR/.backup-lock"
  mkdir -- "$LOCK_DIR" 2>/dev/null || die "Backup/restore lock exists: $LOCK_DIR (inspect before removing a stale lock)"
}

release_backup_lock() {
  [[ -z ${LOCK_DIR:-} ]] || rmdir -- "$LOCK_DIR"
}

write_checksum() {
  local archive=$1 digest
  digest=$(sha256sum -- "$archive")
  printf '%s\n' "${digest%% *}" > "$archive.sha256"
}

prune_backups() {
  local folder=$1 pattern=$2 file count
  local -a files=()
  shopt -s nullglob
  # The glob expands only in the dedicated backup subdirectory, ordered by timestamp.
  for file in "$folder"/$pattern; do
    [[ "$file" != *.sha256 ]] || continue
    [[ -f "$file" && ! -L "$file" && -f "$file.sha256" && ! -L "$file.sha256" ]] || die "Backup or checksum is incomplete; inspect manually: $file"
    files+=("$file")
  done
  shopt -u nullglob
  count=${#files[@]}
  for file in "${files[@]}"; do
    (( count > BACKUP_KEEP )) || break
    printf 'RETENTION: deleting old verified backup %s and its checksum\n' "$file"
    "$BACKUP_SCRIPT_DIR/verify-backup.sh" "$file" >/dev/null || die "Old backup failed verification; inspect and remove manually: $file"
    rm -- "$file" "$file.sha256"
    ((count -= 1))
  done
}

confirm_twice() {
  local first=$1 second=$2 answer
  printf 'Type "%s" to continue: ' "$first" >&2
  IFS= read -r answer || die 'First confirmation was not provided'
  [[ "$answer" == "$first" ]] || die 'First confirmation did not match; nothing restored'
  printf 'Type "%s" to confirm the target: ' "$second" >&2
  IFS= read -r answer || die 'Second confirmation was not provided'
  [[ "$answer" == "$second" ]] || die 'Second confirmation did not match; nothing restored'
}
