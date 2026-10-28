# Phase 11.18 — 工具界面紧凑化与视频格式转换器

交付日期：2026-10-27（Asia/Shanghai）。项目：`D:\study\win-tools-website`。

| 状态 | 本阶段结果 |
| --- | --- |
| 本地开发 | 完成 |
| 自动化测试与构建 | 通过；前端 512 项，带真实转换的后端 test 282 项均通过 |
| 本地真实 FFmpeg 转换 | 通过；ASF → 五种输出 × 有/无音频共 10 组，另有浏览器上传下载验证 |
| 本地浏览器布局和交互 | 通过；32 组布局检查、Tab/Enter、空白区域导航、收藏隔离及实际下载 |
| 用户视觉审核 | 等待审核 |
| 生产环境部署与启用 | 未执行；功能默认关闭 |

## 1. Git 前置检查与保护范围

- 已阅读根目录 `AGENTS.md`、现有前后端实现、认证/CSRF、SQL、Nginx 与部署文档。
- 执行 `git status --short --branch`、`git log -5 --oneline --decorate`、`git branch --show-current` 和提交包含关系检查。
- `35bb54f` 已包含在本地 `main` 中；本地 `main`、缓存的 `origin/main` 与现有目标分支都指向 `fdce236`。复用已有 `feature/phase-11.18-tool-ui-video-converter`，未重置或覆盖分支。此结论来自本地 refs，没有声称刷新了远程状态。
- 开始时已有 `ch5_2/` 用户修改，其中 `Person.java` 同时有暂存与未暂存内容；已向用户报告并原样保留。`.release/` 与原始 `备案图标.png` 保留。
- 本阶段文件未暂存、未 commit、未 push、未合并 main、未打 Tag、未部署。原有暂存内容不属于本阶段，后续审阅时不得一并提交。

## 2. 紧凑工具卡片与整卡导航

统一修改已有 `ToolCard.vue`，通过专用 `tool-grid` 覆盖首页搜索结果、热门工具、最近使用、`/tools` 目录、娱乐等分类筛选和 `/favorites`。Windows 与文章继续使用原 `card-grid`，工具详情内部布局保持原有实现。

卡片高 100px，左侧固定尺寸图标，右侧名称和简介；名称与简介单行省略，保留 title 供查看完整内容。断点为小于 520px 一列、520–899px 两列、900–1199px 三列、1200px 及以上四列。保留原字体、色彩、圆角与轻边框。

整张主体使用一个原生 `RouterLink`，空白区域、图标、名称和简介均可导航；原有工具 slug/路由校验继续生效。收藏按钮作为链接的同级元素独立定位，没有按钮嵌套链接，保留 aria-label、aria-pressed、焦点和键盘访问。移除重复的“使用工具”入口，最近使用仍由已有路由钩子记录。

截图复核发现原有 `body { min-width: 320px }` 在有垂直滚动条的 320px 桌面视口中导致横向溢出，现改为 `min-width: min(320px, 100%)`；浏览器测试按 `documentElement.clientWidth` 判定溢出，避免使用 innerWidth 漏检。图标不换行、不拉伸。

## 3. 视频转换架构和实际能力

新增页面 `/tools/video-converter`、注册 slug `video-converter`，通过 `/api/tools` 的真实目录记录展示。前端提供文件选择/拖放、文件名称和大小、输出格式、实际上传进度、服务器状态/进度、取消、错误与重试、完成下载及主动删除。默认 MP4；未选择文件或服务不可用时禁止转换。

后端由薄 Controller、`VideoConverterService` 任务管理、`VideoTranscoder` 容器验证/参数生成和 `VideoProcessRunner` 进程管理组成，不新增依赖，不改变技术栈，不使用外部转换服务。现有 Java 18、Spring Boot 3.5.x、Vue 3 和数据库结构保持原方案。

输入初筛扩展名为 ASF、WMV、MP4、MKV、MOV、AVI、WebM，实际内容必须通过 FFprobe 容器、视频流、时长及尺寸检查；接受 `.asf` 文件名不等于验证通过。无视频流、损坏文件、无法识别编码、未知/超限时长会失败。只转换第一个视频流和可选第一个音轨；无音轨视频可用。

| 输出 | 视频编码 | 有音轨时的编码 |
| --- | --- | --- |
| MP4 / MKV / MOV | H.264（libx264），yuv420p | AAC |
| AVI | MPEG-4 Part 2 | MP3（libmp3lame） |
| WebM | VP9（libvpx-vp9） | Opus（libopus） |

奇数尺寸补齐到偶数，MP4/MOV 使用 faststart。进度来自 FFmpeg `out_time_us` 与 FFprobe 时长，未知时显示处理中，输出验证通过后才显示 100%。不伪造进度，不复制文件后缀冒充转换。

## 4. ASF 实际转码证据

本地使用 FFmpeg/FFprobe `9.0.2-essentials_build-www.gyan.dev`，便携构建仅放在 Git 已忽略的 `.cache/phase11.18-ffmpeg/`；下载压缩包与发布方 SHA-256 校验值一致：`60f467265b1e312373dbcd92200c2618a74850f98d3d078e94296bb3fa2047ba`。未安装到系统、未修改 PATH，也未将二进制加入交付源码。

`VideoConverterRealTests` 启动真实回环 Spring Boot HTTP 服务，以 H2 隔离数据，通过 Cookie、CSRF 和 multipart 创建任务、轮询、下载，再用真实 FFprobe 校验容器及编码。样本是程序生成的 1 秒 WMV2/WMAV2 ASF 和无音轨 ASF，含中文、空格和特殊字符的文件名。2026-10-27 最终完整 test 中以下 10 组均通过：

| 输出 | 含音轨编码 / 下载字节数 | 无音轨编码 / 下载字节数 |
| --- | --- | --- |
| MP4 | h264 + aac / 11729 | h264 / 1874 |
| MKV | h264 + aac / 10964 | h264 / 1568 |
| MOV | h264 + aac / 11780 | h264 / 1821 |
| AVI | mpeg4 + mp3 / 19886 | mpeg4 / 6448 |
| WebM | vp9 + opus / 10212 | vp9 / 831 |

每组还验证另一无归属会话不能下载，并在验收后取消清理。真实专项只在设置 `VIDEO_REAL_FFMPEG` 时启用，常规 CI 可不安装 FFmpeg。后续常规 verify 会重写 Surefire 中该可选测试的结果为 skipped；这不代表上述独立真实测试未执行。

浏览器另用 2 秒真实 ASF，通过页面文件选择、开始转换、等待成功、点击下载完成 MP4 验证，FFprobe 得到 h264 + aac。最终本地证据目录：

`D:\study\win-tools-website\.cache\phase11.18-browser-1793091383394`

- `results.json`：32 组布局结果、键盘/收藏/空白点击、下载元数据、未捕获 JS 异常列表。
- `tools-1440.png`、`tools-320.png`：最终桌面和窄屏工具卡片截图，已实际查看。
- `video-completed-1440.png`、`video-completed-320.png`：转换完成及下载页面截图，已实际查看。
- `中文 空格 &测试.asf`、`converted.mp4`：本地生成的输入与浏览器下载输出。
- `backend.log`：本次脚本启动的本地后端日志。

这验证了当前 Windows FFmpeg 构建及短样本；不代表所有 ASF 编码、长视频、200 MiB 大文件或生产 Ubuntu 构建都已经通过。

## 5. API 与请求响应

前缀 `/api/tools/video-converter`，JSON 使用项目 `ApiResponse<T>`。

| 方法 | 路径后缀 | 请求 / 返回 |
| --- | --- | --- |
| GET | `/capabilities` | enabled、available、reason、支持格式、大小/时长限制、TTL |
| POST | `/jobs` | multipart `file` + `targetFormat`；返回任务 |
| GET | `/jobs/{jobId}` | 状态与实际进度 |
| GET | `/jobs/{jobId}/download` | 仅完成任务可下载附件 |
| DELETE | `/jobs/{jobId}` | 取消并请求清理，重复取消幂等 |

```json
{"code":200,"message":"success","data":{"jobId":"UUID","status":"CONVERTING","progress":37,"targetFormat":"mp4","errorCode":null,"downloadUrl":null}}
```

状态包含 QUEUED、VALIDATING、CONVERTING、COMPLETED、FAILED、CANCELLED。progress 可为 null，downloadUrl 只在完成时提供。错误采用正确 HTTP 状态及固定 `VIDEO_*` 代码，前端白名单翻译；不返回命令、绝对路径或堆栈。其他会话、过期或重启丢失的任务返回 404，未就绪下载返回 409。Nginx 的 HTML 413 也根据 HTTP 状态显示明确的大小限制提示。

## 6. 安全、会话与进程控制

沿用已存在的 Spring Security、Session 与 `HttpSessionCsrfTokenRepository`，没有关闭全局 CSRF。既有安全过滤链增加视频路径，允许匿名使用，但 POST/DELETE 仍须从原 `/api/admin/auth/csrf` 获取有效 token。管理员接口仍需管理员身份。前端使用既有 Axios 实例/Cookie，写请求不自动重放。

随机 owner 属性保存在 Session 中，随机 job ID 不能替代归属检查。查询、下载、取消都验证同一会话归属。视频响应 no-store。进程使用 `ProcessBuilder(List<String>)`，输入/输出均为受控随机目录，目标格式服务器白名单，不接受 URL、用户输出路径或任意参数。demuxer 仅允许 asf/mov/matroska/webm/avi，协议仅 file/pipe。

进程持续消费输出，最多缓存 64 KiB、单行 2 KiB；超时/取消终止进程及可见子进程。日志仅记录任务状态和固定错误类型，不记录视频内容、文件原始路径、Session 标识或完整内部诊断。输出需存在、非空、未达到大小限制且可被 FFprobe 识别，明显截短不能成功。

## 7. 资源保护、上传限制与清理

| 配置 | 默认值 |
| --- | --- |
| 功能启用 | false |
| 单文件 / multipart 请求 | 200 MiB / 202 MiB |
| 输出文件上限 | 400 MiB |
| 时长 / 像素上限 | 1800 秒 / 3840×2160 像素 |
| 转码进程超时 | 900 秒 |
| probe / 依赖检查 | 各最多 15 秒 / 各最多 5 秒，依赖检查缓存 30 秒 |
| 同时执行 / 等待队列 | 1 / 2 |
| 任务保留 / 扫描周期 | 30 分钟 / 30 秒 |
| 总保留任务数 | 12，包含活动与终态 |

上表除像素、进程线程和扫描/检查策略外均由独立视频配置集中提供；环境变量与 `application.yml`、部署 YAML 和 env 示例一致，完整列表见 `docs/VIDEO_CONVERTER.md`。不擅自提高默认并发。队列或总保留容量满返回 429，不能无限积压。

临时文件位于专用私有目录，POSIX 目录 0700/文件 0600，Windows 继承账户 ACL，不放入 public/dist/Nginx 站点根目录。成功后删除输入，取消/失败在进程退出后尝试删除目录；完成输出与终态元数据按 TTL 保留。到期立即拒绝访问，定时扫描清理磁盘；启动也扫描标记匹配的过期 job-UUID 目录，不跟随符号链接，不删除未知文件。清理失败保留后续重试。

上传中取消需先等待创建响应取得 job ID，再请求取消；断网/关闭页面不能保证请求送达，由超时和 TTL 兜底。取消失败可重试查询，404 释放页面供重新上传。正常退出清理，异常重启不恢复内存任务，旧文件按 TTL 清理。完整任务时间还包含前后 probe；应用限制不是 OS CPU/内存硬配额。

## 8. SQL 和目录接入

新增 `sql/phase-11.18-video-converter.sql`，使用已有 tool 字段、media 分类、`/tools/video-converter` 和排序值 95；开发 `seed-dev.sql` 同步增加记录。幂等插入不覆盖已有同 slug 的禁用状态或管理员内容，不修改表结构、不删除其他记录。

静态检查确认独立脚本只有受控 INSERT…SELECT，没有 UPDATE/DELETE/DROP/ALTER/TRUNCATE。H2 MySQL 兼容测试执行两次并验证已有数据不变；开发种子可重复执行且公开目录包含 22 项。浏览器实际从本地 `/api/tools` 取得新工具，前端没有硬编码目录卡片。未连接真实生产 MySQL，也未执行生产 SQL。

## 9. Nginx 与后续生产启用

仅修改仓库示例：精确 `/api/tools/video-converter/jobs` 允许 202m 请求，其他路径维持 1m；保留原 API 代理、Actuator 公网阻断、HTTPS、SPA、gzip、缓存和安全头。Spring multipart 为单文件 200 MiB / 请求 202 MiB。Nginx 与 Servlet 可能缓冲上传，生产磁盘预算须包含这些临时区，不能只计算应用任务目录。

`deploy/README.md` 已记录审核后的 Ubuntu 步骤：备份；人工执行目录 SQL；安装发行版 FFmpeg/FFprobe 并检查版本/编码器；读取实际 systemd User/Group；创建私有目录；配置 env/multipart/Nginx；nginx -t；按现有授权流程部署并启用；健康检查及真实 ASF 验收；观察 CPU/内存/磁盘；关闭开关或按快照回滚。当前未连接或修改服务器、Nginx、systemd、生产数据库，也未重启生产服务。

## 10. 实际验证结果

以下最终验证于 2026-10-27 执行，使用已有 JDK 18.0.2.1，仅设置当前命令进程 JAVA_HOME，不修改系统配置。

| 工作目录 | 命令 | 结果 |
| --- | --- | --- |
| frontend | `npm.cmd ci` | 成功，319 包；审计报告 29 项已有漏洞，见限制 |
| frontend | `npm.cmd test` | 25 文件、512 测试通过 |
| frontend | `npm.cmd run lint` | 通过，0 ESLint 错误/警告 |
| frontend | `npm.cmd run format:check` | 通过 |
| frontend | `npm.cmd run build` | 通过，无新增 chunk 体积警告 |
| backend | `mvnw.cmd test`，设置 VIDEO_REAL_FFMPEG/FFPROBE | 282 测试通过，0 失败、0 错误、0 跳过，含 10 组真实转换 |
| backend | `mvnw.cmd verify`，不设置真实专项变量 | BUILD SUCCESS；282 项中 281 通过、1 项可选真实测试按设计跳过；Jar 已生成 |
| 项目根目录 | `node frontend/e2e/video.browser.mjs`，设置 JDK/FFmpeg 路径 | PASS，32 组布局及真实浏览器上传/下载 |
| 项目根目录 | Git Bash：对 `deploy/*.sh deploy/tests/*.sh` 循环执行 `bash -n` | 通过 |
| 项目根目录 | `bash deploy/tests/deployment-tests.sh` | Deployment script tests passed；模拟隔离，不执行生产部署 |
| 项目根目录 | `bash deploy/tests/production-smoke-tests.sh` | Production smoke tests passed；是脚本自身的模拟测试，不是生产网站探测 |
| 项目根目录 | SQL 静态审阅 + `ContentDevSeedTests` | 通过，目录幂等、保留已有数据、路由/分类一致 |
| 项目根目录 | `git diff --check`、差异与新增文件敏感信息检查 | 通过；已有 Person.java 的 CRLF 提示属于用户文件 |

新增/更新测试还覆盖卡片渲染、原生导航、收藏隔离、首页/收藏/分类/搜索/最近使用、视频文件初筛、上传/队列/验证/转换/成功/失败/取消、服务关闭与依赖不可用、会话/下载/CSRF、队列满载、Java 子进程超时和退出、无视频流、损坏元数据、输出缺失、清理及 SQL。收尾复查新增 4 个回归测试，先复现后修复：取消失败恢复、取消 404、HTML 413、完成任务取消与容量释放交错的文件清理。

浏览器宽度 320、519、520、899、900、1199、1200、1440px，分别检查 `/tools`、娱乐分类、收藏和首页；卡片均高 100px，列数符合断点，无横向溢出/嵌套操作。另验证 Tab/Enter、收藏不导航、卡片空白导航及下载编码。最终截图已逐张查看，未捕获 JS 异常列表为空。未把模拟响应测试或本地 H2 当成生产验收。

## 11. 已知限制和未执行项目

1. `npm.cmd ci` 对现有锁文件报告 29 项漏洞：1 low、3 moderate、25 high。未新增/升级依赖，package.json、package-lock.json、pom.xml 无差异；依赖治理应单独评估，不擅自自动升级。
2. 当前真实媒体样本为短小的生成 ASF，并未穷举 ASF/其他容器的所有编码。所需输出编码器缺失或解码不支持时明确失败；capabilities 验证程序可启动，不承诺任意编码兼容。
3. 本地数据库为 H2 MySQL 兼容模式；真实 MySQL 执行、Ubuntu 发行版构建、200 MiB 上传边界、生产 Nginx/systemd/TLS、长视频及 CPU/内存/磁盘负载未验收。
4. 关闭浏览器、断网或上传响应丢失可能使取消无法送达，输入/输出由服务器超时与 TTL 后续清理；刷新页面后需重新上传。
5. 应用与 FFmpeg 同账户执行，不提供容器/微服务隔离；生产仍需最小账户权限与资源观测。未新增 Docker、Redis、微服务或系统级配置变更。
6. 用户视觉审核与任何生产启用均待确认。本报告不是生产可用性声明。

## 12. 修改文件清单与最终工作区

本阶段共 46 个新增/修改文件（含本报告）；全部未暂存。按职责列出如下：

**后端实现（9 个）**

- `backend/src/main/java/com/xiaoc/backend/config/SecurityConfig.java`
- `backend/src/main/java/com/xiaoc/backend/config/VideoConverterProperties.java`
- `backend/src/main/java/com/xiaoc/backend/controller/VideoConverterController.java`
- `backend/src/main/java/com/xiaoc/backend/exception/GlobalExceptionHandler.java`
- `backend/src/main/java/com/xiaoc/backend/exception/VideoConversionException.java`
- `backend/src/main/java/com/xiaoc/backend/service/VideoConverterService.java`
- `backend/src/main/java/com/xiaoc/backend/service/video/VideoProcessRunner.java`
- `backend/src/main/java/com/xiaoc/backend/service/video/VideoTranscoder.java`
- `backend/src/main/resources/application.yml`

**后端测试与本地验收支持（7 个）**

- `backend/src/test/java/com/xiaoc/backend/mapper/ContentDevSeedTests.java`
- `backend/src/test/java/com/xiaoc/backend/controller/VideoConverterControllerTests.java`
- `backend/src/test/java/com/xiaoc/backend/controller/VideoConverterRealTests.java`
- `backend/src/test/java/com/xiaoc/backend/service/VideoConverterServiceTests.java`
- `backend/src/test/java/com/xiaoc/backend/service/video/VideoProcessRunnerTests.java`
- `backend/src/test/java/com/xiaoc/backend/service/video/VideoTranscoderTests.java`
- `backend/src/test/java/com/xiaoc/backend/support/VideoBrowserApplication.java`

**前端实现（14 个）**

- `frontend/src/assets/main.css`
- `frontend/src/components/ToolCard.vue`
- `frontend/src/components/FavoriteButton.vue`
- `frontend/src/components/PopularTools.vue`
- `frontend/src/components/ToolPageHeader.vue`
- `frontend/src/views/HomeView.vue`
- `frontend/src/views/ToolsView.vue`
- `frontend/src/views/FavoritesView.vue`
- `frontend/src/views/tools/VideoConverterView.vue`
- `frontend/src/router/index.js`
- `frontend/src/utils/tools/registry.js`
- `frontend/src/utils/request.js`
- `frontend/src/utils/videoMessages.js`
- `frontend/src/api/videoConverter.js`

**前端测试（6 个）**

- `frontend/src/__tests__/App.spec.js`
- `frontend/src/__tests__/request.spec.js`
- `frontend/src/__tests__/toolExperience.spec.js`
- `frontend/src/__tests__/compactToolCard.spec.js`
- `frontend/src/__tests__/videoConverter.spec.js`
- `frontend/e2e/video.browser.mjs`

**目录 SQL、部署和文档（10 个）**

- `sql/seed-dev.sql`
- `sql/phase-11.18-video-converter.sql`
- `deploy/nginx/win-tools.conf.example`
- `deploy/application-prod-example.yml`
- `deploy/env/win-tools.env.example`
- `deploy/tests/deployment-tests.sh`
- `deploy/README.md`
- `docs/VIDEO_CONVERTER.md`
- `README.md`
- `PHASE_11.18_REPORT.md`

最终分支：`feature/phase-11.18-tool-ui-video-converter`，HEAD `fdce236`。Git 工作区有上述本阶段未提交修改，以及原有用户 `ch5_2/`（含暂存）、`.release/`、`备案图标.png`。没有新增本阶段暂存项。验证产物、FFmpeg 和截图位于忽略的 target/dist/.cache，不能纳入后续源码提交。后续若审核后提交，应只选择上述清单；建议提交信息 `feat: compact tool cards and add server-side video converter`。

## 13. 下一步与停止边界

当前阶段停在本地交付审核。先审核卡片截图、视频流程、代码及上述限制；确认后再单独安排依赖漏洞治理与生产启用。生产启用必须按 deploy/README 的授权步骤执行，并完成现场 ASF、上传限制、跨会话、取消/过期、健康和资源验收。未执行生产 SQL、安装服务器软件、修改真实 Nginx/systemd、重启服务、提交/推送、合并或发布 Tag。
