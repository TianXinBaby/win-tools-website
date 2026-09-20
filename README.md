# Win Tools

个人 Windows 资源与在线工具网站，采用前后端分离架构。

当前只完成**第一阶段：仓库基础设施 + Spring Boot 最小可运行后端**。
MySQL 和 Vue 尚未接入，Windows、Tool、Article 和后台管理等业务功能当前阶段未实现。

## 当前技术栈

- JDK 18
- Spring Boot 3.5.16（稳定版，Java 18 在其兼容范围内）
- Spring Web、Spring Validation、Lombok
- Maven 3.9.11 / Maven Wrapper 3.3.4
- JUnit 5、Spring Boot Test、MockMvc

版本兼容性参考 [Spring Boot 3.5 系统要求](https://docs.spring.io/spring-boot/3.5/system-requirements.html)。
后续计划接入 MySQL 8 / MyBatis-Plus，以及 Vue 3 / Vite / JavaScript 前端。

## 当前目录结构

```text
win-tools-website/
├── AGENTS.md
├── .editorconfig
├── .gitattributes
├── .gitignore
├── README.md
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
        │   │   └── exception/GlobalExceptionHandler.java
        │   └── resources/application.yml
        └── test/
            ├── java/com/xiaoc/backend/
            │   ├── BackendApplicationTests.java
            │   ├── controller/HelloControllerTests.java
            │   └── exception/GlobalExceptionHandlerTests.java
            └── resources/mockito-extensions/org.mockito.plugins.MockMaker
```

`frontend/` 和 `sql/` 将在对应阶段按需创建。
`target/`、本地 `.cache/`、IDE 私有文件以及 `.env` 已加入忽略规则。

## 环境要求

- JDK 18；`JAVA_HOME` 应指向 JDK 18 安装目录。
- Windows PowerShell 或 CMD。
- 首次使用 Wrapper 需要联网下载 Maven 和依赖，无需安装全局 Maven。
- 默认端口 `8080` 可用；本阶段运行不需要 Node.js、npm 或 MySQL。

IntelliJ IDEA 可以直接打开 `backend/pom.xml`，项目 SDK 和 Maven Runner JRE 均选择 JDK 18，Maven 选择 Wrapper。

## 启动后端

在项目根目录的 PowerShell 中执行：

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

测试覆盖应用上下文加载、Hello HTTP 状态和 JSON 字段、404、405，以及未处理异常的 500 JSON 和内部信息保护。
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

下一阶段建议配置 MySQL 8、MyBatis-Plus 和数据库初始化脚本；本阶段尚未进行相关开发。
