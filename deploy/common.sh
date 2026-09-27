#!/usr/bin/env bash
# Shared checks for the three mutating deployment commands.
set -euo pipefail

DEPLOY_SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)

die() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

load_config() {
  local config=${WIN_TOOLS_DEPLOY_CONFIG:-$DEPLOY_SCRIPT_DIR/config.sh}
  [[ -f "$config" ]] || die "Missing $config. Copy config.example.sh to config.sh and edit it."
  # Only source a trusted, operator-controlled file. Never use the systemd EnvironmentFile.
  # shellcheck source=/dev/null
  source "$config"

  local name value
  for name in PROJECT_DIR FRONTEND_DIR BACKEND_DIR BACKEND_SERVICE BACKUP_DIR SITE_URL HEALTH_URL BACKUP_LIMIT HEALTH_ATTEMPTS HEALTH_INTERVAL; do
    value=${!name:-}
    [[ -n "$value" ]] || die "Missing config value: $name"
  done
  for name in PROJECT_DIR FRONTEND_DIR BACKEND_DIR BACKUP_DIR; do
    value=${!name}
    [[ "$value" == /* && "$value" != / ]] || die "$name must be an absolute, non-root path"
    [[ ! -L "$value" ]] || die "$name must not be a symlink"
    printf -v "$name" '%s' "$(realpath -m -- "$value")"
  done
  [[ "$PROJECT_DIR" != / && "$FRONTEND_DIR" != / && "$BACKEND_DIR" != / && "$BACKUP_DIR" != / ]] || die 'Root is not a deployment path'
  [[ "$BACKEND_DIR" == "$PROJECT_DIR/backend" ]] || die 'BACKEND_DIR must be PROJECT_DIR/backend'
  [[ "$BACKUP_DIR" == "$PROJECT_DIR/backups" ]] || die 'BACKUP_DIR must be PROJECT_DIR/backups'
  [[ "$FRONTEND_DIR" != "$PROJECT_DIR" && "$FRONTEND_DIR" != "$PROJECT_DIR"/* ]] || die 'FRONTEND_DIR must be outside PROJECT_DIR'
  [[ "$FRONTEND_DIR" != "$BACKUP_DIR" && "$FRONTEND_DIR" != "$BACKUP_DIR"/* ]] || die 'FRONTEND_DIR overlaps BACKUP_DIR'
  [[ "$BACKEND_SERVICE" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.@-]*$ ]] || die 'Invalid BACKEND_SERVICE'
  [[ "$SITE_URL" == https://* && "$SITE_URL" != *example.com* && "$SITE_URL" != *@* ]] || die 'Set SITE_URL to the real HTTPS site URL without credentials'
  [[ "$HEALTH_URL" =~ ^http://(127\.0\.0\.1|localhost):[0-9]+/api/health$ ]] || die 'HEALTH_URL must use the local /api/health endpoint'
  [[ "$BACKUP_LIMIT" =~ ^[1-9][0-9]*$ && "$HEALTH_ATTEMPTS" =~ ^[1-9][0-9]*$ && "$HEALTH_INTERVAL" =~ ^[0-9]+$ ]] || die 'Invalid backup or health-check limit'
  [[ -d "$PROJECT_DIR/frontend" && -d "$BACKEND_DIR" ]] || die 'Project checkout is incomplete'
  [[ ! -L "$FRONTEND_DIR" && ! -L "$BACKUP_DIR" && ! -L "$BACKEND_DIR" ]] || die 'Deployment paths must not be symlinks'
}

check_live_release() {
  [[ -s "$FRONTEND_DIR/index.html" && -s "$BACKEND_DIR/backend.jar" ]] || die 'A complete live frontend and backend are required before an update'
  [[ -d "$FRONTEND_DIR" && ! -L "$FRONTEND_DIR" ]] || die 'Frontend must be a real directory'
  [[ ! -L "$FRONTEND_DIR/index.html" && ! -L "$BACKEND_DIR/backend.jar" ]] || die 'Live release files must not be symlinks'
}

init_backup_dir() {
  mkdir -p -- "$BACKUP_DIR"
  chmod 0700 -- "$BACKUP_DIR"
  [[ ! -L "$BACKUP_DIR" ]] || die 'BACKUP_DIR must not be a symlink'
}

acquire_lock() {
  mkdir -- "$BACKUP_DIR/.deploy-lock" 2>/dev/null || die 'Another deployment is running, or a stale lock needs inspection'
  trap 'rmdir -- "$BACKUP_DIR/.deploy-lock"' EXIT
}

check_backup_capacity() {
  local candidate count=0
  for candidate in "$BACKUP_DIR"/20??-??-??-???????????????-*; do
    [[ -d "$candidate" ]] && ((count += 1))
  done
  (( count < BACKUP_LIMIT )) || die "Backup limit ($BACKUP_LIMIT) reached. Archive and remove reviewed old snapshots manually."
}

new_snapshot() {
  local reason=$1
  SNAPSHOT_ID="$(date +%Y-%m-%d-%H%M%S%N)-$$"
  SNAPSHOT_DIR="$BACKUP_DIR/$SNAPSHOT_ID"
  mkdir -- "$SNAPSHOT_DIR"
  chmod 0700 -- "$SNAPSHOT_DIR"
  printf 'reason=%s\ncreated=%s\n' "$reason" "$(date -Is)" > "$SNAPSHOT_DIR/metadata.txt"
  printf 'Snapshot: %s\n' "$SNAPSHOT_ID"
}

mark_snapshot_complete() {
  [[ -s "$SNAPSHOT_DIR/backend.jar" && -s "$SNAPSHOT_DIR/frontend/index.html" ]] || die "Incomplete snapshot: $SNAPSHOT_DIR"
  : > "$SNAPSHOT_DIR/.complete"
}

confirm_action() {
  local expected=$1 answer
  printf 'Type "%s" to continue: ' "$expected" >&2
  IFS= read -r answer || die 'Confirmation was not provided'
  [[ "$answer" == "$expected" ]] || die 'Confirmation did not match; no live files changed'
}

run_build() {
  if [[ $(id -u) -eq 0 ]]; then
    [[ -n "${SUDO_USER:-}" && "$SUDO_USER" != root ]] || die 'Run with sudo from the deployment user so builds run without root privileges'
    runuser -u "$SUDO_USER" -- "$@"
  else
    "$@"
  fi
}

wait_for_health() {
  local attempt
  for ((attempt=1; attempt<=HEALTH_ATTEMPTS; attempt++)); do
    if "$DEPLOY_SCRIPT_DIR/health-check.sh"; then
      return 0
    fi
    if (( attempt < HEALTH_ATTEMPTS )); then sleep "$HEALTH_INTERVAL"; fi
  done
  die "Health check failed after $HEALTH_ATTEMPTS attempts. Snapshot remains at $SNAPSHOT_DIR; inspect the service, then run rollback.sh."
}
