# Phase 11.17 — 全站公安备案与 ICP 备案页脚报告

记录日期：2026-10-14。结论：**本阶段前端实现与本地验收通过，等待用户审核；尚未部署生产环境。**

## 1. 范围与开始状态

- 已阅读根目录 `AGENTS.md`，检查目录、Git 状态/历史、`App.vue`、`MainLayout.vue`、`AdminLayout.vue`、管理员登录页与既有测试。
- 开始分支为 `main`，HEAD 为 `12019fb`；本地跟踪引用显示领先 `origin/main` 4 个提交。本阶段没有 fetch，此状态不代表远端实时状态。
- 开始时只有 `.release/` 和根目录 `备案图标.png` 未跟踪，没有已跟踪文件的未提交修改。保留这两项，不修改 `.release/`。
- 当前代码的普通 Footer 只有品牌和说明文字，没有 ICP 备案信息；后台和登录页没有 Footer。现有阶段报告到 11.15，本地全部分支历史未找到 ICP / 备案 / 11.16 的相关提交，不能认定 Phase 11.16 已实现并合并。
- 因阶段历史不一致，本次保留 `main` 工作区准备审核修改，没有擅自创建 `feature/phase-11.17-public-security-footer`，也没有合并任何分支。
- 仅修改前端及相关文档，不修改 Spring Boot、MySQL、SQL、Nginx、部署脚本或其他生产服务。未增加依赖，未变更技术栈、系统设置或环境变量。
- 报告沿用仓库根目录 `PHASE_11.xx_REPORT.md` 规范，因此保存为本文件。

## 2. 图标确认与保全

根目录图片候选只有 `备案图标.png`。已预览并读取 PNG 文件头，确认是独立公安备案徽标，不是整张备案格式截图。

| 项目 | 实际结果 |
| --- | --- |
| 原件 | `D:\study\win-tools-website\备案图标.png` |
| 正式资源 | `D:\study\win-tools-website\frontend\public\images\gongan-beian.png` |
| 构建产物 | `D:\study\win-tools-website\frontend\dist\images\gongan-beian.png` |
| 格式、尺寸、大小 | PNG，36×40px，1,403 字节 |
| 页面显示 | 高 20px、宽 18px，保持原始比例 |
| 处理方式 | 原始字节复制，没有重命名伪装格式、转换或覆盖原件 |

原件、正式资源、生产构建产物的 SHA-256 均为：

```text
8DFECAD0DFCB3DC584F2C2447943EEFB1FD65A058856EB0611E2C56DDC4C1FE1
```

组件通过 Vite 的 `BASE_URL` 加上 `images/gongan-beian.png` 引用本地公共资源，默认生产路径为 `/images/gongan-beian.png`。

## 3. 全站集成与视觉

- 新增 `frontend/src/components/SiteFooter.vue`，以语义化 `<footer>` 提供唯一备案信息来源。
- `frontend/src/App.vue` 在普通/后台路由分支之后只挂载一次 Footer。
- `frontend/src/layouts/MainLayout.vue` 移除原有内嵌 Footer，其品牌和两条说明原文迁入新组件。
- `AdminLayout.vue` 与登录页无需增加 Footer，继续使用原来的路由和认证守卫。所有页面共享 App 级 Footer。
- 覆盖首页、Windows 列表/详情、Tools 目录/动态详情、5 个基础工具、4 个媒体工具、12 个娱乐工具、Articles 列表/详情、Favorites、404、管理员登录、Dashboard 和三类管理页，共 35 个路由页面。
- 延续白底、边线和灰色文字；新增 `© 2026 Win Tools`，备案信息在版权下一行居中，字体 13px，两组水平间距 20px，换行后行间距 8px。
- 公安图标与文字为同一个链接，图标在左侧并垂直居中；链接内部不拆行，窄屏在两组之间换行。
- 使用已有 `#app` 纵向 flex 布局和 Footer 的 `margin-top: auto`，短页面尽量贴视口底部、长页面跟随文档流，没有 fixed/sticky 遮挡。
- 链接支持原生 Tab 聚焦，保留全局可见焦点轮廓；hover/focus 使用主题色反馈。装饰图标使用 `alt=""`。常态颜色为既有 `--muted`（`#5e6b7d`），白底文字对比度约 5.4:1。

## 4. 编号与链接核对

| 类型 | 页面文字 | 目标链接 |
| --- | --- | --- |
| 公安备案 | 赣公网安备36082802000204号 | https://beian.mps.gov.cn/#/query/webSearch?code=36082802000204 |
| ICP 备案 | 赣ICP备2026025057号-1 | https://beian.miit.gov.cn/ |

两项均逐字核对用户要求，均设置 `target="_blank"` 与 `rel="noopener noreferrer"`。验证的是前端文字、DOM 属性与本地展示，没有访问备案系统核实行政登记状态。

## 5. 测试与构建

命令在 `D:\study\win-tools-website\frontend` 下执行：

| 命令 | 最终结果 |
| --- | --- |
| `npm.cmd test` | 23 个文件、498 项测试全部通过，无失败、无跳过；较原有 458 项新增 40 项 |
| `npm.cmd run lint` | 通过，零 ESLint 错误或警告 |
| `npm.cmd run format:check` | 通过，全部匹配文件符合 Prettier 格式 |
| `npm.cmd run build` | 通过，生产资源生成成功；图标实际存在且哈希一致 |

新增 `SiteFooter.spec.js` 验证编号、目标链接、安全属性、Tab 可聚焦性、PNG 签名/尺寸/结束块、同链接内图标先于文字、全部路由布局单页脚，以及跨公开/后台/登录页切换时保持同一 Footer。布局遍历保留真实 App、Layout 和路由结构，仅替换叶子页面以隔离业务 API。`App.spec.js` 验证真实普通页面的 Footer；`adminViews.spec.js` 新增真实登录与 Dashboard 页面、认证守卫集成断言。其余真实页面行为继续由完整测试集覆盖。

原有“无有效下载链接”断言限定到 `main` 内的下载链接，保留安全验证目的，允许页脚中合法的备案外链存在。

中间问题均已修复或重试通过：首次图标复制的工作目录错误已纠正，误建空目录已清理；沙箱曾拒绝 public、Vite 临时文件和浏览器启动操作，经获准后完成。Windows/Vitest 对模板静态绝对图片导入和测试中 URL 重写的兼容问题，分别通过本地公共资源 URL 绑定和直接读取公共文件解决；图标宽度断言依据实际 PNG 文件头修正为 36px。没有删除失败测试、跳过验证或放宽安全校验。

## 6. 桌面与移动端浏览器验收

在项目根目录执行 `node .cache/phase11.17-footer-smoke.mjs`，本地 HTTP 服务直接提供本次 `frontend/dist/`，Chrome 无界面模式打开真实页面。API 使用仅存在于验收脚本中的测试数据；管理员页面使用模拟的已认证响应，登录页使用未认证响应，没有连接生产服务或修改数据库。

35 个页面 × 1440/768/390/320px 四种宽度（视口高 1000px），**140 组检查全部通过**：

- 每页只有一个 Footer，编号、链接和安全属性准确。
- 图标成功加载，天然尺寸 36×40px，显示尺寸 18×20px；图标在文字前且垂直居中。
- 1440/768px 两组横排、间距 20px；390/320px 两组换行，公安图标与编号保持完整。
- 页面与链接没有水平溢出；Footer 为正常文档流，在主要内容之后，短页面底部位置正确。
- 真实 Tab 键可以从公安备案链接切换到 ICP 备案链接。
- Chrome 未捕获未处理的 JavaScript 运行异常。

已人工查看桌面首页、移动首页、桌面管理员登录、移动 Dashboard 截图。截图中的资源和管理员名称均为本地验收数据。

本地证据保存在 Git 忽略的 `.cache/phase11.17-footer/`，不随代码提交：

- [桌面首页底部](.cache/phase11.17-footer/home-1440.png)
- [320px 移动首页底部](.cache/phase11.17-footer/home-320.png)
- [桌面管理员登录](.cache/phase11.17-footer/admin-login-1440.png)
- [320px 后台 Dashboard 底部](.cache/phase11.17-footer/admin-320.png)
- [完整 140 组尺寸与属性记录](.cache/phase11.17-footer/results.json)
- [本地浏览器验收脚本](.cache/phase11.17-footer-smoke.mjs)

这是本地 Chrome 与模拟 API 下的前端验收，不替代真实手机、线上缓存、真实管理员会话或其他浏览器的上线后验收。

## 7. 主要修改文件

新增：

- `frontend/src/components/SiteFooter.vue`
- `frontend/src/__tests__/SiteFooter.spec.js`
- `frontend/public/images/gongan-beian.png`
- `PHASE_11.17_REPORT.md`

修改：

- `frontend/src/App.vue`
- `frontend/src/layouts/MainLayout.vue`
- `frontend/src/assets/main.css`
- `frontend/src/__tests__/App.spec.js`
- `frontend/src/__tests__/adminViews.spec.js`
- `README.md`

## 8. Git 与交付状态

已检查 `git diff`、暂存区差异和 `git diff --check`，没有范围外代码修改，没有引入密码、Token、私钥或其他敏感配置；未暂存任何文件。分支保持 `main`，HEAD 仍为 `12019fb`，本阶段修改尚未提交。用户已有 `.release/` 与原始图标保留。

没有创建 commit、push、合并、正式 Release Tag 或生产部署。建议审核后使用提交信息：`feat: add site-wide public security and ICP footer`。

## 9. 生产部署条件与下一步

**本次页脚变更满足本地前端交付和部署准备条件**：测试、Lint、Format、Build 和浏览器布局检查全部通过，生产图标包含在 dist。没有本阶段已知未解决的代码问题。

**尚未生产验收或发布**。待用户审核本报告与截图，再由获授权的发布流程部署完整前端 dist（包括 `images/gongan-beian.png`），并核对真实域名的页面、图标 200 响应和缓存更新。现有 Phase 11.15 的生产验证待办不因本次前端通过而自动关闭。本阶段到此停止，等待用户审核。
