# Ubuntu 手工部署脚本

这些脚本用于现有的 Ubuntu + Nginx + systemd 部署。生产配置保持 `deploy/nginx/win-tools.conf.example` 和 `deploy/systemd/win-tools-backend.service.example` 的路径约定：静态目录 `/var/www/win-tools`、Jar `/opt/win-tools/backend/backend.jar`、服务 `win-tools-backend`。脚本不连接 SSH，不修改数据库、Nginx 配置或 systemd 单元。

## 前置条件与配置

- 服务器上有完整的受信任项目检出，默认位于 `/opt/win-tools`。`frontend/`、`backend/` 和 Maven Wrapper 均须存在；构建用户须能写入源码目录。服务端需安装 Java 18、Node.js（满足 `frontend/package.json` 的 engines）、npm、Nginx、systemd、curl、GNU coreutils、`ss`（iproute2）及 `free`（procps）。Maven 由 Wrapper 下载，首次运行需要网络。
- 现有前端 `index.html` 和 `backend.jar` 必须可用。这些脚本用于**更新**；首次安装仍按 [部署手册](../docs/deployment/tencent-cloud.md) 完成。先确保 systemd 的 EnvironmentFile、Nginx TLS 和 DNS 已配置、可用。
- 从具有 sudo 权限的部署用户运行。脚本经 `sudo` 提权以备份、切换文件和控制服务，但 npm/Maven 构建会由原部署用户执行。不要以直接登录的 root 用户运行。审核检出代码及 npm 生命周期脚本后再部署。
- 在服务器的 `deploy/` 下复制 `config.example.sh` 为 `config.sh`，设置实际路径和 `SITE_URL`。`config.sh` 已被 Git 忽略，仅允许可信管理员编辑；它是 Bash 配置，**不能**把 `/etc/win-tools/win-tools.env` 当作它加载。不要把密码、Token 或私钥写入部署配置。`SITE_URL` 必须是能从服务器访问、证书有效的正式 HTTPS 地址。
- `BACKUP_DIR` 必须是 `PROJECT_DIR/backups`，且与 `FRONTEND_DIR` 在同一文件系统，以便静态目录通过目录重命名切换。备份目录权限设为 0700，已被 Git 忽略。配置中的 `BACKUP_LIMIT` 默认 10；达到上限后新部署停止，由管理员核实、异地归档并手工清理旧快照。脚本绝不自动删除快照；紧急回滚可额外创建一个保护现场的快照，之后应立即检查容量。
- 这些脚本不替代部署前的 MySQL 备份。涉及数据库变更时，先按部署手册单独备份并评审兼容性；回滚脚本只恢复 Jar 和静态文件。
- 在首次启动新版 Jar 前创建日志目录：`sudo install -d -o win-tools -g win-tools -m 0700 /opt/win-tools/logs`。systemd 示例和 EnvironmentFile 示例均设置 `WIN_TOOLS_LOG_DIR=/opt/win-tools/logs`；已有服务器的实际配置也须同步更新。生产配置可对照 [无密钥示例](application-prod-example.yml)。日志目录不可放在 `/var/www/win-tools` 中。

## 执行方式

在服务器项目目录下，先确认 Git 版本、磁盘空间和服务状态：

```sh
cd /opt/win-tools
git status --short --branch
sudo bash deploy/status-check.sh
curl --fail http://127.0.0.1:8080/api/health
sudo bash deploy/backend-deploy.sh
sudo bash deploy/health-check.sh
```

只有前端产物变更时才执行 `sudo bash deploy/frontend-deploy.sh`。两个部署脚本分别构建并部署对应组件：

从 Phase 11.14.2 升级时，先部署新版后端；旧 Jar 没有 Actuator，新版 `health-check.sh` 在升级前会返回非零。此阶段前端没有变更，无须单独发布前端。

| 脚本 | 构建与切换 | 结束检查 |
| --- | --- | --- |
| `frontend-deploy.sh` | `npm ci`、`npm run build`；将 dist 复制到 Web root 同级暂存目录，保存当前前端与 Jar，重命名切换静态目录 | `nginx -t`、reload、完整健康检查 |
| `backend-deploy.sh` | `./mvnw clean package`；保存当前 Jar 与静态目录，停止服务后原子替换 Jar，启动服务 | 重试完整健康检查 |
| `health-check.sh` | 不修改文件 | 验证 systemd active、HTTPS 首页、本机 `/api/health` 和 `/actuator/health` 都返回 HTTP 200 与 UP；任一失败返回非零 |
| `status-check.sh` | 不修改文件 | 显示 backend 和 Nginx 服务、回环 8080 端口、磁盘与内存；服务或端口异常时返回非零 |

构建和预检查通过后，部署脚本才会要求分别输入 `DEPLOY FRONTEND` 或 `DEPLOY BACKEND`。确认前不会切换线上文件。`set -euo pipefail` 使失败立即停止；后端健康检查默认每 2 秒尝试一次，最多 30 次。`/api/health` 只代表进程存活；Actuator health 包括框架默认健康贡献者（如数据源和磁盘空间），发布后仍须核验公开 API 与管理流程。

应用日志在 `/opt/win-tools/logs/application.log` 和 `error.log`，同时保留 `journalctl -u win-tools-backend`；归档按天及单文件 20 MB 滚动，保留 14 天，应用归档总量上限 1 GB、错误归档 512 MB。`application.log` 包含 ERROR，`error.log` 是便于排障的单独副本。Nginx 访问与错误日志分别在 `/var/log/nginx/win-tools-access.log`、`win-tools-error.log`；访问日志仅含时间、方法、状态、字节数、耗时和上游状态，不含 IP、URL、查询串、Cookie、Authorization 或正文。限制日志读取权限，确认 Ubuntu 的 Nginx logrotate 覆盖这两个文件，定期检查磁盘；分享日志前仍须脱敏。

每次部署前在 `BACKUP_DIR/<年月日-时分秒纳秒>-<进程号>/` 保留同一时刻的 `backend.jar`、`frontend/`、`metadata.txt` 和 `.complete` 标记。前端切换与回滚使用同文件系统重命名；后端 Jar 在自身目录内暂存后替换。构建、切换、reload 或健康检查失败时，脚本返回非零且保留快照和可能的暂存文件，不自动清理。检查输出、`journalctl -u win-tools-backend` 与 Nginx 错误日志，再决定回滚。

静态目录切换有连续两次重命名，期间可能短暂返回 404；请在维护窗口发布。

## 回滚

`rollback.sh` 默认选择时间最新的完整快照，也可指定快照目录名；脚本先显示目标版本及元数据，再要求输入 `ROLLBACK <快照名>`。回滚会先把**当前** Jar 与前端保存为新的快照，然后停服务、切换前端与 Jar、启动、reload Nginx，并再次执行健康检查。

```sh
sudo ls -1 /opt/win-tools/backups
sudo bash deploy/rollback.sh
# 或者指定已核验的快照：
sudo bash deploy/rollback.sh 2026-09-27-220012123456789-12345
```

若线上前端目录或 Jar 已因中断而缺失，仍可指定完整快照回滚；脚本将可用的现场文件保存到新快照，并以 `.partial` 标记不完整现场。若回滚本身中断，检查 `BACKUP_DIR` 中的完整快照及暂存目录，确认当前前端目录和 Jar 后再操作。不要在未核对目标时反复执行默认回滚；回滚产生的新完整快照可能成为下一次默认目标。服务重启会使内存 Session 失效，管理员需要重新登录。

回滚到 Phase 11.14.2 或更早的 Jar 时，它没有 `/actuator/health`，新版严格健康检查会返回非零；即使旧服务和原有 `/api/health` 已恢复，回滚脚本也会报告失败。此时人工核对 systemd、HTTPS 首页、`/api/health`、公开数据 API 与管理流程，再决定是否继续使用旧版；不要把缺少 Actuator 误判为旧版业务故障。

## 本地验证与边界

Windows 下可使用 Git Bash 检查语法和隔离的脚本行为；真实 systemd/Nginx/TLS 部署验收只能在授权的 Ubuntu 主机进行：

```sh
bash -n deploy/*.sh deploy/tests/*.sh
bash deploy/tests/deployment-tests.sh
# Ubuntu 上安装 shellcheck 后：
shellcheck deploy/*.sh deploy/tests/*.sh
```

隔离测试模拟构建、服务管理和 HTTP 响应，不会访问生产站点。脚本不自动部署到服务器，也不处理系统配置、证书或数据库回滚。
