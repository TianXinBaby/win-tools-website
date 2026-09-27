# Copy to config.sh on the Ubuntu host and edit the paths and public URL.
# This file contains no credentials. Never source the systemd env file here.
# shellcheck disable=SC2034  # Values are consumed by scripts that source this file.
PROJECT_DIR=/opt/win-tools
FRONTEND_DIR=/var/www/win-tools
BACKEND_DIR=/opt/win-tools/backend
BACKEND_SERVICE=win-tools-backend
BACKUP_DIR=/opt/win-tools/backups
SITE_URL=https://example.com/
HEALTH_URL=http://127.0.0.1:8080/api/health
BACKUP_LIMIT=10
HEALTH_ATTEMPTS=30
HEALTH_INTERVAL=2
