# Phase 11.14.2：标准化部署流程报告

## 阶段目标

为现有 Ubuntu、Nginx、Spring Boot systemd 与 Vue 静态文件部署建立可读的手工脚本，减少替换文件、备份与重启过程中的人工错误。本阶段没有修改业务代码、API、数据库结构或前端功能，也没有连接生产服务器。

## 部署架构

服务器上保留完整项目检出，由部署用户构建前端与后端；切换线上文件及控制服务时使用 sudo。Nginx 继续从 `/var/www/win-tools` 提供静态文件并将 `/api` 转发到本机 Spring Boot；systemd 继续运行 `/opt/win-tools/backend/backend.jar`。`deploy/config.sh` 是服务器本地 Bash 配置，Git 忽略；生产数据库密码仍只放在既有 systemd EnvironmentFile 中。

## 新增脚本

| 文件 | 用途 |
| --- | --- |
| `deploy/config.example.sh` | 路径、服务名、HTTPS 站点地址、健康检查及备份数量上限示例 |
| `deploy/common.sh` | 可信配置读取、危险路径校验、确认、部署锁、备份容量、构建身份与健康重试 |
| `deploy/frontend-deploy.sh` | npm 安装和构建、同文件系统暂存与目录切换、Nginx 校验及 reload |
| `deploy/backend-deploy.sh` | Maven Wrapper 构建、Jar 暂存替换、systemd 停止和启动 |
| `deploy/health-check.sh` | systemd active、HTTPS 首页 HTTP 200、本机 `/api/health` HTTP 200 和 UP |
| `deploy/rollback.sh` | 显示并确认目标快照，保存当前现场，恢复 Jar 和静态目录，启动及健康检查 |
| `deploy/tests/deployment-tests.sh` | 隔离目录中模拟构建、服务与 HTTP，检查部署、备份、失败现场、回滚和路径限制 |

`backend/mvnw` 的 Git 可执行位已设置，确保 Ubuntu 检出后能直接执行 `./mvnw clean package`。脚本使用 `set -euo pipefail`；切换前需要输入精确确认文字，部署并发由备份目录中的锁阻止。

## 备份机制

每次发布会在 `/opt/win-tools/backups/<时间戳>-<进程号>/` 保存配套 `backend.jar` 与 `frontend/`，以及元数据和完成标记。静态目录与备份目录要求在同一文件系统，避免跨文件系统移动造成长时间停站。默认最多允许 10 个快照；达到上限时停止新部署，不自动删除旧版本。回滚为保护现场允许创建额外快照，运维人员须检查磁盘并手工归档、清理旧版本。数据库备份单独按现有部署手册执行。

## 回滚流程

默认选择最新完整快照，也可以显式指定快照名；展示目标后必须输入 `ROLLBACK <快照名>`。脚本先暂存目标文件并保存当前现场，再停止后端、恢复前端与 Jar、启动后端、校验并 reload Nginx，最后执行健康检查。若当前 Jar 或静态目录已经缺失，仍可指定完整快照恢复；可保存的现场文件会写入 `.partial` 快照。部署或回滚失败时保留快照和暂存文件，供人工诊断。

## 本地测试结果

2026-09-27 在 Windows + Git Bash 中验证，均通过：

| 命令 | 结果 |
| --- | --- |
| `bash -n deploy/*.sh deploy/tests/*.sh` | 所有脚本语法通过 |
| `bash deploy/tests/deployment-tests.sh` | 隔离部署、确认拒绝、前端/后端备份、后端健康失败、默认及指定版本回滚、缺件回滚、容量上限及根路径拦截通过 |
| `npm.cmd install` | 成功，依赖审计无漏洞 |
| `npm.cmd test` | 22 个文件、458 项测试通过 |
| `npm.cmd run lint` | 通过，无错误或警告 |
| `npm.cmd run format:check` | 通过 |
| `npm.cmd run build` | 通过，生成 `dist/` |
| `.\mvnw.cmd test` | 245 项测试通过 |
| `.\mvnw.cmd verify` | 245 项测试通过，生成可运行 Jar |

## 已知边界

- Windows 上仅通过 Git Bash 做脚本语法与模拟行为测试；没有在真实 Ubuntu、Nginx、systemd、TLS、MySQL 环境执行发布。当前环境没有 shellcheck，需在 Ubuntu 上补做静态检查和现场验收。
- `/api/health` 是进程存活检查，不证明数据库可用。上线后仍须检查公开数据 API、管理流程和浏览器资源加载。
- 脚本不会清理旧快照、修改系统配置、备份或回滚数据库。达到备份上限后新部署会停止，需人工归档清理。
- 前端目录切换由连续两次重命名完成，中间可能有短暂静态文件不可用窗口；应在维护窗口发布并用 HTTPS 检查确认恢复。
