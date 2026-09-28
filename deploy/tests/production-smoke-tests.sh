#!/usr/bin/env bash
# Curl is mocked; these tests never contact the production site.
set -euo pipefail
repo_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
mkdir -p "$repo_dir/.cache"
test_root=$(mktemp -d "$repo_dir/.cache/production-smoke-tests.XXXXXX")
cleanup() {
  [[ "$test_root" == "$repo_dir/.cache/production-smoke-tests."* ]] || exit 1
  rm -r -- "$test_root"
}
trap cleanup EXIT
fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
expect_failure() {
  if "$@" > "$test_root/output" 2>&1; then
    fail "Expected failure: $*"
  fi
}

mkdir -p "$test_root/bin"
export PATH="$test_root/bin:$PATH"
export MOCK_LOG="$test_root/requests.log"
cat > "$test_root/bin/curl" <<'MOCK'
#!/usr/bin/env bash
[[ "$*" == *'--proto =https'* ]] || exit 70
[[ "$*" != *'--insecure'* && "$*" != *'--data'* && "$*" != *'--user'* && "$*" != *'--cookie'* ]] || exit 71
for argument in "$@"; do url=$argument; done
[[ "$url" == https://smoke.test/* ]] || exit 72
path=/${url#https://smoke.test/}
printf '%s\n' "$path" >> "$MOCK_LOG"
[[ "${MOCK_NETWORK_FAIL:-}" != "$path" ]] || exit 7
status=200
mime=text/html
body='<html><body><div id="app"></div></body></html>'
if [[ "$path" == /api/* ]]; then
  mime=application/json
  body='{"code":200,"message":"success","data":[]}'
  [[ "$path" != /api/health ]] || body='{"code":200,"message":"success","data":{"status":"UP"}}'
fi
if [[ "$path" == /actuator/health ]]; then
  status=${MOCK_ACTUATOR_STATUS:-404}
  mime=application/json
  body='{"status":"UP"}'
fi
[[ "${MOCK_FAIL_PATH:-}" != "$path" ]] || status=${MOCK_FAIL_STATUS:-503}
[[ "${MOCK_BAD_HTML:-}" != "$path" ]] || body='<html><body>wrong app</body></html>'
[[ "${MOCK_BAD_DEEP:-}" != "$path" ]] || body='<html><body><div id="app"></div><p>wrong build</p></body></html>'
[[ "${MOCK_BAD_JSON:-}" != "$path" ]] || body='{"code":500,"message":"failed"}'
[[ "${MOCK_HEALTH_DOWN:-}" != "$path" ]] || body='{"code":200,"data":{"status":"DOWN"}}'
[[ "${MOCK_BAD_MIME:-}" != "$path" ]] || mime=text/plain
printf '%s\n__WIN_TOOLS_RESPONSE__%s %s' "$body" "$status" "$mime"
MOCK
chmod +x "$test_root/bin/curl"

smoke="$repo_dir/deploy/production-smoke-test.sh"
expect_failure env -u BASE_URL bash "$smoke"
expect_failure env BASE_URL=http://smoke.test bash "$smoke"
expect_failure env BASE_URL=https://name@smoke.test bash "$smoke"
[[ ! -e "$MOCK_LOG" ]] || fail 'Invalid origins must not trigger requests'

BASE_URL=https://smoke.test bash "$smoke" > "$test_root/output"
[[ $(wc -l < "$MOCK_LOG") -eq 11 ]] || fail 'Expected exactly 11 read-only requests'
grep -Fxq /tools/json "$MOCK_LOG" || fail 'SPA deep route was not checked'
grep -Fxq /api/articles "$MOCK_LOG" || fail 'Public articles API was not checked'
grep -q 'Production smoke test passed.' "$test_root/output" || fail 'Success summary is missing'

export MOCK_FAIL_PATH=/windows MOCK_FAIL_STATUS=404
expect_failure env BASE_URL=https://smoke.test bash "$smoke"
unset MOCK_FAIL_PATH MOCK_FAIL_STATUS
export MOCK_BAD_HTML=/
expect_failure env BASE_URL=https://smoke.test bash "$smoke"
unset MOCK_BAD_HTML
export MOCK_BAD_DEEP=/windows
expect_failure env BASE_URL=https://smoke.test bash "$smoke"
unset MOCK_BAD_DEEP
export MOCK_BAD_MIME=/api/health
expect_failure env BASE_URL=https://smoke.test bash "$smoke"
unset MOCK_BAD_MIME
export MOCK_BAD_JSON=/api/windows
expect_failure env BASE_URL=https://smoke.test bash "$smoke"
unset MOCK_BAD_JSON
export MOCK_HEALTH_DOWN=/api/health
expect_failure env BASE_URL=https://smoke.test bash "$smoke"
unset MOCK_HEALTH_DOWN
export MOCK_ACTUATOR_STATUS=200
expect_failure env BASE_URL=https://smoke.test bash "$smoke"
unset MOCK_ACTUATOR_STATUS
export MOCK_NETWORK_FAIL=/
expect_failure env BASE_URL=https://smoke.test bash "$smoke"
unset MOCK_NETWORK_FAIL

printf 'Production smoke tests passed.\n'
