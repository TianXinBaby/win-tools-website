#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"
load_config

systemctl is-active --quiet "$BACKEND_SERVICE" || die "systemd service $BACKEND_SERVICE is not active"

site_status=$(curl --silent --show-error --max-time 5 --output /dev/null --write-out '%{http_code}' "$SITE_URL") || die 'Site HTTP request failed'
[[ "$site_status" == 200 ]] || die "Site returned HTTP $site_status, expected 200"

result=$(curl --silent --show-error --max-time 5 --write-out '\n%{http_code}' "$HEALTH_URL") || die 'Backend health request failed'
health_status=${result##*$'\n'}
health_body=${result%$'\n'*}
[[ "$health_status" == 200 ]] || die "Backend health returned HTTP $health_status, expected 200"
[[ "$health_body" == *'"code":200'* && "$health_body" == *'"status":"UP"'* ]] || die 'Backend health response is not UP'
printf 'Site HTTP 200, backend UP, systemd active.\n'
