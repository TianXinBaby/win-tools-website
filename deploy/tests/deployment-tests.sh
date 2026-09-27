#!/usr/bin/env bash
# Run on Ubuntu or Git Bash. All writes stay under the repository's ignored .cache directory.
set -euo pipefail
repo_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
git -C "$repo_dir" check-ignore -q backups/release.jar || { printf 'FAIL: deployment backups must be ignored by Git\n' >&2; exit 1; }
mkdir -p "$repo_dir/.cache"
test_root=$(mktemp -d "$repo_dir/.cache/deploy-tests.XXXXXX")
cleanup() {
  [[ "$test_root" == "$repo_dir/.cache/deploy-tests."* ]] || exit 1
  rm -r -- "$test_root"
}
trap cleanup EXIT

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
assert_file() { [[ -f "$1" ]] || fail "Missing $1"; }
assert_content() { [[ $(cat "$1") == "$2" ]] || fail "Unexpected content in $1"; }
expect_failure() {
  local input=$1; shift
  if printf '%s\n' "$input" | "$@" > "$test_root/output" 2>&1; then
    fail "Expected failure: $*"
  fi
}

export MOCK_LOG="$test_root/commands.log"
mock_bin="$test_root/bin"
mkdir -p "$mock_bin" "$test_root/project/frontend" "$test_root/project/backend" "$test_root/www/live"
export PATH="$mock_bin:$PATH"
printf 'old-frontend' > "$test_root/www/live/index.html"
printf 'old-jar' > "$test_root/project/backend/backend.jar"
cat > "$test_root/project/backend/mvnw" <<'MOCK'
#!/usr/bin/env bash
printf 'mvnw %s\n' "$*" >> "$MOCK_LOG"
mkdir -p target
printf 'new-jar' > target/backend-test.jar
MOCK
cat > "$mock_bin/npm" <<'MOCK'
#!/usr/bin/env bash
printf 'npm %s\n' "$*" >> "$MOCK_LOG"
if [[ "$*" == 'run build' ]]; then
  mkdir -p dist/assets
  printf 'new-frontend' > dist/index.html
  printf 'asset' > dist/assets/app.js
fi
MOCK
cat > "$mock_bin/systemctl" <<'MOCK'
#!/usr/bin/env bash
printf 'systemctl %s\n' "$*" >> "$MOCK_LOG"
if [[ "${1:-}" == is-active ]]; then
  service=${*: -1}
  if [[ "$service" == win-tools-backend && "${MOCK_BACKEND_ACTIVE:-1}" == 0 ]]; then exit 3; fi
  if [[ "$service" == nginx && "${MOCK_NGINX_ACTIVE:-1}" == 0 ]]; then exit 3; fi
fi
exit 0
MOCK
cat > "$mock_bin/nginx" <<'MOCK'
#!/usr/bin/env bash
printf 'nginx %s\n' "$*" >> "$MOCK_LOG"
exit 0
MOCK
cat > "$mock_bin/curl" <<'MOCK'
#!/usr/bin/env bash
for arg in "$@"; do url=$arg; done
if [[ "$url" == https://site.test/ ]]; then
  printf '%s' "${MOCK_SITE_STATUS:-200}"
elif [[ "$url" == http://127.0.0.1:8080/actuator/health ]]; then
  body=${MOCK_ACTUATOR_BODY-'{"status":"UP"}'}
  printf '%s\n%s' "$body" "${MOCK_ACTUATOR_STATUS:-200}"
else
  printf '{"code":200,"message":"success","data":{"status":"UP"}}\n%s' "${MOCK_BACKEND_STATUS:-200}"
fi
MOCK
cat > "$mock_bin/ss" <<'MOCK'
#!/usr/bin/env bash
if [[ "${MOCK_PORT_PRESENT:-1}" != 0 ]]; then
  printf 'LISTEN 0 4096 127.0.0.1:8080 0.0.0.0:*\n'
fi
MOCK
cat > "$mock_bin/df" <<'MOCK'
#!/usr/bin/env bash
printf 'Filesystem Size Used Avail Use%% Mounted on\nmock 100G 20G 80G 20%% /opt\n'
MOCK
cat > "$mock_bin/free" <<'MOCK'
#!/usr/bin/env bash
printf '              total used free\nMem:          16Gi 4Gi 12Gi\n'
MOCK
chmod +x "$test_root/project/backend/mvnw" "$mock_bin"/*

config="$test_root/config.sh"
cat > "$config" <<EOF
PROJECT_DIR=$test_root/project
FRONTEND_DIR=$test_root/www/live
BACKEND_DIR=$test_root/project/backend
BACKEND_SERVICE=win-tools-backend
BACKUP_DIR=$test_root/project/backups
SITE_URL=https://site.test/
HEALTH_URL=http://127.0.0.1:8080/api/health
BACKUP_LIMIT=4
HEALTH_ATTEMPTS=1
HEALTH_INTERVAL=0
EOF
export WIN_TOOLS_DEPLOY_CONFIG="$config"

expect_failure 'WRONG' bash "$repo_dir/deploy/frontend-deploy.sh"
assert_content "$test_root/www/live/index.html" old-frontend
printf 'DEPLOY FRONTEND\n' | bash "$repo_dir/deploy/frontend-deploy.sh" > "$test_root/frontend.log"
assert_content "$test_root/www/live/index.html" new-frontend
assert_content "$test_root/project/backend/backend.jar" old-jar
first_snapshot=$(find "$test_root/project/backups" -mindepth 1 -maxdepth 1 -type d -name '20*' -print -quit)
assert_file "$first_snapshot/.complete"
assert_content "$first_snapshot/frontend/index.html" old-frontend
assert_content "$first_snapshot/backend.jar" old-jar
grep -q 'npm ci' "$MOCK_LOG" || fail 'npm ci did not run'
grep -q 'nginx -t' "$MOCK_LOG" || fail 'nginx validation did not run'
grep -q 'systemctl reload nginx' "$MOCK_LOG" || fail 'nginx reload did not run'

export MOCK_BACKEND_STATUS=503
expect_failure 'DEPLOY BACKEND' bash "$repo_dir/deploy/backend-deploy.sh"
assert_content "$test_root/project/backend/backend.jar" new-jar
second_snapshot=$(find "$test_root/project/backups" -mindepth 1 -maxdepth 1 -type d -name '20*' ! -path "$first_snapshot" -print -quit)
assert_file "$second_snapshot/.complete"
assert_content "$second_snapshot/backend.jar" old-jar
grep -q 'mvnw clean package' "$MOCK_LOG" || fail 'Maven package did not run'
grep -q 'systemctl stop win-tools-backend' "$MOCK_LOG" || fail 'Backend service did not stop'
grep -q 'systemctl start win-tools-backend' "$MOCK_LOG" || fail 'Backend service did not start'

expect_failure '' bash "$repo_dir/deploy/health-check.sh"
unset MOCK_BACKEND_STATUS
bash "$repo_dir/deploy/health-check.sh" > "$test_root/health.log"
grep -q 'Actuator UP' "$test_root/health.log" || fail 'Actuator health was not checked'
export MOCK_ACTUATOR_STATUS=503
expect_failure '' bash "$repo_dir/deploy/health-check.sh"
grep -q 'Actuator health returned HTTP 503' "$test_root/output" || fail 'Actuator HTTP failure was not reported'
unset MOCK_ACTUATOR_STATUS
export MOCK_ACTUATOR_BODY='{"status":"DOWN"}'
expect_failure '' bash "$repo_dir/deploy/health-check.sh"
grep -q 'Actuator health response is not a safe UP status' "$test_root/output" || fail 'Actuator DOWN was accepted'
unset MOCK_ACTUATOR_BODY
export MOCK_BACKEND_ACTIVE=0
expect_failure '' bash "$repo_dir/deploy/health-check.sh"
unset MOCK_BACKEND_ACTIVE

status_log_start=$(wc -l < "$MOCK_LOG")
bash "$repo_dir/deploy/status-check.sh" > "$test_root/status.log"
tail -n "+$((status_log_start + 1))" "$MOCK_LOG" > "$test_root/status-commands.log"
if grep -Eq '^systemctl (start|stop|restart|reload|enable|disable)' "$test_root/status-commands.log"; then
  fail 'Status check changed a service'
fi
grep -q 'Backend port 8080: listening on loopback' "$test_root/status.log" || fail 'Port status is missing'
grep -q 'nginx: active' "$test_root/status.log" || fail 'Nginx status is missing'
grep -q 'Disk space' "$test_root/status.log" || fail 'Disk status is missing'
grep -q 'Memory' "$test_root/status.log" || fail 'Memory status is missing'
export MOCK_PORT_PRESENT=0
expect_failure '' bash "$repo_dir/deploy/status-check.sh"
unset MOCK_PORT_PRESENT
export MOCK_NGINX_ACTIVE=0
expect_failure '' bash "$repo_dir/deploy/status-check.sh"
unset MOCK_NGINX_ACTIVE

nginx_config="$repo_dir/deploy/nginx/win-tools.conf.example"
grep -Fq '/var/log/nginx/win-tools-access.log win_tools_ops' "$nginx_config" || fail 'Safe Nginx access log is missing'
grep -Fq 'location ^~ /actuator/' "$nginx_config" || fail 'Public Actuator block is missing'
log_format=$(grep '^log_format win_tools_ops ' "$nginx_config")
[[ "$log_format" != *'$remote_addr'* && "$log_format" != *'$uri'* && "$log_format" != *'$request_uri'* && "$log_format" != *'$http_'* ]] || fail 'Nginx access log includes request or client data'

second_id=${second_snapshot##*/}
expect_failure 'WRONG' bash "$repo_dir/deploy/rollback.sh"
assert_content "$test_root/project/backend/backend.jar" new-jar
printf 'ROLLBACK %s\n' "$second_id" | bash "$repo_dir/deploy/rollback.sh" > "$test_root/default-rollback.log"
assert_content "$test_root/www/live/index.html" new-frontend
assert_content "$test_root/project/backend/backend.jar" old-jar

target_id=${first_snapshot##*/}
printf 'ROLLBACK %s\n' "$target_id" | bash "$repo_dir/deploy/rollback.sh" "$target_id" > "$test_root/rollback.log"
assert_content "$test_root/www/live/index.html" old-frontend
assert_content "$test_root/project/backend/backend.jar" old-jar
snapshot_count=$(find "$test_root/project/backups" -mindepth 2 -maxdepth 2 -type f -name .complete | wc -l)
[[ "$snapshot_count" -eq 4 ]] || fail "Expected four complete snapshots, got $snapshot_count"

expect_failure 'DEPLOY FRONTEND' bash "$repo_dir/deploy/frontend-deploy.sh"
grep -q 'Backup limit' "$test_root/output" || fail 'Backup limit did not stop deployment'
assert_content "$test_root/www/live/index.html" old-frontend

mv -T -- "$test_root/www/live" "$test_root/www/interrupted-live"
printf 'ROLLBACK %s\n' "$target_id" | bash "$repo_dir/deploy/rollback.sh" "$target_id" > "$test_root/recovery.log"
assert_content "$test_root/www/live/index.html" old-frontend
assert_content "$test_root/project/backend/backend.jar" old-jar
partial_count=$(find "$test_root/project/backups" -mindepth 2 -maxdepth 2 -type f -name .partial | wc -l)
[[ "$partial_count" -eq 1 ]] || fail 'Expected a partial incident snapshot when the live frontend was missing'

mv -- "$test_root/project/backend/backend.jar" "$test_root/project/backend/interrupted.jar"
printf 'ROLLBACK %s\n' "$target_id" | bash "$repo_dir/deploy/rollback.sh" "$target_id" > "$test_root/jar-recovery.log"
assert_content "$test_root/project/backend/backend.jar" old-jar
partial_count=$(find "$test_root/project/backups" -mindepth 2 -maxdepth 2 -type f -name .partial | wc -l)
[[ "$partial_count" -eq 2 ]] || fail 'Expected a partial incident snapshot when the live Jar was missing'

sed 's|^FRONTEND_DIR=.*|FRONTEND_DIR=/|' "$config" > "$test_root/unsafe-config.sh"
WIN_TOOLS_DEPLOY_CONFIG="$test_root/unsafe-config.sh" expect_failure '' bash "$repo_dir/deploy/health-check.sh"
grep -q 'non-root path' "$test_root/output" || fail 'Root path was not rejected'
sed "s|^BACKUP_DIR=.*|BACKUP_DIR=$test_root/project/frontend|" "$config" > "$test_root/unsafe-backup-config.sh"
WIN_TOOLS_DEPLOY_CONFIG="$test_root/unsafe-backup-config.sh" expect_failure '' bash "$repo_dir/deploy/health-check.sh"
grep -q 'BACKUP_DIR must be' "$test_root/output" || fail 'Unsafe backup path was not rejected'
printf 'Deployment script tests passed.\n'
