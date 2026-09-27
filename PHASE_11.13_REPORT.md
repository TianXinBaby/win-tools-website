# Phase 11.13：管理员后台增强报告

## 1. 阶段目标

增强现有后台的工具、分类、文章和 Dashboard 管理能力。沿用 Spring Security、服务端 Session、HttpOnly Cookie 和 CSRF；不修改管理员登录协议、公开资源接口或数据库表结构。

## 2. 新增后台功能

- `/admin/tools` 显示工具名称、slug、分类、状态、排序值和创建时间；可按名称或 slug 搜索，并按分类、状态筛选。分类统计从完整管理列表读取，显示每个非空分类的名称与工具数量。
- 工具行内状态操作先要求确认，再独立更新 `status`；行内排序输入校验 0～1000000 的整数并独立更新 `sort_order`。成功后重新读取管理列表。公开工具列表原本按 `sort_order ASC, id ASC` 查询，仅显示 `status=1`；更新后下一次前台请求即按新状态和顺序返回。
- Dashboard 从受保护的统计接口显示工具总数、启用数、禁用数、文章总数、已发布数和非空工具分类数。后端统计工具只查询状态与分类，文章只执行计数查询，不读取文章正文。
- `/admin/articles` 增加草稿和已发布状态筛选，显示标题、状态和时间信息。现有表没有发布时间字段，因此列表对草稿显示“未发布”，对已发布文章显示“未记录”；创建时间单独显示，避免把其他时间误当作发布时间。

## 3. API 变化

| 方法与路径 | 请求 | 响应与行为 |
| --- | --- | --- |
| `GET /api/admin/dashboard/stats` | 无 | `ApiResponse` 包含 `toolTotal`、`toolEnabled`、`toolDisabled`、`articleTotal`、`articlePublished`、`categoryCount` |
| `PUT /api/admin/tools/{id}/status` | `{"status":0或1}` | 返回更新后的 `AdminToolVO`；缺失资源 404，非法值 400 |
| `PUT /api/admin/tools/{id}/sort` | `{"sortOrder":0到1000000的整数}` | 返回更新后的 `AdminToolVO`；缺失资源 404，非法值 400 |

新接口都在原有 `/api/admin/**` 安全过滤链下，需要 `ROLE_ADMIN`。两个 PUT 请求必须携带有效 CSRF token；前端沿用每次写入前获取新 token 的既有流程。不更改登录、Session 或退出协议。

## 4. 数据库变化

无。复用 `tool.status`、`tool.sort_order`、`tool.category` 和 `article.status`，没有新增表、字段或 SQL 迁移文件。

## 5. 修改文件列表

- 后端：`AdminToolController.java`、`AdminToolService.java`、`AdminToolStatusRequest.java`、`AdminToolSortRequest.java`、`AdminDashboardController.java`、`AdminDashboardService.java`、`AdminDashboardStatsVO.java`。
- 后端测试：`AdminEnhancementControllerTests.java`。
- 前端：`AdminResourcePanel.vue`、`AdminToolsView.vue`、`AdminArticlesView.vue`、`AdminDashboardView.vue`、`adminTools.js`、`adminDashboard.js`。
- 前端测试：`adminEnhancement.spec.js`、`adminContentApi.spec.js`、`adminViews.spec.js`。
- 文档：`README.md`、本报告。

## 6. 测试结果

| 目录 | 命令 | 结果 |
| --- | --- | --- |
| `frontend/` | `npm.cmd test` | 22 个测试文件、458 项测试通过 |
| `frontend/` | `npm.cmd run lint` | 通过，0 个 ESLint 错误或警告 |
| `frontend/` | `npm.cmd run format:check` | 通过 |
| `frontend/` | `npm.cmd run build` | Vite 生产构建通过 |
| `backend/` | `.\mvnw.cmd test` | 245 项测试通过 |
| `backend/` | `.\mvnw.cmd verify` | 245 项测试通过，Jar 打包成功 |

新增后端测试覆盖 Dashboard 实数统计、分类计数、工具状态与排序对公开接口的影响，以及认证、CSRF、参数校验和缺失资源。新增前端测试覆盖工具列表与筛选、分类统计、状态确认、排序更新、文章状态筛选和 Dashboard 展示。

## 7. 部署注意事项与已知限制

- 无数据库迁移。部署时先更新后端，再发布前端构建产物，以免前端先请求尚未提供的新接口；沿用现有 Nginx `/api` 转发、HTTPS、Session Cookie 和 CSRF 配置。
- 现有 `article` 表没有可靠的发布时间；若后续需要显示准确时间，需要单独设计和迁移字段。本阶段按要求未改表结构。
- 自动测试使用 H2 MySQL 兼容模式；本阶段未使用真实 MySQL 凭据联调，也未部署到服务器。
