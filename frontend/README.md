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

图片和输入内容仅在当前浏览器中处理，不会上传服务器。不保存到浏览器存储。
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
后台管理和登录当前阶段未实现。PowerShell 使用 `npm.cmd`，不修改 ExecutionPolicy。
