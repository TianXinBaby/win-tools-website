# Phase 11.18-R1 前端依赖漏洞评估

审计日期：2026-10-28（Asia/Shanghai）。范围为 `frontend/package.json`、锁文件、已安装包的 exports/browser 配置、前端源码和现有静态部署方式。未修改依赖、锁文件或系统 npm 配置，未执行 `npm audit fix`、`--force`、安装或升级。

## 只读命令与实际结果

Node v24.20.0 / npm 11.19.0，在 `frontend/` 执行：

```powershell
npm.cmd audit --json
npm.cmd audit --omit=dev --json
npm.cmd audit --json --prefer-online --cache ..\.cache\npm-audit-r1
npm.cmd audit --omit=dev --json --prefer-online --cache ..\.cache\npm-audit-r1
```

四次均获得有效 JSON，audit 退出码均为 1，表示存在漏洞。第三、四次仅刷新项目内缓存，未改变依赖。原始证据分别为 `.cache/phase11.18-r1-npm-audit-all.json`、`-prod.json`、`-all-fresh.json`、`-prod-fresh.json`。

| 数据集 | Critical | High | Moderate | Low | 合计 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 默认缓存，全量，重现原 29 项 | 0 | 25 | 3 | 1 | 29 |
| 默认缓存，omit=dev | 0 | 17 | 0 | 1 | 18 |
| 新缓存 + prefer-online，全量 | 0 | 4 | 2 | 0 | 6 |
| 新缓存 + prefer-online，omit=dev | 0 | 3 | 0 | 0 | 3 |

默认缓存报告对全部条目标记 `fixAvailable=false`，新缓存中保留的六项均为 `true`。对比两组 JSON，29 项中多出的 23 项都是依赖风险传播项，直接公告涉及的五个包仍在新结果中。该差异发生在同一锁文件上，据此推断 npm 的包元数据/元漏洞缓存影响了统计；本次没有调试 npm 内部缓存实现。**这不代表本次修复了 23 项依赖漏洞**，也不能据旧缓存断言没有兼容修补版本。使用新缓存结果作为本次当前评估，并保留原 29 项分类供追溯。

## 原 29 项逐包分类

“生产树”指 `npm audit --omit=dev` 是否仍列出该包，不等于浏览器最终产物可利用。H/M/L 为 npm 报告的 High/Moderate/Low；“传播”表示 via 为其他包名，未直接列该包独立公告。

| 包 / 锁定版本 | 等级 | 生产树 | 风险来源和本项目实际用途 | 新缓存仍报 |
| --- | --- | --- | --- | --- |
| @asamuzakjp/dom-selector 9.2.1 | H | 否 | css-tree 传播；jsdom 测试选择器 | 否 |
| @bramus/specificity 2.4.2 | H | 否 | css-tree 传播；jsdom CSS 测试 | 否 |
| @csstools/css-syntax-patches-for-csstree 1.1.14 | H | 否 | css-tree 传播；jsdom 测试补丁 | 否 |
| @element-plus/icons-vue 2.3.2 | H | 是 | Vue 编译链传播；浏览器图标本身未列独立公告 | 否 |
| @vitejs/plugin-vue 6.0.9 | H | 否 | Vite/Vue 传播；构建插件 | 否 |
| @vitest/eslint-plugin 1.6.27 | M | 否 | Vitest 传播；lint | 否 |
| @vitest/mocker 4.1.11 | M | 否 | 两项直接公告；测试开发服务器 mock 注册/路径遍历 | 是 |
| @vue-macros/common 3.1.4 | H | 是 | Vue/compiler-sfc 传播；Router 构建工具链 | 否 |
| @vue/compiler-core 3.5.43 | H | 是 | source-map-js 传播；构建模板编译 | 否 |
| @vue/compiler-dom 3.5.43 | H | 是 | compiler-core 传播；构建模板编译 | 否 |
| @vue/compiler-sfc 3.5.43 | H | 是 | compiler、postcss、source-map-js 传播；构建 SFC | 否 |
| @vue/compiler-ssr 3.5.43 | H | 是 | compiler-dom 传播；本项目未使用 SSR | 否 |
| @vue/server-renderer 3.5.43 | H | 是 | compiler-ssr 传播；本项目未使用 SSR | 否 |
| @vue/test-utils 2.5.1 | H | 否 | Vue/compiler/server-renderer 传播；组件测试 | 否 |
| @vueuse/core 15.0.0 | H | 是 | Vue/shared 传播；浏览器组合函数未列独立公告 | 否 |
| @vueuse/shared 15.0.0 | H | 是 | Vue 传播；浏览器组合函数未列独立公告 | 否 |
| axios 1.20.0 | H | 是 | follow-redirects 传播；本项目使用浏览器适配器 | 否 |
| css-tree 3.2.1 | H | 否 | source-map-js 传播；jsdom 测试 CSS | 否 |
| element-plus 2.14.6 | H | 是 | Vue、icons、vueuse 传播；浏览器组件未列独立公告 | 否 |
| follow-redirects 1.16.0 | H | 是 | 两项直接公告；Node HTTP 重定向凭据剥离 | 是 |
| jsdom 30.1.0 | H | 否 | CSS、undici 传播；测试模拟 DOM | 否 |
| postcss 8.5.28 | H | 是 | source-map-js 传播；CSS 构建工具 | 否 |
| source-map-js 1.2.1 | H | 是 | 直接公告；恶意 indexed source map 导致事件循环 DoS | 是 |
| undici 8.10.2 | H | 否 | 八项直接公告；jsdom 的 Node 网络实现 | 是 |
| unplugin 3.4.0 | L | 是 | Vite 传播；Router 构建工具插件框架 | 否 |
| vite 8.3.0 | H | 是 | 六项直接公告；开发服务器编辑器命令/文件访问/中间件 | 是 |
| vitest 4.1.11 | M | 否 | @vitest/mocker 传播；本地测试运行器 | 是 |
| vue 3.5.43 | H | 是 | 编译器/server-renderer 传播；正常浏览器入口为 runtime-only | 否 |
| vue-router 5.3.1 | H | 是 | macros/compiler/unplugin/Vite/Vue 传播；浏览器路由 | 否 |

原 29 项：生产树 18 项（17 H + 1 L），仅开发/测试树 11 项（8 H + 3 M）。新 6 项：生产树 3 H，仅开发/测试树 1 H + 2 M。Vite 虽列于根 `devDependencies`，也被 Router/unplugin 的可选 peer 路径保留在生产树，因此不能只看 package.json 的顶层分类。

## 当前六项的可达性和兼容修补路径

| 当前条目 | 触发条件和直接运行时判断 | 兼容修补建议（本次未执行） |
| --- | --- | --- |
| source-map-js 1.2.1，H | 需解析攻击者控制的 indexed source map；本项目未提供上传/在线编译 source map 的入口。Vue 浏览器默认 `vue.runtime.esm-bundler.js` 仅导出 runtime-dom，源码未引入 compiler-sfc/server-renderer。主要威胁是处理不可信源码/映射的构建环境。 | 更新到 1.2.2；现有 compiler/postcss/css-tree 的 `^1.2.1` 均允许此补丁。 |
| follow-redirects 1.16.0，H | 两项凭据头在 Node 跨域重定向时泄露的公告；Axios browser 配置将 HTTP Node adapter 替换为空实现，生产站点以静态前端 + Java API 运行。未发现网站浏览器请求通过该 Node 实现的链路。 | 至少 1.16.1，已查官方 npm 有 1.16.2；Axios 现有 `^1.16.0` 允许。 |
| vite 8.3.0，H | 六项开发服务器公告，包括 Windows 编辑器启动命令、文件访问绕过和 custom middleware。当前 Vite 配置为默认 SPA，未使用 custom middleware；静态 dist 不运行 Vite 服务。开发端口也不应公开。 | 更新到 8.3.5（当前官方 npm 版本）；根 `^8.2.2` 允许，无须换大版本。 |
| undici 8.10.2，H | 八项涉及 EventSource/WebSocket 缓冲、TLS、解压、SRI、重定向缓存问题；由 jsdom 测试树引入，不是浏览器/Java 服务端运行组件。处理不可信网络响应时仍有开发/CI 风险。 | 至少 8.12.2，已查官方 npm 有 8.12.3；jsdom `^8.10.2` 允许。Node 要求 >=22.19.0，本机 24.20.0 满足；最低支持的 Node 22.18.0 环境需单独评估，不能擅自改系统版本。 |
| @vitest/mocker 4.1.11，M | 两项测试开发服务器 WebSocket 注册/Windows 路径遍历公告；生产不运行 Vitest，不代表开发服务器可无保护地公开。 | 协同 Vitest 更新到 4.1.12，替换其固定 4.1.11 子包；不单独覆盖内部固定版本。 |
| vitest 4.1.11，M | 上项传播，不是额外第六个独立漏洞源。 | 根 `^4.1.11` 允许 4.1.12；无需升级到最新 5.x。 |

维护者公告确认 [Vitest mocker 4.1.12 回补修复](https://github.com/vitest-dev/vitest/security/advisories/GHSA-qxg6-89mg-rqv8)、[Vite custom middleware 的触发前提与修补分支](https://github.com/vitejs/vite/security/advisories/GHSA-9jrq-w75r-8gcw)、[follow-redirects 的数组形式请求头问题](https://github.com/follow-redirects/follow-redirects/security/advisories/GHSA-q3jh-wrc6-jgq8)。每项完整公告地址和影响版本均保存在 fresh JSON 的 `via` 中。

当前审查未发现上述已知公告直接作用于“生产 Nginx 静态页面 + Spring Boot API”的可利用调用路径；该判断来自现有入口与导出配置审查，不是漏洞利用测试，也不等于依赖无风险。开发服务器、CI 和本地 Node 工具仍受影响。源码或部署若加入 SSR、在线编译、Vite 公网服务或 Node 代理，必须重新评估。

## 后续建议和提交边界

建议另开一次范围明确的兼容依赖维护：保持 Vue/Router/Java 等既有技术栈，在同一大版本内更新上述五个根漏洞源，评审 lock diff，运行完整 test/lint/format/build 和 ASF 真实链路，再用可写新缓存执行两种 audit。不得用 `npm audit fix --force`，不得为了计数好看而移除测试或忽略报告。

本次定向修复可以提交供代码审核，但**依赖安全扫描未清零**；是否允许在这些已记录的开发/构建风险仍存在时发布，需要后续依赖维护与生产验收决定。本次不安装、不升级、不提交、不连接生产。
