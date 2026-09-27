# Phase 11.14.1：GitHub Actions CI 报告

## 1. 阶段目标

为前端和后端建立 GitHub Actions 自动检查，在每次 push 和 Pull Request 时运行代码检查、测试和构建。本阶段不修改业务代码、数据库、API 或部署方式，也不配置自动部署。

## 2. CI 架构说明

两个独立 workflow 均运行在 `ubuntu-latest`，各自检出仓库并使用官方 setup action 缓存依赖。步骤顺序执行；任一步返回非零退出码，该 job 和 workflow 就会失败。前端以锁文件缓存 npm 下载，后端缓存 Maven 依赖；缓存不会替代安装、测试或构建。

检查失败阻止合并还取决于目标分支的 required status checks 设置。目标分支应要求 `frontend` 和 `backend` 两个 job 成功；仅由 workflow 文件不能保证合并门禁生效。

## 3. 新增 Workflow

| 文件 | 运行时 | 依赖缓存 | 检查内容 |
| --- | --- | --- | --- |
| `.github/workflows/frontend-ci.yml` | Ubuntu、Node.js 24.20.0 | `actions/setup-node` 的 npm 缓存，键使用 `frontend/package-lock.json` | 安装、Vitest、ESLint、Prettier、Vite 构建 |
| `.github/workflows/backend-ci.yml` | Ubuntu、Temurin Java 18 | `actions/setup-java` 的 Maven 缓存 | Maven test、verify 与 Jar 构建 |

Git 记录的 `backend/mvnw` 缺少 Unix 可执行位，因此后端 job 在调用 `./mvnw` 前执行 `chmod +x ./mvnw`；该操作只影响 CI 检出的副本。

## 4. 触发条件

两个 workflow 都由 `push` 和 `pull_request` 触发，没有分支或路径过滤；推送到任意分支，以及创建或更新 Pull Request 都会运行。PR 同步推送可能产生两次运行。

## 5. 执行步骤

前端：检出代码 → 设置 Node.js 与 npm 缓存 → `npm install` → `npm test` → `npm run lint` → `npm run format:check` → `npm run build`。

后端：检出代码 → 设置 Java 18 与 Maven 缓存 → `chmod +x ./mvnw` → `./mvnw test` → `./mvnw verify`。后端测试使用 H2 测试配置，不连接生产 MySQL。

## 6. 本地验证结果

2026-09-27 在 Windows 本地运行，全部成功：

| 目录 | 命令 | 结果 |
| --- | --- | --- |
| `frontend/` | `npm.cmd install` | 成功；320 个依赖包完成审计，0 个漏洞 |
| `frontend/` | `npm.cmd test` | 成功；22 个测试文件、458 个测试通过 |
| `frontend/` | `npm.cmd run lint` | 成功；ESLint 零错误、零警告 |
| `frontend/` | `npm.cmd run format:check` | 成功；Prettier 检查通过 |
| `frontend/` | `npm.cmd run build` | 成功；Vite 生成 `dist/` |
| `backend/` | `.\mvnw.cmd test` | 成功；245 个测试通过，0 个失败或错误 |
| `backend/` | `.\mvnw.cmd verify` | 成功；245 个测试再次通过，生成可运行 Jar |
| 仓库根目录 | `.\.cache\actionlint\actionlint.exe .github\workflows\frontend-ci.yml .github\workflows\backend-ci.yml` | 成功；actionlint 1.7.12 未报告问题 |

`actionlint` 来自官方发布包，并按 GitHub Release 的 SHA-256 摘要校验；仅放在 Git 忽略的 `.cache/` 中，不加入项目依赖。

## 7. GitHub 验证结果

Frontend CI 与 Backend CI 的 GitHub 运行结果待推送后核验。

合并门禁当前无法启用：仓库为私有仓库，使用当前认证凭据查询 GitHub 的 `branches/main/protection` 与 `rulesets` API 均返回 HTTP 403，响应为 `Upgrade to GitHub Pro or make this repository public to enable this feature.` 因此本阶段创建的 workflow 能报告失败，但目前**不能保证失败时阻止合并**。依据 [GitHub 分支保护可用性说明](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)，需在保持私有并升级 Pro（或更高计划）与明确授权公开仓库之间作出选择，然后将 `frontend` 和 `backend` 设为 `main` 的必需检查。仓库可见性和付费计划未作改动。

## 8. 后续自动部署建议

后续阶段若决定自动部署，应另行设计独立发布 workflow，在 CI 通过后才进入受保护的生产环境，并明确发布权限、凭据管理和回滚流程。本阶段没有服务器连接、部署凭据或发布步骤。
