# Phase 11.18-R1 视频转换器定向复核与修复报告

日期：2026-10-28（Asia/Shanghai）。项目：`D:\study\win-tools-website`。

分支：`feature/phase-11.18-tool-ui-video-converter`，开始时 HEAD：`fdce236`。

> 定向修复与本地回归完成，包含用户追加的上传/下载各 500 MiB 上限。前端 516 项通过；后端 test 和 verify 各 308 项，307 通过、1 项 POSIX 权限测试因 Windows 环境跳过，零失败/错误。10 组真实 ASF 转换均通过。可以进入用户审核后的选择性 Git 提交阶段；本轮没有提交或部署，生产启用仍需 Linux 权限、资源和现场验收。

## 1. 范围与审核结论

本轮在既有 Phase 11.18 未提交代码上定向修复，保留原始阶段报告。没有重构架构、升级依赖、修改已验收工具卡片设计，也没有 commit、push、合并 main、创建 Tag、连接或部署生产服务器。

| 任务 | 结论 |
| --- | --- |
| 临时文件权限 | 发现权限设置偏晚、marker 未限制；改为创建时属性及预创建输出文件。Windows 真实权限位验证不适用，保留可在 POSIX 执行的测试。 |
| 进程生命周期 | 发现中断后的退出等待、后代等待、应用关闭与清理顺序问题，已定向修复。 |
| 视频 API | 现有 Session 归属、CSRF、固定路径和参数白名单有效；补充跨会话、错误 token、参数注入、错误脱敏及真实 Servlet 上传限制测试。 |
| 生产资源保护 | 任务队列不能限制进入 Controller 前的上传缓冲；仅在仓库 Nginx 示例增加上传连接和请求限制，给出小主机起始参数。 |
| 依赖审计 | 原缓存重现 29 项；新缓存在线只读复核为 6 项。两组结果都保留，未升级包，不能算作修复了 23 项。 |
| 回归 | 前端 516 项测试、lint、format、format:check、build 已通过；后端最终结果见第 5 节。 |

## 2. 实际问题、级别与修复位置

级别用于本轮工程风险排序：P1 为可能造成进程/文件生命周期错误或资源耗尽，P2 为权限窗口、清理可靠性和辅助关闭路径问题；不是 CVSS。

| 问题 | 级别 | 修复与位置 |
| --- | --- | --- |
| job 目录和 input 写入后才 chmod；marker 没有限权；output 转换结束才 chmod | P2 | `VideoConverterService` 在 POSIX 创建目录时传入 0700、创建三类文件时传入 0600；output 提前创建，FFmpeg 使用原文件。 |
| Runner 捕获中断后立即恢复中断，finally 的 waitFor 再次被中断且忽略 | P1 | `VideoProcessRunner` 在终止/等待期间记录并暂清中断，确认退出后恢复；调用返回前完成读取线程收尾。 |
| 子进程只发送 kill，未等待；父退出后丢失可见后代 | P1 | Runner 运行期间跟踪 Java 可见后代，先终止后代并给父进程短暂回收机会，再终止并等待父进程。 |
| Service close 等待固定 5 秒后不论 worker 是否退出都删除文件 | P1 | Service 等待 worker 真正退出；运行任务的 finally 才清理文件；排队任务单独取消/释放。 |
| 依赖版本探测在请求线程运行，不在 worker executor 的关闭范围内 | P2 | Runner 登记所有活动进程，销毁时禁止新启动并终止/等待现有进程。 |
| 清理先删除 marker，随后 payload 删除失败时丢失重启清理依据 | P2 | 删除 payload 后才删除 marker；使用 Windows DOS readonly 文件真实验证失败及后续重试。 |
| 提交失败先移除任务，清理同时失败且 marker 不完整时丢失重试追踪 | P2 | 当前实例保留失败任务，受总保留容量约束；空间/权限恢复后 reaper 重试并移除。 |
| 业务队列检查之前，匿名上传已经可能占用 Nginx/Servlet 缓冲 | P1 | 专用上传 location 使用全局及单 IP 连接限制、单 IP 请求限速；不改变其他 API location。 |

关键实现位置（相对项目根目录，行号为本轮最终文件中的一基行号）：

| 修复 | 文件与代码位置 |
| --- | --- |
| 创建时权限 | `backend/src/main/java/com/xiaoc/backend/service/VideoConverterService.java:59`（root）、`:114`（job 和三类文件）、`:298`（按 FileStore 分支） |
| 提交失败追踪 | `backend/src/main/java/com/xiaoc/backend/service/VideoConverterService.java:135` |
| 下载实际大小复核 | `backend/src/main/java/com/xiaoc/backend/service/VideoConverterService.java:222` |
| marker 最后删除 | `backend/src/main/java/com/xiaoc/backend/service/VideoConverterService.java:277` |
| 关闭等待及排队释放 | `backend/src/main/java/com/xiaoc/backend/service/VideoConverterService.java:312` |
| 根进程/后代/读取线程等待 | `backend/src/main/java/com/xiaoc/backend/service/video/VideoProcessRunner.java:40`、`:76`、`:101` |
| 依赖探测等全部进程关闭 | `backend/src/main/java/com/xiaoc/backend/service/video/VideoProcessRunner.java:20`、`:115` |
| 500 MiB 默认和配置绑定 | `backend/src/main/java/com/xiaoc/backend/config/VideoConverterProperties.java:15`、`backend/src/main/resources/application.yml:4`、`deploy/application-prod-example.yml:7` |
| Nginx 上传保护与 502m | `deploy/nginx/win-tools.conf.example:5`、`:84` |
| 生产参数与配置一致性测试 | `deploy/env/win-tools.env.example:14`、`deploy/tests/deployment-tests.sh:184`、`:202` |

完成和取消仍在同一个 job 锁内决定最终状态；迟到的转换结果不能把 CANCELLED 恢复成 COMPLETED。运行中的取消先置标志，进程退出后清理。已打开下载沿用文件系统句柄语义；本机 Windows Java 流允许删除目录后继续读取，取消后新的下载立即拒绝。本轮没有新增下载引用计数或人为改变正常 unlink 行为。

`VideoTranscoder.java` 经完整审阅后未改：现有固定参数列表、白名单、线程和时长/输出限制没有发现需要本次修复的问题。Controller、SecurityConfig 和前端 API 实现也保留原方案，新增测试验证其边界。用户在本轮追加上传/下载均 500 MB 的要求，按项目既有 1024 进制设为各 500 MiB（524288000 字节），multipart 请求为 502 MiB；同步默认值、部署示例与边界测试，下载入口再次校验实际输出大小。

创建属性的原子语义可参见 [JDK 18 Files API](https://docs.oracle.com/en/java/javase/18/docs/api/java.base/java/nio/file/Files.html)。Windows 不传不支持的 POSIX 属性，继续继承运行账户 ACL；本轮没有更改系统账户或 ACL。

## 3. API 安全逐项核对

| 检查 | 结果及证据 |
| --- | --- |
| 其他 Session 的查询、下载、取消 | Service 三个入口统一检查 owner；Controller 回归包含另一 Session 使用其自身有效 CSRF token 取消仍返回 404。 |
| POST/DELETE CSRF | 使用既有 `HttpSessionCsrfTokenRepository`，未增加豁免；缺失、错误、跨 Session token 均拒绝，前端写请求先取得本 Session token。 |
| URL、协议、路径、FFmpeg 参数注入 | 仅上传二进制和目标格式；原文件名仅做后缀初筛，不作为输入路径；随机 job 路径；目标格式白名单；ProcessBuilder 参数列表；file/pipe 和容器白名单，未开放网络或播放列表。 |
| 下载路径泄漏 | 仅返回同源 API 下载地址，附件名 `converted.<format>`，不输出服务器文件路径。 |
| 错误与日志 | 业务错误固定 VIDEO_* 代码；未知异常固定 VIDEO_CONVERSION_FAILED/通用 500；不回传媒体诊断、Session 或堆栈。新增异常含私有路径/Session 字符串的回归。 |
| 下载和取消并发 | 已打开流仍能读取，取消使新下载拒绝；若文件系统暂时拒绝删除，保留 marker 和任务供 reaper 重试。额外检查隐式 HEAD 下载后不会遗留文件。 |
| 大小 | Servlet max-file-size/max-request-size、Service 声明大小及实际读取累计、输出 `-fs` 和完成后大小验证；新增实际 HTTP multipart 413 测试。 |
| 超时和容量 | Runner 真正终止并等待；Semaphore 限制执行+队列，maxRetainedJobs 限制保留任务，满额 429。 |

Servlet 会在调用业务代码前解析 multipart，`file-size-threshold=0` 使文件尽早落盘，不能由 Service 队列代替入口限制。参见 [Spring Boot 3.5 MultipartProperties](https://docs.spring.io/spring-boot/3.5/api/java/org/springframework/boot/autoconfigure/web/servlet/MultipartProperties.html)。

## 4. 生产资源保护建议

针对 2 CPU / 2 GiB RAM / 50 GB 磁盘且 Java 与 MySQL 共机，保留功能默认关闭。上传和输出按用户最新要求统一为 500 MiB；其余生产 env 使用更小的队列、TTL 和时长起点。

| 参数 | 小主机初始建议 |
| --- | --- |
| 单文件 / 请求 | 500 MiB / 502 MiB；Spring 与 Nginx 配套 |
| 输出 / 时长 / 单次转换超时 | 500 MiB / 300 秒 / 300 秒；另含前后 probe 时间 |
| 执行 / 队列 / 总保留任务 | 1 / 1 / 4 |
| TTL / 扫描 | 10 分钟 / 原有 30 秒 |
| 上传并发 | 全局 2、单 IP 1 |
| 新建上传请求速率 | 单 IP 每分钟 1 次，无 burst，超额 429 |
| Nginx 缓冲 | proxy_request_buffering on；16 KiB 请求体内存缓冲，其余落盘；30 秒相邻读取空闲超时 |
| JVM 堆 | 建议现场评估后从 Xms128m/Xmx512m 起试，原 systemd 示例未自动修改 |

任务目录之外，还必须计算 Nginx 请求体、Servlet multipart、日志、备份、MySQL 数据与临时文件。4 个任务各按输入/输出各 500 MiB、2 路上传各按 Nginx/Servlet 两份 502 MiB 粗计约 6008 MiB（5.87 GiB），另留清理失败和下载代理缓冲余量；不是磁盘硬上限。文件大小、`-threads 1`、`-fs` 都不是 FFmpeg 峰值 RSS 或 CPU 硬配额；4K 高参考帧内容仍可能超过主机余量。没有真实负载数据前不能宣布这套参数保证生产安全。

磁盘不足时上传/存储失败返回固定失败码，转换写盘失败不会发布为成功，任务释放执行容量并保留失败清理重试。空间恢复后扫描重试删除；清理持续失败会占据受限保留容量，不能声称磁盘永不耗尽。不要自动删除未知文件来腾空间。

生产启用前应封闭公网 Tomcat 8080，仅允许 Nginx 回环代理，给上传临时区和任务目录分配预算并监测剩余空间，保留 systemd 控制组与停止超时兜底。Nginx 示例与静态脚本测试不等于真实 `nginx -t` 或连接负载验收。本轮没有运行生产命令。

详细参数、缓冲区预算、磁盘满失败行为及后续现场检查见 [视频转换说明](docs/VIDEO_CONVERTER.md) 和 [部署说明](deploy/README.md)。

## 5. 测试与真实 FFmpeg 复测

环境：Windows，Java 18.0.2.1，Node 24.20.0，npm 11.19.0，便携 FFmpeg/FFprobe 9.0.2 essentials。只为命令进程设置 JAVA_HOME/PATH；未修改操作系统环境变量。

| 工作目录 | 命令 | 结果 |
| --- | --- | --- |
| frontend | `npm.cmd test` | 26 文件、516 测试通过 |
| frontend | `npm.cmd run lint` | 通过，零 lint 错误/警告 |
| frontend | `npm.cmd run format` | 通过；仅新增测试需格式化，原设计文件未改变 |
| frontend | `npm.cmd run format:check` | 通过 |
| frontend | `npm.cmd run build` | 通过 |
| backend | `mvnw.cmd test`，启用真实 FFmpeg 环境变量 | BUILD SUCCESS；308 项，307 通过，1 项 POSIX 条件跳过，零失败/错误；35.108 秒 |
| backend | `mvnw.cmd verify`，同样启用真实 FFmpeg 环境变量 | BUILD SUCCESS；308 项，307 通过，1 项 POSIX 条件跳过，零失败/错误；29.917 秒；Jar 重打包成功 |
| 根目录 | Git Bash 对 `deploy/*.sh deploy/tests/*.sh` 逐个 `bash -n` | 通过 |
| 根目录 | Git Bash `bash deploy/tests/deployment-tests.sh` | Deployment script tests passed；隔离模拟，非生产部署 |
| 根目录 | Git Bash `bash deploy/tests/production-smoke-tests.sh` | Production smoke tests passed；脚本自身模拟，未探测生产站点 |
| 根目录 | `git diff --check -- . ':!ch5_2'` | 通过；不处理受保护用户实验目录的原有变动 |

新增/加强测试包括：POSIX 创建时权限、下载中取消、运行取消后文件保留到转换退出、中断关闭等待、清理失败 marker/重试、实际流累计大小、下载大小再次校验、500 MiB 前端边界、Java 父子进程超时/取消/中断/父先退出/关闭、真实 FFmpeg 预创建输出保持文件身份、跨 Session、CSRF、目标注入、异常脱敏、实际 HTTP HEAD、真实 Servlet multipart 大小，以及前端 API CSRF/编码/不自动重放。

`VideoConverterRealTests` 在真实回环 HTTP + Cookie + CSRF + multipart 上执行，test 与 verify 两轮都完成以下 10 组；下载后用真实 FFprobe 核对容器、音轨及编码，另检查其他 Session 无权下载、HEAD 响应无正文/长度正确、取消后目录删除。

| 输出 | 有音轨：编码 / 下载字节数 | 无音轨：编码 / 下载字节数 |
| --- | --- | --- |
| MP4 | h264 + aac / 11729 | h264 / 1874 |
| MKV | h264 + aac / 10964 | h264 / 1568 |
| MOV | h264 + aac / 11780 | h264 / 1821 |
| AVI | mpeg4 + mp3 / 19886 | mpeg4 / 6448 |
| WebM | vp9 + opus / 10212 | vp9 / 831 |

`VideoTranscoderTests.java:82` 的真实 FFmpeg 测试也通过：预创建输出文件后 ASF → MP4 成功，fileKey 保持不变；POSIX 时还执行 0600 断言。本机未执行 POSIX 分支。

新增测试具体位置：`VideoConverterServiceTests.java:146` 权限、`:172` 下载取消、`:189` 下载空/等上限/超上限、`:206` 取消后待进程退出、`:225` 中断关闭、`:260` 完成取消竞态、`:282` 删除失败、`:300` 流大小、`:310` 失败提交追踪；`VideoProcessRunnerTests.java:37` 起父子进程验证；`VideoConverterControllerTests.java:36` 起 API 安全；`VideoConverterUploadLimitTests.java:29` 与 `:33` 真实 Servlet 边界；`frontend/src/__tests__/videoConverterApi.spec.js:27` API 契约及 `videoConverter.spec.js:64` 500 MiB 选择边界。

POSIX 可执行测试命令（在实际 POSIX 文件系统与现有 JDK 18 上）：`cd backend && ./mvnw test -Dtest=VideoConverterServiceTests#privatePermissionsAreSetBeforeUploadOrConversionStarts`。真实输出权限复核需同时设置 `VIDEO_REAL_FFMPEG`/`VIDEO_REAL_FFPROBE` 并运行 `VideoTranscoderTests#realFfmpegTruncatesExistingOutputAndPreservesPermissions`。本轮 Windows 没有 WSL，未安装 Linux 或改变 JDK。

两次完整 Maven 命令均仅在当前进程设置 `JAVA_HOME=D:\study\jdk18`，以及 `VIDEO_REAL_FFMPEG`/`VIDEO_REAL_FFPROBE` 指向 `.cache/phase11.18-ffmpeg/ffmpeg-9.0.2-essentials_build/bin/` 下的现有程序。日志为 `.cache/phase11.18-r1-backend-test.log`、`-backend-verify.log`，均含 10 行 `REAL_VIDEO_PASS`。前端及部署日志同属 `.cache/phase11.18-r1-*`。

## 6. 依赖漏洞独立评估

未执行 npm audit fix、强制修复或版本升级；package.json/package-lock.json 哈希与本轮开始时一致。

| 审计视角 | Critical | High | Moderate | Low | 合计 |
| --- | --- | --- | --- | --- | --- |
| 原缓存：全量 | 0 | 25 | 3 | 1 | 29 |
| 原缓存：生产树（omit=dev） | 0 | 17 | 0 | 1 | 18 |
| 原缓存：仅开发/构建差集 | 0 | 8 | 3 | 0 | 11 |
| 新缓存在线复核：全量 | 0 | 4 | 2 | 0 | 6 |
| 新缓存在线复核：生产树 | 0 | 3 | 0 | 0 | 3 |

`omit=dev` 指 npm 依赖树分类，不代表相同代码一定被打包进浏览器。生产采用 Nginx 静态 dist、Java 后端；Node 端 HTTP/构建/编译链漏洞需要结合实际运行模式判断。原 29 项含 npm 元漏洞传播计数，不等于 29 个独立可从公网利用的根因。根据同一锁文件的不同缓存结果推断，审计/包元数据缓存影响了计数；未调试 npm 内部缓存实现，不能据此声称任何漏洞已修复。

逐包 29 项分类、6 项当前结论、公告、浏览器/开发服务器可达性以及兼容补丁建议见独立文件 [PHASE_11.18_R1_DEPENDENCY_AUDIT.md](docs/PHASE_11.18_R1_DEPENDENCY_AUDIT.md)。下阶段应单独升级兼容补丁、复核锁文件并重跑所有验证，不做无关大版本升级。

## 7. Git 提交阶段判断与证据边界

**可以进入用户审核后的选择性 Git 提交阶段。** 本轮定向修复、本地测试、构建和差异检查已完成，当前所有代码仍未提交、未暂存。此判断只涉及源码提交准备，不代表允许部署或生产资源已验收；依赖扫描尚有 6 项，必须保留独立评估，后续安排兼容补丁维护。任何 commit/push 均等待用户明确授权。

Windows 本轮不能执行真实 POSIX 权限位断言，已检查 WSL 未安装，没有安装或改动系统。权限测试可在 POSIX 文件系统上的 JDK 18 执行。真实媒体是生成的短 ASF 样本，不能覆盖所有编码、4K 长视频、500 MiB 大文件完整 HTTP 链路、磁盘满压力、生产 Ubuntu FFmpeg 或生产 Nginx/TLS；大小边界使用缩小配置的真实 Servlet 和小文件/声明大小进行验证，未分配或传输 500 MiB 样本。

Java ProcessHandle 后代枚举为快照，本轮覆盖根进程和运行期间观察到的后代，不能声称 OS 进程组级强隔离，参见 [JDK 18 ProcessHandle](https://docs.oracle.com/en/java/javase/18/docs/api/java.base/java/lang/ProcessHandle.html)。OS 不终止/不回收进程时，等待会延迟应用关闭；停止超时和控制组是最后兜底。外部强杀后，具有完整有效 marker 的遗留目录按 marker/TTL 处理。如果 marker 未写完整且清理失败，随后进程崩溃，重启扫描无法确认归属会保留该目录，需要人工核查；同一实例内已保留任务追踪以便重试。

## 8. 工作区与文件清单

本轮新增或定向修改 20 个文件；其中本轮新文件为总报告、独立审计、真实 Servlet 限额测试、前端 API 安全契约测试，其余是在既有 Phase 11.18 工作上追加修复。

| 文件 | 本轮用途 |
| --- | --- |
| `backend/src/main/java/com/xiaoc/backend/config/VideoConverterProperties.java` | 上传、输出默认各 500 MiB |
| `backend/src/main/java/com/xiaoc/backend/service/VideoConverterService.java` | 创建权限、退出顺序、marker-last、失败追踪、下载大小验证 |
| `backend/src/main/java/com/xiaoc/backend/service/video/VideoProcessRunner.java` | 全部外部进程登记、后代追踪、终止等待和中断保留 |
| `backend/src/main/resources/application.yml` | 500 MiB 文件、502 MiB 请求、500 MiB 输出绑定 |
| `backend/src/test/java/com/xiaoc/backend/controller/VideoConverterControllerTests.java` | Session、CSRF、注入、错误脱敏、HEAD、能力接口 500 MiB |
| `backend/src/test/java/com/xiaoc/backend/controller/VideoConverterRealTests.java` | 10 组实际媒体增加 HEAD 与取消清理断言 |
| `backend/src/test/java/com/xiaoc/backend/controller/VideoConverterUploadLimitTests.java` | 真实 Servlet 文件/请求 413 |
| `backend/src/test/java/com/xiaoc/backend/service/VideoConverterServiceTests.java` | 权限、取消、关闭、清理失败、流大小和下载边界 |
| `backend/src/test/java/com/xiaoc/backend/service/video/VideoProcessRunnerTests.java` | 真实 Java 父子进程退出 |
| `backend/src/test/java/com/xiaoc/backend/service/video/VideoTranscoderTests.java` | 真实 FFmpeg 保持预建输出文件身份/权限 |
| `frontend/src/__tests__/videoConverter.spec.js` | 500 MiB 上传选择边界 |
| `frontend/src/__tests__/videoConverterApi.spec.js` | API CSRF、任务 ID 编码、失败不重放 |
| `deploy/application-prod-example.yml` | 同步文件/请求/输出默认上限 |
| `deploy/env/win-tools.env.example` | 500/502/500 MiB 与小主机显式参数、Servlet 私有目录 |
| `deploy/nginx/win-tools.conf.example` | 502m 上传、连接和请求限流、缓冲/空闲超时 |
| `deploy/tests/deployment-tests.sh` | 上传保护与限额配置回归 |
| `deploy/README.md` | 小主机资源预算及启用检查 |
| `docs/VIDEO_CONVERTER.md` | 最新限额、清理/关闭语义和验证边界 |
| `docs/PHASE_11.18_R1_DEPENDENCY_AUDIT.md` | 29 项追溯、当前 6 项及兼容修补建议 |
| `PHASE_11.18_R1_REPORT.md` | 本轮交付证据与工作区清单 |

最终工作区仍在 `feature/phase-11.18-tool-ui-video-converter`，HEAD `fdce236`；本轮没有新增暂存项，索引只包含用户原有的 `ch5_2/.../Person.java`，其暂存 diff 与开始快照一致。以下为最终 `git status --short` 快照（目录合并显示，未操作保护目录）：

```text
 M README.md
 M backend/src/main/java/com/xiaoc/backend/config/SecurityConfig.java
 M backend/src/main/java/com/xiaoc/backend/exception/GlobalExceptionHandler.java
 M backend/src/main/resources/application.yml
 M backend/src/test/java/com/xiaoc/backend/mapper/ContentDevSeedTests.java
AM ch5_2/src/main/java/com/ch/ch5_2/model/Person.java
 M deploy/README.md
 M deploy/application-prod-example.yml
 M deploy/env/win-tools.env.example
 M deploy/nginx/win-tools.conf.example
 M deploy/tests/deployment-tests.sh
 M frontend/src/__tests__/App.spec.js
 M frontend/src/__tests__/request.spec.js
 M frontend/src/__tests__/toolExperience.spec.js
 M frontend/src/assets/main.css
 M frontend/src/components/FavoriteButton.vue
 M frontend/src/components/PopularTools.vue
 M frontend/src/components/ToolCard.vue
 M frontend/src/components/ToolPageHeader.vue
 M frontend/src/router/index.js
 M frontend/src/utils/request.js
 M frontend/src/utils/tools/registry.js
 M frontend/src/views/FavoritesView.vue
 M frontend/src/views/HomeView.vue
 M frontend/src/views/ToolsView.vue
 M sql/seed-dev.sql
?? .release/
?? PHASE_11.18_R1_REPORT.md
?? PHASE_11.18_REPORT.md
?? backend/src/main/java/com/xiaoc/backend/config/VideoConverterProperties.java
?? backend/src/main/java/com/xiaoc/backend/controller/VideoConverterController.java
?? backend/src/main/java/com/xiaoc/backend/exception/VideoConversionException.java
?? backend/src/main/java/com/xiaoc/backend/service/VideoConverterService.java
?? backend/src/main/java/com/xiaoc/backend/service/video/
?? backend/src/test/java/com/xiaoc/backend/controller/VideoConverterControllerTests.java
?? backend/src/test/java/com/xiaoc/backend/controller/VideoConverterRealTests.java
?? backend/src/test/java/com/xiaoc/backend/controller/VideoConverterUploadLimitTests.java
?? backend/src/test/java/com/xiaoc/backend/service/VideoConverterServiceTests.java
?? backend/src/test/java/com/xiaoc/backend/service/video/
?? backend/src/test/java/com/xiaoc/backend/support/VideoBrowserApplication.java
?? ch5_2/.gitattributes
?? ch5_2/.gitignore
?? ch5_2/.mvn/
?? ch5_2/mvnw
?? ch5_2/mvnw.cmd
?? ch5_2/pom.xml
?? ch5_2/src/main/java/com/ch/ch5_2/Ch52Application.java
?? ch5_2/src/main/java/com/ch/ch5_2/controller/
?? ch5_2/src/main/resources/
?? ch5_2/src/test/
?? docs/PHASE_11.18_R1_DEPENDENCY_AUDIT.md
?? docs/VIDEO_CONVERTER.md
?? frontend/e2e/video.browser.mjs
?? frontend/src/__tests__/compactToolCard.spec.js
?? frontend/src/__tests__/videoConverter.spec.js
?? frontend/src/__tests__/videoConverterApi.spec.js
?? frontend/src/api/videoConverter.js
?? frontend/src/utils/videoMessages.js
?? frontend/src/views/tools/VideoConverterView.vue
?? sql/phase-11.18-video-converter.sql
?? 备案图标.png
```

保护检查：`.release/`、原始 `备案图标.png`、工具卡片和主样式文件哈希保持不变。`ch5_2/` 内 `src/main/resources/application.properties` 与 `target/classes/application.properties` 在本轮期间出现外部修改；本次代理没有写入或恢复该目录，原用户暂存 diff 保持不变。所有外部变化按用户现场状态保留。

验证日志与审计 JSON 放在 Git 忽略的 `.cache/phase11.18-r1-*`；target/dist、FFmpeg 二进制、缓存和受保护目录不应加入后续本阶段提交。
