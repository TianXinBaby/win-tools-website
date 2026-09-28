#!/usr/bin/env bash
# Single-pass, read-only production sample. No parallel requests or writes.
set -euo pipefail
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"
load_config

status=0
check_http() {
  local label=$1 url=$2 result code total first_byte
  if ! result=$(curl --silent --show-error --max-time 10 --output /dev/null \
      --write-out '%{http_code} %{time_total} %{time_starttransfer}' "$url"); then
    printf '%s: request failed\n' "$label"
    status=1
    return
  fi
  read -r code total first_byte <<< "$result"
  printf '%s: HTTP %s total=%ss first_byte=%ss\n' "$label" "$code" "$total" "$first_byte"
  [[ "$code" == 200 ]] || status=1
}

if systemctl is-active --quiet "$BACKEND_SERVICE"; then
  printf '%s: active\n' "$BACKEND_SERVICE"
else
  printf '%s: inactive\n' "$BACKEND_SERVICE"
  status=1
fi

check_http 'HTTPS homepage' "$SITE_URL"
check_http 'Public tools API' "${SITE_URL%/}/api/tools"
check_http 'Loopback health API' "$HEALTH_URL"
check_http 'Loopback Actuator health' "${HEALTH_URL%/api/health}/actuator/health"

printf '\nMemory:\n'
free -h || status=1
printf '\nDisk (%s):\n' "$PROJECT_DIR"
df -h -- "$PROJECT_DIR" || status=1

exit "$status"
