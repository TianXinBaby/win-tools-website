# 视频格式转换器（Phase 11.18）

页面 `/tools/video-converter`；目录来自 `/api/tools`，使用既有 `media` 分类。`sql/phase-11.18-video-converter.sql` 与开发 `seed-dev.sql` 均可重复执行，仅插入缺失记录，保留管理员修改、排序和禁用状态。

## 使用与隐私

选择或拖放单个 ASF、WMV、MP4、MKV、MOV、AVI、WebM 文件，选择输出格式后开始，默认 MP4。页面先查询服务能力，关闭或缺少依赖时不允许上传。视频上传到本站服务器，由本机 FFmpeg/FFprobe 处理，不经过第三方，不存入 MySQL。

上传百分比来自 Axios 上传事件；转换百分比来自 FFmpeg `out_time_us / FFprobe duration`，未知时显示不定进度，输出校验通过后才到 100%。取消排队任务会移出队列，运行中的任务通过约 100ms 的进程检查终止并清理。上传期间取消需等待响应取得任务 ID，再立即 DELETE；页面明确显示该状态。离开组件会尝试取消活动任务，断网/关闭浏览器不能保证取消送达，服务器超时与 TTL 仍生效。

成功输出保留 30 分钟，也可点击“删除转换文件”。输入成功后删除，失败/取消在进程退出后清理。刷新不恢复任务 ID；Session 丢失、重启或过期时提示重新上传。文件不会永久保存。

取消请求网络失败时可点击“重试查询”恢复真实任务状态；取消返回任务不存在时允许重新上传。代理直接返回 HTML 413 时，页面同样显示明确的文件超限提示。

## API

前缀 `/api/tools/video-converter`。JSON 遵循 `{code:200,message:"success",data:...}`；错误返回正确 HTTP 状态和固定 `VIDEO_*` 代码，前端仅显示白名单消息。

| 方法 | 后缀 | 请求或 data |
| --- | --- | --- |
| GET | `/capabilities` | enabled、available、reason、inputFormats、outputFormats、maxUploadBytes、maxDurationSeconds、jobTtlMinutes |
| POST | `/jobs` | multipart `file` + `targetFormat`；返回 JobView |
| GET | `/jobs/{jobId}` | JobView |
| GET | `/jobs/{jobId}/download` | 附件流 converted.format；仅 COMPLETED 可下载 |
| DELETE | `/jobs/{jobId}` | 取消并请求清理，重复取消幂等；过期后 404 |

```json
{"jobId":"UUID","status":"CONVERTING","progress":37,"targetFormat":"mp4","errorCode":null,"downloadUrl":null}
```

状态包含 QUEUED、VALIDATING、CONVERTING、COMPLETED、FAILED、CANCELLED。progress 可以为 null。只有完成才返回下载地址。所有视频响应 no-store。

现有 Spring Security 来自前阶段，本阶段不新增依赖。既有过滤链加入视频路径：允许匿名使用，同时 POST/DELETE 必须通过同一个 `HttpSessionCsrfTokenRepository`。前端先从既有匿名 `/api/admin/auth/csrf` 获取 token，再使用既有 Axios/Cookie 机制写入；管理员权限规则保持原样。随机 owner 属性存于 Session，Session ID 轮换不破坏归属；随机 job ID 本身不授予访问权限。其他 Session 的查询、下载、取消返回 404。

POST 不自动重放，每个成功 POST 创建一个任务；提交期间前端禁用重复操作，后端对所有请求执行容量检查。不接受远程 URL、用户输出路径或任意 FFmpeg 参数。文件名只用于扩展名初筛，写入随机任务目录的 `input.bin`；实际容器/视频流/时长/尺寸经 FFprobe 验证，不靠扩展名判断内容。

## 编码与进程

| 输出 | 视频 | 可选音频 |
| --- | --- | --- |
| MP4 / MKV / MOV | libx264 / H.264，yuv420p | AAC |
| AVI | MPEG-4 Part 2 | libmp3lame / MP3 |
| WebM | libvpx-vp9 / VP9 | libopus / Opus |

取首个视频和可选首个音轨，不复制字幕、附件、章节和原始元数据。奇数宽高补齐偶数，MP4/MOV faststart。缺少编码器、解码失败或损坏输入返回明确失败，能力查询只验证可执行程序可启动，不承诺任意编码均支持。

`ProcessBuilder(List<String>)` 不经过 Shell。demuxer 白名单 asf/mov/matroska/webm/avi，协议白名单 file/pipe，拒绝播放列表及网络协议。持续排空输出，每进程最多缓存 65536 个字符，单行 2048 个字符；不向用户/日志输出命令、绝对路径或进程诊断。输出校验存在、非空、FFprobe 可识别及有效时长，达到大小上限或明显截短视为失败。参考 [FFmpeg 协议说明](https://www.ffmpeg.org/ffmpeg-protocols.html) 和 [FFmpeg 白名单实现](https://github.com/FFmpeg/FFmpeg/blob/master/libavformat/options_table.h)。

## 配置与清理

| 环境变量 | 默认 |
| --- | --- |
| WIN_TOOLS_VIDEO_CONVERTER_ENABLED | false |
| WIN_TOOLS_FFMPEG_PATH / WIN_TOOLS_FFPROBE_PATH | ffmpeg / ffprobe |
| WIN_TOOLS_VIDEO_CONVERTER_TEMP_DIR | `${java.io.tmpdir}/win-tools-video` |
| WIN_TOOLS_VIDEO_CONVERTER_MAX_UPLOAD_BYTES | 524288000（500 MiB） |
| WIN_TOOLS_VIDEO_CONVERTER_MAX_REQUEST_BYTES | 526385152（502 MiB） |
| WIN_TOOLS_VIDEO_CONVERTER_MAX_OUTPUT_BYTES | 524288000（500 MiB） |
| WIN_TOOLS_VIDEO_CONVERTER_MAX_DURATION_SECONDS | 1800 |
| WIN_TOOLS_VIDEO_CONVERTER_TIMEOUT_SECONDS | 900 |
| WIN_TOOLS_VIDEO_CONVERTER_MAX_CONCURRENT_JOBS | 1 |
| WIN_TOOLS_VIDEO_CONVERTER_QUEUE_CAPACITY | 2 |
| WIN_TOOLS_VIDEO_CONVERTER_JOB_TTL_MINUTES | 30 |
| WIN_TOOLS_VIDEO_CONVERTER_MAX_RETAINED_JOBS | 12 |

配置统一见 `backend/src/main/resources/application.yml`、`deploy/application-prod-example.yml` 和 `deploy/env/win-tools.env.example`。异常配置只令能力不可用，不使网站启动失败。probe 各最多 15 秒，依赖检查各 5 秒并缓存 30 秒；转换进程最多 900 秒，完整任务还包括前后 probe 时间。编码/解码与滤镜使用 1 线程，像素数最多 3840×2160，未知时长拒绝。

应用默认最多 1 执行 + 2 等待、总保留 12 个任务（含活动与终态），容量在复制应用文件前预留，满额返回 429；生产 env 另显式收紧为 1+1、总保留 4。按用户最新要求，单文件和转换输出各限 500 MiB（页面沿用 MB 标注、按 1024 进制计算），Spring 请求及 Nginx 精确上传 location 为 502 MiB/502m，其他 API 仍 1m。下载入口另校验实际文件非空且不超过输出上限，超限返回固定 VIDEO_OUTPUT_INVALID。Nginx/Tomcat 会缓冲上传，磁盘预算必须包括代理、Servlet 临时区和任务目录；应用限制不构成 OS CPU/内存硬配额。

专用目录必须在静态根目录之外。POSIX 创建目录时设置 0700，创建 input/output/marker 时设置 0600；output 预创建后由 FFmpeg 截断写入，Windows 继承账户 ACL。清理每 30 秒执行；下载到期立即拒绝，正常删除最多滞后一个扫描周期，失败则后续重试。删除 payload 后才删除 marker，提交失败但清理未成功的任务仍在当前实例中受总保留容量限制并重试。启动仅扫描名称为 job-UUID 且 `.win-tools-job` 与 UUID 相符的过期目录，不跟随符号链接或删除未知文件；marker 未写完整且清理失败后崩溃的目录无法自动确认归属，需要人工核查。正常关闭等待外部进程和 worker 退出后清理，保留调用线程中断标记；异常重启不恢复内存任务。下载与取消并发沿用系统文件句柄语义，已打开的流可读完，删除失败时保留 marker 供扫描重试。

## 验证与部署

### 小主机生产初始参数

2 CPU / 2 GiB RAM、50 GiB 磁盘且与 MySQL 共机时，采用 `deploy/env/win-tools.env.example` 的显式生产覆盖：按用户要求上传 500 MiB / 请求 502 MiB / 输出 500 MiB，与后端大小默认一致；时长及转换超时各 300 秒、1 执行 + 1 等待、TTL 10 分钟、最多保留 4 个任务。Nginx 精确上传接口示例为 502m，全局 2 个上传请求、每 IP 1 个、每 IP 1 次/分钟，超限 429；其他接口不套用上传限制。Tomcat 只能通过回环由 Nginx 访问。

Nginx 与 Servlet 会在应用任务容量检查之前缓冲，队列不是此阶段的保护。Servlet 用 `SPRING_SERVLET_MULTIPART_LOCATION` 指向已建立的私有磁盘目录，任务目录与 Nginx body/proxy 临时区也要用 `findmnt`/`df` 核对，避免 tmpfs 消耗内存。按四任务输入/输出与两路双层上传缓冲约 6008 MiB（5.87 GiB）预算，初始为视频预留至少 8 GiB，整机剩余低于 10 GiB 或 15% 的较高者时告警并停止新上传；另给清理失败、下载缓冲、日志/备份/MySQL 留空间。这是运维预算与建议，不是应用自动执行的磁盘硬上限。

500 MiB 文件限制不等于 2 GiB 内存安全：仍允许 4K 像素，编码器、解码器参考帧与 JVM 非堆均可能有峰值。保持单转码/单线程设置，生产启用前实测 RSS、CPU、数据库延迟及磁盘清理。JVM 512 MiB 堆与 MySQL 256 MiB buffer pool 仅为现场评估起点，本次不修改 systemd 或 MySQL。进程不可中断/孤儿回收由 OS 决定，既有 systemd 30 秒关闭超时与默认 cgroup 终止为最终兜底，不代表已验证生产退出。

完整入口限流语义、磁盘告警线、磁盘不足失败边界及启用检查见 [部署资源审查](../deploy/README.md#2-cpu--2-gib-ram--50-gib-磁盘的启用检查)。本次只修改仓库示例与文档，未连接生产；依赖漏洞见 [独立审计结论](PHASE_11.18_R1_DEPENDENCY_AUDIT.md)。

常规 `mvnw.cmd test` / `verify` 不需要 FFmpeg，进程组件使用 Java 测试子进程验证超时/取消/输出限额，服务使用替身验证业务。可选真实验收：

```powershell
cd backend
$env:VIDEO_REAL_FFMPEG='C:\path\ffmpeg.exe'
$env:VIDEO_REAL_FFPROBE='C:\path\ffprobe.exe'
.\mvnw.cmd test '-Dtest=VideoConverterRealTests'
.\mvnw.cmd test-compile dependency:build-classpath '-Dmdep.outputFile=target/video-classpath.txt'
cd ..
# 先在 frontend 执行 npm.cmd run build；JAVA_HOME 指向已有 JDK 18
node frontend/e2e/video.browser.mjs
```

真实测试通过 HTTP + Cookie + CSRF + multipart，将 ASF 转成五种格式，分别包含/不含音轨，下载后以 FFprobe 校验。浏览器脚本需要 Chrome（可设 CHROME_PATH）和空闲 18081 端口，启动自己的回环 H2 后端和静态代理，使用开发 SQL 真实目录，记录截图、输入输出和 JSON 到 `.cache/phase11.18-browser-*`，结束停止自身进程。不会访问生产。

Ubuntu 安装、权限、环境、Nginx、健康检查、ASF 验收与关闭/回滚见 [部署说明](../deploy/README.md#phase-1118-视频转换后续启用)。本阶段未执行任何生产操作。
