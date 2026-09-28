# Phase 11.14.5：生产性能基线与轻量优化报告

## 1. 阶段目标与测量边界

记录可重复的前端构建体积，审查路由、静态资源、Nginx、后端/JVM 和数据库查询，在不改业务语义、API、表结构或安全控制的前提下处理有依据的配置问题。2026-09-28 在 Windows 本地测量构建产物并运行测试；没有连接生产 Ubuntu、Nginx、MySQL，也没有真实请求延迟、GC、RSS 或 MySQL EXPLAIN 数据。因此下文不声明实际线上提速。

## 2. 优化前性能基线

在未修改前执行 `frontend/` 下的 `npm.cmd run build`，Vite 8.3.0 构建成功，转换 1785 个模块。以 PowerShell `Get-ChildItem dist -Recurse -File` 按扩展名汇总未压缩文件字节：

| 项目 | 文件数 | 大小 |
| --- | ---: | ---: |
| `dist/` 总体 | 73 | 497,871 B |
| JavaScript | 55 | 422,958 B |
| CSS | 16 | 73,814 B |
| HTML | 1 | 899 B |
| SVG | 1 | 200 B |

最大 JS chunk 是 `index-BUjnhHck.js`，106,307 B（Vite 输出的 gzip 估算为 39.79 kB）；其后是 `adminRequest-ZVHvAS8E.js` 66,039 B、`runtime-core.esm-bundler-DQp1PQTM.js` 64,927 B、`request-CPnaysS_.js` 51,935 B。最大 CSS 为 `index-2qr94n9L.css` 50,543 B。主要延迟加载产物包括二维码页 26,982 B、共享图片面板 11,862 B、娱乐工具页约 1.6–4.6 kB、Admin 页面约 1.4–2.4 kB（另有共享 `adminRequest`）、文章详情页约 1.6 kB。文件大小不是首屏网络传输量；实际请求集合需在浏览器 Network 面板确认。

`frontend/src/router/index.js` 中首页、Windows、工具、文章、Admin 布局及各 Admin 页面、全部娱乐和图片工具页均为动态 import。`frontend/src/main.js` 只注册五个基础 Element Plus 组件；后台专用组件和样式位于 Admin 路由代码中。项目内图像资源只有 200 B 的 favicon；`frontend/win-tools-frontend.zip` 为已有 164,772 B 仓库文件，不进入 `dist/`，未删除或修改。

## 3. 实施的优化与验证

| 当前问题与依据 | 修改内容 | 预期收益 | 风险与控制 | 验证方法 |
| --- | --- | --- | --- | --- |
| Nginx 示例的 `/assets/` 仅 `try_files`，未设置缓存；本次 Vite 输出的 55 个 JS 和 16 个 CSS 均为内容哈希文件 | 在 `http {}` 使用 `$uri` 映射，仅给 `/assets/` 哈希 JS/CSS 设置 `public, max-age=31536000, immutable` | 重复访问可复用未变化的静态文件 | 未哈希文件放入 `/assets/` 会长期陈旧；映射只匹配当前哈希命名，发布前检查产物。服务器级 `add_header` 保留安全头继承 | 隔离配置断言；生产 `nginx -t`、请求实际哈希文件并核对 Cache-Control |
| 原 `index.html` 通过 `expires -1` 禁止长期缓存，需要同时避免 SPA 深链接读到旧入口 | 在同一映射中为 `/`、`/index.html` 设置 `no-cache`；SPA fallback 保留 | 浏览器可重新验证入口文件，及时获得新哈希引用 | HTTP 缓存行为需在实际 Nginx 核对；深链接仍须人工刷新验收 | 请求 `/`、`/admin/windows` 并核对响应头和页面内容 |
| Nginx 示例未启用 gzip，构建中有 106 kB 主 JS、50 kB 主 CSS 等可压缩文本 | 在 HTTPS server 启用 gzip、Vary、1024 B 门槛及 CSS/JS/JSON/SVG 类型；HTML 由 Nginx 默认处理 | 支持 gzip 的客户端可减少文本传输字节 | 压缩消耗少量 CPU；保留默认压缩级别并限制为文本类型 | 请求大 JS 时发送 `Accept-Encoding: gzip`，核对 `Content-Encoding`、页面功能和 CPU |
| 原 systemd 示例无用户给出的生产堆边界 | 示例 ExecStart 显式采用 `-Xms256m -Xmx768m`，不增加最大堆 | 应用示例时维持已知堆上限，避免无意变为 JVM 自动估算 | 真实单元与进程参数可能不同；部署前后检查 `systemctl cat`、`ps`、整机内存和 journal | 本地示例断言；生产内存及服务检查 |
| 缺少统一、低负载的验收采样入口 | 新增 `deploy/performance-check.sh`，顺序各请求一次首页、公开工具 API、回环健康 API 与 Actuator，并显示时间、服务、内存、磁盘 | 便于在相同环境重复记录状态和延迟，定位明显回归 | 单次样本有网络波动，不能代表 P95 或浏览器体验；脚本不使用并发、写入或管理员凭据 | 隔离 mock 测试验证四次请求、非 200 失败与无服务变更 |

Nginx 缓存映射对其他 URI 返回空值，不给 `/api`、`/api/admin/*` 或 CSRF 响应新增缓存头；管理员/CSRF 响应已有的 `no-store` 不被隐藏。原 HTTPS 301、TLS、API proxy、SPA fallback、公网 `/actuator` 404、`microphone=(self)` 和其他安全头保留。真实 Nginx/TLS 环境尚未运行，必须按第 10 节验收。

## 4. 未实施的优化及原因

- 路由已经按页面加载；没有为小页面重复拆包，也没有修改 Element Plus 的现有按需引用。
- 没有删除仓库归档或用户提供的图片 URL；这些不在本次 `dist/` 中，且删除可能影响用户资料。
- 没有加 Redis、CDN、额外依赖、Tomcat/Hikari 大规模参数或更大的 Xmx；缺少现场吞吐、内存和连接等待数据。
- 没有改 API 列表字段、分页、管理员文章正文返回或数据库索引；这些都可能改变业务/API，且未取得真实行数及 EXPLAIN。

## 5. 前端构建体积变化

修改后再次执行同一 `npm.cmd run build`，产物文件名与大小相同：`dist/` 497,871 B、JS 422,958 B、CSS 73,814 B，变化均为 **0 B**。本阶段的预期网络收益来自尚未部署的 Nginx gzip 和缓存策略，未测得真实传输或页面耗时改善。

## 6. Nginx 配置评估

原配置已有 `/assets/` 缺失资源 404、`index.html` 不长期缓存、API 回环代理、Actuator 公网拒绝和完整安全头，故复用现有 location。新增映射放在 `http {}`，缓存头放在 server 级，避免 location 级 `add_header` 覆盖安全头。API 未启用 proxy cache；认证、Session 与 CSRF 行为不变。`nginx` 本地未安装，未执行 `nginx -t`；生产部署前必须运行。

## 7. 后端与 JVM 评估

`application-prod.yml` 设定 SQL `NoLoggingImpl`、root 及相关组件 INFO，关闭详细请求日志和 Tomcat access log；没有 DEBUG SQL 输出。Actuator 仅 HTTP 暴露只读 health/info，细节隐藏，JMX 关闭；Nginx 拒绝公网访问。未修改 Java 配置、业务代码、线程池或连接池。给定主机约 2 GiB RAM + 2 GiB Swap，示例保持 Xms 256 MiB / Xmx 768 MiB。Xmx 只是 Java 堆上限，不是进程 RSS 上限；需在生产同时观察 MySQL、Nginx、系统可用内存、Swap 与 journal。当前无启动时间或内存前后对比数据。

## 8. 数据库查询评估

| 路径 | 代码检查结果 | 后续测量条件 |
| --- | --- | --- |
| 公开 Windows、Tools | 列表各一次 `selectList`，详情各一次条件查询；按已有 `status`、`sort_order` 等字段排序，无逐行再查 | Windows 列表还按 `release_date` 排序；只有实际慢查询和 EXPLAIN 显示排序代价时才评估索引 |
| 公开 Articles | 列表只投影摘要等列，不加载 LONGTEXT 正文；详情单次按 id/status 查询；按创建时间和 id 排序 | 现有 `(status, created_at, id)` 索引；需用真实数据 EXPLAIN 核实 |
| Admin CRUD | 各列表一次查询，新增/修改按现有语义再读取详情；文章管理列表包含正文，可能随文章量增加变大 | 保持返回格式；先测记录数、响应体积和耗时，再单独设计分页/字段拆分 |
| Dashboard | 工具查询仅取分类/状态两列供计数和去重；文章总数及已发布数用两次数据库 COUNT，不加载正文 | 工具量增长后测 Dashboard 延迟与行数，再考虑聚合查询 |

`sql/init.sql` 已有 Windows `(status, sort_order, id)`、Tool `(status, sort_order, id)`、Article `(status, created_at, id)` 及 slug 唯一索引。未连接真实 MySQL，未执行 EXPLAIN，也未修改 schema 或提出无依据的生产迁移。

## 9. 测试结果

| 命令（工作目录） | 结果 |
| --- | --- |
| `npm.cmd test`（`frontend/`） | 22 个文件、458 项通过 |
| `npm.cmd run lint`（`frontend/`） | 通过，零 ESLint 错误或警告 |
| `npm.cmd run format:check`（`frontend/`） | 通过 |
| `npm.cmd run build`（`frontend/`） | 基线及修改后均通过，构建产物相同 |
| `.\mvnw.cmd test`（`backend/`） | 248 项通过，0 失败、0 错误 |
| `.\mvnw.cmd verify`（`backend/`） | 248 项通过，Jar 构建成功 |
| `bash -n deploy/*.sh deploy/tests/*.sh`（Git Bash，仓库根目录） | 通过 |
| `bash deploy/tests/deployment-tests.sh`（Git Bash，仓库根目录） | 通过，含性能脚本成功/失败及 Nginx/systemd 配置断言 |

本机没有 `shellcheck` 或 `nginx` 命令，未运行 shellcheck 或真实 `nginx -t`。Maven 测试使用 H2；测试日志有既有测试场景触发的 WARN，不代表生产新增警告。`git diff --check` 已通过。

## 10. 生产环境验收步骤

1. 在相同构建环境重新运行前端 build，记录 `du -sb frontend/dist` 与最大 chunk。确认 Nginx Web root 仅部署 `dist/`，`/assets/` 文件名含哈希。
2. 按实际域名和证书调整配置，先 `sudo nginx -t`，成功后 `sudo systemctl reload nginx`；`sudo systemd-analyze verify /etc/systemd/system/win-tools-backend.service` 并检查实际 JVM 参数。不要直接覆盖生产现有配置。
3. 在项目目录执行 `bash deploy/performance-check.sh`、`sudo bash deploy/health-check.sh`。分别记录时间、日期、版本、响应状态、`free -h`、`ps aux --sort=-%mem | head -n 15`、`df -h`、`sudo journalctl -u win-tools-backend -n 100 --no-pager` 和 `curl --fail http://127.0.0.1:8080/actuator/health`。异常时先排查，不做并发压测。
4. 按 [部署说明](deploy/README.md) 检查 `Cache-Control`、`Content-Encoding`、管理员响应的 `no-store`、HTTPS 跳转、安全头与 `microphone=(self)`，确认公网 `/actuator/health` 为 404、SPA 深链接刷新与 `/api` 代理正常。
5. 用浏览器人工检查首页、文章、媒体/娱乐工具、管理员登录与 CRUD，并记录 Network 加载情况；需要分析数据库慢查询时，先获取真实行数与 MySQL EXPLAIN，再决定是否单独立项。
