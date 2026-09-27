# Phase 11.14.3：生产日志与监控报告

## 1. 阶段目标

在现有 Ubuntu、systemd、Spring Boot 3.5.16、Nginx 和 Vue 静态部署上增加文件日志、健康检查与只读状态查看。保留业务 API、数据库结构、管理员认证和前端页面。本阶段未连接生产服务器，也未部署到服务器。

## 2. 日志架构

`logback-spring.xml` 将同一事件输出到控制台（供 systemd journal 收集）和 `application.log`；ERROR 事件额外写入 `error.log`。每条日志包含时间、级别、线程、完整类名和消息。文件按日期及单文件 20 MB 滚动，压缩归档为 `application.YYYY-MM-DD.N.log.gz`、`error.YYYY-MM-DD.N.log.gz`；保留 14 天，应用归档总量上限 1 GB，错误归档上限 512 MB。日志文件和归档由 `logs/` 忽略规则排除在 Git 外。

生产通过 `WIN_TOOLS_LOG_DIR=/opt/win-tools/logs` 指定目录。systemd 保留 journal，并以非 root 服务用户和 `UMask=0077` 运行；日志目录需预先由运维人员创建，权限 0700。开发或测试未设置该变量时写入后端工作目录的 `logs/`。

Nginx 为 HTTP 跳转站点和 HTTPS 站点统一写入 `/var/log/nginx/win-tools-access.log` 与 `/var/log/nginx/win-tools-error.log`。访问日志使用最小格式，仅含时间、方法、状态、响应字节数、请求耗时和上游状态，不记录 IP、URI、查询串、请求头或正文；错误日志保持 `error` 级别。需由运维人员确认系统 logrotate 覆盖这两个 `.log` 文件，并限制读取权限。

## 3. 监控架构

- `/api/health` 继续返回原有统一 JSON，作为不依赖数据库的进程存活检查。
- 本机 `/actuator/health` 使用 Spring Boot 默认健康贡献者，包含可用时的数据源和磁盘空间检查；只返回整体状态。`/actuator/info` 当前返回空 JSON。
- `deploy/health-check.sh` 依次检查后端 systemd 服务、HTTPS 首页、原有健康接口和 Actuator health。任何步骤失败都返回非零；部署与回滚沿用此检查。
- `deploy/status-check.sh` 只读显示后端服务、配置中的回环端口（默认 8080）、Nginx 服务、项目磁盘空间和内存。它在状态异常时仍显示其余项目，最终返回非零。

本阶段没有新增管理员 Dashboard 页面、监控业务接口或大型监控服务。

## 4. Actuator 配置

新增 `spring-boot-starter-actuator`，沿用 Spring Boot 3.5.16 依赖管理。管理端点默认不可访问，整体最大权限限定为只读；仅 `health`、`info` 获得只读权限并通过 HTTP 暴露。JMX 暴露与 `/actuator` 发现页关闭；健康组件及详情始终隐藏。`metrics`、`env`、`logfile` 等端点在后端返回 404。

生产后端继续只绑定 `127.0.0.1`。Nginx 对 `/actuator` 和 `/actuator/` 返回 404，不向公网代理管理端点；原 `/api` 转发和 HTTPS 配置不变。配置依据：[Spring Boot 3.5 Actuator 端点文档](https://docs.spring.io/spring-boot/3.5/reference/actuator/endpoints.html)、[日志文档](https://docs.spring.io/spring-boot/3.5/reference/features/logging.html)。

## 5. 安全说明

生产配置示例只引用环境变量，不含真实密码、密钥或 Token。文件日志目录与 systemd EnvironmentFile 都须限制权限，且不能放在 Web root。访问日志不采集客户端地址或请求目标；Nginx 错误日志及底层库日志仍可能包含诊断内容，分享前须脱敏。现有 Session、CSRF、管理员权限和业务响应未更改。

## 6. 新增和主要修改文件

| 文件 | 用途 |
| --- | --- |
| `backend/src/main/resources/logback-spring.xml` | 控制台、应用和错误文件日志及滚动策略 |
| `backend/pom.xml`、`backend/src/main/resources/application.yml` | Actuator 依赖、最小端点暴露和日志目录配置 |
| `deploy/application-prod-example.yml` | 无密钥的有效生产配置参考 |
| `deploy/status-check.sh` | 只读服务、端口、磁盘与内存状态 |
| `deploy/health-check.sh`、`deploy/tests/deployment-tests.sh` | Actuator 健康检查与失败路径模拟测试 |
| `deploy/nginx/win-tools.conf.example`、`deploy/systemd/win-tools-backend.service.example`、`deploy/env/win-tools.env.example` | 安全访问日志、公网 Actuator 拦截和生产日志目录 |
| `backend/src/test/java/com/xiaoc/backend/config/ProductionConfigurationTests.java`、`backend/src/test/java/com/xiaoc/backend/controller/ProductionHardeningTests.java` | 配置、端点暴露、日志写入与滚动策略测试 |
| `.gitignore`、`README.md`、`deploy/README.md`、`docs/deployment/tencent-cloud.md` | 忽略日志及更新部署说明 |

## 7. 测试结果

2026-09-27 在 Windows PowerShell 与 Git Bash 执行：

Maven 命令在 `backend/` 目录执行，npm 命令在 `frontend/` 目录执行，Bash 命令在仓库根目录执行。

| 命令 | 结果 |
| --- | --- |
| `.\mvnw.cmd test` | 248 项通过，0 失败 |
| `.\mvnw.cmd verify` | 248 项通过，Jar 构建成功 |
| `npm.cmd test` | 22 个文件、458 项通过 |
| `npm.cmd run lint` | 通过，无 ESLint 错误或警告 |
| `npm.cmd run build` | 通过，生成静态产物 |
| `bash -n deploy/*.sh deploy/tests/*.sh` | 通过（Git Bash） |
| `bash deploy/tests/deployment-tests.sh` | 通过：部署/回滚及新增 Actuator、状态异常路径 |
| `git diff --check` | 通过 |

测试实际启动了生产 profile 的后端容器，验证 `/actuator/health` 精确响应、`info` 空 JSON、敏感端点 404，并检查 Logback 将 INFO/ERROR 写到对应文件以及日期滚动策略和 14 天保留。`shellcheck`、`nginx` 与 `systemd-analyze` 在本地环境未安装，因此无法在此执行它们的静态或现场检查。

## 8. 部署注意事项

1. 在服务器上先创建 `/opt/win-tools/logs`，owner 为 `win-tools`，模式为 0700；更新实际 EnvironmentFile 和 systemd 单元中的 `WIN_TOOLS_LOG_DIR`。核对日志目录不在 Web root 内。
2. 在 Nginx `http {}` 中使用更新的示例；保留实际域名与 TLS 证书路径。先运行 `sudo nginx -t`，成功后再 reload。确认公网 `/actuator/health` 为 404，回环地址为 200，8080 不对公网开放。
3. 从 Phase 11.14.2 升级时，先发布新版后端，再运行增强后的 `health-check.sh`。旧 Jar 没有 Actuator，增强检查在升级前必然失败；本阶段前端没有变更，无须重发。
4. 运行 `sudo systemd-analyze verify /etc/systemd/system/win-tools-backend.service`、`sudo bash deploy/status-check.sh`、`sudo bash deploy/health-check.sh`，并核对 `application.log`、`error.log`、journal 和 Nginx 日志。确认 Ubuntu logrotate 实际覆盖 Nginx 的新日志文件。
5. 如果回滚到 Phase 11.14.2 或更早 Jar，新版严格健康检查会因缺少 `/actuator/health` 返回非零。须人工核对 systemd、HTTPS 首页、原 `/api/health`、公开数据 API 与管理流程，区分旧版监控能力缺失和业务故障。

真实 Ubuntu、Nginx、systemd、MySQL 与 TLS 的部署后验收仍需在授权服务器上执行。
