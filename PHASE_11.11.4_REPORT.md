# Phase 11.11.4 开发报告

## 1. 阶段目标

在现有娱乐工具模块增加四个浏览器本地高级互动工具，沿用 Vue 3、Element Plus、`tool` 表及已有 API。保留之前的八个娱乐工具，不修改数据库结构。

## 2. 新增工具列表

| 工具 | 路由 | 功能 |
| --- | --- | --- |
| Mikutap | `/tools/mikutap` | 点击或键盘触发本地合成音符、颜色变化、Canvas 粒子和圆形波纹。 |
| 在线钢琴 | `/tools/online-piano` | A S D F G H J 及鼠标点击弹奏 C4–B4，带琴键反馈。 |
| 随机头像生成器 | `/tools/random-avatar` | 随机组合背景、脸型、眼睛、嘴巴和装饰，预览并下载 SVG。 |
| 声控弹力球 | `/tools/voice-ball` | 用户点击启动并授权后，本地分析声音大小，驱动球体运动。 |

## 3. 技术实现说明

- Mikutap 使用 Web Audio API 合成五种音高；每次点击生成 20 个粒子，画面最多保留 160 个粒子和 12 个波纹。没有动画对象时停止安排新帧。
- 在线钢琴使用预设音符映射、振荡器和音量包络；忽略组合键、重复键与表单输入。
- 头像由固定图形和配色组合为 SVG，下载使用本地 `data:` URL，不调用头像服务。
- 声控弹力球仅在点击启动后调用 `getUserMedia`，使用 `AnalyserNode` 的时域数据计算均方根音量。不录音，不上传声音。停止、离开页面或隐藏标签页时取消动画帧、停止音轨并关闭 `AudioContext`；授权等待中停止后，迟到的音轨也会立即关闭。
- 新工具使用 `/tools/*` 的独立路由，放在通用工具详情路由之前。现有 Nginx `try_files` 规则支持 history 模式直达和刷新。
- 生产 Nginx 示例的 `Permissions-Policy` 改为 `microphone=(self)`，仅允许本站请求麦克风；camera 和 geolocation 仍禁用。麦克风需要 HTTPS 或本地安全上下文。
- `sql/phase-11.11.4-fun-tools.sql` 只增加缺失目录记录；`sql/seed-dev.sql` 同步开发目录。两者可重复执行，不覆盖已存在或已禁用的记录。

## 4. 权限说明

麦克风权限只会在声控弹力球页面点击“启动麦克风”后请求。页面显示未启动、等待授权、运行中以及拒绝授权时的提示。其余三个工具不请求设备权限。所有处理均在浏览器本地完成，不依赖第三方 API。

## 5. 修改文件列表

| 范围 | 文件 |
| --- | --- |
| 页面 | `frontend/src/views/tools/fun/MikutapView.vue`、`OnlinePianoView.vue`、`RandomAvatarView.vue`、`VoiceBallView.vue` |
| 本地逻辑 | `frontend/src/utils/tools/fun/mikutap.js`、`onlinePiano.js`、`randomAvatar.js`、`voiceBall.js` |
| 路由及目录 | `frontend/src/router/index.js`、`frontend/src/utils/tools/registry.js`、`frontend/src/views/ToolsView.vue` |
| SQL | `sql/phase-11.11.4-fun-tools.sql`、`sql/seed-dev.sql` |
| 测试 | `frontend/src/__tests__/interactiveFunTools.spec.js`、`interactiveFunToolViews.spec.js`、`App.spec.js`、`frontend/e2e/interactive.browser.mjs`、`frontend/e2e/production.browser.mjs`、`backend/src/test/java/com/xiaoc/backend/mapper/ContentDevSeedTests.java` |
| 配置及文档 | `deploy/nginx/win-tools.conf.example`、`docs/deployment/tencent-cloud.md`、`README.md`、`frontend/README.md`、本报告 |

## 6. 测试结果

| 命令 | 结果 |
| --- | --- |
| `frontend> npm.cmd install` | 通过，未新增依赖，审计无漏洞。 |
| `frontend> npm.cmd test` | 通过，18 个文件、439 项测试。 |
| `frontend> npm.cmd run lint` | 通过，无 ESLint 错误或警告。 |
| `frontend> npm.cmd run format:check` | 通过。 |
| `frontend> node e2e/interactive.browser.mjs` | 通过，真实无头 Chrome 在生产构建和 Nginx 示例安全响应头下验证四个页面直达和刷新、本地音频、SVG 显示、麦克风启动及离开时释放音轨。测试使用浏览器的本地模拟麦克风。 |
| `backend> .\mvnw.cmd test` | 通过，242 项测试，含新 SQL 的重复执行和保留已有数据验证。 |
| `backend> .\mvnw.cmd verify` | 通过，242 项测试并生成 Jar。 |

## 7. 构建结果

`frontend> npm.cmd run build` 通过，Vite 为四个新页面生成独立资源文件。后端 `verify` 构建通过。

## 8. 已知问题

无已知功能问题。SQL 自动验证使用 H2 MySQL mode，尚未在真实 MySQL 手工导入；路由直达和刷新通过带有示例安全响应头的临时服务验证，尚未在实际 Nginx/HTTPS 环境验收。浏览器测试使用模拟麦克风，实际设备和授权弹窗仍需部署后检查。

## 9. 后续建议

在目标 MySQL 数据库执行 `sql/phase-11.11.4-fun-tools.sql`，确认四张新工具卡片。部署到 HTTPS 后，在实际桌面和移动浏览器检查音量响应、权限拒绝提示、SVG 下载及页面离开时的设备释放。
