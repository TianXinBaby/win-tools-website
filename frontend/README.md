# Win Tools 前端

Vue 3 + Vite + JavaScript 前端，使用 Vue Router、Axios 和 Element Plus。
完整环境要求、API 说明、页面路由和联调边界见[根目录 README](../README.md)。

```powershell
npm.cmd ci
npm.cmd run dev
```

开发地址为 http://localhost:5173，`/api` 代理到 http://localhost:8080。
首次创建工程使用 `npm.cmd install`；后续使用提交的锁文件配合 `npm.cmd ci`。

```powershell
npm.cmd run lint
npm.cmd run format:check
npm.cmd run test
npm.cmd run build
npm.cmd audit
```

`npm.cmd run format` 格式化代码；`npm.cmd run test:unit` 监听测试。
已开放 JSON、UUID v4、时间戳、SHA-256、Base64，以及第七阶段四个媒体工具：

- `/tools/qrcode`：文本 / URL 生成二维码并下载 PNG，使用 qrcode 1.5.4。
- `/tools/image-compress`：JPEG / WebP 质量调整、PNG 重新编码。
- `/tools/image-resize`：保持原图比例或自定义尺寸。
- `/tools/image-convert`：静态 JPEG / PNG / WebP 转换。

Phase 11.11.2 增加四个浏览器本地娱乐工具：

- `/tools/nickname-generator`：游戏、程序员、可爱、中二四类昵称生成与复制。
- `/tools/ascii-art`：本地字符映射生成 ASCII 艺术，支持英文字母、数字及常用标点。
- `/tools/lucky-wheel`：2–12 个自定义选项，旋转后显示随机结果。
- `/tools/reaction-test`：随机等待后测量反应时间；仅最佳成绩写入本浏览器的 `localStorage`。

Phase 11.11.3 再增加四个动画互动工具：

- `/tools/magic-keyboard`：按键粒子、颜色和按键显示，可选本地合成声音；离开页面释放动画帧、监听和音频资源。
- `/tools/crt-tv`：可切换的黑白、扫描线、噪点与闪烁 CSS 效果。
- `/tools/fps-test`：实时 FPS、Frame Time 和平均 FPS；停止或离开页面取消动画帧。
- `/tools/typing-test`：按正确字符计算 WPM、正确率和用时；仅最佳成绩保存在本浏览器的 `localStorage`。

娱乐工具不调用第三方 API，也不上传输入。目录数据需来自现有 `tool` 表；开发库运行 `sql/seed-dev.sql`，已有数据库可分别运行 `sql/phase-11.11.2-fun-tools.sql` 和 `sql/phase-11.11.3-fun-tools.sql`。部署示例 Nginx 已包含 `/index.html` 回退，娱乐工具的 history 路由支持直接打开或刷新。

上述四个媒体工具的图片和输入内容仅在当前浏览器中处理，不会上传服务器，也不保存到浏览器存储。
文件上限 20 MiB、单边 8192 px、总像素 1600 万。格式与元数据限制详见根目录 README。
共享图片面板和工具函数统一管理解码、Canvas 导出、错误及资源释放。
Vitest 使用模拟 Canvas 测试边界、交互和资源生命周期；真实图片导出需要浏览器验证。

可复现的 Chrome 实机验证（先在另一终端运行 `npm.cmd run dev`）：

```powershell
node e2e/media.browser.mjs
```

脚本默认使用 Windows 标准安装位置的 Chrome；其他位置可用当前进程的 `CHROME_PATH` 指定。
用真实无头 Chrome 检查四档宽度、图片解码和 MIME、透明转 JPEG 白背景、下载、清空及无内容上传。
程序生成测试素材，截图、下载文件和报告仅放在 Git 忽略的根目录 `.cache/`，没有新增浏览器测试依赖。

## 阶段 8：后台认证

- `/admin/login`：管理员登录，提交前获取 CSRF token，并使用后端返回的 headerName。
- `/admin`：通过 `/me` 确认服务端 Session 后显示 Dashboard，刷新同样恢复。
- 退出先获取新 CSRF token，再 POST logout；后台 API 401 清理内存状态并跳登录。

使用同源 `/api` proxy 的 HttpOnly Session Cookie，不使用 JWT，不读取 Session ID，不持久化认证状态或 CSRF token。
无默认管理员。阶段 9 已开放 Windows / Tool / Article 管理 CRUD。
后端密码与生产 HTTPS / Secure Cookie 说明见根 README。

认证的真实 Chrome 测试需要隔离 H2 服务。在项目根目录另开终端执行：

```powershell
cd backend
.\mvnw.cmd test-compile spring-boot:test-run '-Dspring-boot.run.main-class=com.xiaoc.backend.support.AdminBrowserApplication'
```

这个 test-only 启动类强制使用内存 H2 并绑定 `127.0.0.1:8080`，不会访问真实 MySQL。
临时测试账户仅存在于测试源码，退出服务即丢弃。它不会包含在正式 Jar 中；不要使用这个启动类部署生产服务。
确认 8080 / 5173 未被其他服务占用；在 `frontend` 目录分别运行 Vite 和浏览器测试：

```powershell
npm.cmd run dev
# 另一个终端，同样位于 frontend
node e2e/admin.browser.mjs
```

浏览器测试验证真实 Session / CSRF 登录、刷新恢复、退出、失效跳转、Cookie 安全属性、公开 API 和四档屏宽，
并操作三个管理页的新增、编辑、状态变更、取消删除及确认删除。每次浏览器验收从新启动的隔离 H2 服务开始。
只记录结果和截图，不输出密码、Cookie 值或 CSRF token。测试结束后停止上述临时服务。
这不是使用真实 MySQL 管理员账户完成的验证。

PowerShell 使用 `npm.cmd`，不修改 ExecutionPolicy。

## 阶段 10：生产构建与 CSP 验证

`npm.cmd run build` 生成 `dist/`，默认不生成 source map；仅部署 dist 内容至 Nginx Web root。
API 保持同源 `/api`，由 Nginx 反代；服务器不运行 `npm run dev`。
配置及 HTTPS、权限、备份和回滚步骤见 [腾讯云部署手册](../docs/deployment/tencent-cloud.md)。

先按上文启动一个全新的隔离 H2 `AdminBrowserApplication`（8080），完成 build 后在 frontend 执行：

```powershell
node e2e/production.browser.mjs
```

脚本以随机本地端口提供 dist，直接读取 Nginx 示例中的 CSP，通过 Chrome 重跑后台 CRUD、
Element Plus 弹窗、二维码和图片工具测试，并检查安全策略错误。无需启动 Vite。
现有浏览器脚本也支持进程环境变量 `BASE_URL` 指定测试地址；默认仍使用开发地址。
本地 HTTP 使用测试 profile 的非 Secure Cookie；prod Secure Cookie 由后端真实容器测试覆盖。
这项验证不代表已在真实 Nginx、HTTPS 或 MySQL 环境通过。

## 阶段 9：后台内容管理

- `/admin/windows`：Windows 列表和编辑弹窗，官方 URL 提示仅 Microsoft HTTPS，状态和排序可编辑。
- `/admin/tools`：工具目录 CRUD，slug 使用小写字母 / 数字 / 连字符，path 必须为站内 `/tools/...`。
- `/admin/articles`：草稿 / 发布状态，摘要和普通 textarea 正文（最多 100000 字符）；浏览量只读。

三个路由继承后台守卫，导航包含 Dashboard、Windows、工具、文章及退出。
独立 admin API 模块复用 request.js；写请求通过 adminRequest.js 每次先取 CSRF，不自动重试写入。
错误沿用安全消息映射，401 继续清理状态并跳登录；409 显示 slug 冲突，403 提示重新操作。
共用 AdminResourcePanel 和 AdminContentForm，保存期间禁用提交和关闭，成功关闭弹窗并刷新列表；
删除使用 Element Plus 确认框，取消或失败保留数据。表格在窄屏内部滚动。
状态修改及删除立即影响公开 API；工具目录编辑不会创建新的工具实现。
仍不包含分页、搜索、批量操作、图片上传、富文本或普通用户系统。
