# Copy to backup-config.sh on the Ubuntu host; keep that file out of Git.
# No credentials belong here. Set MYSQL_CREDENTIALS_FILE to a private MySQL
# option file, or export MYSQL_PWD only for the backup/restore process.
# shellcheck disable=SC2034
BACKUP_DIR=/var/backups/win-tools
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=win_tools
DB_USER=win_tools_backup
MYSQL_CREDENTIALS_FILE=
BACKEND_DIR=/opt/win-tools/backend
FRONTEND_DIR=/var/www/win-tools
NGINX_CONFIG_DIR=/etc/nginx
SYSTEMD_SERVICE_FILE=/etc/systemd/system/win-tools-backend.service
APP_CONFIG_DIR=/etc/win-tools
BACKUP_KEEP=7
MYSQL_COMPRESS=1
