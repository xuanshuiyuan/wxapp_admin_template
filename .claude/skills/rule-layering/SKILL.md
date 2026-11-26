---
name: rule-layering
description: 当需要新建文件、新增一个能力、或不确定某段代码该放在哪一层时使用（页面/composable/api/services/config/utils/store 的落位判断）。也用于判断「这段逻辑是不是写错层了」。提供本工程的分层约定与依赖方向，不涉及具体业务逻辑判断。
---

# rule-layering

本工程的分层与文件落位约定。**依赖只能向下，业务逻辑不在页面里。**
`project-dev` 在「涉及新模块或代码落位不确定时」会调用本 skill。

## 分层与落位决策树

```
这段代码是「一次性的界面行为」吗？（渲染、事件响应）
  ├─ 是 → src/pages/<page>/index.vue
  └─ 否 ↓
会被 ≥2 个页面用，且是「一个完整能力」吗？
  ├─ 是 → src/composables/use<Name>.js（hook 形态，不含 HTTP 细节）
  └─ 否 ↓
是「业务域名词 → HTTP」的映射吗？
  ├─ 是 → src/api/<域>.js（URL 必须先登记 config/endpoints.js）
  └─ 否 ↓
是「跨页响应式状态」吗？
  ├─ 是 → src/store/<name>.js（★ 真相源仍在 storage 或服务端，store 只是视图）
  └─ 否 ↓
是「与业务无关的纯函数」吗？（零副作用）
  ├─ 是 → src/utils/<name>.js
  └─ 否 ↓
是「常量 / 环境 / 枚举 / URL / 页面清单」吗？
  ├─ 是 → src/config/（★ 最底层，不引任何业务模块；含 `access.js` = 页面路径 + 准入配置）
  └─ 否 ↓
是「横切能力」吗？（请求 / 会话 / 路由 / 存储 / 提示 / 多端）
  └─ 是 → src/services/<name>.js
```

**跨页通用的 UI 组件** → `src/components/app-<name>/app-<name>.vue`
（easycom 免 import；**目录名与文件名必须同名**）。

## 依赖方向（硬约束）

```
pages → composables → api → services → config / utils
                            ↑
                     store ─┘
```

- **只能向下**。`services/` 不许 import `api/`；`config/` 不许引任何业务模块。
- **禁止同级循环依赖**。

### 打破循环的**唯一合法解法**：注册模式

| 场景 | 本工程范例 |
|---|---|
| 下层需要调用上层能力 | `services/session.js` → `registerAuthHandler(relogin)`；`http/request.js` 只持有 handler 引用 |
| 业务码 → 全局动作 | `services/guards.js` → `registerCodeGuard(code, fn)`；`http/guard.js` 只查表 |

❌ **禁止**用动态 `import()`、延迟 `require`、`globalThis` 挂载来绕环 ——
那会把「编译期环」变成「运行期时序炸弹」。

## ★ 页面层禁止清单（**全工程唯一一份**）

> 页面层（`src/pages/`）与组件层（`src/components/`）的「必须 / 禁止」**收口在本节**，
> 各主题 skill 不再各写一份。写完页面**逐条自查**。

| # | ❌ 页面 / 组件里禁止 | ✅ 该去哪 |
|---|---|---|
| 1 | **业务逻辑**（校验规则 / 状态机 / 计算规则 / 权限判定） | `services/` 或 `api/` |
| 2 | 接口**路径字符串** | `config/endpoints.js` 登记 → `api/<域>.js` |
| 3 | 直接调 `curl` / `@/services/http` | `api/<域>.js`（页面只调 api） |
| 4 | `#ifdef` / `#ifndef`（条件编译） | `services/platform.js`（见 `rule-multi-platform`） |
| 5 | 直读写 `uni.getStorageSync` / `setStorageSync` | `services/storage.js` |
| 6 | 直调 `uni.showModal` / `showToast` / `showLoading` | `useModal` / `services/toast`（见 `rule-page-services`） |
| 7 | 直调 `uni.navigateTo` / `switchTab` / `reLaunch` | `services/route.js` 的 `route.*` |
| 8 | **硬编码色值 / 字号 / 间距** | `common/css/theme.scss` token（见 `rule-style-tokens`） |
| 9 | 手写 `env(safe-area-inset-*)` | `$safe-bottom` / `$safe-top` |
| 10 | **字面量**枚举值 / 错误码（`58001`、`58003`…） | `config/dict.js` |
| 11 | 重造已有能力（`useList` / `useModal` / `usePullRefresh` / `platform` / `storage` / `toast`） | 直接用现成的 |
| 12 | 手写列表**四态** `v-if` 链 | `<app-list-state>`（优先级只在组件内定义一次） |
| 13 | 自己拼 query 字符串 | `curl.*` 的 `params`（内部已 `encodeURIComponent`） |
| 14 | `v-html` 渲染用户输入 | 禁止（H5 端有 XSS 面） |

**必须**（同样重要）：

- 每页模板放一次 **`<app-modal />`** 与一次**不带 `show` 的 `<app-loading />`**
  —— 少了前者弹窗不渲染、少了后者请求 loading **静默降级**成原生样式
- 新页**必须**在 `src/pages.json` 的 `pages` 数组登记（第一项是启动页）
- 页面私有类名带**页面前缀**（BEM），且 ≥3 字母

## 任务 → 该读哪个 skill

| 你要做的事 | 读 |
|---|---|
| 新增页面 / 列表页 / 表单页 / 详情页 | `rule-add-page` |
| 发请求 / 设 options / 处理接口失败 | `rule-request-chain` |
| 加接口 / 加错误码 / 加常量 | `rule-api-registry` |
| 弹窗 / toast / loading / 跳转 | `rule-page-services` |
| 写样式 / 调色值 / 用 HUD 语言 | `rule-style-tokens` |
| 选组件 / 封装组件 | `rule-ui-components` |
| 登录态 / 守卫 / 页面准入（两道门） | `rule-session-guards` |
| 端差异 / 设备能力 / 条件编译 | `rule-multi-platform` |
| 命名 / 注释 / 函数规范 | `rule-coding-basics` |
| 性能 / 重复请求 / 缓存 | `rule-performance` |
| 安全 / 密钥 / 脱敏 / 发布产物 | `rule-security` |
| 测试 / 回归 / 发布验证清单 | `rule-testing` |
| **新建文件该放哪层** | **本文件** |

## 判定口诀：这段逻辑写错层了吗？

> **把入口层文件（`pages/`）删掉换成 CLI，业务规则应该完全不受影响。**
> 若受影响，说明逻辑写错层了。

**入口层允许做的（穷举）**：解析/校验**格式** · 调 api/service · 组装渲染 · 错误映射。
**入口层禁止做的**：业务规则 · 状态机迁移 · 计算规则 · 权限判定 · 数据访问 · 跨服务编排。

## 抽取的时机（避免过度抽象）

| 出现次数 | 处置 |
|---|---|
| 1 次 | 就地实现 |
| 2 次 | **考虑**抽（若两处变化原因不同，可不抽） |
| **≥3 次** | **必须**抽 |

**改之前先 grep** —— 本工程已有：`useList`（分页列表）· `useModal`（Promise 化弹窗）·
`usePullRefresh`（下拉三段态）· `platform.js`（端差异）· `storage.js`（存储）·
`toast.js`（提示 + `withLoading`）· `endpoints.js`（URL 登记）· `dict.js`（枚举）·
`access.js`（页面清单 + 准入配置）· `pageAccess.js`（**页面准入 + 配置 ∩ 权限点** 的唯一实现）。
**重造这些是最常见的评审阻断项。**

## 真相源：一个数据只有一个

| 数据 | 真相源 | 视图 |
|---|---|---|
| 登录态 | 本地存储（`services/storage.js`） | `store/user.js` |
| 权限 / 账号态 / 余额 | **服务端**（会话里的 `permission` 只是**登录快照**，仅供显隐；准入看服务端 `40102`） | 页面局部状态（配置在 `config/access.js`、判据在 `services/pageAccess.js`） |
| 列表数据 | 服务端 | `useList` 的 `items` |
| 环境配置 | `.env.*` → `config/env.js` | 只读引用 |

**禁止**同一数据在页面 `ref`、store、存储各存一份。
**症状**：为了「同步两份状态」而写 watch / 事件 —— 这说明真相源已经分裂。

## 目录约定速查

| 层 | 路径 | 命名 |
|---|---|---|
| 页面 | `src/pages/<page>/index.vue` | 目录 kebab-case |
| 通用组件 | `src/components/app-<name>/app-<name>.vue` | 目录名 = 文件名 |
| 复用逻辑 | `src/composables/use<Name>.js` | camelCase 文件名 |
| 接口域 | `src/api/<域>.js` | 一个域一个文件 |
| 服务 | `src/services/<name>.js` | kebab-case |
| 状态 | `src/store/<name>.js` | kebab-case |
| 配置 | `src/config/<name>.js` | kebab-case |
| 纯函数 | `src/utils/<name>.js` | kebab-case |

## 硬性禁令（MUST / MUST NOT）

> **本节是本主题 MUST / MUST NOT 的唯一权威。**

1. ❌ **业务逻辑写进 `pages/` 或 `components/`** —— 本工程红线第 1 条。
2. ❌ **页面里写接口路径字符串** —— 走 `config/endpoints.js`。
3. ❌ **页面里写 `#ifdef`** —— 端差异收进 `services/platform.js`（见 `rule-multi-platform`）。
4. ❌ **为了「将来可能复用」提前抽象** —— 过度设计与重复代码同样违规。
5. ❌ **只因为「文件太长」就拆分** —— 长度不是拆分理由，职责才是。
6. ❌ **`config/` 引业务模块** —— 它是最底层。
7. ⚠️ **改共用目录要评估双向下发** —— `src/services/` · `src/composables/` · `src/utils/` ·
   `src/components/app-*` · `src/common/css/` · `src/styles/` 与 C 端工程是**两份副本**。

## 补充硬约束（2026-11-16 从 `rules/architecture.md` 迁入）

- ❌ **`api/<域>.js` 与数据访问封装里同样禁止写业务规则**（状态机 / 计算 / 权限判定）——
  它们只能做「域名词 → 请求」的映射。否则同一条规则会在 `api` 与 `services` 各存一份，改一处必漏一处。
- **两端应当分化的改动，优先不动共用文件**：改为管理端侧覆盖、或新建管理端专属件；
  ❌ 禁止直接在 `scaffold.scss` 里为管理端需求改公共版式块 —— 那样 C 端视觉会被动变化，而改动者不会知道。

## 来源

> ★ **2026-11-16：`.claude/rules/` 目录已删除** —— 其硬约束已全量迁入各 rule-skill（删前逐条审计过缺口，共补 28 条）。
> 下文出现的 `.claude/rules/xxx.md` 是**历史出处**，不是可读路径；需要规则正文时就地看本 skill。


提炼自 `.claude/rules/architecture.md`（§1 分层与依赖方向、§2 分层职责铁律、§4 状态与真相源、
§5 边界与拆分判定）与 `.claude/memory/architecture.md`（§2 分层现状、§9 与 C 端关系），
最后同步于 2026-10-27（v1.0.1：`config/access.js` = 页面清单 + 准入配置、
`services/pageAccess.js` = 准入与显隐判据的唯一实现）。规则文档更新后，重新跑一遍
`project-skill-manager` 的 RULES-TO-SKILLS 流程来同步。