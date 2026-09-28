#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"
[[ $# -eq 1 ]] || die 'Usage: restore-files.sh BACKUP.tar.gz'
archive=$1
[[ "$archive" == *.tar.gz ]] || die 'Expected a .tar.gz backup'
load_backup_config
"$SCRIPT_DIR/verify-backup.sh" "$archive"
for target in "$BACKEND_DIR" "$FRONTEND_DIR" "$NGINX_CONFIG_DIR" "$APP_CONFIG_DIR"; do
  [[ -d "$target" && ! -L "$target" ]] || die "Restore target must be an existing real directory: $target"
done
[[ -f "$SYSTEMD_SERVICE_FILE" && ! -L "$SYSTEMD_SERVICE_FILE" ]] || die 'systemd target must be an existing regular file'
[[ -f "$BACKEND_DIR/backend.jar" && ! -L "$BACKEND_DIR/backend.jar" ]] || die 'Backend target must be an existing regular file'
init_backup_dir
acquire_backup_lock
trap release_backup_lock EXIT
stage=$(mktemp -d "$BACKUP_DIR/.restore-files.XXXXXXXX")
id="$(date +%Y%m%d%H%M%S)-$$"
targets=("$BACKEND_DIR/backend.jar" "$FRONTEND_DIR" "$NGINX_CONFIG_DIR" "$SYSTEMD_SERVICE_FILE" "$APP_CONFIG_DIR")
sources=("$stage/backend/backend.jar" "$stage/frontend" "$stage/config/nginx" "$stage/config/systemd/win-tools-backend.service" "$stage/config/app")
staged=()
previous=()
swapped=0
done_ok=0
cleanup() {
  local status=$? i
  if (( ! done_ok && swapped > 0 )); then
    printf 'Restore failed; rolling back switched targets. Inspect retained .failed files if present.\n' >&2
    for ((i=swapped-1; i>=0; i--)); do
      if [[ -e ${targets[i]} ]]; then mv -- "${targets[i]}" "${targets[i]}.failed.$id" || true; fi
      mv -- "${previous[i]}" "${targets[i]}" || true
    done
  fi
  for ((i=0; i<${#staged[@]}; i++)); do
    [[ ! -e ${staged[i]} ]] || rm -rf -- "${staged[i]}"
  done
  rm -rf -- "$stage"
  release_backup_lock
  exit "$status"
}
trap cleanup EXIT

# Extract only after checking names and checksum; do not trust arbitrary archives.
tar -xzf "$archive" -C "$stage" --no-same-owner
for source in "${sources[@]}"; do [[ -e "$source" && ! -L "$source" ]] || die "Archive is incomplete: $source"; done
[[ -s ${sources[0]} && -s "$stage/frontend/index.html" ]] || die 'Jar or frontend index is empty'
validate_tree_links "$stage/frontend" "$FRONTEND_DIR"
validate_tree_links "$stage/config/nginx" "$NGINX_CONFIG_DIR"
validate_tree_links "$stage/config/app" "$APP_CONFIG_DIR"

printf 'Source: %s\nTargets:\n' "$archive"
for target in "${targets[@]}"; do printf '  %s\n' "$target"; done
printf 'Existing targets will be retained beside them as .before.%s copies. Stop application writes and use a maintenance window.\n' "$id"
confirm_twice 'RESTORE FILES' "${archive##*/}"

# Stage on each target filesystem before switching any live path.
for ((i=0; i<${#targets[@]}; i++)); do
  staged[i]="${targets[i]}.new.$id"
  previous[i]="${targets[i]}.before.$id"
  [[ ! -e ${staged[i]} && ! -e ${previous[i]} ]] || die 'Restore staging name already exists'
  cp -a -- "${sources[i]}" "${staged[i]}"
done
for ((i=0; i<${#targets[@]}; i++)); do
  mv -- "${targets[i]}" "${previous[i]}"
  if ! mv -- "${staged[i]}" "${targets[i]}"; then
    mv -- "${previous[i]}" "${targets[i]}" || true
    die "Could not switch ${targets[i]}"
  fi
  ((swapped += 1))
done
done_ok=1
printf 'File restore complete. Previous targets retained:\n'
for path in "${previous[@]}"; do printf '  %s\n' "$path"; done
printf 'Validate nginx and systemd configuration, restart/reload services, then run deploy/health-check.sh.\n'
