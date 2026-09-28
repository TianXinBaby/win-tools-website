# Production release checklist — Phase 11.15

**Production Verification Pending.** 本清单供获授权的运维人员在真实 Ubuntu 环境执行和签收；创建清单及本地测试没有连接生产服务器。操作前填写发布记录，逐项记录通过、失败或不适用及证据。任何关键项失败先停止切换并评估回滚，不要跳过或把本地模拟结果写成现场通过。

## 发布记录

| 项目 | 现场填写 |
| --- | --- |
| 发布窗口、操作员、复核人 |  |
| 域名、当前版本/commit、候选 commit |  |
| `main` 状态、Frontend CI/Backend CI 运行链接及结论 |  |
| SQL 审查决定（见 [SQL 清单](PRODUCTION_SQL_CHECKLIST.md)） |  |
| MySQL 归档、文件归档、SHA-256 校验结果 |  |
| 发布前 Jar/dist 摘要、部署快照 ID、发布后摘要 |  |
| 性能基线、日志检查、Smoke Test、人工验收结果 |  |
| 最终决定（继续上线/回滚）、时间、签收人 |  |

## A. 发布前

- [ ] 确认将发布的 commit 已审核并进入预定发布分支；核对 `main` 当前 commit、`git status --short --branch` 与计划版本一致，没有未审查的服务器本地改动。正式版本号与 Git tag 由用户在真实验收后决定。
- [ ] 核对本次 commit 的 Frontend CI、Backend CI 均成功，确认 `push`/`pull_request` 触发，前端 Node 版本和 test/lint/format/build、后端 Java 18 和 test/verify 均执行；保留运行链接。当前仓库不能仅凭 workflow 推断合并门禁已经启用。
- [ ] 核对本地回归记录：前端 test、lint、format:check、build；后端 test、verify；部署和备份 Shell 语法与隔离测试。
- [ ] 核对新 Jar 与 `frontend/dist/index.html`、`frontend/dist/assets/` 存在且非空，记录摘要、文件数和体积；前端只部署 `dist/` 内容。
- [ ] 阅读 [SQL 清单](PRODUCTION_SQL_CHECKLIST.md)，逐个确认生产已执行/缺失的脚本。不要导入 `seed-dev.sql`，不要在未知现有结构上把 `init.sql` 当作迁移脚本。
- [ ] 记录 `df -h`、`free -h`、Swap、当前 `systemctl status win-tools-backend nginx`、`sudo bash deploy/status-check.sh`；检查发布和双份备份所需空间。
- [ ] 核对部署配置、systemd EnvironmentFile、日志目录和 TLS 证书路径的存在及权限；不把文件内容、密码或私钥写入记录。确认变更窗口和回滚负责人与快照位置。

## B. 备份

- [ ] 按 [备份手册](backup/README.md) 在受控目录执行 `mysql-backup.sh`，记录数据库归档名、完成时间与目标库；确认备份成功且归档不在 Web root 或 Git 中。
- [ ] 执行 `file-backup.sh`，记录 Jar、静态文件、Nginx、systemd 和应用配置归档名；确认受限权限与可用磁盘空间。
- [ ] 分别对数据库和文件归档运行 `verify-backup.sh <归档路径>`，记录 SHA-256、压缩包完整性及结果。必要的异地备份和隔离恢复演练另行记录；校验通过不等于已经演练恢复。
- [ ] 在实际切换前确认 `deploy/backups` 容量上限尚未达到，并记录部署脚本将保存的旧 Jar + 旧静态目录快照 ID。不得自动删除旧备份。

## C. Backend 发布

- [ ] 在发布前核对当前 `/opt/win-tools/backend/backend.jar` 的摘要和服务版本；确认配套前端快照及数据库备份可用。
- [ ] 按 [部署手册](deploy/README.md) 审查并运行 `sudo bash deploy/backend-deploy.sh`，在脚本提示时确认目标。它构建 Jar、保存旧版本、切换新 Jar、控制 systemd 并执行严格健康检查；不要在脚本运行中另启并行发布。
- [ ] 核对新 Jar 摘要、`systemctl status win-tools-backend`、`journalctl -u win-tools-backend -n 100 --no-pager`，确认重启成功、无持续异常；记录实际启动时间和快照 ID。

## D. Frontend 发布

- [ ] 确认旧 `/var/www/win-tools` 静态目录已随旧 Jar 保存为完整快照；核对新 `dist` 中 `index.html` 与哈希 `assets`。
- [ ] 按部署手册运行 `sudo bash deploy/frontend-deploy.sh`，由脚本构建并切换新 `dist`，再验证 Nginx 与完整健康检查。发布窗口内注意目录重命名可能有短暂不可用。
- [ ] 核对 Web root 只含期望静态文件、owner 和读取权限正确、没有用 `chmod 777` 处理问题；记录入口与主要哈希资源摘要。

## E. Nginx、HTTPS 与安全

- [ ] 对实际配置执行 `sudo nginx -t`，成功后才 `sudo systemctl reload nginx`；检查 reload 状态与 Nginx error log。
- [ ] 浏览器与 `curl -I` 检查 HTTP 自动 301 跳转到同域 HTTPS；TLS 证书域名、有效期、链和 HTTPS 页面均正常，不使用 `-k` 绕过证书检查。
- [ ] 直接打开并刷新 `/windows`、`/tools/json`、`/articles`、`/favorites`，确认 SPA fallback 返回正确页面，静态资源无 404，`/api/*` 由回环 8080 代理且正常返回。
- [ ] 从公网检查 `/actuator/health` 为 404；在服务器内部检查回环 `/actuator/health` 为 200/UP。核对实际 Nginx 配置不把 `/actuator` 代理出去。
- [ ] 用 `ss -ltn` 和云防火墙/安全组核对 8080、3306 仅允许预定的本机或私网访问，公网不得直接连接；不要以应用路由保护代替网络隔离。
- [ ] 检查 `Set-Cookie` 的 Session Cookie 在生产为 `Secure`、`HttpOnly`、`SameSite=Lax`，且不记录 Cookie 值；核对生产 `SESSION_COOKIE_SECURE=true`。使用浏览器人工确认登录和 CSRF 流程仍启用，不通过关闭 CSRF 完成验收。
- [ ] 用虚构错误凭据人工检查管理员登录返回统一错误，不透露账号是否存在；核对生产管理员由运维单独创建，仓库与部署配置中不存在默认管理员密码。不要做批量猜测。
- [ ] 核对 Nginx gzip、`Vary`、哈希 JS/CSS 的 `Cache-Control: public, max-age=31536000, immutable`、HTML 的 `no-cache` 重新验证，以及 API/管理员/CSRF 响应没有被 Nginx 缓存。检查 `Permissions-Policy` 与其他安全头仍在。

## F. Health 与只读 Smoke Test

- [ ] `sudo bash deploy/health-check.sh`：systemd active、HTTPS 首页、回环 `/api/health` 和回环 `/actuator/health` 均通过。
- [ ] `BASE_URL=https://xc64.com.cn bash deploy/production-smoke-test.sh`（域名只是示例，按实际站点设置）：只发 11 个顺序 HTTPS GET，不发送 Cookie 或管理员凭据；检查首页、列表、收藏、深层路由、公开 API 和公网 Actuator 404。记录命令退出码与时间，不将模拟测试当作生产执行。
- [ ] `GET /api/health` 返回统一响应且 `status=UP`；公开 `/api/windows`、`/api/tools`、`/api/articles` 返回正确 JSON，而非 Nginx 回退 HTML。再核对 systemd 状态。

## G. 浏览器回归与管理员人工验收

- [ ] 首页、Windows 列表/详情、Tools、Articles 列表/详情与 Favorites 页面在桌面和移动视口可用；直接打开、刷新并查看 Console/Network，无明显错误。
- [ ] 按下方[工具回归表](#工具回归表)逐项操作。对浏览器本地工具，观察 Network，确认输入、图片或录音没有上传；检查刷新与错误提示。
- [ ] 由授权管理员**人工**访问 `/admin/login` 登录；核对 `/admin` Dashboard 的工具、文章和分类统计与后台列表一致。凭据和 Session Cookie 不进入脚本、截图或报告。
- [ ] 在 `/admin/tools` 人工检查名称/slug 搜索、分类与状态筛选；选择经批准的测试记录检查启停和排序，记下原值并恢复，确认公开列表变化符合预期。
- [ ] 在 `/admin/articles` 检查状态筛选和现有文章列表；如需变更文章，先选定测试记录和恢复方案，不用真实内容做试验。
- [ ] 人工退出登录后直接访问或刷新 `/admin`，应跳回登录页且后台 API 不再可用；同时核对 CSRF 保护仍启用。

### 工具回归表

每项均检查直达 URL、刷新、交互、Console 无明显错误。以下操作由浏览器人工执行；自动单元测试不证明真实设备、权限或生产 Nginx 行为。

| 类别 | 工具路径 | 人工验收动作 |
| --- | --- | --- |
| 基础 | `/tools/json` | 格式化有效 JSON，错误输入有提示。 |
| 基础 | `/tools/uuid` | 生成 UUID，复制结果。 |
| 基础 | `/tools/timestamp` | 正反向转换时间戳，检查时区提示。 |
| 基础 | `/tools/sha256` | 计算已知文本的摘要，输入不离开浏览器。 |
| 基础 | `/tools/base64` | 编码、解码含中文文本。 |
| 媒体 | `/tools/qrcode` | 生成二维码并检查下载/复制。 |
| 媒体 | `/tools/image-compress` | 选本地样例图并压缩、下载。 |
| 媒体 | `/tools/image-resize` | 调整样例图尺寸、下载。 |
| 媒体 | `/tools/image-convert` | 转换样例图格式、下载。 |
| 娱乐 | `/tools/nickname-generator` | 生成并复制昵称。 |
| 娱乐 | `/tools/ascii-art` | 输入字符并生成 ASCII 图。 |
| 娱乐 | `/tools/lucky-wheel` | 输入选项、旋转并得到结果。 |
| 娱乐 | `/tools/reaction-test` | 完成一次测试并显示成绩。 |
| 娱乐 | `/tools/magic-keyboard` | 键盘/触屏交互和声音开关。 |
| 娱乐 | `/tools/crt-tv` | 开关 CRT 视觉效果。 |
| 娱乐 | `/tools/fps-test` | 开始、停止，数值变化。 |
| 娱乐 | `/tools/typing-test` | 完成打字并核对 WPM/正确率。 |
| 娱乐 | `/tools/mikutap` | 用户手势触发音画，离开后停止。 |
| 娱乐 | `/tools/online-piano` | 点击/键盘弹奏，离开后停止声音。 |
| 娱乐 | `/tools/random-avatar` | 生成并下载头像。 |
| 娱乐 | `/tools/voice-ball` | **必须人工**在 HTTPS secure context 中授权麦克风；由用户手势启动，权限拒绝有提示，离开页面后麦克风 track 停止且浏览器录音指示消失。 |

## H. 生产监控、性能与备份验收

- [ ] 顺序运行只读 `bash deploy/performance-check.sh`，记录首页、公开 API、回环 health、回环 Actuator 的实际响应时间与状态；再记录 `free -h`（含 Swap）、`df -h`、`systemctl status win-tools-backend`。只建立真实基线，不设未经测量的毫秒阈值或做高并发压测。
- [ ] 检查 `/opt/win-tools/logs/application.log`、`error.log` 可由服务账号写入、授权运维账号读取；`journalctl -u win-tools-backend` 可读；检查 Nginx access/error log、系统 logrotate 和 Logback 按日期/20 MB 滚动配置。不要用 `chmod 777` 解决权限。
- [ ] 确认最近 MySQL 与文件备份仍能通过 `verify-backup.sh`；只审查恢复脚本语法、文档和双重确认机制。真实恢复须在隔离环境演练，不能作为普通 Smoke Test，也不覆盖生产数据库。

## I. 继续上线或回滚

- [ ] **继续上线条件**：A–H 的关键检查通过，SQL 状态和人工验收已签收，健康与公开 API 正常，错误日志无持续新增问题，备份和完整快照可用；记录观察窗口和负责人。
- [ ] **暂停并评估回滚条件**：健康或公开 API 失败、核心页面/后台不可用、TLS/安全隔离异常、SQL 结果不符合预期、持续错误或性能/资源相对现场基线明显恶化。不要用生产数据库 restore 作为快速回滚。
- [ ] 回滚前列出并核对 `deploy/backups/<snapshot-id>` 的 `.complete`、Jar、前端和元数据，选择明确目标；`sudo bash deploy/rollback.sh <snapshot-id>` 会提示 `ROLLBACK <snapshot-id>`，保存失败版本快照，并在切换后运行严格健康检查。不要盲目重复默认回滚。
- [ ] 若回滚到 Phase 11.14.2 或更早、**没有 Actuator** 的旧 Jar，新版 `health-check.sh` 可能因 `/actuator/health` 返回非零；此时必须人工核对 `/api/health`、`systemctl status win-tools-backend`、`journalctl -u win-tools-backend`、HTTPS 首页和公开 API，并记录旧版监控能力差异。不要降低当前版的健康检查标准。
- [ ] 回滚后重新核对前端、后端、Nginx、公开 API、管理员人工流程和数据库兼容性，记录最终状态。数据库迁移不由 `rollback.sh` 撤销；若发现结构或数据问题，另行制定受控恢复方案。
