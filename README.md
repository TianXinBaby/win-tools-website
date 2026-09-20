# Win Tools

个人 Windows 资源与在线工具网站，采用前后端分离架构。

当前已实现**第二阶段：MySQL + MyBatis-Plus + 数据库基础设施**，保留第一阶段后端和 Hello API。
包含四张基础表、Entity、Mapper 和独立数据库层测试。Vue 尚未创建；Windows、Tool、Article
业务 API、Service 和后台登录当前阶段未实现。

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
│   └── init.sql
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
        │   │   ├── controller/HelloController.java
        │   │   ├── entity/（WindowsVersion、Tool、Article、AdminUser）
        │   │   ├── mapper/（对应的四个 BaseMapper 接口）
        │   │   └── exception/GlobalExceptionHandler.java
        │   └── resources/application.yml
        └── test/
            ├── java/com/xiaoc/backend/
            │   ├── BackendApplicationTests.java
            │   ├── controller/HelloControllerTests.java
            │   ├── mapper/DatabaseMapperTests.java
            │   └── exception/GlobalExceptionHandlerTests.java
            └── resources/
                ├── application-test.yml
                ├── sql/schema-h2.sql
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
4. 退出 MySQL 客户端，在 PowerShell 中设置下节环境变量，运行后端，再访问 `/api/hello`。
   Hello 本身不查询数据库，HTTP 200 **不能单独证明**应用已经连通 MySQL。
   当前自动化验证使用 H2，真实 MySQL 的 JDBC 连接及 Mapper 行为仍需在凭据可用后单独验证。

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
`sort_order` 默认 0；列表可按其升序并以 id 稳定排序。
默认排序规则不区分大小写和重音，因此 `slug` / `username` 唯一约束也遵循此规则。

四个 Mapper 使用 `@Mapper` 注册并继承 `BaseMapper`。Entity 使用 `@TableName`、
`@TableId(type = IdType.AUTO)`，沿用 MyBatis-Plus 默认的下划线到驼峰映射；无需额外配置类。
日期使用 `LocalDate`，时间戳使用 `LocalDateTime`。MySQL 无符号 INT 浏览量映射为 Java `Long`，
避免超过 Java Integer 上限；主键 Java `Long` 的使用范围上限为 `Long.MAX_VALUE`。
时间戳字段禁止 Mapper 插入/更新赋值，由数据库统一管理；插入后需要重新查询才能取得这些默认值。
Entity 仅生成 Getter/Setter，避免自动生成包含密码字段的 `toString()`。

## API

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

测试保留第一阶段 5 项，并增加 10 项数据库测试，共 15 项：应用上下文、四个 Mapper Bean、
Windows CRUD、全部 Entity 字段映射、唯一约束、长文章、浏览量默认值及范围、数据库时间戳，
以及完整数据库应用上下文中的 Hello API。原有 Hello、404、405、500 JSON 和内部信息保护测试继续执行。

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

下一阶段仅建议：Windows 资源后端 API；本次未提前实现。
