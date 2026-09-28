# Phase 11.15 — Production Release & Full Regression 报告

记录日期：2026-09-28。结论：**Production Verification Pending**。本阶段只在本地检查、编写发布资料与测试只读脚本；没有连接真实生产服务器、生产 MySQL 或管理员后台，没有执行生产 SQL、备份、部署、恢复、回滚或正式发布。

## 1. 阶段目标

对 Phase 11.14.5 后的发布候选版本完成前后端、Shell 和 CI 配置回归，建立 SQL 与生产发布清单，以及仅用公开 GET 请求的 Smoke Test。整理备份、部署、监控、性能、回滚和人工验收顺序，不增加业务功能或数据库结构。

## 2. Release Candidate 状态

本地回归与构建通过，可作为**待现场验收的 Release Candidate**。检查时远端 `main` 位于 `be752c9`（Phase 11.14.4），本候选分支基于 `5a9bbf1`（Phase 11.14.5）；合入 `main` 仍需审核。本报告不宣称已生产发布，也不决定版本号或创建 Git tag。真实环境的 MySQL、Nginx、TLS、systemd、权限、日志、备份及浏览器人工验收未执行，故不能标记为 Production Verified。

## 3. 本地完整回归结果

| 范围与命令 | 结果 |
| --- | --- |
| `frontend/`: `npm.cmd test` | 22 个测试文件，**458 项通过**。 |
| `frontend/`: `npm.cmd run lint` | 通过，零 ESLint 错误或警告。 |
| `frontend/`: `npm.cmd run format:check` | 通过。 |
| `frontend/`: `npm.cmd run build` | 通过；`dist/` 73 个文件、**497,871 B**（未压缩文件大小总和）。 |
| `backend/`: `.\mvnw.cmd test` | **248 项通过**，0 失败、0 错误、0 跳过。 |
| `backend/`: `.\mvnw.cmd verify` | **248 项通过**，生成 `backend-0.0.1-SNAPSHOT.jar`，**35,455,564 B**。 |
| `bash -n deploy/*.sh deploy/tests/*.sh backup/*.sh backup/tests/*.sh` | Git Bash 下通过，包括新增脚本。 |
| `bash deploy/tests/deployment-tests.sh` | 隔离部署、健康、性能与回滚场景通过。 |
| `bash backup/tests/backup-tests.sh` | 隔离备份、校验、恢复确认及失败处理场景通过。 |
| `bash deploy/tests/production-smoke-tests.sh` | 模拟成功、HTTP/TLS/内容失败、Actuator 泄露及非法 origin 等场景通过；没有访问生产站点。 |
| `.cache/actionlint/actionlint.exe .github/workflows/frontend-ci.yml .github/workflows/backend-ci.yml` | 通过，无 workflow 静态错误。 |

本机未安装 `shellcheck` 或 Nginx，因此未执行 ShellCheck 和真实 `nginx -t`。Maven 测试使用 H2；测试日志中的预期 WARN/ERROR 来自错误处理与安全边界用例，不代表生产现场状态。

## 4. CI 状态

`.github/workflows/frontend-ci.yml` 和 `backend-ci.yml` 均存在，保留 `push` 与 `pull_request` 触发，没有自动部署步骤。前端 CI 使用 Node.js 24.20.0 并执行 install/test/lint/format/build；后端 CI 使用 Temurin Java 18 并执行 test/verify。本地 actionlint 校验通过。

首次推送 `fd5cbe1` 后，[Frontend CI](https://github.com/TianXinBaby/win-tools-website/actions/runs/36434545957) 成功；[Backend CI](https://github.com/TianXinBaby/win-tools-website/actions/runs/36434545741) 在 `./mvnw test` 失败。日志中的首个根因是 Java 18 在 GitHub Linux runner 读取 cgroup 信息时，Actuator `processorMetrics` 创建触发 `anyController` 为空的异常；随后 229 项测试出现 ApplicationContext 加载连锁错误。本地 Windows 248 项测试通过，无法替代 Linux CI。

经用户选择，后端 CI 的 `test` 与 `verify` 两个步骤各自通过 `JDK_JAVA_OPTIONS=-XX:-UseContainerSupport` 关闭该 runner 中的 JVM 容器资源探测，不更换 Java 18、不跳过测试、不修改生产 JVM 或健康检查配置。修复提交 `ed86238` 的 [Frontend CI](https://github.com/TianXinBaby/win-tools-website/actions/runs/36435273591) 与 [Backend CI](https://github.com/TianXinBaby/win-tools-website/actions/runs/36435273633) 均已成功；后端 `test` 与 `verify` 步骤均完成。最终文档提交仍需按发布清单核对自身 CI；生产 Java 18 启动与 Actuator 健康检查仍是现场阻塞验收项。私有仓库尚未确认有 required status checks 门禁。

## 5. SQL 检查结果

`sql/` 有 `init.sql`、`seed-dev.sql` 和 Phase 11.11.2/11.11.3/11.11.4 三个娱乐工具目录脚本。本阶段**新增 SQL 为零**。`seed-dev.sql` 不需要在生产执行；其余脚本是否曾在真实生产运行，仓库无证据，均标为**需要人工确认**。详细逐项核对、只读查询和备份先决条件见 [Production SQL Checklist](PRODUCTION_SQL_CHECKLIST.md)。未做生产迁移。

## 6. Production Checklist

[Production Release Checklist](PRODUCTION_RELEASE_CHECKLIST.md) 覆盖发布前版本与 CI、Jar/dist、资源与服务状态；MySQL/文件备份及校验；后端和前端切换；Nginx；健康与浏览器回归；监控；最终继续/回滚决定。它是待现场填写的验收表，不是已通过记录。

## 7. Smoke Test 设计

`deploy/production-smoke-test.sh` 要求 `BASE_URL` 为纯 HTTPS origin，使用可信证书、不跟随跳转，顺序执行 11 个公开 GET：`/`、`/windows`、`/tools`、`/articles`、`/favorites`、`/tools/json`、`/api/health`、`/api/windows`、`/api/tools`、`/api/articles`、`/actuator/health`。页面必须返回 200、HTML 与同一 Vue SPA 入口；API 必须返回 200、JSON、成功 envelope，health 为 UP；公网 Actuator 必须为 404。任何网络、TLS、状态或内容失败返回非零。脚本不加载管理员凭据、不保存 Cookie、不修改数据库或服务。仅模拟测试已通过，真实域名未请求。

## 8. Security Checklist

发布清单要求现场核对 HTTP→HTTPS、可信 TLS、Session Cookie 的 Secure/HttpOnly/SameSite、CSRF、统一错误登录、不存在默认管理员密码、Actuator 公网 404、8080/3306 网络隔离以及缓存和安全头。代码审查见生产 profile 中 `secure: ${SESSION_COOKIE_SECURE:true}`、`http-only: true`、`same-site: lax`，以及 Nginx 示例的 `/actuator` 拒绝和 API 回环代理。**示例配置不证明线上实际配置**；没有关闭 CSRF，也没有做攻击性测试。

## 9. Admin 人工验收

发布清单列明 `/admin/login`、成功登录、Dashboard、工具搜索/分类/状态筛选、经批准记录的启停与排序、文章状态筛选、退出及退出后 `/admin` 不可访问；CSRF 必须保持启用。所有管理员步骤待真实现场由授权人员手工执行，不能将生产密码或 Session Cookie 写入脚本、日志或报告。

## 10. Tools 回归

发布清单逐项列出 5 个基础工具、4 个媒体工具和 12 个娱乐工具，共 21 个页面；要求直接访问、刷新、交互、Console/Network 检查及浏览器本地处理确认。Voice Ball 的 HTTPS secure context、麦克风授权、用户手势和离页后 track 释放必须用真实浏览器与设备人工验证。前端 458 项单元测试通过，但不能替代这些现场步骤。

## 11. Performance 验收

`deploy/performance-check.sh` 的隔离测试通过；现场应顺序记录首页、公开 API、回环 health、Actuator 的响应时间、内存、Swap、磁盘和 systemd 状态，作为实际基线。Nginx gzip、哈希资源长期缓存、HTML 重新验证与 API 不缓存须检查真实响应头。没有真实生产延迟数据，因此不设虚构的毫秒阈值，也不做高并发压测。

## 12. Monitoring 验收

仓库配置含 `application.log`、`error.log` 的 Logback 日期/大小滚动、systemd journal 与 Nginx access/error log；本地配置和已有测试通过。现场仍须核对日志目录写入/读取权限、logrotate、持续错误、`free -h` 与 `df -h`，不得用 `chmod 777` 修复权限。

## 13. Backup 验收

`mysql-backup.sh`、`file-backup.sh`、`verify-backup.sh` 的隔离行为测试及所有备份脚本语法通过。现场须生成并验证真实归档、记录版本和权限，并在隔离环境演练可恢复性。恢复脚本本阶段只检查语法、文档及双重确认机制；**没有执行生产数据库恢复**，也没有修改 crontab 或删除生产备份。

## 14. Rollback 验收

`deploy/rollback.sh` 在隔离测试中可按快照 ID 选择版本、提示确认、保留被替换版本并在切换后执行严格健康检查；现场仍须核验真实快照与目标。回滚到 Phase 11.14.2 或更早、没有 Actuator 的旧 Jar 时，新版健康检查可能非零。发布清单要求人工核对 `/api/health`、`systemctl status`、`journalctl`、HTTPS 首页和公开 API，不降低当前版健康标准。数据库恢复不属于普通回滚。

## 15. 尚未完成的真实生产验证

- 当前 commit 的 GitHub Actions 实际运行与发布分支/`main` 审核状态。
- 生产 SQL 导入历史、真实 MySQL 8 结构及目录记录。
- 服务器磁盘、内存、Swap、systemd、Nginx/TLS、安全组、Cookie 与 CSRF 行为。
- 真正的 MySQL/文件备份、校验和隔离恢复演练；部署快照及回滚演练。
- 真实域名 Smoke Test、浏览器 21 项工具、管理员人工流程、日志与性能基线。

## 16. 最终发布建议

保持 **Production Verification Pending**。在获授权的维护窗口按两份生产清单完成备份、SQL 决定、部署、只读 Smoke Test、安全与人工回归，并由负责人签收后，再决定继续上线、回滚及正式版本号/Tag。当前不创建 `v1.0.0` 或其他正式 Git tag。
