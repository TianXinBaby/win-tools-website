#!/usr/bin/env bash
# Read-only checks against a public HTTPS release. No credentials or cookies.
set -euo pipefail

base_url=${BASE_URL:-}
if [[ ! "$base_url" =~ ^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?/?$ ]]; then
  printf 'Set BASE_URL to the public HTTPS origin, for example https://xc64.com.cn\n' >&2
  exit 2
fi
base_url=${base_url%/}

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

request() {
  local path=$1 response metadata
  if ! response=$(curl --silent --show-error --max-time 10 --max-redirs 0 \
      --proto '=https' --write-out $'\n__WIN_TOOLS_RESPONSE__%{http_code} %{content_type}' \
      "$base_url$path"); then
    fail "GET $path failed (network or TLS)"
  fi
  [[ "$response" == *$'\n__WIN_TOOLS_RESPONSE__'* ]] || fail "GET $path has no HTTP metadata"
  metadata=${response##*$'\n__WIN_TOOLS_RESPONSE__'}
  body=${response%$'\n__WIN_TOOLS_RESPONSE__'*}
  read -r code mime <<< "$metadata"
}

check_page() {
  local path=$1
  request "$path"
  [[ "$code" == 200 ]] || fail "GET $path returned HTTP $code, expected 200"
  [[ "$mime" == text/html* ]] || fail "GET $path returned $mime, expected HTML"
  [[ "$body" == *'<div id="app"></div>'* ]] || fail "GET $path is not the Vue application shell"
  if [[ "$path" == / ]]; then
    homepage_body=$body
  else
    [[ "$body" == "$homepage_body" ]] || fail "GET $path did not serve the SPA entry page"
  fi
  printf 'PASS: GET %s (HTTPS, HTTP 200, SPA HTML)\n' "$path"
}

api_code_pattern='"code"[[:space:]]*:[[:space:]]*200'
api_data_pattern='"data"[[:space:]]*:'
health_up_pattern='"status"[[:space:]]*:[[:space:]]*"UP"'

check_api() {
  local path=$1
  request "$path"
  [[ "$code" == 200 ]] || fail "GET $path returned HTTP $code, expected 200"
  [[ "$mime" == application/json* ]] || fail "GET $path returned $mime, expected JSON"
  [[ "$body" =~ $api_code_pattern && "$body" =~ $api_data_pattern ]] || fail "GET $path has no successful API envelope"
  if [[ "$path" == /api/health ]]; then
    [[ "$body" =~ $health_up_pattern ]] || fail 'GET /api/health is not UP'
  fi
  printf 'PASS: GET %s (HTTPS, HTTP 200, API JSON)\n' "$path"
}

check_page /
for path in /windows /tools /articles /favorites /tools/json; do
  check_page "$path"
done
for path in /api/health /api/windows /api/tools /api/articles; do
  check_api "$path"
done

request /actuator/health
[[ "$code" == 404 ]] || fail "Public /actuator/health returned HTTP $code, expected 404"
printf 'PASS: GET /actuator/health (public HTTP 404)\n'
printf 'Production smoke test passed.\n'
