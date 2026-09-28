# Phase 11.14.4：生产备份与恢复报告

## 1. 阶段目标

为现有 Ubuntu、Spring Boot 3.5.16、MySQL 8、Vue 静态文件、Nginx、systemd 部署增加可审计的生产备份、保留、校验和恢复流程。本阶段只增加 `backup/` 脚本、测试和文档，未修改业务代码、数据库结构或生产服务器 crontab，也未连接生产主机。

## 2. 备份架构

默认将归档保存在 `/var/backups/win-tools/mysql/` 和 `/var/backups/win-tools/files/`，与 `/var/www/win-tools` Web root、Git 检出以及 `deploy/` 发布回滚快照分开。备份根目录和子目录模式为 0700，归档、摘要文件随 `umask 077` 创建。数据库备份、文件备份和恢复共用目录锁，防止彼此并发。每个归档附带 SHA-256 摘要；校验同时检查文件存在、可读、压缩内容完整及文件归档的预期目录结构。SHA-256 只用于发现损坏，不能证明归档来源，应另做加密异地备份。

`BACKUP_KEEP` 默认 7，分别计算 SQL 和文件归档。新归档成功校验后才检查旧归档；删除前输出明确的 `RETENTION` 日志。旧归档校验失败时停止自动删除。部署脚本现有 `deploy/backups` 快照不参与此策略。

## 3. 数据库备份方案

`mysql-backup.sh` 使用 `mysqldump` 导出指定 `DB_NAME` 的表结构与数据，并包含触发器、事件和存储过程。使用 `--single-transaction`、`--quick` 适配 InnoDB；非事务表仍需维护窗口控制写入。默认压缩成 `win_tools_YYYY-MM-DD-HHMMSS-PID.sql.gz`，可通过 `MYSQL_COMPRESS=0` 输出 `.sql`。脚本先写私有暂存文件，生成 SHA-256 并调用 `verify-backup.sh`，失败不留下被视为成功的半成品。MySQL 密码只从 0600 的服务器独立客户端配置文件或临时 `MYSQL_PWD` 环境变量读取，不写在模板或命令行参数中。

## 4. 文件备份方案

`file-backup.sh` 保存当前 `backend.jar`、完整前端静态目录、完整 Nginx 配置目录、`win-tools-backend.service` 和应用配置目录（默认 `/etc/win-tools`），在归档内按 `backend/`、`frontend/`、`config/` 保持结构。输出 `win_tools_files_YYYY-MM-DD-HHMMSS-PID.tar.gz` 并校验。脚本检查内部链接；指向目录树外的链接会保留并输出警告，但其目标文件不包含在归档中。数据库文件、日志、外部 TLS 证书及私钥路径、其他系统服务配置不在此文件归档中。

## 5. 恢复流程

`restore-mysql.sh` 要求指定 `.sql` 或 `.sql.gz`，先检查摘要和可读性，再测试目标数据库连接，显示源文件与目标库；必须依次输入 `RESTORE MYSQL` 和目标数据库名。SQL 导入可能覆盖表和数据；中途失败可能留下部分改动，因此生产使用需停写、预先创建恢复前备份并安排维护窗口。

`restore-files.sh` 要求指定 `.tar.gz`，检查摘要、压缩包结构、目标路径和链接，再显示全部五个目标；必须依次输入 `RESTORE FILES` 和归档文件名。它先在目标文件系统暂存各目录/文件，再切换路径；旧版保留为同目录 `.before.时间-进程号`。切换中途失败时尝试把已切换目标还原；若自动还原也失败，保留 `.failed` 现场供人工处理。脚本不擅自停止、重启或 reload 生产服务。成功后运维人员检查 Nginx 与 systemd 配置，再重启/重载并进行健康及业务检查。目标必须已存在；新主机先按部署手册准备基础服务。

隔离演练的备份创建、归档校验、模拟恢复、数据和文件抽查及 HTTP 健康检查步骤见 [备份恢复手册](backup/README.md)。真实生产恢复需要维护窗口。

## 6. 安全措施

- `backup-config.example.sh` 不含密码；真实 `backup-config.sh`、`.sql`、`.sql.gz`、`.tar.gz` 等归档被 `.gitignore` 排除。测试只使用模拟 MySQL 命令与临时文件。
- 推荐把脚本安装为 root 拥有、普通部署账号不可修改的副本，root 的定时任务不直接执行可写 Git 检出中的代码。MySQL 客户端配置单独放在 `/etc/win-tools` 并限制为 0600。
- 文件归档可能含生产环境变量和 TLS 私钥，需要受限存储、异地加密副本及过期清理。恢复只应使用可信归档；摘要不提供认证。
- 两种恢复均需要两次明确输入确认，备份保留删除逐项输出日志。脚本不修改生产 crontab。

## 7. 测试结果

2026-09-28 在 Windows PowerShell、Git Bash 环境执行：

| 命令 | 结果 |
| --- | --- |
| `bash -n backup/*.sh backup/tests/*.sh` | 通过 |
| `bash backup/tests/backup-tests.sh` | 通过：压缩与非压缩 SQL、文件归档、保留日志、双重确认、校验失败、恢复切换失败回滚 |
| `npm.cmd test`（`frontend/`） | 22 个文件、458 项通过 |
| `npm.cmd run lint`（`frontend/`） | 通过，无 ESLint 错误 |
| `npm.cmd run format:check`（`frontend/`） | 通过 |
| `npm.cmd run build`（`frontend/`） | 通过，静态产物生成 |
| `.\mvnw.cmd test`（`backend/`） | 248 项通过，0 失败 |
| `.\mvnw.cmd verify`（`backend/`） | 248 项通过，Jar 构建成功 |
| `git diff --check` | 通过 |

本地没有 `shellcheck`，因此未执行该可选静态检查。隔离测试使用模拟 MySQL 客户端及项目工作区内的临时目录；真实 MySQL、Nginx、systemd、cron、权限和异地恢复需在授权 Ubuntu 环境进一步验收。

## 8. 生产部署建议

1. 审核脚本与 [备份恢复手册](backup/README.md)，将脚本安装为 root 拥有的只读副本；复制示例为 root 专用配置，设置真实目录及单独的 MySQL 客户端凭据文件。准备 `/var/backups/win-tools`，限制访问并确认磁盘空间。
2. 手动分别运行两种备份和 `verify-backup.sh`，确认生成的 SQL 与文件归档能在隔离主机恢复；记录行数、文件摘要及健康检查结果。
3. 经运维审核后再在 root crontab 安排每日数据库、每周文件备份，配置失败告警、日志轮转、异地加密复制及定期恢复演练。本阶段没有改动生产计划任务。
4. 生产恢复先协调维护窗口和应用停写，选择时间点兼容的数据库与文件归档，保留恢复前快照。恢复后执行 `nginx -t`、`systemd-analyze verify`、服务重启/重载、`deploy/health-check.sh` 和业务抽查，再由运维人员审核清理 `.before` 文件。
