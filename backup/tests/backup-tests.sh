#!/usr/bin/env bash
# Isolated behavior tests. All generated files stay in the repository's ignored .cache.
set -euo pipefail
repo_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
git -C "$repo_dir" check-ignore -q backup/mysql/example.sql.gz || { printf 'FAIL: SQL backup ignore rule missing\n' >&2; exit 1; }
git -C "$repo_dir" check-ignore -q backup/files/example.tar.gz || { printf 'FAIL: file backup ignore rule missing\n' >&2; exit 1; }
git -C "$repo_dir" check-ignore -q backup/backup-config.sh || { printf 'FAIL: private config ignore rule missing\n' >&2; exit 1; }
mkdir -p "$repo_dir/.cache"
test_root=$(mktemp -d "$repo_dir/.cache/backup-tests.XXXXXXXX")
cleanup() {
  [[ "$test_root" == "$repo_dir/.cache/backup-tests."* && -d "$test_root" ]] || exit 1
  rm -rf -- "$test_root"
}
trap cleanup EXIT
fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
assert_content() { [[ -f "$1" && $(cat -- "$1") == "$2" ]] || fail "Unexpected content: $1"; }
expect_failure() {
  local input=$1; shift
  if printf '%s\n' "$input" | "$@" > "$test_root/output" 2>&1; then fail "Expected failure: $*"; fi
}

mock_bin="$test_root/bin"
mkdir -p "$mock_bin" "$test_root/backend" "$test_root/frontend" "$test_root/nginx" "$test_root/systemd" "$test_root/app"
cat > "$mock_bin/mysqldump" <<'MOCK'
#!/usr/bin/env bash
printf 'mysqldump %s\n' "$*" >> "$MOCK_LOG"
[[ ${1:-} == --defaults-extra-file=* ]] || exit 4
if [[ ${MOCK_DUMP_FAIL:-0} == 1 ]]; then exit 5; fi
printf '%s\n' 'CREATE TABLE demo (id INT);' 'INSERT INTO demo VALUES (1);'
MOCK
cat > "$mock_bin/mysql" <<'MOCK'
#!/usr/bin/env bash
printf 'mysql %s\n' "$*" >> "$MOCK_LOG"
[[ ${1:-} == --defaults-extra-file=* ]] || exit 4
for arg in "$@"; do [[ "$arg" != -e ]] || exit 0; done
cat > "$MOCK_RESTORE_SQL"
MOCK
chmod +x "$mock_bin"/*
export PATH="$mock_bin:$PATH"
export MOCK_LOG="$test_root/commands.log" MOCK_RESTORE_SQL="$test_root/restored.sql"
printf '[client]\n' > "$test_root/credentials.cnf"
chmod 0600 "$test_root/credentials.cnf"
printf 'jar-before' > "$test_root/backend/backend.jar"
printf 'front-before' > "$test_root/frontend/index.html"
printf 'old-asset' > "$test_root/frontend/app.js"
printf 'nginx-before' > "$test_root/nginx/nginx.conf"
printf 'service-before' > "$test_root/systemd/win-tools-backend.service"
printf 'app-before' > "$test_root/app/win-tools.env"
config="$test_root/backup-config.sh"
cat > "$config" <<EOF
BACKUP_DIR=$test_root/backups
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=win_tools
DB_USER=win_tools_backup
MYSQL_CREDENTIALS_FILE=$test_root/credentials.cnf
BACKEND_DIR=$test_root/backend
FRONTEND_DIR=$test_root/frontend
NGINX_CONFIG_DIR=$test_root/nginx
SYSTEMD_SERVICE_FILE=$test_root/systemd/win-tools-backend.service
APP_CONFIG_DIR=$test_root/app
BACKUP_KEEP=2
MYSQL_COMPRESS=1
EOF
export WIN_TOOLS_BACKUP_CONFIG="$config"

cat > "$mock_bin/stat" <<'MOCK'
#!/usr/bin/env bash
if [[ "$*" == *credentials.cnf* ]]; then printf '644\n'; else exec /usr/bin/stat "$@"; fi
MOCK
chmod +x "$mock_bin/stat"
expect_failure '' bash "$repo_dir/backup/mysql-backup.sh"
grep -q 'must not be readable by group' "$test_root/output" || fail 'Insecure credential permissions were accepted'
rm -- "$mock_bin/stat"
sed "s|^BACKUP_DIR=.*|BACKUP_DIR=$test_root/frontend|" "$config" > "$test_root/overlap-config.sh"
WIN_TOOLS_BACKUP_CONFIG="$test_root/overlap-config.sh" expect_failure '' bash "$repo_dir/backup/file-backup.sh"
grep -q 'overlaps FRONTEND_DIR' "$test_root/output" || fail 'Overlapping backup directory was accepted'
MOCK_DUMP_FAIL=1 expect_failure '' bash "$repo_dir/backup/mysql-backup.sh"
[[ ! -d "$test_root/backups/mysql" || -z $(find "$test_root/backups/mysql" -maxdepth 1 -name '*.sql.gz' -print -quit) ]] || fail 'Failed dump was published'
mkdir "$test_root/backups/.backup-lock"
expect_failure '' bash "$repo_dir/backup/mysql-backup.sh"
grep -q 'lock exists' "$test_root/output" || fail 'Concurrent backup was not blocked'
rmdir "$test_root/backups/.backup-lock"
for i in 1 2 3; do bash "$repo_dir/backup/mysql-backup.sh" > "$test_root/mysql-$i.log"; done
shopt -s nullglob
sql_archives=("$test_root"/backups/mysql/*.sql.gz)
[[ ${#sql_archives[@]} -eq 2 ]] || fail 'SQL retention did not keep exactly two backups'
grep -q 'RETENTION: deleting' "$test_root/mysql-3.log" || fail 'SQL retention was not logged'
sql_archive=${sql_archives[1]}
bash "$repo_dir/backup/verify-backup.sh" "$sql_archive" >/dev/null
expect_failure 'WRONG' bash "$repo_dir/backup/restore-mysql.sh" "$sql_archive"
expect_failure $'RESTORE MYSQL\nwrong_db' bash "$repo_dir/backup/restore-mysql.sh" "$sql_archive"
[[ ! -e "$MOCK_RESTORE_SQL" ]] || fail 'SQL restore ran without both confirmations'
printf 'RESTORE MYSQL\nwin_tools\n' | bash "$repo_dir/backup/restore-mysql.sh" "$sql_archive" > "$test_root/restore-mysql.log"
grep -q 'CREATE TABLE demo' "$MOCK_RESTORE_SQL" || fail 'SQL was not sent to mysql'
grep -q 'INSERT INTO demo' "$MOCK_RESTORE_SQL" || fail 'SQL rows were not sent to mysql'

sed 's/MYSQL_COMPRESS=1/MYSQL_COMPRESS=0/' "$config" > "$test_root/plain-config.sh"
WIN_TOOLS_BACKUP_CONFIG="$test_root/plain-config.sh" bash "$repo_dir/backup/mysql-backup.sh" > "$test_root/plain.log"
plain_archives=("$test_root"/backups/mysql/*.sql)
[[ ${#plain_archives[@]} -eq 1 ]] || fail 'Uncompressed SQL backup missing'
bash "$repo_dir/backup/verify-backup.sh" "${plain_archives[0]}" >/dev/null

for i in 1 2 3; do bash "$repo_dir/backup/file-backup.sh" > "$test_root/file-$i.log"; done
file_archives=("$test_root"/backups/files/*.tar.gz)
[[ ${#file_archives[@]} -eq 2 ]] || fail 'File retention did not keep exactly two backups'
grep -q 'RETENTION: deleting' "$test_root/file-3.log" || fail 'File retention was not logged'
file_archive=${file_archives[1]}
bash "$repo_dir/backup/verify-backup.sh" "$file_archive" >/dev/null
printf 'jar-after' > "$test_root/backend/backend.jar"
printf 'front-after' > "$test_root/frontend/index.html"
printf 'new-only' > "$test_root/frontend/new.js"
printf 'nginx-after' > "$test_root/nginx/nginx.conf"
printf 'service-after' > "$test_root/systemd/win-tools-backend.service"
printf 'app-after' > "$test_root/app/win-tools.env"
expect_failure 'WRONG' bash "$repo_dir/backup/restore-files.sh" "$file_archive"
expect_failure $'RESTORE FILES\nwrong.tar.gz' bash "$repo_dir/backup/restore-files.sh" "$file_archive"
assert_content "$test_root/frontend/index.html" front-after
printf 'RESTORE FILES\n%s\n' "${file_archive##*/}" | bash "$repo_dir/backup/restore-files.sh" "$file_archive" > "$test_root/restore-files.log"
assert_content "$test_root/backend/backend.jar" jar-before
assert_content "$test_root/frontend/index.html" front-before
[[ ! -e "$test_root/frontend/new.js" ]] || fail 'Frontend restore retained stale file'
assert_content "$test_root/nginx/nginx.conf" nginx-before
assert_content "$test_root/systemd/win-tools-backend.service" service-before
assert_content "$test_root/app/win-tools.env" app-before
before_front=("$test_root"/frontend.before.*)
[[ ${#before_front[@]} -eq 1 ]] || fail 'Pre-restore frontend was not retained'
assert_content "${before_front[0]}/index.html" front-after

# A failure during a later switch must put all earlier live targets back.
printf 'jar-after-two' > "$test_root/backend/backend.jar"
printf 'front-after-two' > "$test_root/frontend/index.html"
printf 'nginx-after-two' > "$test_root/nginx/nginx.conf"
cat > "$mock_bin/mv" <<'MOCK'
#!/usr/bin/env bash
args=("$@")
source_path=${args[${#args[@]}-2]}
target_path=${args[${#args[@]}-1]}
if [[ "$source_path" == *.new.* && "$target_path" == "$MOCK_FAIL_TARGET" ]]; then exit 9; fi
exec /usr/bin/mv "$@"
MOCK
chmod +x "$mock_bin/mv"
export MOCK_FAIL_TARGET="$test_root/nginx"
expect_failure "$(printf 'RESTORE FILES\n%s' "${file_archive##*/}")" bash "$repo_dir/backup/restore-files.sh" "$file_archive"
assert_content "$test_root/backend/backend.jar" jar-after-two
assert_content "$test_root/frontend/index.html" front-after-two
assert_content "$test_root/nginx/nginx.conf" nginx-after-two
unset MOCK_FAIL_TARGET

printf 'tamper' >> "$file_archive"
expect_failure '' bash "$repo_dir/backup/verify-backup.sh" "$file_archive"
grep -q 'Checksum mismatch' "$test_root/output" || fail 'Corruption was not reported'
printf 'Backup workflow tests passed.\n'
