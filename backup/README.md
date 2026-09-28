# 生产备份与恢复（Phase 11.14.4）

本目录供 Ubuntu + MySQL 8 + Nginx + systemd 生产环境使用。数据库备份与文件备份是两组独立快照；文件归档包括 `backend.jar`、已发布的 Vue 静态目录、整个 `/etc/nginx`、后端 systemd 单元，以及 `/etc/win-tools`。后两处可能含数据库密码、TLS 私钥或其他敏感配置。数据库归档包含结构和数据、触发器、事件、存储过程；使用 `--single-transaction` 获取 InnoDB 一致视图。若存在非事务表，需另行安排写入冻结。归档不包含 `/opt/win-tools/logs`、Nginx 日志、数据库服务自身配置、外部 TLS 证书路径或部署脚本的发布回滚快照。

默认备份根目录 `/var/backups/win-tools` 与 Web root、项目检出和 `deploy/` 的回滚快照目录分开。每个归档旁有只存 SHA-256 摘要的 `.sha256` 文件。校验能发现损坏，不能证明文件来源；只恢复可信、访问受控的归档。备份目录及内容应仅允许 root 读取，并另行加密、异地复制；单机备份无法防范整机损坏。

## 服务器安装与配置

以下操作须由有 sudo 权限的运维人员审核后执行，不会自动修改服务器。本仓库中的 `backup/backup-config.sh` 已被 Git 忽略。root 的计划任务应调用 **root 拥有且普通部署用户不可修改** 的脚本副本，避免从可写检出目录以 root 权限执行代码。

```sh
cd /opt/win-tools
sudo install -d -o root -g root -m 0755 /usr/local/libexec/win-tools-backup
sudo install -o root -g root -m 0644 backup/common.sh /usr/local/libexec/win-tools-backup/
sudo install -o root -g root -m 0755 backup/mysql-backup.sh backup/file-backup.sh backup/restore-mysql.sh backup/restore-files.sh backup/verify-backup.sh /usr/local/libexec/win-tools-backup/
sudo install -d -o root -g root -m 0700 /etc/win-tools
sudo install -o root -g root -m 0600 backup/backup-config.example.sh /etc/win-tools/backup-config.sh
sudoedit /etc/win-tools/backup-config.sh
sudo install -d -o root -g root -m 0700 /var/backups/win-tools
```

在私有配置中核对 `BACKUP_DIR`、`DB_HOST`、`DB_PORT`、`DB_NAME`、`DB_USER`、`BACKEND_DIR`、`FRONTEND_DIR`、`NGINX_CONFIG_DIR`、`SYSTEMD_SERVICE_FILE`、`APP_CONFIG_DIR`。默认目录与现有部署示例一致。`BACKUP_KEEP=7` 表示数据库和文件归档各保留最近 7 份；`MYSQL_COMPRESS=1` 生成 `.sql.gz`，设为 `0` 生成 `.sql`。配置文件是可信 Bash 代码，不能让非管理员修改，也不能直接加载 systemd 的 `win-tools.env`。

数据库密码不得写进示例、命令行参数或 Git。推荐在独立、root 可读的 MySQL 客户端配置中填写密码，在 `backup-config.sh` 中仅设置路径：

```sh
sudo install -o root -g root -m 0600 /dev/null /etc/win-tools/backup-mysql.cnf
sudoedit /etc/win-tools/backup-mysql.cnf
sudo chmod 0600 /etc/win-tools/backup-mysql.cnf
```

该文件格式为 `[client]` 段和 `password=实际密码` 行；不要把实际内容贴入工单、命令历史或仓库。将 `MYSQL_CREDENTIALS_FILE=/etc/win-tools/backup-mysql.cnf` 写入私有配置。也可留空该项，在单次进程环境中设置 `MYSQL_PWD`；它不会被脚本打印，但环境变量的可见性通常高于 0600 文件。运行备份的账号应有读取所有表、视图、触发器、事件和例程所需的权限；恢复时使用具备建表、删除、插入等恢复权限的维护账号，必要时在维护窗口临时调整私有配置的 `DB_USER` 和凭据路径。应用自身的受限账号不一定足以恢复。

## 创建、校验和保留

```sh
sudo env WIN_TOOLS_BACKUP_CONFIG=/etc/win-tools/backup-config.sh bash /usr/local/libexec/win-tools-backup/mysql-backup.sh
sudo env WIN_TOOLS_BACKUP_CONFIG=/etc/win-tools/backup-config.sh bash /usr/local/libexec/win-tools-backup/file-backup.sh
sudo bash /usr/local/libexec/win-tools-backup/verify-backup.sh /var/backups/win-tools/mysql/win_tools_YYYY-MM-DD-HHMMSS-PID.sql.gz
sudo bash /usr/local/libexec/win-tools-backup/verify-backup.sh /var/backups/win-tools/files/win_tools_files_YYYY-MM-DD-HHMMSS-PID.tar.gz
```

`mysql-backup.sh` 先生成完整 SQL，再可选 gzip，写入 SHA-256 并调用校验。`file-backup.sh` 从实际线上目录复制到私有暂存区，再生成 `tar.gz`、摘要并校验。链接会以链接形式保存，不会跟随到目录树外；脚本会提示外部链接，目标文件需另行备份。失败返回非零，不把半成品当作成功归档。归档按时间名排序，仅在新归档通过校验后执行保留策略；删除每个旧归档前输出 `RETENTION: deleting ...` 日志。若旧归档校验失败，自动清理停止，供运维调查。数据库和文件备份、恢复共用备份目录锁；进程异常留下 `.backup-lock` 时，应先确认没有运行中的任务再手工处理。`deploy/backups` 的发布快照仍按其原有策略人工管理，不受本策略影响。

备份目录宜设置独立磁盘配额和空间告警。SHA-256 不等于可恢复性证明；定期执行下文演练。修改配置、Jar 或前端后，应在维护窗口外尽快做一次完整文件备份。含密码和私钥的文件归档及其旧版 `.before` 文件均应限制访问并纳入过期清理流程。

## 自动化计划（本阶段不修改 crontab）

推荐每日备份数据库、每周备份文件。审核时区、磁盘容量、MySQL 权限和备份窗口后，由运维人员在 root crontab 中加入类似条目；先建立 root 专用 0600 日志并配置轮转：

```cron
WIN_TOOLS_BACKUP_CONFIG=/etc/win-tools/backup-config.sh
17 2 * * * /usr/bin/bash /usr/local/libexec/win-tools-backup/mysql-backup.sh >> /var/log/win-tools-backup.log 2>&1
23 3 * * 0 /usr/bin/bash /usr/local/libexec/win-tools-backup/file-backup.sh >> /var/log/win-tools-backup.log 2>&1
```

这些时间使用服务器本地时区。失败必须通过日志和监控告警发现；若备份失败，脚本返回非零。日志里会写删除操作，不会写 MySQL 密码。安装或更新脚本后重新审核 root 拥有权和文件权限。

## 恢复流程

真实生产恢复须预约维护窗口，提前暂停应用写入、确认最近可用的两个归档及校验，记录当前版本并预留额外磁盘空间。**数据库和文件是独立备份**，需选定兼容的一组时间点；只有文件恢复不能撤销数据库迁移。脚本不会自动停止服务或重启 Nginx/systemd，避免在未协调的窗口中中断业务。恢复前先在测试环境演练。

```sh
sudo env WIN_TOOLS_BACKUP_CONFIG=/etc/win-tools/backup-config.sh bash /usr/local/libexec/win-tools-backup/restore-mysql.sh /var/backups/win-tools/mysql/win_tools_YYYY-MM-DD-HHMMSS-PID.sql.gz
sudo env WIN_TOOLS_BACKUP_CONFIG=/etc/win-tools/backup-config.sh bash /usr/local/libexec/win-tools-backup/restore-files.sh /var/backups/win-tools/files/win_tools_files_YYYY-MM-DD-HHMMSS-PID.tar.gz
```

数据库脚本显示源文件、目标主机/库/账号后，要求依次输入 `RESTORE MYSQL` 和目标 `DB_NAME`。它预先检查目标连接，再通过 MySQL 客户端把 SQL 导入**配置中的现有数据库**。SQL 中的建表/删表语句可覆盖数据；导入中途失败可能留下部分变更，不能当成事务式整库切换。先确保有可用的恢复前备份。

文件脚本显示源文件和五个目标路径后，要求依次输入 `RESTORE FILES` 和归档文件名。它将 Jar、前端、整个 Nginx 配置目录、systemd 单元和整个应用配置目录复制到各目标同文件系统的暂存路径，再逐一重命名切换。原目标保留为同目录 `.before.时间-进程号`，失败时脚本尝试将已切换目标回滚；若回滚本身失败，需依据输出和 `.failed` 文件人工处理。新目录与备份目录需有足够空间。恢复的是归档中的完整目录，包括当时的配置；请审查其他站点配置及 TLS 文件。归档外部路径引用的证书、密钥和依赖需另行准备。脚本不读取 Git 中的示例配置代替真实配置。

完成文件恢复后，人工运行 `sudo nginx -t`、`sudo systemd-analyze verify /etc/systemd/system/win-tools-backend.service`；确认无误再 `sudo systemctl daemon-reload`、重启后端、reload Nginx，并运行 `sudo bash deploy/health-check.sh` 与业务抽查。若目标是全新主机，先按部署手册创建目标目录、MySQL 数据库和服务，再恢复；本脚本要求目标已经存在。保留的 `.before` 文件要在确认业务正常、完成异地备份后由管理员逐项清理。

## 隔离恢复演练

1. 在现有主机运行两种备份，记录归档名、`.sha256`、创建时间和执行结果；将归档及摘要复制到隔离演练主机，运行 `verify-backup.sh`。
2. 演练主机安装同版本 MySQL 8、Nginx 与 Java，创建空的 `win_tools` 库及相同目标目录。将 `WIN_TOOLS_BACKUP_CONFIG` 指向演练主机的独立配置，绝不指向生产 IP 或生产路径；用两次确认分别运行 `restore-mysql.sh`、`restore-files.sh`。
3. 对照备份前记录检查关键表行数和抽样数据、Jar 摘要、前端 `index.html`、Nginx/systemd/应用配置；`nginx -t` 和 `systemd-analyze verify` 均应通过。若含绝对路径证书，演练主机须提供隔离的替代证书。
4. 启动演练服务，检查 `/api/health`、`/actuator/health`、公开资源 API 和 HTTPS 首页；若部署配置已指向演练域名，可运行 `deploy/health-check.sh`。记录恢复用时、失败及手工步骤。

本地行为测试使用临时文件和模拟 MySQL 命令，不会访问生产数据：

```sh
bash -n backup/*.sh backup/tests/*.sh
bash backup/tests/backup-tests.sh
# 安装 shellcheck 的环境再运行：
shellcheck backup/*.sh backup/tests/*.sh
```
