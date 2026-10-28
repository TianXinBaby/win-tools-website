# Ubuntu 手工部署脚本

## Phase 11.18 视频转换后续启用

以下步骤是审核通过后由操作人员执行的部署说明，本阶段未连接或修改生产。功能默认 `WIN_TOOLS_VIDEO_CONVERTER_ENABLED=false`，未安装 FFmpeg 不影响网站启动。完整配置及 API 见 [视频转换器说明](../docs/VIDEO_CONVERTER.md)。

1. 先备份现有数据库、Jar、前端和配置，审阅 `sql/phase-11.18-video-converter.sql`，选择 `win_tools` 后手工执行。它只插入缺失的 `media` 工具记录，不覆盖同 slug 的已有数据。不要在生产运行开发种子。
2. 安装 Ubuntu 提供的 FFmpeg（包括 FFprobe）：`sudo apt-get update`、`sudo apt-get install ffmpeg`。执行 `ffmpeg -version`、`ffprobe -version`；核对 `ffmpeg -encoders` 包含 libx264、aac、mpeg4、libmp3lame、libvpx-vp9、libopus。不要假定生产已有这些组件；不把二进制加入 Git/发布包。
3. 用 `systemctl show win-tools-backend -p User -p Group` 检查实际运行用户和组。仓库示例为 `win-tools:win-tools`，现场可能不同。以实际账户执行 `sudo install -d -m 700 -o <实际User> -g <实际Group> /var/lib/win-tools/video-converter`。目录必须在静态站点根目录之外，后台账户独占，磁盘空间和 ACL 足够。systemd 示例已有 `UMask=0077` 和 `PrivateTmp=true`。
4. 在既有 `/etc/win-tools/win-tools.env` 设置 `deploy/env/win-tools.env.example` 中全部视频变量，初始仍保持 false。按用户要求，单文件 500 MiB、请求 502 MiB、输出 500 MiB，与后端大小默认一致；页面 MB 沿用 1024 进制。2 CPU / 2 GiB RAM 与 MySQL 共机时，其余初始覆盖为视频时长及转换超时各 300 秒、1 执行 + 1 等待、10 分钟保留、最多 4 个任务。`application-prod-example.yml` 展示后端默认与变量绑定。不要修改系统级 Java/Node 配置。
5. 合并 Nginx 示例的 `http {}` 共享区和精确路径 `/api/tools/video-converter/jobs`：全局最多 2 个上传请求、每 IP 1 个、每 IP 1 次/分钟且无突发队列，超限 429；`client_max_body_size 502m`，缓冲 16k，保持 `proxy_request_buffering on`。其他 API 仍 1m，查询/下载/取消接口不加此上传限流。保留既有 TLS、域名、缓存、安全头和 Actuator 阻断。`sudo nginx -t` 通过后才能 reload；仅提供仓库示例，本阶段没有执行此操作。提高文件大小须同步调整 `MAX_UPLOAD_BYTES`、`MAX_REQUEST_BYTES` 和 location 上限。
6. 按现有批准流程部署前后端；设置启用开关 true 后重启后端，运行 `deploy/health-check.sh`，检查能力接口的 available。浏览器实际上传有效 ASF，至少完成 ASF → MP4 和下载，用 FFprobe 核对 H.264/AAC；同时核查五种输出、有/无音轨、损坏输入、取消、队列满载、另一会话无权限、过期删除及生产 500 MiB 文件/502 MiB 请求/500 MiB 输出边界。只有现场实测才能声称生产大文件上传/转码成功。
7. 观察 `journalctl -u win-tools-backend`、CPU、内存、磁盘和任务清理，日志只有状态/固定错误代码。关闭功能时将开关改为 false 并重启后端；需要回滚则使用现有后端/前端快照流程。关闭或回滚后确认旧临时目录是否还有残留，按应用 marker 和过期时间核查后再清理，禁止删除未知文件。重启会丢失内存任务和 Session，用户需要重新上传。

应用限流不能替代操作系统资源隔离；FFmpeg 与网站同账户运行，生产启用前应使用受维护的发行版构建并测量并发上传时的临时存储占用。本阶段不改变生产 systemd，也不声称已完成负载验收。

### 2 CPU / 2 GiB RAM / 50 GiB 磁盘的启用检查

上传会先进入 Nginx 请求体缓冲，再经 Servlet multipart 解析，最后才到 Service 的任务预留与复制。因此匿名客户端可反复创建 Session，单靠 1+1 任务队列无法限制上传缓冲；上述 Nginx 全局连接限制才覆盖这段入口。Tomcat 必须仅监听回环地址，云安全组/防火墙不得开放 8080，否则可绕过这些入口保护。每 IP 限制会影响共享 NAT 用户；若前面有 CDN，需先按可信代理范围配置真实 IP，不接受客户端任意 X-Forwarded-For。

在启用前，以实际后端账户创建 `/var/lib/win-tools/video-multipart`，权限 0700，并通过环境变量 `SPRING_SERVLET_MULTIPART_LOCATION` 指向它。用 `findmnt -T <路径>`、`df -h <路径>` 核对任务目录、Servlet 目录、`nginx -T` 中的 `client_body_temp_path`/`proxy_temp_path` 都在受预算的磁盘上；不能把 `/tmp` 或 `PrivateTmp` 自动等同于磁盘，tmpfs 会消耗这台机器的内存。Nginx 临时区由其 worker 账户持有，不要改成与后端共用的任务目录，也不要设 `client_body_in_file_only on` 留存请求体。

保守磁盘粗算为：4 个任务各暂按 500 MiB 输入 + 500 MiB 输出计 4000 MiB，2 个同时上传在 Nginx 与 Servlet 各按 502 MiB 计约 2008 MiB，总计约 6008 MiB（5.87 GiB）。此数只是预算，不是硬上限：容器开销、FFmpeg `-fs` 最后一包、失败清理重试、旧进程/旧版本遗留、Nginx 下载响应临时文件、日志、发布备份和 MySQL 都需另计。初始给视频相关磁盘至少留 8 GiB 余量；50 GiB 整机剩余少于 10 GiB 或低于 15% 时先关闭新上传并调查，较高者为告警线。这是运维建议，不是应用自动执行的磁盘配额。不要自动删除未知目录、数据库或备份来腾空间。

保持 FFmpeg 并发 1，现有解码/滤镜/编码线程设置 1；线程参数不会限制每个原生库的所有线程，也不构成 CPU/内存硬配额。输入仍允许最多 3840×2160 像素，高压缩 500 MiB 文件也可能占用大量解码/参考帧内存。建议先用真实 4K/复杂编码 ASF 测得峰值 RSS、耗时、MySQL 延迟与 GC，再决定是否启用；当前没有此主机实测，不能承诺 2 GiB 不会 OOM。JVM 示例仍为 `-Xmx768m`，启用前可评估 `-Xmx512m` 作为起点，同时核对非堆和线程栈；MySQL buffer pool 可从 256 MiB 起评估。若 MySQL/OS/JVM 已吃掉可用空间，应继续保持转换关闭，不能靠 Swap 保证稳定。

Spring 的 multipart 文件/请求大小与落盘阈值、应用的输入复制计数、输出 `-fs` + 结果大小检查、时长/超时、任务槽位和总保留容量都在服务器端执行。队列满返回 429，磁盘不足在上传/复制/编码阶段失败，不会成功返回下载任务；固定错误响应不暴露绝对路径。容量拒绝不能回收已经产生的 Nginx/Servlet 缓冲，后者由请求容器清理；应用只清理自己的标记目录。删除失败会重试，但持续权限错误/磁盘错误需运维介入，并保留任务标记，不应承诺损坏文件系统必定自动恢复。

`client_body_timeout 30s` 是相邻读取的空闲超时，不是上传总时长限制；持续滴流仍可占用这 2 个受限上传请求，但不会因新建 Session 扩大并行缓冲数。该方案限制资源，并不保证匿名服务在分布式攻击中仍有可用名额。[Nginx 连接计数语义](https://nginx.org/en/docs/http/ngx_http_limit_conn_module.html) 还规定 HTTP/2/3 的每个并发请求单独计数；[请求限流](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html) 无 burst 时不排队突发请求。[请求体缓冲](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_request_buffering) 开启会完整接收正文后再转发。

应用关闭应先请求进程结束并等待，再清理任务文件。Java 的等待/强制终止 API 不能保证处于操作系统不可中断状态的进程立即消失，孤儿子进程的回收也取决于操作系统。既有 systemd `TimeoutStopSec=30` 与默认控制组终止是最终兜底；本次未修改 unit、未增加 OS 方案，也未在生产验证进程组退出。正式启用需现场检查 stop 后 cgroup/FFmpeg 是否为空。

这些脚本用于现有的 Ubuntu + Nginx + systemd 部署。生产配置保持 `deploy/nginx/win-tools.conf.example` 和 `deploy/systemd/win-tools-backend.service.example` 的路径约定：静态目录 `/var/www/win-tools`、Jar `/opt/win-tools/backend/backend.jar`、服务 `win-tools-backend`。脚本不连接 SSH，不修改数据库、Nginx 配置或 systemd 单元。

## Phase 11.15 发布验收入口

获授权的运维人员先填写 [生产发布清单](../PRODUCTION_RELEASE_CHECKLIST.md) 和 [SQL 发布清单](../PRODUCTION_SQL_CHECKLIST.md)。本目录的 `production-smoke-test.sh` 是公网只读检查，不加载部署配置、不登录后台、不发送 Cookie、不修改业务数据或服务；它对站点顺序发送 11 个 HTTPS GET，检查首页、五个深层路由、`/api/health`、三个公开列表 API，以及公网 `/actuator/health` 返回 404。任一请求、TLS、状态、类型或响应内容不符即退出非零。

```sh
BASE_URL=https://xc64.com.cn bash deploy/production-smoke-test.sh
```

域名只是示例，使用时替换为实际 HTTPS 站点根地址，不要放账号、密码、路径或查询参数。脚本要求可信 TLS 证书，不使用 `-k`，也不跟随跳转；HTTP 到 HTTPS 的跳转、Session Cookie、CSRF、管理员流程、媒体和娱乐工具仍按发布清单人工检查。Phase 11.15 仅在本地用模拟 `curl` 验证脚本，尚未对生产站点执行。

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
| `performance-check.sh` | 不修改文件 | 顺序测一次 HTTPS 首页、公开工具 API、回环健康 API 与 Actuator；显示响应时间、服务状态、内存和磁盘；非 200 时返回非零 |

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

## 性能检查与生产验收

先在 `frontend/` 运行 `npm run build`，再用 `du -sb dist`、`find dist -type f -name '*.js' -printf '%s %p\n' | sort -nr | head` 记录构建体积和大 chunk。比较同一 Node/npm 版本、同一锁文件和相同构建命令的结果。`performance-check.sh` 使用现有受信任的 `deploy/config.sh`，每个 URL 仅发一个 GET 请求，不并发、不写文件、不发送管理员凭据；`total` 和 `first_byte` 是 curl 测得的秒数，适合重复抽样，不能代替真实浏览器加载指标。

```sh
cd /opt/win-tools
bash deploy/performance-check.sh
free -h
ps aux --sort=-%mem | head -n 15
sudo journalctl -u win-tools-backend -n 100 --no-pager
curl --fail http://127.0.0.1:8080/actuator/health
sudo nginx -t
```

systemd 示例为 `-Xms256m -Xmx768m`，符合当前约 2 GiB RAM/2 GiB Swap 的已知配置；不要未经现场内存和 GC 数据评估就扩大 Xmx。检查 JVM 常驻内存时还要看 MySQL、Nginx 和系统剩余内存。Actuator 只提供有限健康状态，不提供堆内存指标。

Nginx 在 `http {}` 中用 URI 映射缓存头：当前 Vite 构建的 `/assets/` 哈希 JS/CSS 返回 `Cache-Control: public, max-age=31536000, immutable`；首页及 SPA 回退到的 `index.html` 返回 `no-cache`，更新时可重新验证。其他路径不由该映射设置缓存头，API 保留后端原有缓存策略，管理员/CSRF 响应的 `no-store` 不被覆盖。gzip 对文本、JS、CSS、JSON 和 SVG 生效（至少 1024 字节）；服务器级安全头继续继承到所有 location。部署前须确认 `/assets/` 只放内容哈希构建文件，避免把未改名的资源长期缓存。变更实际配置后先 `sudo nginx -t`，成功后再 reload。

```sh
ASSET=$(basename "$(find frontend/dist/assets -maxdepth 1 -type f -name 'index-*.js' -print -quit)")
curl -sS -o /dev/null -D - https://example.com/
curl -sS -o /dev/null -D - https://example.com/admin/windows
curl -sS -o /dev/null -D - -H 'Accept-Encoding: gzip' "https://example.com/assets/$ASSET"
curl -sS -o /dev/null -D - https://example.com/api/admin/auth/me
curl -sS -o /dev/null -D - https://example.com/actuator/health
sudo bash deploy/health-check.sh
```

核对 HTML 的 `no-cache`、哈希 JS 的 `immutable` 与 `Content-Encoding: gzip`、未认证管理员响应不被缓存、公开 Actuator 为 404、深链接返回页面、HTTP 跳转 HTTPS、麦克风 Permissions-Policy 与现有安全头。最后在浏览器验收后台和工具页面及深链接刷新，检查 Network 中没有失效 chunk。不要将上述响应头检查替代真实业务、数据库和 TLS 验收。

## 本地验证与边界

Windows 下可使用 Git Bash 检查语法和隔离的脚本行为；真实 systemd/Nginx/TLS 部署验收只能在授权的 Ubuntu 主机进行：

```sh
bash -n deploy/*.sh deploy/tests/*.sh
bash deploy/tests/deployment-tests.sh
# Ubuntu 上安装 shellcheck 后：
shellcheck deploy/*.sh deploy/tests/*.sh
```

隔离测试模拟构建、服务管理和 HTTP 响应，不会访问生产站点。脚本不自动部署到服务器，也不处理系统配置、证书或数据库回滚。
