# Win Tools

个人 Windows 资源与在线工具网站，采用前后端分离架构。

当前已实现 **Phase 11.11.3：动画互动工具**，保留原有功能和后端 API。
Windows、Tool、Article 列表和详情通过 Controller → Service → Mapper 从数据库读取，使用独立 VO 输出。
前端提供首页、三类资源列表与详情、404 页面及统一响应式布局。
已开放 JSON 格式化、UUID v4、时间戳、SHA-256、Base64、二维码生成、三种图片处理工具，以及八个娱乐工具，共十七个浏览器本地工具。
已开放管理员登录、后台 Dashboard，以及 Windows / Tool / Article 的列表、新增、编辑和单条删除。

## Phase 11.11.3：动画互动工具

- `/tools/magic-keyboard`：按键触发有数量上限的 Canvas 粒子、颜色与按键显示；可选浏览器本地合成声音，触屏设备可用示例按键。
- `/tools/crt-tv`：CSS 黑白、扫描线、噪点、闪烁效果，可随时开关。
- `/tools/fps-test`：开始后使用 `requestAnimationFrame` 测量实时 FPS、单帧耗时和本次平均 FPS；停止或离开页面时取消动画帧。
- `/tools/typing-test`：首个字符开始计时，按每 5 个正确字符折算 WPM，显示正确率与用时；最佳成绩存于当前浏览器的 `localStorage`。

四个工具不上传用户输入，也不调用第三方 API。工具目录继续使用 `tool` 表，无结构和后端 API 变更。开发库可重新运行 `sql/seed-dev.sql`；已有数据库先执行 `USE win_tools;`，再运行 `SOURCE D:/study/win-tools-website/sql/phase-11.11.3-fun-tools.sql;`。脚本重复执行不会新增重复记录，也不会覆盖已有工具。Nginx 示例已有 history 路由回退。实现和验证见 [阶段报告](PHASE_11.11.3_REPORT.md)。

## Phase 11.11.2：基础娱乐工具

- `/tools/nickname-generator`：从四类内置词库随机组合昵称，可复制结果。
- `/tools/ascii-art`：将最多 32 个英文字母、数字、空格和 `. , ! ? - :` 转为 5×7 ASCII 字符艺术，可清空与复制；未映射字符会显示说明。
- `/tools/lucky-wheel`：输入 2–12 个选项，浏览器本地随机选中等大扇区，旋转后显示结果，可重新开始。
- `/tools/reaction-test`：随机等待 1.5–4 秒，点击目标后按单调时钟计算毫秒成绩；仅最佳成绩保存在当前浏览器的 `localStorage`。

四个工具不发送用户输入或测试结果到 API。工具目录沿用 `tool` 表和 `/api/tools`，仅增加 `category=fun` 元数据，未改表结构或 API 格式。开发库可重新运行 `sql/seed-dev.sql`；已有数据库可单独运行 `sql/phase-11.11.2-fun-tools.sql`，该脚本只新增缺失的四条工具数据，保留已有记录。具体实现和验证见 [阶段报告](PHASE_11.11.2_REPORT.md)。

## 第十阶段：生产配置与部署准备

```text
Internet → HTTPS 443 → Nginx ┬→ Vue dist 静态文件
                            └→ /api → Spring Boot 127.0.0.1:8080 → MySQL 8
```

详细步骤见 [腾讯云 Linux 部署手册](docs/deployment/tencent-cloud.md)。
示例位于 `deploy/env/`、`deploy/nginx/`、`deploy/systemd/`；本阶段未执行真实腾讯云部署。

- `application-prod.yml` 通过 `SPRING_PROFILES_ACTIVE=prod` 激活；数据库读取 DB_HOST、DB_PORT、
  DB_NAME、DB_USERNAME、DB_PASSWORD，用户名和密码没有默认值；启动不自动初始化数据库。
- 生产使用 `SESSION_COOKIE_SECURE=true`、HttpOnly、SameSite=Lax、30m Session。
  保持 CSRF、Session 轮换和同源 API，不放宽 CORS；INFO 日志不输出 SQL 或请求正文。
- Nginx 统一设置生产 CSP 和其他安全响应头、80→443、TLS 1.2/1.3、SPA fallback；
  后端仅监听回环地址，通过 framework 识别受信代理转发的 HTTPS。
- 新增公开 `GET /api/health`，精确返回
  `{"code":200,"message":"success","data":{"status":"UP"}}`，仅表明进程存活，不检查数据库或暴露系统信息。
- 应用由非 root 的 win-tools 用户通过 systemd 运行 `java -jar`；前端只部署 dist。
  env 权限 600，禁止 chmod 777；安全组不向公网开放 8080/3306。
- 无默认管理员；离线 BCrypt 辅助类仅在 test scope，执行方式见部署手册。
  当前未实现登录失败限流，部署前须审核管理入口来源限制。
- 真实 `.env`、`*.env`、私钥、证书、target/dist 不提交；示例文件仅含占位符。
  生产不默认导入 seed-dev.sql，发布前备份数据库与上一版 Jar/dist。

新增自动测试覆盖 prod 配置绑定、真实 Servlet Cookie、转发 HTTPS、安全响应头、无敏感信息的异常日志和 JSON、
health、容器错误及离线 Hash。Chrome 生产 CSP 验证方法见 [前端 README](frontend/README.md)。
真实 MySQL 与真实 Linux/Nginx/systemd/TLS 部署验收仍需授权环境，不能用 H2 测试替代。

## 当前技术栈

- JDK 18
- Spring Boot 3.5.16（稳定版，Java 18 在其兼容范围内）
- Spring Web、Spring Validation、Lombok
- Spring Security 6.5.11；spring-security-test 6.5.11（test scope），均由 Spring Boot BOM 管理
- MySQL 8 / MySQL Connector/J 9.7.0（runtime，由 Spring Boot 管理版本）
- MyBatis-Plus Spring Boot 3 Starter 3.5.17
- H2 2.3.232（仅 test scope，由 Spring Boot 管理版本）
- Maven 3.9.11 / Maven Wrapper 3.3.4
- JUnit 5、Spring Boot Test、MockMvc

版本兼容性参考 [Spring Boot 3.5 系统要求](https://docs.spring.io/spring-boot/3.5/system-requirements.html)。
MyBatis-Plus 使用[官方 Spring Boot 3 Starter](https://baomidou.com/en/getting-started/install/)，
不额外引入 MyBatis Starter、XML Mapper 或无实际用途的插件。
Connector/J 9.7.0 是支持 MySQL Server 8.0 及以上的正式版本，见
[官方版本说明](https://dev.mysql.com/doc/relnotes/connector-j/en/news-9-7-0.html)。
前端使用 JavaScript / HTML5 / CSS3，基于 [Vue 官方 create-vue](https://vuejs.org/guide/quick-start) 创建：

- Vue 3.5.43 / Vite 8.3.0
- Vue Router 5.3.1 / Axios 1.20.0 / Element Plus 2.14.6
- Vitest 4.1.11 / Vue Test Utils 2.5.1 / jsdom 30.1.0（仅开发测试）
- ESLint 10.11.0 / Prettier 3.9.6
- qrcode 1.5.4：专用二维码编码依赖，使用浏览器 Canvas 输出；[上游文档](https://github.com/soldair/node-qrcode)。现有依赖不提供 QR 编码，未新增图片处理依赖。

精确依赖由 `frontend/package-lock.json` 锁定。Element Plus 的 Button、Alert、Empty、Skeleton、Tag
在 `main.js` 中直接注册并引入对应样式，未添加自动导入插件或复杂组件配置。

## 当前目录结构

```text
win-tools-website/
├── AGENTS.md
├── .editorconfig
├── .gitattributes
├── .gitignore
├── README.md
├── deploy/（env、Nginx、systemd 的 example 配置）
├── docs/deployment/tencent-cloud.md
├── frontend/
│   ├── public/favicon.svg
│   ├── src/
│   │   ├── api/（公开资源、adminAuth.js、adminRequest.js、三类 admin 资源 API）
│   │   ├── assets/main.css
│   │   ├── components/（请求状态、Windows / Tool / Article 卡片）
│   │   ├── composables/useResource.js
│   │   ├── layouts/（MainLayout.vue、AdminLayout.vue）
│   │   ├── router/（index.js、adminGuard.js）
│   │   ├── utils/（request.js、urls.js、tools/ 工具核心逻辑和开放状态，tools/fun/ 娱乐工具逻辑）
│   │   ├── views/（首页、列表、详情、404、tools/ 十七个工具页面、admin/ 登录、Dashboard 与内容管理）
│   │   ├── __tests__/
│   │   ├── App.vue
│   │   └── main.js
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.js
│   └── vitest.config.js
├── sql/
│   ├── init.sql
│   ├── seed-dev.sql
│   ├── phase-11.11.2-fun-tools.sql
│   └── phase-11.11.3-fun-tools.sql
└── backend/
    ├── .mvn/wrapper/maven-wrapper.properties
    ├── mvnw
    ├── mvnw.cmd
    ├── pom.xml
    └── src/
        ├── main/
        │   ├── java/com/xiaoc/backend/
        │   │   ├── BackendApplication.java
        │   │   ├── common/ApiResponse.java
        │   │   ├── config/SecurityConfig.java
        │   │   ├── security/（AdminPrincipal、JsonSecurityHandler、AdminHttpFirewall）
        │   │   ├── dto/AdminLoginRequest.java
        │   │   ├── controller/（HelloController、WindowsController、ToolController、ArticleController、AdminAuthController）
        │   │   ├── entity/（WindowsVersion、Tool、Article、AdminUser）
        │   │   ├── mapper/（对应的四个 BaseMapper 接口）
        │   │   ├── service/（WindowsVersionService、ToolService、ArticleService、AdminAuthService、AdminUserDetailsService）
        │   │   ├── service/impl/（对应的三个 Service 实现）
        │   │   ├── vo/（WindowsVersionListVO、WindowsVersionDetailVO、ToolVO、ArticleListVO、ArticleDetailVO、AdminUserVO、AdminCsrfVO）
        │   │   └── exception/（GlobalExceptionHandler、ResourceNotFoundException）
        │   └── resources/（application.yml、application-prod.yml）
        └── test/
            ├── java/com/xiaoc/backend/
            │   ├── BackendApplicationTests.java
            │   ├── controller/（HelloControllerTests、WindowsControllerTests、ToolControllerTests、ArticleControllerTests）
            │   ├── service/（WindowsVersionServiceTests、ToolServiceTests、ArticleServiceTests）
            │   ├── mapper/（DatabaseMapperTests、WindowsDevSeedTests、ContentDevSeedTests）
            │   └── exception/GlobalExceptionHandlerTests.java
            └── resources/
                ├── application-test.yml
                ├── sql/（schema-h2.sql、windows-query-data.sql、content-query-data.sql）
                └── mockito-extensions/org.mockito.plugins.MockMaker
```

`target/`、`node_modules/`、`dist/`、本地 `.cache/`、IDE 私有文件以及 `.env` 已加入忽略规则。

## 环境要求

- JDK 18；`JAVA_HOME` 应指向 JDK 18 安装目录。
- Windows PowerShell 或 CMD。
- 首次使用 Wrapper 需要联网下载 Maven 和依赖，无需安装全局 Maven。
- 默认端口 `8080` 可用；开发数据库使用本地 MySQL 8，测试不需要本地 MySQL。
- 前端要求 Node.js `^22.18.0 || >=24.12.0`，本阶段使用 Node.js 24.20.0 / npm 11.19.0 验证。
- 前端开发端口 `5173` 可用；不需要 Docker，不修改系统 Java / Node 配置。

IntelliJ IDEA 可以直接打开 `backend/pom.xml`，项目 SDK 和 Maven Runner JRE 均选择 JDK 18，Maven 选择 Wrapper。

## 启动后端

先按下方 Database 章节初始化 MySQL，并在当前终端设置 `DB_PASSWORD`。
然后在项目根目录的 PowerShell 中执行：

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

CMD 中对应命令为：

```bat
cd backend
mvnw.cmd spring-boot:run
```

按 `Ctrl+C` 停止。应用名称为 `backend`，端口为 `8080`，配置位于 `backend/src/main/resources/application.yml`。

Linux 环境也保留了官方 Wrapper 脚本，可在 `backend` 中使用 `sh mvnw spring-boot:run`。

## 启动前端

先在单独终端按上文启动后端，再在项目根目录打开另一个 PowerShell：

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

首次创建工程时使用 `npm.cmd install` 生成并提交锁文件；克隆仓库及后续验证使用 `npm.cmd ci`。
PowerShell 统一使用 `npm.cmd`，避免 `npm.ps1` 被 ExecutionPolicy 阻止；不要为此修改执行策略。
无需创建 `.env`。访问 [前端首页](http://localhost:5173)，后端地址为 [localhost:8080](http://localhost:8080/api/hello)。
按 `Ctrl+C` 停止开发服务。端口被占用时 Vite 会报错，不会静默换端口。

`vite.config.js` 将 `/api` 原路径代理到 `http://localhost:8080`。浏览器只访问同源 `/api/...`，
页面不硬编码后端地址。生产构建不包含开发代理，未来部署时需要 Nginx 转发 `/api` 到后端，
并为 Vue Router history 模式配置前端路径回退到 `index.html`；本阶段未部署。

### 页面与 API 集成

| 路由 | 页面作用 |
| --- | --- |
| `/` | Hero、热门 Windows、常用工具、最新文章；独立请求三个已有列表，各取前三项 |
| `/windows` | 展示版本、版本名称、架构、发布日期、简介与详情入口 |
| `/windows/:id` | Windows 详情、SHA-256、官方链接、可选图片 |
| `/tools` | 从后端读取工具元数据，展示开放状态并优先使用有效的 `path` 进入工具 |
| `/tools/json` | JSON 格式化、压缩、复制和清空 |
| `/tools/uuid` | UUID v4 单个 / 批量生成，最多 100 个 |
| `/tools/timestamp` | Unix 秒 / 毫秒与浏览器本地日期时间双向转换 |
| `/tools/sha256` | UTF-8 文本 SHA-256 Hash |
| `/tools/base64` | UTF-8 文本 Base64 编解码，支持中文和 emoji |
| `/tools/qrcode` | 文本 / URL 生成二维码，下载 PNG |
| `/tools/image-compress` | JPEG / WebP 质量调整、PNG 重新编码 |
| `/tools/image-resize` | 保持原图比例或自定义宽高，下载图片 |
| `/tools/image-convert` | 静态 JPEG / PNG / WebP 格式转换 |
| `/tools/nickname-generator` | 四类内置词库随机组合昵称、复制 |
| `/tools/ascii-art` | 本地字符映射生成 ASCII 艺术、清空、复制 |
| `/tools/lucky-wheel` | 自定义选项、旋转、随机停靠和重新开始 |
| `/tools/reaction-test` | 随机等待、反应时间、浏览器本地最佳成绩 |
| `/tools/:slug` | 未实现工具的通用介绍，继续提示尚未开放 |
| `/articles` | 文章标题、摘要、封面、分类、浏览量、发布时间；不展示正文 |
| `/articles/:id` | 文章纯文本正文、摘要、封面及发布时间 / 更新时间等信息 |
| `/admin/login` | 管理员登录 |
| `/admin` | 管理员 Dashboard 和内容管理导航 |
| `/admin/windows` | Windows 管理：列表、新增、编辑、单条删除 |
| `/admin/tools` | 工具目录管理：列表、新增、编辑、单条删除 |
| `/admin/articles` | 文章管理：草稿 / 发布、普通文本正文编辑、单条删除 |
| 其他路径 | 404 页面，提供返回首页入口 |

顶部导航、主内容和 Footer 由 `MainLayout` 统一提供；CSS Grid / Flexbox 适配桌面、平板、手机，
长标题、URL、SHA-256 和正文可换行。所有请求页面提供加载、空数据、错误及重试状态。
首页各区块独立处理错误；同类详情路由参数变化会重新加载，迟到的旧请求不会覆盖新页面。

`src/utils/request.js` 统一配置 Axios（`baseURL: '/api'`，超时 10 秒），成功解包 `ApiResponse.data`。
已知公开错误消息转为中文，未知业务错误、HTTP 500、网络错误和超时均提供安全提示，
不展示 SQL、堆栈、Axios 内部对象或服务器原始错误内容。
`src/api/windows.js`、`tools.js`、`articles.js` 封装六个列表 / 详情 GET 方法。

文章通过 Vue 文本插值和 `white-space: pre-wrap` 展示，**不使用 `v-html` 或 Markdown 解析器**。
Windows 下载仅使用后端提供的 HTTPS `microsoft.com` 或其子域链接，拒绝非官方域名与带凭据的 URL；
前端不生成其他下载地址，不存储 ISO。图片拒绝 `javascript:`、`data:` 等非 HTTP(S) 协议。
未配置真实前端环境文件，也不将数据库凭据传入前端。

### 第六阶段：基础在线工具

五个工具的计算完全在浏览器本地运行，用户输入不会发送到服务器、API、数据库或日志系统。
不使用 localStorage、sessionStorage、IndexedDB 或 Cookie 保存输入；不新增 Analytics，不记录输入到 console。
刷新或离开页面后丢弃工具状态。工具计算不依赖后端；首页和工具目录仍从已有 API 读取元数据。

- JSON 使用原生 JSON.parse / JSON.stringify，支持所有合法 JSON 值；错误时提供友好提示。
- UUID 优先使用 crypto.randomUUID，缺失时使用 crypto.getRandomValues 设置 v4 version / variant；不使用 Math.random。
  支持快捷数量 1、5、10、20、50 及自定义 1–100。UUID 用于唯一标识，不作为密码、密钥或安全 Token。
- 时间戳必须明确选择秒或毫秒，接受整数和负数，检查 Date 有效范围；日期输入和结果均使用浏览器本地时区。
  同时显示当前时间、Unix 秒和毫秒，每秒刷新；秒结果向下取整。无效日期及夏令时跳过的时间报错，重复时间按 Date 规则选择较早时刻。
- SHA-256 使用 TextEncoder 和 crypto.subtle.digest，输出 64 位小写十六进制；是 Hash，不是加密，不能解密。
- Base64 使用 TextEncoder / TextDecoder 处理 UTF-8；接受标准 Base64 的必要 = 填充和 ASCII 空白，拒绝非法编码及非 UTF-8 数据。
  支持中文、emoji、空文本及多行文本。Base64 是编码，不是加密，不能保护敏感信息。
- 复制使用 navigator.clipboard.writeText，明确反馈成功、失败或不支持；可手动选中结果复制。
  Web Crypto、文本编码或解码 API 缺失时提示不支持，不引入替代算法或依赖。

Web Crypto 和剪贴板通常需要安全上下文：本地开发使用 localhost，未来部署使用 HTTPS。
五个具体路由位于通用 /tools/:slug 之前；轻量 registry 仅维护开放的 slug，不复制后端名称、描述等元数据。
工具卡片优先采用解析为对应工具的站内 path，异常 path 按路由名称回退；未开放工具继续展示原有详情。

### 第七阶段：二维码与图片处理

图片和输入内容仅在当前浏览器中处理，不会上传服务器。
不发送用户内容到 `/api` 或 Analytics，不写数据库、浏览器存储、IndexedDB、Cookie 或 console。
刷新或离开页面后丢弃状态。工具目录继续从原有 API 获取元数据，媒体计算不依赖后端。

- 二维码按钮生成，支持文本、中文、emoji、URL；URL 仅作为文本编码，不访问、不验证、不生成追踪链接。
  二维码是编码，不是加密。尺寸为 128 / 256 / 512 / 1024 px，最多 1200 个 UTF-8 字节，过密内容要求更大尺寸。
  下载为 `qrcode.png`，保留四个模块的空白边界。
- 图片输入和输出重点支持静态 JPEG / PNG / WebP。拒绝 GIF 和动画 WebP，不支持 HEIC、RAW、PSD、AVIF。
  集中限制单文件 20 MiB（20 × 1024 × 1024 字节）、单边 8192 px、总像素 1600 万；处理前读取格式头检查尺寸，解码后再次检查。
- 压缩默认质量 80%，JPEG / WebP 可调 10%–100%。PNG 仅重新编码，不显示质量滑块，也不保证文件变小。
  结果显示原大小、输出大小、节省字节和比例；没有变小会明确提示，节省数值最低为零。
- 尺寸调整默认保持原图比例，修改宽或高时按原始尺寸计算另一边；可关闭比例锁自定义正整数宽高。
  输出保留原 MIME 格式，不静默更改格式。下载文件名含目标宽高。
- 格式转换显式选择 JPEG / PNG / WebP。JPEG 不支持透明背景，透明区域将填充为白色。
  PNG 保留透明通道，JPEG / WebP 提供质量设置。浏览器导出若回退为不同 MIME，会报错并建议改选格式。
- 处理后的图片通常不会保留原始 EXIF 等元数据；不承诺绝对清除全部元数据。
  优先使用 `createImageBitmap` 和 `imageOrientation: 'from-image'`，缺失时使用 HTMLImageElement 解码；不承诺完全兼容所有 EXIF 方向。
- 本地预览使用 Blob Object URL；替换、清空、卸载时释放，下载 URL 启动后延迟回收。
  释放 Bitmap 和临时 Canvas，处理期间禁用重复操作；清空或离开后过期任务不再显示结果。
  下载生成新文件，不自动覆盖原文件，文件名清理路径分隔符、非法字符和 Windows 保留名称。

需要浏览器支持 File / Blob、Canvas 2D、`canvas.toBlob` 和 Object URL；不支持时显示中文错误。
WebP 编码及照片方向行为取决于浏览器。文件大小与像素保护可降低内存风险，接近上限的图片仍可能耗时。

### 前端测试与构建

在 `frontend` 目录执行：

```powershell
npm.cmd ci
npm.cmd run lint
npm.cmd run format:check
npm.cmd run test
npm.cmd run build
npm.cmd audit
```

`npm.cmd run test` 一次性执行 Vitest，`npm.cmd run test:unit` 用于监听开发；`npm.cmd run format` 格式化前端文件。
测试使用 Vue Test Utils + jsdom、模拟 API / Axios adapter，覆盖请求解包和错误处理、六个 API 路径、
全部路由、页面状态与重试、详情参数切换、旧请求竞态、文章 XSS、官方链接校验和首页部分失败。
新增工具测试覆盖 JSON 类型、UUID v4 / 数量限制、时间戳边界与固定时钟、真实 SHA-256 标准向量、Unicode Base64、
复制失败、工具关键交互、异步清空竞态、具体路由和通用详情回归。保留第五阶段全部测试，通用详情用例改用未开放 slug。
媒体测试覆盖格式头检查、文件和像素限制、尺寸比例、质量、文件名、Canvas 参数、白背景、失败恢复、Object URL 生命周期、清空竞态与新路由。
jsdom 仅验证逻辑和模拟 Canvas 边界，实际图片质量与导出通过真实浏览器验证。
媒体浏览器验证脚本及运行方法见 [frontend/README.md](frontend/README.md)，只使用程序生成素材并将产物保存在 `.cache/`。
Vitest 不需要 MySQL，不连接真实 API；管理员 Chrome 验证连接隔离的 Spring Boot + H2 测试服务。
未引入 E2E 框架或 Mock Service Worker。

`npm.cmd run build` 产物位于 `frontend/dist/`，不会写入后端 `resources/static`，不提交 Git。
可用 `npm.cmd run preview` 本地查看生产构建；preview 仅供本地检查，不是生产服务器，真实部署需按上文配置反向代理。

### 前后端联调边界

真实 MySQL 联调需要在后端进程环境提供 `DB_PASSWORD`，并先手工初始化数据库。
访问首页及三个列表，从实际数据进入详情；检查浏览器 Network 中 `/api/windows`、`/api/tools`、
`/api/articles` 均返回统一 JSON，并检查不存在资源的 404 状态。
当前阶段执行环境未提供数据库凭据，未使用真实 MySQL 完成后台 CRUD 实机验证。
后端自动认证测试使用 H2；前端 Vitest 使用模拟响应，Chrome 联调使用隔离 H2 测试管理员。
这些测试不能据此证明真实 MySQL 已连通。

## 第八阶段：管理员认证与后台基础框架

认证使用 Spring Security + BCrypt（strength 12）+ 服务端 HTTP Session + HttpOnly Cookie + CSRF。
没有 JWT、Access / Refresh Token、普通用户注册或复杂 RBAC；前端没有新增依赖。
认证依据是服务端 Session，前端仅在运行时内存保存管理员显示信息。

### 账户和密码

复用现有 `admin_user` 表，未修改正式数据库结构。`admin_user.password` 必须保存 BCrypt Hash，禁止明文密码。
只有 `status = 1` 可以登录；密码错误、用户名不存在及禁用账户统一返回 HTTP 401 和 `用户名或密码错误`。
用户名最多 100 字符并 trim；密码最多 72 字符，不 trim，也不增加最短长度规则。

**项目不会创建默认管理员。** 正式 SQL、开发 seed 和应用启动流程都不创建管理员账户。
真实数据库没有管理员是允许状态；管理员初始化必须按部署文档的离线运维流程显式执行。
当前没有匿名注册 / 创建管理员接口或公开密码 Hash API，也不在配置和文档中提供真实密码。
测试凭据仅存在于测试源码和明确的浏览器 test fixture 中，不进入正式 Jar 或 SQL。

### 认证 API

接口均返回现有 `ApiResponse`。成功的 login / me 的 `data` 仅包含 `id`、`username`、`nickname`。

| 方法和路径 | 认证要求 | CSRF | HTTP 状态 |
| --- | --- | --- | --- |
| `GET /api/admin/auth/csrf` | 可匿名 | 获取真实 token 和 headerName | 200 |
| `POST /api/admin/auth/login` | 可匿名 | 必须 | 成功 200；参数错误 400；凭据错误 401；CSRF 错误 403 |
| `GET /api/admin/auth/me` | ROLE_ADMIN | 安全读取不要求提交 token | 200；未认证 401；权限不足 403 |
| `POST /api/admin/auth/logout` | ROLE_ADMIN | 必须 | 200；未认证且 CSRF 有效 401；CSRF / 权限错误 403 |

登录 JSON 包含 `username` 和 `password`。前端先 GET csrf，再把返回的 `token` 放到 `headerName` 指定的请求头中。
退出前重新 GET csrf 并以同样方式携带请求头；CSRF token 仅用于当前操作，不写入 localStorage、sessionStorage 或 IndexedDB。
登录成功会轮换 Session ID、清除旧 CSRF token，并显式把 SecurityContext 保存至 HTTP Session。
退出使用 Spring Security 的 LogoutHandler 清空认证并使 Session 失效，之后 `/me` 返回 401。没有 GET logout。

401 / 403 使用 JSON Handler，登录失败使用安全的统一文案，不返回 HTML 登录页、302、Java 类名或内部堆栈。
安全过滤链只保护 `/api/admin/**`，除 csrf GET 与 login POST 外均需要 ROLE_ADMIN。
公开 Hello / Windows / Tools / Articles 保持匿名访问，原有公开 404、写入方法 405 保持不变。
URL 防火墙仅为既有的精确 `GET /api/tools/%25`（字面 `%` slug）保留兼容路径，后台编码路径和双重编码仍拒绝。
未来新增可修改数据的接口应放在受 CSRF 保护的后台路径中。

实现参考 Spring Security 6.5 的 [Session 持久化与认证策略](https://docs.spring.io/spring-security/reference/6.5/servlet/authentication/session-management.html)
及 [CSRF 文档](https://docs.spring.io/spring-security/reference/6.5/servlet/exploits/csrf.html)。

### Session 和生产配置

- Session 空闲超时为 30 分钟，使用 Cookie 传递，禁止 URL 重写传递 Session ID。
- Cookie 设置 `HttpOnly=true`、`SameSite=Lax`；前端不读取 Session Cookie 或 Session ID。
- 本地 HTTP 默认 `Secure=false`。**生产必须使用 HTTPS，并设置 `SESSION_COOKIE_SECURE=true`。**
- 保留 Session fixation protection；自定义登录显式调用 `ChangeSessionIdAuthenticationStrategy` 和 `CsrfAuthenticationStrategy`。
- Nginx 同站点转发 `/api`，开发沿用 Vite `/api` proxy。浏览器自动携带同源 Cookie，无需读取 Cookie 或添加跨域认证方案。

### 后台页面和测试

`/admin/login` 提供用户名、密码、loading 和安全错误提示；`/admin` 显示基础欢迎信息和退出操作。
进入后台或登录页由路由守卫调用 `/me` 检查 Session，刷新同样从服务端恢复，不信任内存或持久化 boolean。
后台请求返回 401 时清理运行时状态、跳转登录并提示重新登录；网络失败不放行后台，不无限重试。
退出先完成后端 logout，成功后才清理状态和跳转。Dashboard 提供内容管理入口，不展示假统计。

后端测试覆盖真实 CSRF 往返、登录 / me / logout、Session ID 轮换、旧 CSRF 失效、Cookie 配置、错误响应和公开 API 回归。
前端测试覆盖表单、loading、CSRF 顺序与请求头、服务端认证恢复、路由守卫、失效跳转和退出。
真实 Chrome 通过 Vite proxy 验证隔离 H2 账户的登录、刷新、退出、HttpOnly / SameSite Cookie、无持久化存储及四档屏宽。
复现命令见 [frontend/README.md](frontend/README.md)。截图和报告仅输出到被忽略的 `.cache/`。

## 第九阶段：后台内容管理 CRUD

三个管理页共用轻量表单和列表组件，提供加载状态、错误提示、保存中禁用、成功刷新和
`ElMessageBox.confirm` 删除确认。删除失败保留原列表。文章正文使用普通 textarea，不执行 HTML，
不使用 `v-html`、Markdown 或富文本编辑器。工具管理只维护目录元数据，不生成新的工具实现。

### 管理 API

全部位于既有 Spring Security 的 `/api/admin/**` 保护范围，需要 `ROLE_ADMIN`。
沿用 BCrypt、服务端 Session 和 HttpOnly Cookie，不使用 JWT。
POST / PUT / DELETE 必须携带 CSRF；前端每次写入先 GET `/api/admin/auth/csrf`，
使用返回的 headerName 和 token。不缓存 token、不自动重放写请求，403 显示错误后由用户重试。
后台 API 401 清理内存认证状态并跳转登录。匿名 GET 返回 401；写请求有有效 CSRF 但未登录时
返回 401，无有效 CSRF 时先返回 403；已认证但无管理员角色返回 403。

| 资源 | 列表 | 详情 | 新增 | 更新 | 删除 |
| --- | --- | --- | --- | --- | --- |
| Windows | GET `/api/admin/windows` | GET `/api/admin/windows/{id}` | POST `/api/admin/windows` | PUT `/api/admin/windows/{id}` | DELETE `/api/admin/windows/{id}` |
| Tool | GET `/api/admin/tools` | GET `/api/admin/tools/{id}` | POST `/api/admin/tools` | PUT `/api/admin/tools/{id}` | DELETE `/api/admin/tools/{id}` |
| Article | GET `/api/admin/articles` | GET `/api/admin/articles/{id}` | POST `/api/admin/articles` | PUT `/api/admin/articles/{id}` | DELETE `/api/admin/articles/{id}` |

独立 Admin Controller → Admin Service → 既有 Mapper；请求使用 SaveRequest DTO，
响应使用 Admin VO，均复用 `ApiResponse`，不直接暴露 Entity。成功返回 200，删除的 data 为 null。
详情、更新和删除不存在的资源返回 404；非法字段返回统一 JSON 400；
Tool / Article slug 重复返回友好 409，数据库唯一约束兜底并发冲突，同样不泄露 SQL。

### 字段与边界

- Windows：name（100）、version（50）、edition（100）、architecture（20）必填；
  releaseDate 为可空 ISO 日期；description 最多 10000 字符；sha256 为空或 64 位十六进制。
  officialDownloadUrl 最多 1000 字符，可空；非空必须为 HTTPS、microsoft.com 或其子域名，
  不允许用户名 / 密码或非标准端口。imageUrl 可空，最多 1000 字符，只保存 HTTPS URL。
- Tool：name / slug 最多 100 字符且必填，icon 最多 255、description 最多 10000、
  category 最多 100；path 必填且最多 255，必须为 `/tools/...`，各路径段仅小写字母、
  数字和分隔用连字符，拒绝外部 URL、路径穿越、查询串及编码路径。
- Article：title 必填且最多 255，slug 必填且最多 200，summary 最多 1000，
  **content 最多 100000 字符**，category 最多 100，coverImage 可空且最多 1000，仅 HTTPS URL。
  viewCount 仅显示，创建固定为 0，更新 SQL 不写此字段；id 和时间戳也不属于 SaveRequest。
- 两类 slug 仅允许小写字母、数字和中间连字符；更新允许保留自身 slug。
  所有 status 必填且仅 0 / 1；Windows / Tool 的 sortOrder 必填，范围 0～1000000。
  前端提示规则，后端通过 `@Valid`、`@NotBlank`、`@NotNull`、`@Size`、
  `@Pattern`、`@Min`、`@Max` 和 HTTPS URL 校验强制执行。

后台列表包含 disabled / draft：Windows / Tool 按 sort_order ASC、id ASC；
Article 按 created_at DESC、id DESC。公开 API 仍只查询 status=1，状态修改或删除立即生效。
PUT 提交完整可编辑字段，可空字段传 null 可以清除旧值。事务覆盖每次单条写操作；
created_at / updated_at 继续由数据库默认值和 ON UPDATE 管理。
现有 schema 无外键依赖和软删除字段，本阶段使用单条物理删除，没有修改正式表结构。

本阶段不包含图片 / 文件上传、普通用户系统、管理员账户管理、复杂角色权限、分页、
搜索、批量操作、对象存储、富文本或 Markdown 渲染。

### 验证范围

H2 MySQL mode + MockMvc 覆盖三类 CRUD、所有权限 / CSRF 边界、校验、唯一冲突、
可空字段清除、只读字段保护、公开状态联动和删除后的 404。
Vitest 覆盖真实组件交互、请求 payload、删除确认、loading、错误提示、CSRF 顺序和认证回归。
`node e2e/admin.browser.mjs` 在隔离 H2 和真实无头 Chrome 中验证三个管理页 CRUD、
文章草稿发布、正文编辑、Session 刷新恢复、退出、401 跳转及缺少 CSRF 的 403。
检查 1440 / 768 / 390 / 320 px 宽度，截图和报告保存在忽略目录 `.cache/`。
未使用真实 MySQL 完成后台 CRUD 实机验证；H2 验证不能替代生产 MySQL 联调。

## Database

开发数据库为 **MySQL 8**，数据库名为 `win_tools`。初始化脚本为 `sql/init.sql`，
字符集为 `utf8mb4`，排序规则为 MySQL 8 支持的
[`utf8mb4_0900_ai_ci`](https://dev.mysql.com/doc/refman/8.0/en/charset-server.html)。
应用不会自动执行正式初始化 SQL（`spring.sql.init.mode=never`）。

### 初始化与手工验证

1. 启动本地 MySQL 8 服务。找到实际安装目录中的 `mysql.exe`，无需将其加入 PATH。
2. 在 PowerShell 中连接；将下面的客户端路径替换为实际路径，密码在提示时输入：

   ```powershell
   & 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe' --host=localhost --port=3306 --user=root --password --default-character-set=utf8mb4
   ```

3. 在 **MySQL 客户端内**执行（`SOURCE` 后的路径使用正斜杠）：

   ```sql
   SOURCE D:/study/win-tools-website/sql/init.sql;
   SELECT DATABASE();
   SHOW TABLES;
   SHOW CREATE TABLE windows_version;
   ```

   脚本会创建 `win_tools` 和四张表；执行账户需要相应的建库、建表权限。
   `IF NOT EXISTS` 允许重复执行且保留已有数据，但不会修复或迁移已存在的表结构。
   初始化脚本不插入任何 Windows 下载数据或默认管理员账户。
4. 可选：在同一个 MySQL 客户端会话中导入本地开发示例：

   ```sql
   USE win_tools;
   SOURCE D:/study/win-tools-website/sql/seed-dev.sql;
   ```

   `seed-dev.sql` 仅供开发演示，与正式建表脚本分开，应用不会自动执行。
   示例包含 Windows 11 / Windows 10，下载入口只使用 Microsoft 官方页面，不存储 ISO。
   示例版本不代表官方入口当前提供的版本；发布日期和 SHA256 未确认，因此使用 `NULL`。
   同时包含 17 个工具目录项（五个基础工具、四个媒体工具、八个娱乐工具）和 3 篇原创简短示例文章。
   工具表继续只提供元数据；八个娱乐工具的 `category` 均为 `fun`，slug / path 与前端路由一致。
   已导入过的开发库需手工再次执行 seed 才会出现新增目录项；脚本不自动运行。
   已有数据库如只需 Phase 11.11.3 数据，先执行 `USE win_tools;`，再执行 `SOURCE D:/study/win-tools-website/sql/phase-11.11.3-fun-tools.sql;`，无需导入开发演示内容。若还缺少 Phase 11.11.2 数据，另行运行 `sql/phase-11.11.2-fun-tools.sql`。
   早期五个工具的描述和示例文章保留目录阶段文案，不代表当前开放状态；前端 registry 标注实际开放状态。示例文章不是完整技术教程。
   Windows 按名称、版本、edition、architecture 判断是否存在，Tool / Article 按各自 slug 判断。
   在单个本地会话中顺序重复执行不会重复插入，不覆盖已有数据、不重新启用 disabled 工具、不发布已有 draft。
   不创建默认管理员、密码或密钥。不用于并发执行，未为 seed 新增业务唯一约束。
5. 退出 MySQL 客户端，在 PowerShell 中设置下节环境变量，运行后端，再访问 `/api/hello`。
   Hello 本身不查询数据库，HTTP 200 **不能单独证明**应用已经连通 MySQL。
   还应访问 `/api/windows`、`/api/tools`、`/api/articles`，从结果选择有效 ID / slug 验证详情，
   并用不存在的 ID / slug 验证 404；如果已有 disabled 工具或 draft 文章，也应确认其详情为 404。
   当前自动化验证使用 H2，真实 MySQL 的 JDBC 连接及 API 行为仍需在凭据可用后单独验证。
   验证完成后使用 `Ctrl+C` 停止后端。

### 连接配置

`backend/src/main/resources/application.yml` 读取以下环境变量：

| 变量 | 默认值 / 用途 |
| --- | --- |
| `DB_HOST` | `localhost` |
| `DB_PORT` | `3306` |
| `DB_NAME` | `win_tools` |
| `DB_USERNAME` | `root` |
| `DB_PASSWORD` | 无默认值，开发启动前必须设置 |

Windows PowerShell 示例（密码文字是占位说明，不能照抄作为真实密码）：

```powershell
$env:DB_HOST="localhost"
$env:DB_PORT="3306"
$env:DB_NAME="win_tools"
$env:DB_USERNAME="root"
$env:DB_PASSWORD="你的MySQL密码"
cd D:\study\win-tools-website\backend
.\mvnw.cmd spring-boot:run
```

也可以用 `$env:DB_PASSWORD = Read-Host 'MySQL password' -MaskInput`（PowerShell 7.1+）
避免将密码明文写入终端命令历史。
这些变量仅对当前 PowerShell 会话及其启动的子进程有效，不修改系统环境变量。
从其他终端或 IDEA 启动时，需要在相应进程环境中配置。Spring Boot 不会自动读取项目 `.env`。
若改用其他 `DB_NAME`，需要另行准备对应数据库；此初始化脚本固定操作 `win_tools`。

当前只有默认开发配置 `application.yml` 和测试配置 `application-test.yml`，
没有单独的 `dev` / `prod` Profile。测试通过 `@ActiveProfiles("test")` 使用内存 H2，
无需提供 `DB_PASSWORD`。不要在正常开发启动时启用 `test` Profile。
开发配置要求提供 MySQL 凭据；连接池按需建立连接，数据库未启动时 Hello 可能仍能响应，
首次数据库操作会失败。需要同时检查 MySQL 服务、初始化结果和连接参数。

### 表与映射约定

所有表均使用 InnoDB、`BIGINT UNSIGNED AUTO_INCREMENT` 主键及数据库维护的
`created_at` / `updated_at`。`updated_at` 在行数据实际变化时由数据库自动更新。

| 表 | 关键约束 / 索引 |
| --- | --- |
| `windows_version` | 版本、版本名称非空；`(status, sort_order, id)` 列表索引 |
| `tool` | `slug` 唯一，名称和路径非空；`(status, sort_order, id)` 列表索引 |
| `article` | `slug` 唯一，标题非空，正文 `LONGTEXT`；`view_count INT UNSIGNED DEFAULT 0`；`(status, created_at, id)` 索引 |
| `admin_user` | `username` 唯一，`password VARCHAR(255) NOT NULL` 仅供未来安全密码 Hash 存储，无初始账户 |

Windows、工具和管理员的 `status` 约定为 1=enabled、0=disabled，默认 1；
文章约定为 1=published、0=draft，默认 0。数据库未增加状态枚举 CHECK，后台写入在 DTO 中强制校验 0 / 1。
`sort_order` 默认 0；Windows 公开列表按 `sort_order ASC, release_date DESC, id ASC` 排序，
相同 sort_order 下未填写发布日期的数据排在有日期的数据之后。
默认排序规则不区分大小写和重音，因此 `slug` / `username` 唯一约束也遵循此规则。

四个 Mapper 使用 `@Mapper` 注册并继承 `BaseMapper`。Entity 使用 `@TableName`、
`@TableId(type = IdType.AUTO)`，沿用 MyBatis-Plus 默认的下划线到驼峰映射；无需额外配置类。
日期使用 `LocalDate`，时间戳使用 `LocalDateTime`。MySQL 无符号 INT 浏览量映射为 Java `Long`，
避免超过 Java Integer 上限；主键 Java `Long` 的使用范围上限为 `Long.MAX_VALUE`。
时间戳字段禁止 Mapper 插入/更新赋值，由数据库统一管理；插入后需要重新查询才能取得这些默认值。
Entity 仅生成 Getter/Setter，避免自动生成包含密码字段的 `toString()`。

## API

| 方法 | 路径 | 行为 |
| --- | --- | --- |
| GET | `/api/hello` | Hello 连通性接口，不查询数据库 |
| GET | `/api/windows` | 数据库中的公开 Windows 列表，无数据时返回空数组 |
| GET | `/api/windows/{id}` | 公开 Windows 详情，不存在或未启用时返回 404 |
| GET | `/api/tools` | enabled 工具目录列表，无公开数据时返回空数组 |
| GET | `/api/tools/{slug}` | enabled 工具详情，不存在或 disabled 时返回 404 |
| GET | `/api/articles` | published 文章列表，不返回正文 content，无公开数据时返回空数组 |
| GET | `/api/articles/{id}` | published 文章详情，包含 content，不存在或 draft 时返回 404 |

Windows 数据来自 `windows_version`，只公开 `status=1` 的资源；其他状态均不可通过列表或详情读取。
列表排序为 `sort_order ASC`、`release_date DESC`、`id ASC`。
下载链接只允许 Microsoft 官方来源，后台写入由服务端校验 HTTPS 和 Microsoft 域名；手工 SQL 仍需维护者核验。
公开接口使用 VO，不返回 `status`、`sortOrder`、`createdAt`、`updatedAt`。
列表字段为 `id`、`name`、`version`、`edition`、`architecture`、`releaseDate`、`description`、`imageUrl`；
详情在此基础上增加 `officialDownloadUrl` 和 `sha256`。
零和负数 ID 返回 404；非整数或超出 Java Long 范围的 ID 返回 400，均使用统一 JSON。
公开资源接口的 POST / PUT / PATCH / DELETE 返回 405；后台写入使用独立管理 API，没有分页、搜索或复杂筛选。

### Tool 与 Article 查询规则

Tool 仅公开 `status=1`（enabled），列表按 `sort_order ASC, id ASC` 稳定排序。
列表与详情共用 `ToolVO`，字段仅有 `id`、`name`、`slug`、`icon`、`description`、`category`、`path`，
不返回 `status`、`sortOrder`、`createdAt`、`updatedAt`。
详情通过 slug 等值查询，沿用数据库唯一约束和排序规则，不做模糊匹配。
不存在、disabled 或其他非 1 状态均返回 HTTP 404，消息为 `Tool resource not found`。
能匹配详情路由的空白或无法匹配资源的 slug 同样返回 404；未提供 slug 的 `/api/tools` 是列表接口。

Article 仅公开 `status=1`（published），列表按 `created_at DESC, id DESC` 稳定排序。
列表字段为 `id`、`title`、`slug`、`summary`、`coverImage`、`category`、`viewCount`、`createdAt`，
SQL 查询和 JSON 响应均不包含正文 `content`。
详情在列表字段基础上增加 `content`、`updatedAt`，所有公开响应均不返回 `status`。
GET 仅查询，不增加 `view_count`，也不更新文章时间戳。
draft、其他非 1 状态、不存在、零和负数 ID 均返回 HTTP 404，消息为 `Article resource not found`；
非整数或超出 Java Long 范围的 ID 返回 HTTP 400，消息为 `Bad Request`。

两个资源继续使用统一 `ApiResponse<T>`：成功为 `code=200`、`message=success`；
错误的 HTTP 状态与 `code` 一致，`data=null`，不返回 SQL、堆栈或未公开记录。
POST / PUT / PATCH / DELETE 均返回 405。当前不提供分类筛选、搜索、分页或浏览量写入逻辑。

PowerShell 查询示例（后端已启动，数据库已初始化）：

```powershell
$windows = Invoke-RestMethod http://localhost:8080/api/windows
$windows | ConvertTo-Json -Depth 5
if ($windows.data.Count -gt 0) {
    $windowsId = $windows.data[0].id
    Invoke-RestMethod "http://localhost:8080/api/windows/$windowsId"
}
$tools = Invoke-RestMethod http://localhost:8080/api/tools
$tools | ConvertTo-Json -Depth 5
if ($tools.data.Count -gt 0) {
    $toolSlug = [uri]::EscapeDataString($tools.data[0].slug)
    Invoke-RestMethod "http://localhost:8080/api/tools/$toolSlug"
}
$articles = Invoke-RestMethod http://localhost:8080/api/articles
$articles | ConvertTo-Json -Depth 5
if ($articles.data.Count -gt 0) {
    $articleId = $articles.data[0].id
    Invoke-RestMethod "http://localhost:8080/api/articles/$articleId"
}
```

无公开数据时列表返回：

```json
{"code":200,"message":"success","data":[]}
```

详情不存在或已禁用时，HTTP 状态和 JSON code 均为 404：

```json
{"code":404,"message":"Windows resource not found","data":null}
```

访问 [http://localhost:8080/api/hello](http://localhost:8080/api/hello)，或运行：

```powershell
Invoke-RestMethod http://localhost:8080/api/hello
```

`GET /api/hello` 返回 HTTP 200：

```json
{
  "code": 200,
  "message": "success",
  "data": "Hello Win Tools!"
}
```

统一响应类型为 `ApiResponse<T>`。未处理异常返回 HTTP 500：

```json
{
  "code": 500,
  "message": "Internal server error",
  "data": null
}
```

未处理异常只记录异常类型，不记录可能含敏感内容的消息和堆栈，也不返回浏览器。Spring MVC 的常见请求异常保留对应 HTTP 状态（如 404、405），并使用统一 JSON 响应。
异常测试使用的故障接口只存在于测试源码中，不会包含在运行包里。

## 测试与构建

在 `backend` 目录运行（PowerShell）：

```powershell
.\mvnw.cmd test
.\mvnw.cmd verify
```

CMD 中使用 `mvnw.cmd test` 和 `mvnw.cmd verify`。
如果当前仍在项目根目录，则显式指定后端 POM：

```powershell
.\backend\mvnw.cmd -f backend\pom.xml test
.\backend\mvnw.cmd -f backend\pom.xml verify
```

测试保留前三阶段全部回归测试，覆盖 Windows、Tool、Article 的 Service、Controller / MockMvc、
Mapper 查询和开发 seed。包含 enabled / published 过滤、同排序值的稳定次序、详情映射、
空列表、disabled / draft / 其他状态、非法 ID / slug、公开字段精确集合、404 / 400 和写入方法的 405。
Article 测试验证列表不返回正文、详情返回正文、无符号 INT 浏览量的 Long 映射和重复 GET 不修改数据库。
保留 Tool slug 唯一约束、Article 长正文 CLOB / LONGTEXT 映射和浏览量范围测试。
开发 seed 测试直接执行 `sql/seed-dev.sql`，检查重复执行、保留用户维护数据及不生成管理员账户的行为。
原有 Hello、404、405、500 JSON 和内部信息保护测试继续执行。

数据库测试使用 test scope H2 的 MySQL compatibility mode，每个应用上下文使用独立内存库，
测试事务结束后回滚，既不访问本地 MySQL，也不写本地数据库文件。测试专用建表脚本为
`backend/src/test/resources/sql/schema-h2.sql`；同步维护四张表字段、默认值和唯一约束。
该脚本省略 MySQL 建库、引擎、排序规则及列表索引，`LONGTEXT` 适配为 CLOB，
`view_count` 用 BIGINT + CHECK 模拟 MySQL 无符号 INT 的完整范围。
H2 不能证明 MySQL 的排序规则、索引、严格模式或全部 DDL 行为正确，仍需按 Database 章节做实机验证。
正式 Jar 不包含 H2 或测试配置。
405 和异常测试会主动触发错误路径，日志中的对应 WARN、ERROR 是预期行为，应以 Maven 测试结果为准。
测试使用 Mockito 的 subclass 引擎，避免当前无需使用的内联插桩触发 JVM 类共享警告；该配置只作用于测试，不支持 Mock final 类或方法。参考 [Mockito 官方说明](https://github.com/mockito/mockito/blob/v5.17.0/mockito-core/src/main/java/org/mockito/MockMakers.java)。

`verify` 会执行测试并构建可运行 Jar：

```powershell
& "$env:JAVA_HOME\bin\java.exe" -jar .\target\backend-0.0.1-SNAPSHOT.jar
```

此命令同样在 `backend` 目录运行。项目自身版本的 `SNAPSHOT` 表示开发中的应用版本；Spring Boot 依赖使用正式版 `3.5.16`。

## 编码和 Git 约定

文本文件使用 UTF-8，默认 LF 换行；Windows `.cmd` / `.bat` 脚本使用 CRLF。
遵循根目录 `AGENTS.md`。不提交构建输出、依赖缓存、真实密码、密钥或本地环境配置。
Maven Wrapper 使用 Apache 官方的 `only-script` 发行包，保留两个平台脚本和 `.mvn/` 配置，并校验 Maven 下载包的 SHA-256。

后续可在授权的环境中完成真实 MySQL 数据导入、腾讯云上线与域名 HTTPS 验收；操作真实服务器前需明确授权。
