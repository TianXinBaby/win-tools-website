#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"
[[ $# -eq 0 ]] || die 'Usage: backend-deploy.sh'
load_config
check_live_release
init_backup_dir
acquire_lock
check_backup_capacity

cd -- "$PROJECT_DIR/backend"
run_build ./mvnw clean package
shopt -s nullglob
jars=(target/*.jar)
[[ ${#jars[@]} -eq 1 && -s ${jars[0]:-} ]] || die 'Expected exactly one nonempty built Jar in backend/target'
stage=$(mktemp "$BACKEND_DIR/.backend.jar.new.XXXXXX")
cp -p -- "$BACKEND_DIR/backend.jar" "$stage"
cat -- "${jars[0]}" > "$stage"
[[ -s "$stage" ]] || die "Staged Jar is empty: $stage"
printf 'Deploy %s to %s/backend.jar. Current Jar and frontend will be saved in %s.\n' "${jars[0]}" "$BACKEND_DIR" "$BACKUP_DIR"
confirm_action 'DEPLOY BACKEND'

new_snapshot backend-deploy
cp -p -- "$BACKEND_DIR/backend.jar" "$SNAPSHOT_DIR/backend.jar"
cp -a -- "$FRONTEND_DIR" "$SNAPSHOT_DIR/frontend"
mark_snapshot_complete
systemctl stop "$BACKEND_SERVICE"
if ! mv -f -- "$stage" "$BACKEND_DIR/backend.jar"; then
  systemctl start "$BACKEND_SERVICE" || true
  die "Jar switch failed; inspect $stage and $SNAPSHOT_DIR"
fi
systemctl start "$BACKEND_SERVICE"
wait_for_health
printf 'Backend deployment succeeded. Rollback snapshot: %s\n' "$SNAPSHOT_ID"
