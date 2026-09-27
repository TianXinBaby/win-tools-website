# Ubuntu 手工部署脚本

这些脚本用于现有的 Ubuntu + Nginx + systemd 部署。生产配置保持 `deploy/nginx/win-tools.conf.example` 和 `deploy/systemd/win-tools-backend.service.example` 的路径约定：静态目录 `/var/www/win-tools`、Jar `/opt/win-tools/backend/backend.jar`、服务 `win-tools-backend`。脚本不连接 SSH，不修改数据库、Nginx 配置或 systemd 单元。

## 前置条件与配置

- 服务器上有完整的受信任项目检出，默认位于 `/opt/win-tools`。`frontend/`、`backend/` 和 Maven Wrapper 均须存在；构建用户须能写入源码目录。服务端需安装 Java 18、Node.js（满足 `frontend/package.json` 的 engines）、npm、Nginx、systemd、curl 及 GNU coreutils。Maven 由 Wrapper 下载，首次运行需要网络。
- 现有前端 `index.html` 和 `backend.jar` 必须可用。这些脚本用于**更新**；首次安装仍按 [部署手册](../docs/deployment/tencent-cloud.md) 完成。先确保 systemd 的 EnvironmentFile、Nginx TLS 和 DNS 已配置、可用。
- 从具有 sudo 权限的部署用户运行。脚本经 `sudo` 提权以备份、切换文件和控制服务，但 npm/Maven 构建会由原部署用户执行。不要以直接登录的 root 用户运行。审核检出代码及 npm 生命周期脚本后再部署。
- 在服务器的 `deploy/` 下复制 `config.example.sh` 为 `config.sh`，设置实际路径和 `SITE_URL`。`config.sh` 已被 Git 忽略，仅允许可信管理员编辑；它是 Bash 配置，**不能**把 `/etc/win-tools/win-tools.env` 当作它加载。不要把密码、Token 或私钥写入部署配置。`SITE_URL` 必须是能从服务器访问、证书有效的正式 HTTPS 地址。
- `BACKUP_DIR` 必须是 `PROJECT_DIR/backups`，且与 `FRONTEND_DIR` 在同一文件系统，以便静态目录通过目录重命名切换。备份目录权限设为 0700。配置中的 `BACKUP_LIMIT` 默认 10；达到上限后新部署停止，由管理员核实、异地归档并手工清理旧快照。脚本绝不自动删除快照；紧急回滚可额外创建一个保护现场的快照，之后应立即检查容量。
- 这些脚本不替代部署前的 MySQL 备份。涉及数据库变更时，先按部署手册单独备份并评审兼容性；回滚脚本只恢复 Jar 和静态文件。

## 执行方式

在服务器项目目录下，先确认 Git 版本、磁盘空间和服务状态：

```sh
cd /opt/win-tools
git status --short --branch
sudo bash deploy/health-check.sh
sudo bash deploy/frontend-deploy.sh
sudo bash deploy/backend-deploy.sh
sudo bash deploy/health-check.sh
```

两个部署脚本分别构建并部署对应组件：

| 脚本 | 构建与切换 | 结束检查 |
| --- | --- | --- |
| `frontend-deploy.sh` | `npm ci`、`npm run build`；将 dist 复制到 Web root 同级暂存目录，保存当前前端与 Jar，重命名切换静态目录 | `nginx -t`、reload、完整健康检查 |
| `backend-deploy.sh` | `./mvnw clean package`；保存当前 Jar 与静态目录，停止服务后原子替换 Jar，启动服务 | 重试完整健康检查 |
| `health-check.sh` | 不修改文件 | 验证 systemd active、HTTPS 首页 HTTP 200、本机 `/api/health` HTTP 200 且返回 UP |

构建和预检查通过后，部署脚本才会要求分别输入 `DEPLOY FRONTEND` 或 `DEPLOY BACKEND`。确认前不会切换线上文件。`set -euo pipefail` 使失败立即停止；后端健康检查默认每 2 秒尝试一次，最多 30 次。健康接口只代表进程存活，发布后还须核验依赖数据库的公开 API 与管理流程。

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

## 本地验证与边界

Windows 下可使用 Git Bash 检查语法和隔离的脚本行为；真实 systemd/Nginx/TLS 部署验收只能在授权的 Ubuntu 主机进行：

```sh
bash -n deploy/*.sh deploy/tests/*.sh
bash deploy/tests/deployment-tests.sh
# Ubuntu 上安装 shellcheck 后：
shellcheck deploy/*.sh deploy/tests/*.sh
```

隔离测试模拟构建、服务管理和 HTTP 响应，不会访问生产站点。脚本不自动部署到服务器，也不处理系统配置、证书或数据库回滚。
