# Phase 11.11.2 开发报告

## 1. 开发内容

在现有 `tool` 表和工具卡片、Vue Router 结构中增加 `fun` 分类的四个工具。功能计算全部在浏览器本地完成；未增加后端 API、数据库表或第三方服务调用。Nginx 示例已有 `try_files $uri $uri/ /index.html`，支持新路由直接访问和刷新。

## 2. 修改文件列表

| 范围 | 文件 |
| --- | --- |
| 工具页面 | `frontend/src/views/tools/fun/` 下四个 Vue 页面 |
| 本地逻辑 | `frontend/src/utils/tools/fun/` 下昵称、ASCII、转盘、反应时间模块 |
| 路由与目录 | `frontend/src/router/index.js`、`frontend/src/utils/tools/registry.js`、`frontend/src/views/ToolsView.vue` |
| 共用 UI | `frontend/src/components/ToolPageHeader.vue`、`frontend/src/assets/main.css` |
| 目录数据 | `sql/seed-dev.sql`、`sql/phase-11.11.2-fun-tools.sql` |
| 测试 | `frontend/src/__tests__/funTools.spec.js`、`frontend/src/__tests__/funToolViews.spec.js`、`frontend/src/__tests__/App.spec.js`、`backend/src/test/java/com/xiaoc/backend/mapper/ContentDevSeedTests.java` |
| 文档 | `README.md`、`frontend/README.md`、本报告 |

## 3. 新增工具说明

| 工具 | 路由 | 功能与本地数据 |
| --- | --- | --- |
| 随机昵称生成器 | `/tools/nickname-generator` | 四类内置词库随机组合、复制；结果只保留在当前页面。 |
| ASCII艺术生成器 | `/tools/ascii-art` | 5×7 本地映射，支持英文字母、数字、空格和 `. , ! ? - :`，最多 32 个字符；生成、清空、复制。 |
| 幸运转盘 | `/tools/lucky-wheel` | 输入 2–12 个选项，等大扇区旋转，随机停靠，显示结果并可重新开始。 |
| 反应速度测试 | `/tools/reaction-test` | 随机等待后点击目标，显示毫秒成绩；仅最佳成绩存入当前浏览器的 `localStorage`。 |

两份 SQL 脚本对四条 `fun` 元数据均按 slug 判断是否缺失，不覆盖管理员已维护的记录；其中独立脚本适用于已有数据库，不会插入其他演示数据。应用不会自动执行脚本，维护者需先在 MySQL 会话中 `USE win_tools;`，再手工导入目录数据。

## 4. 测试结果

| 命令 | 结果 |
| --- | --- |
| `frontend> npm.cmd install` | 通过，依赖已是最新状态。 |
| `frontend> npm.cmd test` | 通过，14 个文件、408 项测试。 |
| `frontend> npm.cmd run lint` | 通过，无 ESLint 警告。 |
| `frontend> npm.cmd run format:check` | 通过，全部匹配 Prettier 格式。 |
| `frontend> npm.cmd run preview -- --host 127.0.0.1 --port 4173 --strictPort` 后直达四个新路由 | 均返回 HTTP 200 和应用入口 HTML。 |
| `backend> .\mvnw.cmd test` | 通过，240 项测试。 |
| `backend> .\mvnw.cmd verify` | 通过，240 项测试，生成可运行 Jar。 |

前端新增测试覆盖四类昵称及随机组合、ASCII 映射与非法输入、转盘解析/随机索引/停靠角度、反应时间和最佳成绩逻辑，以及页面交互、直接路由与目录卡片。后端测试覆盖新目录脚本的字段、重复执行和保留已有数据。

## 5. 构建结果

`frontend> npm.cmd run build` 通过，Vite 生成四个新页面的独立资源文件。现有 Nginx 示例支持 history 路由回退；本阶段未在真实 MySQL、Nginx 或部署环境执行人工验收。

## 6. 后续开发建议

将独立目录脚本应用到目标数据库后，按四个新路由逐一用浏览器检查交互与刷新行为；后续娱乐工具批次继续沿用浏览器本地处理和现有 `tool` 元数据结构。
