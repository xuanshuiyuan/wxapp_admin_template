# CLAUDE.md — uni-app B 端管理小程序模板 · AI 工程系统唯一真相源

> **本文件是本模板 AI 协作的单一真相源（Single Source of Truth）。**
> `agents / workflows / skills / templates / 架构` 中任何一项发生变更，
> **必须在同一次改动内更新本文件**，否则该改动视为「未完成」。

| 项 | 值 |
|---|---|
| 系统版本 | `v1.0.0`（模板） |
| 最后同步 | 2026-11-26 |
| 技术栈指纹 | `uni-app 3.x + Vue 3.4 + uview-plus`（多端：mp-weixin / h5 / app） |
| 工程定位 | **可复制的管理端基础设施底座**（业务页面按需另建） |
| 契约真源 | 后端模板 `go_project_template`（README / `internal/route/verification.go` / `internal/conf/err_code.go`） |

---

## 0. 阅读顺序（给 AI 的最短路径）

1. **本文件** —— 全局约束与红线，读完再动手。
2. `README.md`（工程根）—— 快速开始 / 占位清单 / 后端对接指引。
3. `.claude/QUICK_START.md` —— 怎么用这套系统（开场模板 / Agent 调用 / 提问粒度）。
4. `.claude/skills/rule-*/` —— 具体编码规则，**按需加载**（清单见 `project-meta/skills-index.md`）。
   改代码前至少读 `rule-layering` + `rule-coding-basics`；碰请求链 / 登录态 / 样式各读对应 skill。
5. `.claude/project-meta/modules/demo/` —— **业务模块文档的范本**（新模块照它建）。
6. `.claude/workflows/<type>.yaml` / `.claude/agents/<role>.md` —— 多角色协作时的顺序与职责。
7. `.claude/templates/` —— 可执行代码模板（页面 / 组件 / composable / api 域 / service）。

> ⚠️ **不要凭印象写代码。** 本工程绝大多数「看起来该有」的业务代码都不存在；
> 已有基础设施的写法有大量非显然的 why。**先 grep，再写。**

---

## 1. 项目简介

**uni-app B 端管理小程序模板**：一套代码多端产出（微信小程序 / H5 / App）。

- **保留**：HTTP 请求链（签名 / 重登重放 / 错误归一）、登录态、**权限菜单机制**、页面准入、
  通用上传、路由、多端适配、存储、弹窗、loading、样式三层体系、`app-*` 通用组件、
  `composables`、通用 `utils`、`.claude` 工程系统。
- **不包含**：任何业务页面 / 业务接口 / 业务字典 / 业务知识库。
- **演示内容**：`pages/demo/*`、`api/demo.js`、`config/demo.js` 是**可删的示例**，
  用来验证请求链路、权限菜单、上传与页面骨架。

### 1.1 关键运行开关

| 开关 | 位置 | 说明 |
|---|---|---|
| `DEMO_MODE` | `src/config/app.js`（读 `VITE_DEMO_MODE`） | true = 登录/绑定不请求网络，写 `config/demo.js` 的演示会话；生产必须 false（误开启动即抛错） |
| `source` | `src/config/app.js` | B 端小程序 = `1001`（网页 B = `0101`，C 端 = `1010`） |
| `edition` | `src/config/app.js` | 接口版本协商值，**后端 `EditionList` 未登记则全部接口被拒** |
| `VITE_API_KEY` | `.env.*.local`（不进 git） | 签名密钥，**按 source 区分**，向后端线下领取 |
| 权限码 | `src/config/dict.js` + `src/config/access.js` | 演示用 `PERM_DEMO_*`，接真项目时整体替换 |

---

## 2. 技术栈

| 维度 | 值 | 证据 |
|---|---|---|
| 形态 | 前端 · 跨端应用 | 无 `pom.xml` / `go.mod` / `composer.json` |
| 框架 | uni-app 3.x（Vue 3 SFC，`<script setup>`） | `package.json` 的 `@dcloudio/uni-app` |
| 语言 | JavaScript（ESM，**非 TypeScript**） | 无 `tsconfig.json`，仅有 `jsconfig.json` |
| UI 库 | uview-plus（整包 `src/uni_modules/uview-plus`，**勿手改**） | `pages.json` 的 `easycom` |
| 样式 | SCSS + ColorUI 原子类 | `src/common/css/`、`src/styles/`、`uni.scss` |
| 构建 | Vite 5（`uni` CLI 封装） | `package.json` scripts |
| 目标端 | `mp-weixin` / `h5` /（`app` 预留） | `.env.*` 的 `VITE_HOST_*`、`services/platform.js` |
| 包管理 | npm | `package-lock.json` |
| 测试框架 | **无**（未装 vitest/jest） | `devDependencies` |
| 后端契约 | 统一响应 `{ code, msg, data }`，`code=0` 成功 | `src/services/http/request.js` |

---

## 3. 系统架构

### 3.1 分层与依赖方向（**硬约束**）

```
页面层    pages/             只做：调 api、渲染、反馈（收事件 → 调什么 → 渲染什么）
复用层    composables/       把一个能力封成 hook（useList / useModal / useAdminHome / usePageGuard）
接口层    api/               业务域名词 → HTTP（demoApi.list）
基础层    services/          http(签名/传输/重登/错误) · session · route · storage
                             · toast · platform · guards · pageAccess · pickPage
                             · fieldEditor / regionPicker · uploader · listDirty · appUpdate
                             · location（预留）
          store/             跨页响应式状态（user / modal / loading）
配置层    config/            环境 · 常量 · 字典 · JS 侧色值 · 接口 URL 登记表
                             · access（★ 页面路径 + 入口/按钮清单 + PAGES 准入表）
                             · demo（演示会话）
          utils/             纯函数（无副作用、无 import 上层）
```

**依赖只能向下**。禁止反向调用（`services` 不许 import `api`），禁止同级循环依赖。
打破循环的唯一合法手段是**注册模式**——`services/session.js` 向 `http/request.js`
注册 `authHandler`、`services/guards.js` 向 `http/guard.js` 注册业务码动作。

### 3.2 请求链路（唯一入口）

```
api/<域>.js  →  curl.get / post / upload
                    ↓
              request.js   补会话 → 签名注入 → 发送 → HTTP 状态 → 业务码
                          → 40005 单飞重登并重放一次 → 全局守卫 → 错误归一为 ApiError
                    ↓
              transport.js  uni.request / uni.uploadFile（两种 transport 返回同形状）
```

- 签名头：`source / timestamp / sign / random / edition / token / userid`，
  `sign = MD5("Source=..&TimeStamp=..&Key=<apiKey>&Weight=<random>").toUpperCase()`。
- 失败**永远抛 `ApiError`**，按 `type` 分支：`network` / `http` / `business` / `auth` / `guard` / `unknown`。
- 关键 options：`{ toast:false }` 静默 · `{ loading:true }` 托管 loading ·
  `{ authRetry:false }`（登录/绑定**必传**） · `{ guard:false }` 豁免全局守卫。
- **接口 URL 一律先登记 `config/endpoints.js`**，再在 `api/<域>.js` 包方法。禁止在页面里写路径字符串。
- **请求方式**：读接口 `curl.get`；业务写 / 查询 `curl.post`（form-urlencoded）；
  上传 `curl.upload`（multipart，**一次一个文件**）。**不提供 `postJSON`**（后端统一表单解码）；
  第三方 JSON 接口只能在 api 层显式 `request({ contentType:'application/json', rawResponse:true })`。
  响应统一 `{ code, msg, data }`：缺 `code` 的对象按「响应格式异常」抛错，不再当成功。
  数组字段用 `joinIdsParam` 逗号串（`role_ids=2,3`），禁止 `key[]=`。
- 联调开关（生产留空）：`VITE_SOURCE` 覆盖 source、`VITE_DEVELOP_BYPASS=develop` 跳过签名。

### 3.3 登录态

1. **微信静默登录**（`admin/login/login`，`wx.login` 的 code 换 token）—— 由请求层与
   **首屏页 `onShow`** 负责（无 token 自动补 + `40005` 自动重登重放），用户无感。
2. **不是「登录即注册」**：后端不为新微信建账号，没绑过回 `58001`
   —— 那是**流程分支不是错误** → 清栈跳 `pages/bind`（手机号 + 密码绑定）。
   > ★ `58001–58006` 是**本项目约定的 RBAC 标准码**（用户 2026-11-26 拍板）。
   > 后端模板 `go_project_template` 未内置这一段，新项目自建登录/绑定时**应沿用同一组码**
   > 并在后端落同一组常量；确需换号段时必须同步 `config/dict.js` + `services/session.js` + `guards.js`。
3. 绑定成功**不必再调登录接口**（绑定响应与登录完全相同）。
4. **没有独立登录页**：登录是静默的，绑定页承接首次使用。
5. 会话结构是 `admin_info`（身份主键 `admin_info.id` = `userid` 头）；
   `permission`（权限点数组）入本地存储——它是入口 / tab / 按钮的显隐判据。
   ⚠️ 权限是**登录时快照**，变更要重新登录才刷新；真正的防线在服务端。
6. ⚠️ **`App.vue` 的 `onLaunch` 刻意不做登录**：登录失败要跳页，而 onLaunch 阶段首个页面
   还没创建，跳页在微信端不可靠 → 改由首屏 `onShow` 触发。
7. ★ **冷启动判定态**：微信把 `pages[0]` 钉死成启动页，未绑定者必然先渲染首页。
   首页按 `booted`（初值 = 同步判据 `sessionReady()`）分两套骨架：会话不完备时渲染
   「整屏极光 + 只含 `app-brand` 的玻璃卡 + 页脚」，与绑定页同一视觉基线，
   把那次整屏瞬切伪装成「启动画面 → 请你绑定」。
8. **两道门**：`requireAdminLogin()`（登录门，`onShow`，是否执行由 `PAGES.login` 决定）
   → `requirePageAccess(path, query)`（权限门，`onLoad` 一行）。
   页面的标准写法是**一行** `usePageGuard({ path, onReady })`（`composables/usePageGuard.js`），
   它同时完成两道门与首次取数；手写等价语义时不要漏任何一道。
   配置只有一处 `src/config/access.js`，判据只有一处 `src/services/pageAccess.js`。
9. **演示模式**（`.env.development` 的 `VITE_DEMO_MODE=true`）下以上链路照常运行，只是登录/绑定不请求网络；生产由 `VITE_DEMO_MODE=false` + 启动硬护栏保证不出现。

### 3.4 全局业务码守卫

「某业务码返回时做全局动作（弹框 / 跳页）」由 `services/guards.js` 登记，
命中后请求以 `ApiError(type='guard')` 终止且不 toast，页面 catch 到直接忽略。
机制层带 **busy 去重 + 1s 冷静期**。当前登记 **2 枚**（只弹框不跳页）：
`50008` 账号已被禁用 / `58004` 未配角色权限。

⚠️ **其余业务码一律不进守卫**（有意为之）：`40102` 无权限 · `40205` 频控 · `58003` 绑定频控 ·
`58005` / `58006` 绑定冲突等。**判据只有一条**：全局框会**遮住用户正在填的表单 / 正在看的页面**
→ 这些码必须**就地**处置（定位字段 / 置灰按钮 / 提示下一步 / 刷新列表 / 保持勾选）。

**新增一个码 = 两步**（`config/dict.js` 加常量 + `guards.js` 登记动作），页面层零改动。
守卫是全局行为，改动前须经用户确认。

### 3.5 样式三层体系

```
common/css/theme.scss   ★ 唯一值源：只写 SCSS 变量，禁止写任何 CSS 规则
common/css/base.scss    页面默认 + 语义文字类 + 原子类
styles/scaffold.scss    通用版式块（.glass .card .stats .entry .rows .btn .field …）
                        + **流光玻璃视觉语言**（极光渐变 / 玻璃拟态 / 骑缝）
common/css/main.css     ColorUI（只用布局/flex 与 .solid-* 边框原子类）
config/theme.js         theme.scss 的 JS 镜像（给 uview 组件 color prop 这类只能传字符串的场景）
```

**换主色 / 字号 / 间距只改 `theme.scss` 一个文件**（+ 同步 `config/theme.js` 镜像）。
⚠️ 还有两处**读不到 SCSS 变量**的同步点：`src/pages.json` 各页的 `backgroundColor*` 与
`src/index.html` 的标题/主题色 —— 它们是 JSON/HTML，只能各留一份字面量（见 theme.scss 头部同步清单）。

**两种页面口径**：

| 口径 | 适用 | 特征 |
|---|---|---|
| **首屏 / 品牌页** | 首页工作台、绑定页 | **极光渐变底** + 玻璃卡（骑缝）+ 白字（`navigationBarTextStyle: "white"`） |
| **二级页** | 列表 / 表单 / 详情 | **白顶栏 + `#FAFAFE` 浅底 + 白卡 + 紫为唯一强调色**；不上极光与玻璃 |

---

## 4. 目录结构

```
.
├── .env.development / .env.production   ← 环境（进 git；生产值是 REPLACE_* 占位）
├── .env.*.local                         ← VITE_API_KEY（不进 git）
├── init.sh                              ← 改名 / 填占位
├── README.md                            ← 快速开始 · 占位清单 · 后端对接指引
└── src/
    ├── main.js        入口（★ 两条副作用 import 不可删：services/session · services/guards）
    ├── App.vue        根组件（样式入口；★ onLaunch 刻意不做登录）
    ├── pages.json     路由 + easycom + globalStyle + subPackages/preloadRule（新页面必须登记）
    ├── manifest.json  平台配置（appid 占位 REPLACE_WX_APPID）
    ├── uni.scss       SCSS 注入入口（把 theme.scss 注入每个编译块）
    ├── common/css/    main.css(ColorUI) · base.scss · theme.scss ★ token 唯一真源
    ├── styles/        scaffold.scss（版式块 + 流光玻璃视觉语言）
    ├── components/    app-* 跨页通用件（easycom 免 import）
    ├── pages-sub/     分包（当前：common/region-picker + 区划表；按需下载）
    ├── composables/   跨页能力；★ **页面私有**的放 pages/<模块>/composables/
    ├── services/      基础设施。★ 唯一入口：pageAccess（准入判据）· listDirty（返回刷新）
    │                  · pickPage/fieldEditor/regionPicker（跳页取值）· uploader（端差异收口）
    ├── store/         user / modal / loading（**都是视图**，真相源在 storage 与服务端）
    ├── config/        ★ access.js = 访问配置唯一真源
    ├── utils/         纯函数（无副作用、不 import 上层）
    ├── api/           接口层（★ 登录 / 绑定不在这里 —— 走 services/session）
    └── static/ · uni_modules/（uview-plus 整包，勿手改）
```

### 4.2 `.claude/` 目录

| 目录 | 职责 |
|---|---|
| `agents/` | 10 个单职责 Agent（Claude Code 子代理，含 frontmatter） |
| `workflows/` | 4 条 YAML 流程编排（feature / bugfix / refactor / release） |
| `skills/` | **13 个 `rule-*`**（基础设施用法，按需加载）+ `project-dev`（开发工作流）+ `design-preview`（设计稿） |
| `templates/` | 可执行代码模板（page / component / composable / api-domain / service / response-schema / 测试） |
| `project-meta/` | 业务知识库骨架 + `modules/demo/` 范本 + `versions/` 版本记录 |
| `checks/` · `prompts/` · `context/` · `examples/` · `tools/` · `scripts/` | 检查清单 / 提示词 / 迭代上下文 / 示例 / 工具说明 / 脚本 |

### 4.3 真相源分工

| 内容 | 唯一真相源 |
|---|---|
| **业务逻辑规则**（流程 / 状态机 / 计算 / 权限判定） | `project-meta/modules/<模块>/business-logic.md` |
| **一次改动的全貌** | `project-meta/versions/vN/`（由 `project-dev` 每次改动新建） |
| **接口契约（代码真源）** | `src/config/endpoints.js` + `src/config/dict.js` |
| ★ **访问配置** | `src/config/access.js`（页面路径 / 入口 / 按钮 / `PAGES`），并与 `src/pages.json` 对齐 |
| **基础设施用法** | `skills/rule-*/` |
| **工程结构与流程编排** | 本文件 |

---

## 5. Agent Team

| Agent | 职责（一句话） | 工具权限 |
|---|---|---|
| `architect` | 定分层、依赖方向、模块边界、数据/状态流转（ADR 作为回复输出，不落盘） | **只读** |
| `api_designer` | 定接口契约（路径/入参/响应/错误码）与前端 `api/` 层签名 | 读写 |
| `backend_service` | 业务逻辑层（本项目 = `services/` + `api/` 编排） | 读写 |
| `frontend_engineer` | 页面/组件/composable 实现（UI、交互、样式接线） | 读写 |
| `repository_agent` | 数据访问层（本项目 = 远程 API 封装与缓存） | 读写 |
| `test_agent` | 生成测试（**默认只生成不执行**） | 读写 |
| `security_agent` | 安全审查（密钥/鉴权/注入/敏感信息/越权） | **只读** |
| `reviewer` | 代码审查，**每条流程的最后一步**，可否决（用户手动触发） | **只读** |
| `debugger` | 问题定位（复现 → 假设 → 证据 → 根因） | 只读 + 受限写 |
| `deploy_agent` | 构建、发布、产物校验、回滚方案 | 读写（**执行前须确认**） |

**职责边界**：业务逻辑归 `backend_service`，页面不写业务规则；契约变更由 `api_designer` 唯一负责；
只有 `reviewer` 与 `security_agent` 能否决；构建/发布由 `deploy_agent` 执行，**任何角色默认都不得执行测试/构建**。

---

## 6. Workflow

| 流程 | 触发场景 | 链路 | 质量闸门 |
|---|---|---|---|
| `feature.yaml` | 新功能 / 新页面 / 新接口 | architect → api_designer → backend_service → repository_agent → frontend_engineer → test_agent → security_agent → **reviewer** | 契约确认 → 分层达标 → 测试覆盖 → 安全通过 → 评审通过 |
| `bugfix.yaml` | 缺陷修复 | debugger →（定责后）backend_service / frontend_engineer → test_agent → **reviewer** | 根因确认 → 最小修复 → 回归用例 → 评审通过 |
| `refactor.yaml` | 重构（行为不变） | architect →（分派）实现角色 → test_agent → **reviewer** | 行为等价证明 → 回归通过 → 评审通过 |
| `release.yaml` | 发布 | test_agent → security_agent → deploy_agent → **reviewer** | 产物校验 → 密钥扫描 → **最后一次 build** → 评审通过 |

### 6.1 流程铁律

1. **`reviewer` 若执行，必须是每条流程的最后一步**；**是否评审由用户在收尾时决定**。
   用户明确说不做 → `versions/vN/CHANGELOG.md` 记 `评审：跳过（用户确认）`；**不允许代码窗口自评**。
   AI **不自动起子代理**：用户确认后在**本仓新开一个窗口**跑 reviewer。
2. **轻微改动**（单文件 / 需求明确 / 不涉新模块、权限、状态机 / 照抄既有模式）**免流程、免评审**，
   自检 + 静态检查即可。边界从严：涉及登录态 / 请求链路 / 全局守卫 / 权限 / 口径时就不是轻微改动。
3. 任何一步产出「阻断项」→ 流程**回到上一步**，不得带病前进。
4. **默认不执行测试 / 构建 / 装依赖**（见 §9 红线 13）；验证清单写进 `versions/vN/CHANGELOG.md`，
   **未执行就如实写「未执行，待验证」**，禁止编造通过。
5. 重要变更（新页面 / 新接口 / 状态机 / 权限 / 口径）在 commit message 写一行：
   `<type>: <变更> —— <why>`。

---

## 7. 编码规范（必须记住的 10 条）

1. **业务逻辑不进页面/组件**。页面只做「调 api + 渲染 + 反馈」。
2. **URL 先登记** `config/endpoints.js`，再在 `api/<域>.js` 包方法。页面里禁止路径字符串。
3. **统一错误处理**：失败一律 `ApiError`，按 `type` 分支。禁止裸 `try/catch` 吞异常后返回 `null`。
4. **统一返回格式**：`{ code, msg, data }`，`code === 0` 为成功。
5. **禁止重复逻辑**：同一能力出现两次 → 抽 `composables/` 或 `utils/`；出现三次 → 必须抽。
6. **页面里禁止 `#ifdef`**：端差异一律收在 `services/platform.js`，页面只消费「能力」。
7. **禁止手写 `env(safe-area-inset-*)`**：用 `theme.scss` 的 `$safe-bottom` / `$safe-top`；
   凡 `calc(... env ...)` **必先写一行不含 env 的同属性回退**。
8. **组件类名 ≥3 字母 + 语义前缀**；写前缀前先 grep `common/css/main.css` 的 ColorUI 类名
   （实例：`main.css` 有全局 `.fr{float:right}`，撞名会废掉行内 flex）。
9. **改样式只改 `theme.scss`**（+ 同步 `config/theme.js`）；禁止硬编码色值/字号。
10. **中文注释解释 why**，不是 what。非显然的写法必须留「为什么这样」。

### 7.1 命名与格式

- 缩进 **Tab**；字符串单引号；语句结尾带分号。
- 文件名 `kebab-case`；组件目录与文件同名；页面私有类名用页面前缀 + `__`。
- 常量 `UPPER_SNAKE` 放 `config/`；枚举值取 `config/dict.js`，**页面不写字面量数字**。

---

## 8. 当前开发重点

模板本身的待办与验收记录在 `.claude/context/current_sprint.md`。
接新项目时**先清空该文件**，按新项目重写。

**接真后端前的必做清单**（详见 README）：

1. `npm install` + `npm run verify:mp-weixin` 通过。
2. `init.sh` 改名 / 填 appid / 填域名；`grep -rn 'REPLACE_'` 清零。
3. `.env.*.local` 填 `VITE_API_KEY`（按 source）。
4. `config/app.js` 的 `edition` 与后端 `EditionList` 对齐。
5. `config/dict.js` + `config/access.js` 换成真实权限码。
6. 后端自建 admin 登录 / 绑定，并把角色授权路径写进登录缓存 `api` 字段。
7. 确认 `.env.production` 的 `VITE_DEMO_MODE=false`（去演示化清单见 README §4.1）。

---

## 9. 禁止事项（红线，违反即打回）

### 9.1 架构红线

1. ❌ **业务逻辑写进 `pages/` 或 `components/`**（含校验规则、状态机、计算规则、权限判定）。
2. ❌ **反向依赖**：`services/` 引 `api/`、`utils/` 引上层、`config/` 引任何业务模块。
3. ❌ **同级循环依赖**（唯一合法解法是注册模式）。
4. ❌ **页面里写接口路径字符串**（必须走 `endpoints.js`）。
5. ❌ **页面里出现 `#ifdef` 条件编译**（必须收进 `services/platform.js`）。
6. ❌ **手改 `src/uni_modules/uview-plus/`**。
7. ❌ **在 `pages.json` 漏登记新页面**（第一项是启动页；分包另加 `subPackages` + `preloadRule`）。
   加 tabBar 必须同步 `services/route.js` 的 `TAB_PAGES`。

### 9.2 安全红线

8. ❌ **把 `VITE_API_KEY` / token / 完整手机号写进代码、注释、日志、埋点或 git**。
   密钥只在 `.env.*.local`（已 gitignore）；页面渲染手机号必须脱敏（`utils/text.js` 的 `maskMobile`）。
   若某页确需明文（业务核对），必须在 `skills/rule-security` 里**登记例外**并说明理由。
9. ❌ **在页面把 token 原文渲染出来**（只显示「已获取 / 未获取」）。
10. ❌ **`authRetry` 未置 `false` 就调登录/绑定接口**（会造成递归登录）。
11. ❌ **给「失败即隐藏的装饰位模块」不传 `{ guard:false }`** —— 它有能力弹阻断框。
12. ❌ **提交 `.env.*.local`、`dist/`、`unpackage/`、`.idea/`**。

### 9.3 流程红线

13. ❌ **默认执行测试 / 跑构建 / 装依赖**。**除非用户在本轮明确要求**，否则只生成与静态检查。
14. ❌ **在需要评审的改动上默默跳过 `reviewer`**，或带 blocker 继续推进流程。
15. ❌ **结构与规则变更不改 `CLAUDE.md`**；❌ **重要变更不在 commit message 写一行**；
    ❌ **口径 / 状态机 / 权限变化不更新 `business-logic.md`**。
16. ❌ **提交空文件 / 占位 `TODO` 模板 / 未经核实的 API**。不确定就写「待确认」并登记。
17. ❌ **凭印象编造后端字段名、错误码、接口路径**。契约不确定**必须问后端**。
18. ❌ **发布前不跑最后一次 `build:*`**（用 `verify:*` 的产物会把开发域名发到生产）。

---

## 10. 输出规范

### 10.1 通用结构

```
## 结论        ← 一句话说清做了什么/发现了什么
## 依据        ← 引用 file_path:line_number，不引用记忆
## 改动/发现   ← 分条列出，每条含：文件 · 动作 · 原因(why)
## 影响范围    ← 受影响的模块/端/环境，是否需数据迁移
## 风险        ← 风险等级(低/中/高) + 回滚方式
## 待确认      ← 需要人/后端拍板的问题（没有则写「无」）
```

### 10.2 代码输出规范

- **必须包含中文注释，且解释 why**，不是复述代码做什么。
- **给出完整文件内容或精确 diff**，禁止「此处省略」「其余同理」。
- 引用代码位置一律 `src/xxx/yyy.js:42` 形式（可点击）。
- 新增文件必须同时给：用途、在分层中的位置、被谁调用。

### 10.3 禁止的输出形式

- ❌ 空文件、`TODO` 占位、`// 实现略`。
- ❌ 未标注不确定性的编造内容（字段名/错误码/接口路径）。
- ❌ 与本项目栈不符的通行写法。
- ❌ 不说明 why 的「最佳实践」套话。

### 10.4 重要变更记录

`<type>: <变更> —— <why>`（type：`feat` / `fix` / `refactor` / `chore` / `docs`）。
`project-meta/versions/vN/` 的需求档与变更表仍由 `project-dev` 维护。

---

## 11. 维护契约

### 11.1 日志策略

**只记「真重要变更」**（新页面 / 新接口 / 状态机 / 权限 / 口径 / 数据迁移）：
commit message 写一行；若属业务规则，同时更新受影响的 `business-logic.md`。
普通改动（修 bug / 文案 / 样式 / 重构）不单独记。

### 11.2 本文件的同步规则

| 变更 | 需更新章节 |
|---|---|
| 新增 / 删除 / 改职责 Agent | §5 |
| 新增 / 改 Workflow | §6 |
| 新增页面 / 功能模块 / 子入口 / 操作按钮 | §3.3、§4.3，并同步 `src/config/access.js` 与 `src/pages.json` |
| 新增权限码 | §3.3、§4.3，并在 `config/dict.js` 加 `PERM_*` |
| 新增 / 改 rule-skill | §4.2、§4.3，并登记 `project-meta/skills-index.md` |
| 技术栈 / 目录结构变化 | §2、§4 |
| 红线增删 | §9 |

`node .claude/scripts/sync_claude_md.mjs --fix` 可刷新文末自动索引与「最后同步」日期；
`node .claude/scripts/check_system.mjs` 做九件事的一致性检查。
**不通过即视为系统损坏。**

**版本号**：`MAJOR.MINOR.PATCH` —— 结构破坏性变更升 MAJOR，新增 Agent / Workflow / Rule 升 MINOR，
文档修订升 PATCH。