# Phase 11.11.3 开发报告

## 1. 阶段目标

在现有 `fun` 分类中增加四个浏览器本地动画互动工具，继续使用 `tool` 表和现有前后端分离结构，不改数据库结构或 API 格式。四个页面沿用工具标题、卡片主体和说明布局，支持直接访问与刷新。

## 2. 新增工具列表

| 工具 | 路由 | 功能 |
| --- | --- | --- |
| 魔法键盘 | `/tools/magic-keyboard` | 字母、数字、标点和常见特殊键触发按键显示、颜色变化及 Canvas 粒子；可选 Web Audio 本地合成声音，触屏可点击示例键。 |
| 老电视模拟器 | `/tools/crt-tv` | CSS 黑白滤镜、扫描线、噪点与轻微闪烁，可开关效果。 |
| FPS测试 | `/tools/fps-test` | `requestAnimationFrame` 测量实时 FPS、Frame Time 和本次平均 FPS，可开始与停止。 |
| 打字速度测试 | `/tools/typing-test` | 输入英文短文，统计 WPM、正确率和时间；完成后将最佳 WPM 与正确率保存在当前浏览器的 `localStorage`。 |

## 3. 技术实现说明

- 魔法键盘按键事件过滤重复键、组合键和表单输入；每次生成 20 个粒子，总量最多 160 个。粒子耗尽后停止动画帧；离开页面移除监听、取消帧并关闭音频上下文。声音默认关闭，不加载音频文件。
- CRT 画面通过 CSS 绘制；关闭效果后移除动画样式。全站已有 `prefers-reduced-motion` 规则，可禁用动效。
- FPS 测试仅在运行时安排动画帧，统计窗口约一秒；页面离开或标签页隐藏时停止。
- 打字计时从首个字符开始，仅正确字符计入 WPM，完成或离开页面时清理定时器；输入文本不上传。
- `sql/phase-11.11.3-fun-tools.sql` 仅插入缺失的四条目录记录，不覆盖现有记录；`sql/seed-dev.sql` 同步增加开发示例。两者均不自动执行，也不建表。
- 现有 Nginx 示例使用 `try_files $uri $uri/ /index.html`，新路由无需改动服务器配置。

## 4. 修改文件列表

| 范围 | 文件 |
| --- | --- |
| 页面 | `frontend/src/views/tools/fun/MagicKeyboardView.vue`、`CrtTvView.vue`、`FpsTestView.vue`、`TypingTestView.vue` |
| 本地逻辑 | `frontend/src/utils/tools/fun/magicKeyboard.js`、`fps.js`、`typing.js` |
| 路由与目录 | `frontend/src/router/index.js`、`frontend/src/utils/tools/registry.js`、`frontend/src/views/ToolsView.vue` |
| 目录数据 | `sql/phase-11.11.3-fun-tools.sql`、`sql/seed-dev.sql` |
| 测试 | `frontend/src/__tests__/animationFunTools.spec.js`、`animationFunToolViews.spec.js`、`App.spec.js`、`backend/src/test/java/com/xiaoc/backend/mapper/ContentDevSeedTests.java` |
| 文档 | `README.md`、`frontend/README.md`、本报告 |

## 5. 测试结果

| 命令 | 结果 |
| --- | --- |
| `frontend> npm.cmd install` | 通过，无新增依赖。 |
| `frontend> npm.cmd test` | 通过，16 个文件、424 项测试。 |
| `frontend> npm.cmd run lint` | 通过，无 ESLint 错误或警告。 |
| `frontend> npm.cmd run format:check` | 通过。 |
| `backend> .\mvnw.cmd test` | 通过，241 项测试，含 SQL 重复执行与保留已有数据的验证。 |
| 生产预览直达四个新路由 | 均返回 HTTP 200 和应用入口 HTML；无头 Chrome 直接打开后均渲染正确的页面标题。 |

前端新增测试覆盖按键事件、粒子数量与初始轨迹、音频及动画帧释放、CRT 状态切换、FPS 计算与停止、打字 WPM / 正确率 / 用时 / 最佳成绩，以及新路由和工具卡片。

## 6. 构建结果

`frontend> npm.cmd run build` 通过，Vite 生成四个新页面的独立资源文件。`backend> .\mvnw.cmd verify` 通过，241 项测试并生成可运行 Jar。

## 7. 已知问题

无已知功能问题。自动数据库验证使用 H2 MySQL mode，尚未在真实 MySQL 手工导入新脚本；直达与刷新验证使用 Vite 生产预览，尚未在实际 Nginx 环境验收。FPS 数值会受浏览器节流、显示器刷新率和设备负载影响。

## 8. 后续开发建议

在目标 MySQL 数据库执行 `sql/phase-11.11.3-fun-tools.sql` 后，检查工具目录是否出现四张新卡片；部署时再在真实 Nginx 和移动端浏览器逐页检查视觉效果、声音开关、路由刷新与资源释放。
