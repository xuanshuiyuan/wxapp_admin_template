---
name: rule-session-guards
description: 当代码需要读/写登录态、判断是否已登录（或本地会话是否够用）、需要页面级登录拦截与权限门、或需要处理账号受限状态（账号已被禁用 / 未配置角色权限）时使用。也用于「新增一个业务码要在全局做动作」这类需求。提供登录态与全局守卫机制的用法；业务规则细节见 project-meta/modules/<模块>/business-logic.md。
---

# rule-session-guards

本工程的**登录态读写入口**与**全局业务码守卫机制**。

> ⚠️ **边界**：本 skill 讲**机制怎么用**（基础设施）。
> 「管理端一阶段登录 + 首次绑定分支的规则」「哪个码触发什么动作」是**业务规则** →
> 见 `.claude/project-meta/modules/<模块>/business-logic.md`。

## 登录态读写（唯一入口）

⚠️ 管理端**没有登录页**：登录是**微信静默**的（`wx.login` 换 token），用户无感。
故页面里**没有**「跳登录页」这个动作；`58001`（该微信未绑管理员）是**流程分支不是错误** ——
由服务层内部清栈跳绑定页，页面层不判这个码。

★ **2026-10-27（v1.0.1）起，两道门与页内显隐都收口到两个文件**（用户定稿：
「不管是什么页面、路由、功能模块的展示，都配置在一处，再按登录下发的权限码决定显示」）：

| | 唯一真相源 | 内容 |
|---|---|---|
| **配置** | `src/config/access.js` | 页面路径 `PAGE_*` + 入口/子入口/按钮清单组成 + **页面准入表 `PAGES`** |
| **判据** | `src/services/pageAccess.js` | `requirePageAccess` / `byPermission` / `pageNeedsLogin`（+ `pageCodes` / `pageConfig`） |

页面不再自己拼权限码数组，也不再各写一遍「配置 ∩ 权限点」的过滤（那写法曾是 3 处副本）。

```js
// ★ 首选：两道门一行接线（登录门 onShow + 权限门 onLoad + 首次取数）
import { usePageGuard } from '@/composables/usePageGuard';
usePageGuard({ path: PAGE_DEMO, onReady: refreshAll });

// 需要手写时（等价语义，不要漏任何一道）：
import { sessionReady, requireAdminLogin } from '@/services/session';
import { requirePageAccess, byPermission, pageNeedsLogin } from '@/services/pageAccess';
import { PAGE_DEMO, DEMO_SUBMENU_ENTRIES } from '@/config/access';

// ① 登录门（页面 onShow）：**跑不跑由配置决定**（access.js 的 PAGES[path].login）
if (pageNeedsLogin(PAGE_DEMO) && !(await requireAdminLogin())) return;

// ② 权限门（页面 onLoad 一行）：无权则内部 toast + route.back()；
//    'unresolved' 是参数问题，不跳页、由页面给空态
const access = requirePageAccess(PAGE_DEMO, query);
if (!access.allowed) return;

// ③ 页内 tab / 按钮显隐：同一口径的**唯一实现**
const tabs = byPermission(DEMO_SUBMENU_ENTRIES, permission.value);  // ⚠️ 响应式场景**必须显式传 ref 的值**

// ④ 同步判据（零网络）：本地会话够不够用 —— 只有需要**第一帧**就决定渲染什么时才用
const ok = sessionReady();                  // isLogin() && 权限点已取到
```

**★ 判据别混用**（会话侧 2 个在 `session.js`，准入口 3 个在 `pageAccess.js`）：

| 判据 | 何时用 | 语义 |
|---|---|---|
| `sessionReady()` | 需要**同步**决定首帧渲染（如首页的「启动判定态」） | 「本地会话**够不够用**」——**乐观**，允许假阳性（有 token 不代表服务端认，那是 `40005` 的事） |
| `requireAdminLogin()` | 页面 `onShow` 的登录拦截 | 「**登录态可不可用**」——可能一次网络往返 |
| `requirePageAccess(path, query)` | 页面 `onLoad` 的**权限门 + 取本页配置** | 返回 `{allowed, reason, codes, config, entries}`；`reason` = `open` / `granted` / `denied` / `unresolved`（★ `unresolved` 是**参数问题不是权限问题**：URL 被手改 / 后端加了新类型而这版还不认识） |
| `pageNeedsLogin(path)` | 页面 `onShow` 决定登录门**要不要跑** | 读配置的 `login`；**未登记页按「要」处理**（安全侧默认，漏配不该变成"谁都能进"） |
| `byPermission(list, codes)` | 页内入口 / tab / 按钮的显隐 | 会话里的**权限点快照**（会过期，最长 2h） |

> 低阶判据（`hasPermission` / `hasAnyPermission` / `requirePermissions`，都在 `session.js`）仍在，
> 但**页面层不再直接用它们** —— 已被 `pageAccess.js` 包住（`requirePageAccess` 内部就调 `requirePermissions`）。

**读原始字段**走 `services/storage.js`（`getToken` / `getUserId` / `getOpenid` / `getUserInfo` /
`getPermission` / `isLogin`）。**❌ 禁止直接调 `uni.getStorageSync`。**

### 四个必须知道的约束

1. **`requireAdminLogin()` 失败不抛异常、只返回 `false`** —— 页面据此渲染「加载失败可重试」态。
   **不许**跟着写「未登录就跳登录页」（那是 C 端的 `requireLogin()`，本工程**已删除**）：
   未登录的成因有多种（网络失败 / 账号禁用 / 未绑定），只有未绑定才该去绑定页。
2. **判据不许在页面里复制** —— `sessionReady()` 的 `isLogin() && getPermission().length`
   集中在服务层（`requireAdminLogin` 内部也调它）；「配置 ∩ 权限点」的唯一实现是
   `pageAccess.js` 的 `byPermission()`。页面自己再写一份，将来改判据必然漏改一处。
   ⚠️ **响应式场景（`computed`）必须显式传** `byPermission(list, permission.value)` ——
   省略 `codes` 时它现读会话（**非响应式**），重新登录后不会重算。
3. **权限门是体验层，不是安全层** —— 权限点是登录快照，真正的防线在服务端（无权回 `40102`，
   调用方**仍必须**处理）。
4. **登录/绑定接口必须传 `authRetry: false`** —— 否则递归登录。

## 全局守卫机制

### 机制链路

```
services/guards.js（业务语义登记处）  registerCodeGuard(CODE_XXX, handler)
        ↓
services/http/guard.js（机制）        getCodeGuard(code) → fireCodeGuard(entry)
                                     ★ busy 去重 + 1s 冷静期
        ↓
services/http/request.js              命中后抛 ApiError(type='guard')，toast 强制 false
        ↓
页面 catch 到 type==='guard' → 直接忽略（弹框/跳页已处理）
```

### 新增一个守卫码 = 两步（**页面层零改动**）

```js
// ① src/config/dict.js 加常量（★ 必须是真实码值；改成 0 表示关闭该守卫）
export const CODE_XXX = 50012;

// ② src/services/guards.js 登记动作
registerCodeGuard(CODE_XXX, () => pushModal({ title: '...', content: '...', showCancel: true })
	.then(action => { if (action === 'confirm') route.to(SOME_PAGE); return action; }));
```

### 当前登记**两枚**（都是「本人自助解决不了、必须找管理员」的账号态，**只弹框不跳页**）

| 码 | 常量 | 含义 | 动作 |
|---|---|---|---|
| `50008` | `CODE_ACCOUNT_DISABLED` | 账号已被禁用（登录**与绑定**都回它） | 弹框「请联系管理员恢复」（无跳转 —— 不给假出口） |
| `58004` | `CODE_ADMIN_NO_ROLE` | 未配置角色权限（无角色 / 角色被禁用 / 角色名下无权限点） | 弹框「请联系管理员分配后重试」 |

⚠️ **三组码（共 4 个）刻意不进守卫**（有意为之，别"顺手统一"）：

| 码 | 为什么豁免 |
|---|---|
| `58003` 绑定频控 | 页面级语义（同手机号 60s 内失败 5 次）→ 绑定页置灰倒计时即可恢复 |
| `40102` 无权限操作 | 模块可能**按子类型拆权**，一个 tab 无权不该弹阻断框、更不该把模块藏掉 → 页面就地置灰 / 空态 |
| `58005` / `58006` 绑定冲突 | 提交后的**字段级**结果，全局框会遮住刚填的表单 |

> ⚠️ 守卫是**全局行为**：新增/改动前须经 `security_agent` + 用户确认（见 `rule-api-registry` 禁令 4）。

### `guard: false` 的两种**合法**用途

| 用途 | 理由 |
|---|---|
| 守卫**目标页自己**的接口 | 否则弹框与页面自身逻辑打架 |
| **失败即隐藏的装饰位模块** | 它**有能力弹阻断框**，但它失败了本就该隐藏 |

❌ **其余用途 = 绕过登录态/账号态检查，属安全缺陷（评审阻断项）。**

### 四条不可改坏的机制

1. **保留页栈** —— 用 `route.to`，用户处理完受限状态能回到原操作
2. **busy 去重 + 1s 冷静期** —— 并发 10 个接口同回一个码只弹一个框
3. **Promise 未 settle 前 busy 持续** —— 框没关之前不重复弹、也不提前放行
4. **频控码与守卫码分开处置** —— `58003`（绑定频控）是「几十秒内点太快」
   （页面置灰倒计时即可恢复），守卫码是「要找管理员才能恢复」（弹框给说明，
   **不倒计时、不自动重试**）→ 故 `58003` **刻意不进全局守卫**

## ⚠️ 两条不可删的副作用 import

`src/main.js`：

```js
import '@/services/session';   // 注册 authHandler（删了不再自动重登）
import '@/services/guards';    // 登记守卫动作（删了守卫码只剩普通抛错）
```

**删了不会报错，是静默失效** —— 这是本工程最容易被误删的两行。

## 目录约定

| 内容 | 位置 |
|---|---|
| 登录态读写 / 登录流程 | `src/services/session.js` |
| 登录态存储（唯一入口） | `src/services/storage.js` |
| 守卫**动作登记** | `src/services/guards.js` |
| 守卫**机制** | `src/services/http/guard.js` |
| 守卫触发点 | `src/services/http/request.js` |
| 业务码 / 频控常量 | `src/config/dict.js` |
| 登录态字段白名单 / 存储前缀 | `src/config/app.js` |
| **页面清单 + 准入配置**（`PAGE_*` / `PAGES` / 入口与按钮） | `src/config/access.js`（★ 唯一真相源） |
| **页面准入判据** | `src/services/pageAccess.js`（`requirePageAccess` / `byPermission` / `pageNeedsLogin`） |
| 跳转出口 | `src/services/route.js`（⚠️ 登录/权限**拦截不在这里**；路径常量定义在 `config/access.js`，这里只**转出**） |
| 响应式视图 | `src/store/user.js`（★ 真相源在 storage） |

## 硬性禁令（MUST / MUST NOT）

> **本节是本主题 MUST / MUST NOT 的唯一权威。**

1. ❌ **绕过 `services/storage.js` 直读写存储**。
2. ❌ **登录/绑定接口漏 `authRetry: false`**。
3. ❌ **滥用 `guard: false`**（见上）。
4. ❌ **改存储前缀 `PREFIX` 不评估** —— 与同一产品线的其它端撞前缀
   会导致 **H5 同域部署时两工程互相串登录态**。
5. ❌ **把登录态只存进 `store/` 而不存 storage** —— `store/user.js` 只是**视图**。
6. ❌ **在页面把 token 原文渲染出来**（只显示「已获取 / 未获取」）；**不得进日志/埋点**。
7. ❌ **手机号不脱敏直接展示**（只保留前 3 后 4，长度 <7 全星号）。
8. ❌ **给装饰位模块不传 `guard: false`** —— 它有能力弹阻断框。

## 隐患排查命令

```bash
grep -rn "getStorageSync\|setStorageSync" src/ | grep -v "services/storage.js"   # 应为空
grep -rn "guard:\s*false" src/          # 逐点评估合法性
grep -rn "authRetry" src/               # 登录/绑定接口是否传了 false
grep -n "services/session\|services/guards" src/main.js   # 两条副作用 import 是否在
```

## `guard: false` 的合法用途（补充，2026-11-16 从 `rules/security.md` 迁入）

| 用途 | 为什么合法 |
|---|---|
| 守卫目标页自己的接口 | 否则弹框会与页面自身逻辑打架 |
| **失败即隐藏的装饰位模块** | 它**有能力弹阻断框**，不该有 |
| ★ **只想本地静默处理**（如页面自行处置频控码 `58003`） | 恢复动作在页面（置灰倒计时），全局框只会遮住绑定表单 |

❌ **除此之外一律非法**。为了「别弹框打扰我」而全局加 `guard: false` = 绕过登录态 / 账号态检查，
是安全缺陷而不是体验优化。

## 来源

> ★ **2026-11-16：`.claude/rules/` 目录已删除** —— 其硬约束已全量迁入各 rule-skill（删前逐条审计过缺口，共补 28 条）。
> 下文出现的 `.claude/rules/xxx.md` 是**历史出处**，不是可读路径；需要规则正文时就地看本 skill。


⚠️ **本 skill 曾是 C 端口径的遗留**（写着 `ensureLogin` / `phoneBound` / `ensurePhoneBound`
与三枚已删码 `50011` / `40011` / `40012`），已于 2026-10-26 **冷启动过渡轮**按管理端现况校正 ——
若在别处再看到那几个符号，一律视为**未同步的旧文本**。

> 来源：源工程 `.claude/memory/architecture.md`（§4 登录态、§5 全局业务码守卫机制）
> 与 `rules/security.md`（§2 敏感信息、§3 鉴权与越权、§4 会话安全），已随本次抽离去业务化。
> 业务规则正文见 `.claude/project-meta/modules/<模块>/business-logic.md`。