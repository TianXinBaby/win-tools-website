# Win Tools

个人 Windows 资源与在线工具网站，采用前后端分离架构。

当前已实现**第四阶段：Tool 与 Article 查询后端 API**，保留前三阶段的后端基础设施、Hello 和 Windows API。
Windows、Tool、Article 列表和详情通过 Controller → Service → Mapper 从数据库读取，使用独立 VO 输出。
前端尚未创建；工具实际功能、后台写接口、后台管理和登录当前阶段未实现。

## 当前技术栈

- JDK 18
- Spring Boot 3.5.16（稳定版，Java 18 在其兼容范围内）
- Spring Web、Spring Validation、Lombok
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
后续前端计划使用 Vue 3 / Vite / JavaScript。

## 当前目录结构

```text
win-tools-website/
├── AGENTS.md
├── .editorconfig
├── .gitattributes
├── .gitignore
├── README.md
├── sql/
│   ├── init.sql
│   └── seed-dev.sql
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
        │   │   ├── controller/（HelloController、WindowsController、ToolController、ArticleController）
        │   │   ├── entity/（WindowsVersion、Tool、Article、AdminUser）
        │   │   ├── mapper/（对应的四个 BaseMapper 接口）
        │   │   ├── service/（WindowsVersionService、ToolService、ArticleService）
        │   │   ├── service/impl/（对应的三个 Service 实现）
        │   │   ├── vo/（WindowsVersionListVO、WindowsVersionDetailVO、ToolVO、ArticleListVO、ArticleDetailVO）
        │   │   └── exception/（GlobalExceptionHandler、ResourceNotFoundException）
        │   └── resources/application.yml
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

`frontend/` 尚未创建。
`target/`、本地 `.cache/`、IDE 私有文件以及 `.env` 已加入忽略规则。

## 环境要求

- JDK 18；`JAVA_HOME` 应指向 JDK 18 安装目录。
- Windows PowerShell 或 CMD。
- 首次使用 Wrapper 需要联网下载 Maven 和依赖，无需安装全局 Maven。
- 默认端口 `8080` 可用；开发数据库使用本地 MySQL 8，测试不需要本地 MySQL。
- 本阶段不需要 Node.js、npm 或 Docker。

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
   同时包含 5 个工具目录项（JSON、UUID、时间戳、SHA256、Base64）和 3 篇原创简短示例文章。
   工具仅提供元数据，`path` 是未来前端路由，当前阶段未实现对应页面或工具功能；示例文章不是完整技术教程。
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
文章约定为 1=published、0=draft，默认 0。当前数据库未增加状态枚举 CHECK，业务校验在后续阶段实现。
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
下载链接只允许 Microsoft 官方来源，由数据维护者在录入数据库时核验；本阶段没有写入接口或链接校验接口。
公开接口使用 VO，不返回 `status`、`sortOrder`、`createdAt`、`updatedAt`。
列表字段为 `id`、`name`、`version`、`edition`、`architecture`、`releaseDate`、`description`、`imageUrl`；
详情在此基础上增加 `officialDownloadUrl` 和 `sha256`。
零和负数 ID 返回 404；非整数或超出 Java Long 范围的 ID 返回 400，均使用统一 JSON。
POST / PUT / PATCH / DELETE 返回 405；本阶段没有分页、搜索、复杂筛选或后台 API。

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

异常堆栈仅记录在后端日志，不返回浏览器。Spring MVC 的常见请求异常保留对应 HTTP 状态（如 404、405），并使用统一 JSON 响应。
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
405 和异常测试会主动触发错误路径，日志中的对应 WARN、ERROR 和堆栈是预期行为，应以 Maven 测试结果为准。
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

下一阶段仅建议：阶段 5：Vue 3 前端基础工程；本次未提前实现。
