#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"
[[ $# -le 1 ]] || die 'Usage: rollback.sh [snapshot-id]'
load_config
[[ -d "$BACKEND_DIR" && -d "$(dirname -- "$FRONTEND_DIR")" ]] || die 'Deployment directories are missing'
[[ ! -e "$FRONTEND_DIR" || ( -d "$FRONTEND_DIR" && ! -L "$FRONTEND_DIR" ) ]] || die 'Live frontend is not a regular directory'
[[ ! -e "$BACKEND_DIR/backend.jar" || ( -f "$BACKEND_DIR/backend.jar" && ! -L "$BACKEND_DIR/backend.jar" ) ]] || die 'Live Jar is not a regular file'
init_backup_dir
acquire_lock

if [[ $# -eq 1 ]]; then
  target_id=$1
else
  target_id=
  for candidate in "$BACKUP_DIR"/20??-??-??-???????????????-*; do
    [[ -f "$candidate/.complete" ]] && target_id=${candidate##*/}
  done
fi
[[ "$target_id" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{15}-[0-9]+$ ]] || die 'No valid rollback snapshot found'
target="$BACKUP_DIR/$target_id"
[[ -f "$target/.complete" && -s "$target/backend.jar" && -s "$target/frontend/index.html" && -f "$target/metadata.txt" ]] || die "Snapshot is incomplete: $target"
[[ ! -L "$target" && ! -L "$target/frontend" && ! -L "$target/backend.jar" ]] || die 'Snapshot contains unexpected symlinks'
[[ $(stat -c %d -- "$(dirname -- "$FRONTEND_DIR")") == "$(stat -c %d -- "$BACKUP_DIR")" ]] || die 'FRONTEND_DIR and BACKUP_DIR must be on the same filesystem'

printf 'Restore frontend and backend from snapshot %s (%s).\n' "$target_id" "$(cat "$target/metadata.txt")"
printf 'The current release will be saved as a new snapshot before replacement.\n'
confirm_action "ROLLBACK $target_id"

front_stage=$(mktemp -d "${FRONTEND_DIR}.rollback.XXXXXX")
cp -a -- "$target/frontend/." "$front_stage/"
chmod 0755 -- "$front_stage"
jar_stage=$(mktemp "$BACKEND_DIR/.backend.jar.rollback.XXXXXX")
cp -p -- "$target/backend.jar" "$jar_stage"
[[ -s "$front_stage/index.html" && -s "$jar_stage" ]] || die 'Rollback staging is incomplete'

new_snapshot "rollback-from-$target_id"
if [[ -s "$BACKEND_DIR/backend.jar" ]]; then
  cp -p -- "$BACKEND_DIR/backend.jar" "$SNAPSHOT_DIR/backend.jar"
fi
systemctl stop "$BACKEND_SERVICE"
if [[ -d "$FRONTEND_DIR" ]]; then
  mv -T -- "$FRONTEND_DIR" "$SNAPSHOT_DIR/frontend"
fi
if ! mv -T -- "$front_stage" "$FRONTEND_DIR"; then
  if [[ -d "$SNAPSHOT_DIR/frontend" ]]; then
    mv -T -- "$SNAPSHOT_DIR/frontend" "$FRONTEND_DIR" || true
  fi
  systemctl start "$BACKEND_SERVICE" || true
  die "Frontend restore failed; inspect $front_stage and $SNAPSHOT_DIR"
fi
if [[ -s "$SNAPSHOT_DIR/backend.jar" && -s "$SNAPSHOT_DIR/frontend/index.html" ]]; then
  mark_snapshot_complete
else
  : > "$SNAPSHOT_DIR/.partial"
  printf 'Current release was incomplete; its available files were saved at %s\n' "$SNAPSHOT_DIR" >&2
fi
if ! mv -f -- "$jar_stage" "$BACKEND_DIR/backend.jar"; then
  systemctl start "$BACKEND_SERVICE" || true
  die "Jar restore failed; current release is saved at $SNAPSHOT_DIR"
fi
systemctl start "$BACKEND_SERVICE"
nginx -t
systemctl reload nginx
wait_for_health
printf 'Rollback to %s succeeded. Replaced release snapshot: %s\n' "$target_id" "$SNAPSHOT_ID"
