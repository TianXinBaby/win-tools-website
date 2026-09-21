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
```

`npm.cmd run format` 格式化代码；`npm.cmd run test:unit` 监听测试。
已开放 JSON、UUID v4、时间戳、SHA-256、Base64 五个本地工具；输入不上传、不持久化。
后台管理和登录当前阶段未实现。PowerShell 使用 `npm.cmd`，不修改 ExecutionPolicy。
