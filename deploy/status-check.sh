#!/usr/bin/env bash
# Read-only summary of the current host; no service or filesystem changes.
set -euo pipefail
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"
load_config
status=0

if systemctl is-active --quiet "$BACKEND_SERVICE"; then
  printf '%s: active\n' "$BACKEND_SERVICE"
else
  printf '%s: inactive\n' "$BACKEND_SERVICE"
  status=1
fi

port=${HEALTH_URL#http://}
port=${port#*:}
port=${port%%/*}
if ! listeners=$(ss -ltnH); then
  printf 'Backend port %s: unavailable (ss failed)\n' "$port"
  status=1
elif awk -v port="$port" '$4 ~ (":" port "$") && $4 ~ /^(127\.0\.0\.1|\[::1\]):/ { found=1 } END { exit !found }' <<< "$listeners"; then
  printf 'Backend port %s: listening on loopback\n' "$port"
else
  printf 'Backend port %s: not listening on loopback\n' "$port"
  status=1
fi

if systemctl is-active --quiet nginx; then
  printf 'nginx: active\n'
else
  printf 'nginx: inactive\n'
  status=1
fi

printf '\nDisk space (%s):\n' "$PROJECT_DIR"
if ! df -h -- "$PROJECT_DIR"; then
  printf 'Disk space: unavailable\n'
  status=1
fi
printf '\nMemory:\n'
if ! free -h; then
  printf 'Memory: unavailable\n'
  status=1
fi
exit "$status"
