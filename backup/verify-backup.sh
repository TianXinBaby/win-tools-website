#!/usr/bin/env bash
set -euo pipefail
[[ $# -eq 1 ]] || { printf 'Usage: verify-backup.sh ARCHIVE\n' >&2; exit 2; }
archive=$1
[[ -f "$archive" && ! -L "$archive" && -s "$archive" && -r "$archive" ]] || { printf 'Backup is missing, empty, unreadable, or a symlink: %s\n' "$archive" >&2; exit 1; }
[[ -f "$archive.sha256" && ! -L "$archive.sha256" ]] || { printf 'Missing checksum: %s.sha256\n' "$archive" >&2; exit 1; }
expected=$(cat -- "$archive.sha256")
[[ "$expected" =~ ^[0-9a-fA-F]{64}$ ]] || { printf 'Invalid checksum format\n' >&2; exit 1; }
digest=$(sha256sum -- "$archive")
[[ "${digest%% *}" == "${expected,,}" ]] || { printf 'Checksum mismatch: %s\n' "$archive" >&2; exit 1; }

case "$archive" in
  *.sql)
    [[ -s "$archive" ]] || exit 1
    ;;
  *.sql.gz)
    gzip -t -- "$archive"
    bytes=$(gzip -cd -- "$archive" | wc -c)
    (( bytes > 0 )) || { printf 'SQL backup expands to an empty file\n' >&2; exit 1; }
    ;;
  *.tar.gz)
    gzip -t -- "$archive"
    listing=$(tar --quoting-style=escape -tzf "$archive") || { printf 'Tar archive is unreadable\n' >&2; exit 1; }
    for required in backend/backend.jar frontend/index.html config/nginx/ config/systemd/win-tools-backend.service config/app/; do
      grep -Fxq -- "$required" <<< "$listing" || { printf 'Missing archive member: %s\n' "$required" >&2; exit 1; }
    done
    while IFS= read -r member; do
      [[ -n "$member" && "$member" != /* && "$member" != *'..'* && "$member" != *\\* ]] || { printf 'Unsafe archive member: %s\n' "$member" >&2; exit 1; }
      case "$member" in
        backend|backend/*|frontend|frontend/*|config|config/|config/nginx|config/nginx/*|config/systemd|config/systemd/*|config/app|config/app/*) ;;
        *) printf 'Unexpected archive member: %s\n' "$member" >&2; exit 1 ;;
      esac
    done <<< "$listing"
    ;;
  *) printf 'Unsupported backup type: %s\n' "$archive" >&2; exit 2 ;;
esac
printf 'Verified %s\n' "$archive"
