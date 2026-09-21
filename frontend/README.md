# Win Tools 前端

Vue 3 + Vite + JavaScript 前端，使用 Vue Router、Axios 和 Element Plus。
完整环境要求、API 说明、页面路由和联调边界见[根目录 README](../README.md)。

```powershell
npm ci
npm run dev
```

开发地址为 http://localhost:5173，`/api` 代理到 http://localhost:8080。
首次创建工程使用 `npm install`；后续使用提交的锁文件配合 `npm ci`。

```powershell
npm run lint
npm run format:check
npm run test
npm run build
```

`npm run format` 格式化代码；`npm run test:unit` 监听测试。
工具功能、后台管理和登录当前阶段未实现。
