# AGENTS.md

本文件用于约束在本仓库中工作的 AI 编程代理（包括 Codex）的行为。

所有在本仓库中进行的代码创建、修改、测试、重构、文档更新和 Git 操作，都必须遵守本文件。

---

# 1. 项目目标

本项目是一个个人 Windows 资源与在线工具网站。

主要功能包括：

- Windows 各版本信息
- Microsoft 官方 Windows 下载入口
- Windows 安装及使用教程
- 常用网页在线工具
- 技术文章
- 后台管理

项目采用前后端分离架构。

---

# 2. 固定技术栈

未经用户明确许可，不得擅自改变以下技术栈。

## Backend

- Java 18
- Spring Boot 3.5.x
- Maven
- Maven Wrapper
- Spring Web
- Spring Validation
- Lombok
- MyBatis-Plus
- MySQL 8

## Frontend

- Vue 3
- Vite
- JavaScript
- HTML5
- CSS3
- Vue Router
- Axios
- Element Plus

## Deployment

后续计划使用：

- 腾讯云 Linux
- Nginx
- Spring Boot
- MySQL
- HTTPS

当前阶段不要擅自增加 Docker、Kubernetes 或微服务架构。

---

# 3. 禁止擅自更换技术方案

未经用户明确要求，不得：

- 升级或更换 JDK
- 使用 Spring Boot 4
- 将 Maven 改为 Gradle
- 将 MyBatis-Plus 改成 JPA/Hibernate
- 将 MySQL 改成其他数据库
- 将 Vue 改成 React
- 将 JavaScript 改成 TypeScript
- 引入微服务架构
- 引入 Redis
- 引入 Docker
- 引入 Kubernetes
- 引入 Spring Security
- 修改用户操作系统环境变量
- 修改系统级 Java / Node / Git 配置

如确实存在兼容性问题，应先说明问题、影响和可选解决方案，再等待用户决定。

不得通过私自改变技术栈来绕过问题。

---

# 4. 工作范围

默认情况下，只允许修改本项目目录：

D:\study\win-tools-website

不得修改该目录之外的文件。

不得删除用户已有文件，除非用户明确要求。

修改已有文件之前，应先阅读并理解相关代码。

不要因为重构而修改与当前任务无关的文件。

遵循最小必要修改原则。

---

# 5. 项目目录规范

项目总体结构应保持：

win-tools-website/
├── AGENTS.md
├── README.md
├── .gitignore
├── .gitattributes
├── .editorconfig
├── backend/
├── frontend/
└── sql/

后端代码位于：

backend/

前端代码位于：

frontend/

SQL 文件位于：

sql/

不得将 Vue 源代码混入 Spring Boot resources/static。

保持标准前后端分离结构。

---

# 6. 后端代码结构

Spring Boot 基础包：

com.xiaoc.backend

建议结构：

com.xiaoc.backend
├── common
├── config
├── controller
├── dto
├── entity
├── exception
├── mapper
├── service
│   └── impl
├── vo
└── BackendApplication

Controller 只负责：

- 接收请求
- 参数校验
- 调用 Service
- 返回结果

业务逻辑不得大量写入 Controller。

数据库访问不得直接写入 Controller。

数据库操作通过：

Controller
→ Service
→ Mapper
→ MySQL

完成。

---

# 7. API 规范

REST API 统一使用：

/api

作为前缀。

例如：

GET /api/windows
GET /api/windows/{id}
GET /api/tools

API 应使用统一响应结构。

建议：

{
  "code": 200,
  "message": "success",
  "data": {}
}

统一响应类建议命名：

ApiResponse<T>

错误响应必须提供有意义的信息。

不要把 Java 堆栈信息直接返回给浏览器。

---

# 8. 数据库规范

数据库：

win_tools

数据库字符集：

utf8mb4

所有数据库初始化脚本统一放入：

sql/

禁止在 Java 代码中自动执行危险的数据删除操作。

修改数据库结构时必须同步更新 SQL 文件。

SQL 表和字段使用：

snake_case

Java 属性使用：

camelCase

通过 MyBatis-Plus 映射。

不得将用户提供的数据直接拼接进 SQL。

---

# 9. Windows 资源规则

Windows 下载信息必须优先来源于 Microsoft 官方渠道。

不得加入：

- Windows 破解资源
- KMS 激活工具
- 非官方激活程序
- 来历不明的 ISO 镜像
- 破解软件下载地址

Windows ISO 默认不直接存储在本项目服务器。

网站主要提供：

- 版本信息
- 官方下载入口
- SHA256 等校验信息
- 安装教程

---

# 10. 在线工具隐私原则

能够在浏览器本地完成的工具，应优先在浏览器本地执行。

例如：

- JSON 格式化
- UUID
- 时间戳
- SHA-256
- Base64
- 图片压缩

这些功能原则上不要将用户输入发送到服务器。

如果未来某个工具必须上传用户数据，应明确说明。

---

# 11. 测试是强制要求

每次完成改动之后，都必须编写或更新相关测试，并在交付给用户之前，确保所有测试和验证全部通过。

不得以：

“改动很简单”
“只是配置修改”
“理论上应该没问题”

为理由跳过验证。

修复 Bug 时，应尽可能先添加能够复现该 Bug 的测试，然后进行修复。

新增功能必须增加对应测试。

修改已有功能必须检查和更新已有测试。

---

# 12. 后端测试规范

后端优先使用：

- JUnit 5
- Spring Boot Test
- MockMvc

根据需要区分：

- 单元测试
- Controller 测试
- Service 测试
- 集成测试

至少保证关键业务路径存在测试。

在交付后端修改前，应执行：

Windows：

backend\mvnw.cmd test

如果适用，还应执行：

backend\mvnw.cmd verify

只有测试成功才能声明任务完成。

---

# 13. 前端测试和验证

前端创建后，应至少执行：

npm install

以及项目定义的：

npm run build

如果项目配置：

npm run test

或：

npm run lint

也必须执行。

不得在存在 Vue 编译错误、ESLint 错误或构建失败时声明任务完成。

新增重要交互功能时，应增加相应测试。

---

# 14. 完成定义（Definition of Done）

一个任务只有满足以下条件才能被认为完成：

1. 功能实现完成
2. 没有明显未完成代码
3. 没有无意义 TODO
4. 相关测试已添加或更新
5. 所有相关测试通过
6. 项目能够编译
7. 项目能够构建
8. 没有新增明显警告或错误
9. README / 文档在需要时已经更新
10. git diff 已检查
11. 没有提交敏感信息
12. 最终结果已经向用户明确汇报

如果其中任何必要条件未满足，不得声称“已完成”。

---

# 15. 错误处理规则

遇到错误时：

1. 阅读完整错误信息
2. 找到根本原因
3. 尽量做最小修复
4. 重新运行对应测试
5. 再运行相关完整测试
6. 验证修复没有破坏已有功能

不得：

- 隐藏错误
- 删除失败测试
- 降低测试标准
- 注释掉正确的校验
- 为了让测试变绿而删除实际功能

如果无法解决，应明确告诉用户：

- 哪一步失败
- 错误是什么
- 已尝试什么
- 当前判断的原因
- 推荐下一步

不得假装成功。

---

# 16. 代码质量规则

代码应：

- 简洁
- 可读
- 命名明确
- 易于维护
- 避免重复
- 避免过度设计

禁止为了表现“企业级”而创建大量：

- 无意义接口
- 无意义抽象层
- 空实现
- Wrapper
- Factory
- Manager
- Util

只有确实有需要时才增加抽象。

优先使用简单清晰的实现。

---

# 17. 安全规范

禁止将以下信息提交到 Git：

- 数据库真实密码
- API Key
- Access Key
- Secret Key
- Token
- 私钥
- 生产服务器密码
- SSH 私钥

敏感配置必须通过：

- 环境变量
- 本地配置
- 示例配置文件

完成。

必要时使用：

application-example.yml

或：

.env.example

真实：

.env

必须加入 .gitignore。

---

# 18. Git 操作规范

允许主动执行只读或安全检查命令，例如：

git status
git diff
git diff --cached
git log

未经用户明确允许，不得执行危险 Git 操作，例如：

git reset --hard
git clean -fd
git push --force
git push --force-with-lease
git rebase
删除用户分支
改写已有 Git 历史

不得覆盖用户尚未提交的修改。

如果发现仓库中已有与当前任务无关的修改，不得擅自恢复或删除。

---

# 19. Commit 和 Push 规则

默认情况下：

可以准备适合提交的修改，但不要擅自 push 到远程仓库。

除非任务明确要求，否则不要自动创建 Git commit。

完成工作后应建议合适的 Conventional Commit 信息，例如：

feat: add Windows resource API

fix: handle missing Windows version

test: add Windows controller tests

docs: update setup instructions

refactor: simplify Windows service

chore: configure project tooling

用户明确要求 commit 时才执行 commit。

用户明确要求 push 时才执行 push。

---

# 20. 分支规则

个人项目推荐使用：

main

作为稳定主分支。

开发功能时可以使用：

feature/<name>

例如：

feature/phase-1-backend-foundation
feature/phase-2-database
feature/windows-api
feature/vue-frontend

Bug 修复可以使用：

fix/<name>

不要创建大量没有意义的长期分支。

---

# 21. 文档要求

如果修改内容影响以下事项：

- 环境要求
- 安装方法
- 启动方法
- 数据库
- API
- 配置
- 项目结构
- 部署方式

必须同步修改 README.md 或相关文档。

文档中的命令必须与实际项目保持一致。

---

# 22. 依赖管理规则

新增依赖之前应确认：

1. 是否真的需要
2. 是否与当前 JDK 和框架兼容
3. 是否已有现有依赖能够完成同样功能

不得为了一个简单功能随意引入大型第三方库。

不要无理由升级已有依赖。

---

# 23. 不允许留下假实现

不得创建看似完成但实际上未实现的功能，例如：

return null;

硬编码假数据冒充数据库数据；

空方法；

永远成功的假 API；

为了通过测试而跳过真实逻辑。

如果当前阶段不实现某个功能，应明确标注：

“当前阶段未实现”

而不是制造假完成状态。

---

# 24. 每次任务开始前

开始任务前必须：

1. 阅读本 AGENTS.md
2. 检查当前目录结构
3. 查看 git status
4. 阅读与本任务相关的已有代码
5. 确认当前任务范围
6. 避免修改无关文件

---

# 25. 每次任务完成前

交付用户之前必须：

1. 检查 git diff
2. 检查是否误修改无关文件
3. 检查是否泄露敏感信息
4. 运行相关测试
5. 运行必要构建验证
6. 确认全部验证通过
7. 更新需要更新的文档

如果任何验证失败，不得声称任务已经完成。

---

# 26. 最终汇报格式

每次完成任务后必须向用户汇报：

## 已完成

说明实现了什么。

## 主要修改文件

列出主要新建或修改文件。

## 测试和验证

列出实际运行的命令，例如：

backend\mvnw.cmd test

并明确说明结果。

## 未完成或已知问题

如果没有：

无。

如果存在问题，必须明确说明。

## Git 状态

简要说明：

- 当前分支
- 是否存在未提交修改

可以建议 Commit Message，但未经允许不要自行 push。

## 下一步

给出最合理的下一阶段建议。

---

# 27. 最高原则

正确性优先于速度。

测试通过优先于快速交付。

简单清晰优先于过度设计。

保护用户数据和代码优先于自动化方便。

如果不确定某个重要设计决定，应询问用户，而不是擅自做出影响整个项目的决定。