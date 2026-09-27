#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"
[[ $# -eq 0 ]] || die 'Usage: frontend-deploy.sh'
load_config
check_live_release
init_backup_dir
acquire_lock
check_backup_capacity

cd -- "$PROJECT_DIR/frontend"
run_build npm ci
run_build npm run build
[[ -s dist/index.html && -d dist/assets && ! -L dist ]] || die 'Frontend build output is incomplete'
[[ -z $(find dist -type l -print -quit) ]] || die 'Frontend build must not contain symlinks'

# Stage alongside the live directory so the final directory rename stays on one filesystem.
stage=$(mktemp -d "${FRONTEND_DIR}.new.XXXXXX")
cp -R -- dist/. "$stage/"
chmod 0755 -- "$stage"
[[ -s "$stage/index.html" ]] || die "Staged frontend is incomplete: $stage"
[[ $(stat -c %d -- "$FRONTEND_DIR") == "$(stat -c %d -- "$BACKUP_DIR")" ]] || die 'FRONTEND_DIR and BACKUP_DIR must be on the same filesystem'
nginx -t
printf 'Deploy frontend from %s to %s. Existing frontend and Jar will be saved in %s.\n' "$PROJECT_DIR/frontend/dist" "$FRONTEND_DIR" "$BACKUP_DIR"
confirm_action 'DEPLOY FRONTEND'

new_snapshot frontend-deploy
cp -p -- "$BACKEND_DIR/backend.jar" "$SNAPSHOT_DIR/backend.jar"
mv -T -- "$FRONTEND_DIR" "$SNAPSHOT_DIR/frontend"
if ! mv -T -- "$stage" "$FRONTEND_DIR"; then
  mv -T -- "$SNAPSHOT_DIR/frontend" "$FRONTEND_DIR" || true
  die "Frontend switch failed; inspect $stage and $SNAPSHOT_DIR"
fi
mark_snapshot_complete
nginx -t
systemctl reload nginx
wait_for_health
printf 'Frontend deployment succeeded. Rollback snapshot: %s\n' "$SNAPSHOT_ID"
