---
name: rule-multi-platform
description: 当代码需要区分运行端（微信小程序/H5/App）、调用设备能力（拨号/震动/扫码/地图/滚锁）、或需要写条件编译时使用。也用于排查「H5 上点了没反应」「真机上某功能缺失」这类问题。提供本工程的多端适配收口约定，不涉及业务逻辑。
---

# rule-multi-platform

本工程一套代码产出**多端**（mp-weixin / h5 / app）。
**核心铁律：端差异全部收口，页面里禁止条件编译。**

## ★ 优先用「能力分档」而不是「判端」

**这是本主题最重要的一条原则。** 写 `if (isMP) … else …` 之前先问：

> **我要的是「某个端的能力」，还是「某个端本身」？**

| 写法 | 评价 |
|---|---|
| ❌ `if (isMP) { uni.scanCode(...) } else { toast('请在微信中打开') }` | **判端散落** —— 每个调用点都要重复一遍端逻辑 |
| ✅ `const mode = SCAN_MODE; if (mode === 'wx') … else if (mode === 'h5-sdk') …` | **能力分档** —— 端差异收在 `platform.js` 一处，页面只按「档」分支 |

**分档的好处**：将来接 App 端、或换扫码 SDK，**改 `platform.js` 一处**，
所有消费点自动跟随；而判端写法要改 N 处。

本工程 `platform.js` 已提供的能力（**照抄这个思路，不要新增判端分支**）：
`RUNTIME` · `isMP` / `isH5` / `isApp` · `getLayout()` · `callPhone` · `vibrateLight` ·
`openDocument` · `SCAN_MODE` · `MAP_MODE` · `canContact` · `lockPageScroll`

> 现有的 `isMP` / `isH5` / `isApp` **不是让你到处判端的**，
> 而是给「确实只有两种行为、且不值得抽象成能力」的场景兜底。
> **新增端差异时，优先往 `platform.js` 加一个「能力」而不是在页面里加 `if`。**

## 用法约定

```js
import { isMP, isH5, isApp, RUNTIME, callPhone, vibrateLight, getLayout } from '@/services/platform';

if (isMP) { /* ... */ }
```

**页面只消费「能力」，不关心「哪个端」。**

### `services/platform.js` 提供的能力

| 导出 | 说明 |
|---|---|
| `RUNTIME` | 当前运行端字符串（`'mp'` / `'h5'` / `'app'`） |
| `isMP` / `isH5` / `isApp` | 端判定布尔 |
| `getLayout()` | 布局信息（**含状态栏高度与微信胶囊让位计算**，`app-navbar` 依赖它） |
| `callPhone(tel)` | 拨号（取消不提示，真失败才提示） |
| `vibrateLight()` | 轻震动 |
| `openDocument(url)` | 打开文档 |
| `SCAN_MODE` / `MAP_MODE` | 扫码 / 地图的模式差异 |
| `canContact` | 能否一键联系 |
| `lockPageScroll(lock)` | 页面滚动锁（弹层时用） |

### 页面里 ❌ 禁止出现的

```js
// ❌ 页面 / 组件里禁止 —— 这是红线
// #ifdef MP-WEIXIN
uni.login(...)
// #endif
```

**端差异必须收进 `services/platform.js`**（或同类适配函数）。
若 `platform.js` 里没有你需要的能力 → **往那里加**，不要在页面里就地写条件编译。

## ★ 允许写 `#ifdef` 的位置（白名单，**只有这三处**）

| 文件 | 用来做什么 |
|---|---|
| `services/platform.js` | 端判定（`RUNTIME`）、胶囊导航栏高度与让位计算（`getLayout()`）、H5 锁滚（`lockPageScroll`）、**能力分档（`SCAN_MODE` / `MAP_MODE`）** |
| `services/session.js` | 登录凭证（`MP-WEIXIN` 用 `uni.login` 换 code / 非微信端用 `.env` 的 `VITE_MOCK_LOGIN_CODE`，经 `config/env.js` 导出为 `mockLoginCode`） |
| `config/env.js` | 选 host（浏览器有 CORS、小程序没有）—— 决定 `runtime` 从而选 `VITE_HOST_MP/H5/APP` |

**2026-10-26 复核**：**JS / Vue 里**条件编译**只剩这三处** ——

```bash
grep -rln "#ifdef\|#ifndef" src --include="*.js" --include="*.vue" | grep -v uni_modules
# → src/services/platform.js  src/services/session.js  src/config/env.js
```

⚠️ 另有 `src/common/css/main.css`（**vendored 的 ColorUI 三方件**）里的 6 处
`/* #ifdef */` —— 那是 **CSS 级**条件编译、随 ColorUI 一起进来的，**既不在白名单内也不许新增**
（该文件的口径是「只消费，不新增」，见 `rule-style-tokens`）。故上表的白名单
只约束**我们自己写的 JS / Vue**。

⚠️ **要新增第四处，先想清楚能不能收敛进 `platform.js` 的一个能力档 —— 一般都能。**

已经收敛过的先例（C 端迁移过来时的历史）：
- `components/app-modal` 的 H5 锁 body → 收进 `lockPageScroll`
- 某业务页的 11 处页内 `#ifdef` → 收进 `SCAN_MODE`

`components/app-navbar/app-navbar.vue` **不是例外** ——
它只在**注释**里提到 `#ifdef`（正文写的是「页面/组件层零 #ifdef」），自身无任何条件编译指令。

**规律**：条件编译只允许出现在**「取凭证 / 调设备能力 / 选环境」这类适配处**。
**渲染与业务分支里一律不允许。**

自查（应为空）：
```bash
grep -rn "#ifdef\|#ifndef" src/pages src/components
```

## 安全区（样式侧）

- 用 `theme.scss` 的 `$safe-bottom` / `$safe-top`
- ❌ **禁止手写 `env(safe-area-inset-*)`**
- ⚠️ 凡 `calc(... env ...)`，**必先写一行不含 env 的同属性回退**
  —— 小程序端混 `rpx` 与 `env()` 兼容性不可靠，那行被丢弃时会用到上一条声明

（样式细节见 `rule-style-tokens`）

## 目录约定

| 内容 | 位置 |
|---|---|
| 端判定 / 设备能力 / 布局计算 | `src/services/platform.js` |
| 取登录凭证的端适配 | `src/services/session.js` 的 `getLoginCredential()` |
| 安全区 token | `src/common/css/theme.scss` |
| 各端配置（appid / 平台设置） | `src/manifest.json` |

## 硬性禁令（MUST / MUST NOT）

> **本节是本主题 MUST / MUST NOT 的唯一权威。**

1. ❌ **页面里写 `#ifdef` / `#ifndef`** —— 本工程红线第 5 条。
2. ❌ **手写 `env(safe-area-inset-*)`**；`calc(env(...))` 不写回退行。
3. ❌ **手改 `src/uni_modules/uview-plus/`** —— 第三方整包，升级即丢改动。
4. ❌ **用 `uni.navigateTo` 直接跳页** —— 走 `services/route.js` 的 `route.*`
   （`TAB_PAGES` 判定的 bug 只在一处修，见下）。
5. ❌ **各页各写一份设备能力调用**（本工程已踩过：各页各写 `uni.navigateToMiniProgram`，
   既绕过统一出口又没 fail 兜底，H5/App 点下去**毫无反应 = 死按钮**）。
6. ⚠️ **`route.to` 判 tab 必须拿「未拼 query 的路径」比** ——
   tabBar 页 `navigateTo` 必失败，而带 query 的串永远匹配不上 `TAB_PAGES`。
   本工程已在 `route.js` 修好，**别改回去**。

## 多端验证提醒

⚠️ **H5 验过 ≠ MP 验过。** 小程序端有**样式隔离**、双线程运行时、`env()` 兼容性问题。
本工程的这些**必须在真机验证**：

| 项 | 状态 |
|---|---|
| `.u-popup` 是否被页面滚动区挤压（MP 端） | ⚠️ **未确证**（K-08） |
| 签名（管理端 source/edition/密钥组合） | ⚠️ **未确证**（K-09） |
| 下拉三段态跟手 | ⚠️ **未确证** |
| 安全区在刘海屏 / 全面屏 | ⚠️ **未确证** |

（清单见 `.claude/rules/testing.md` §4；状态见 `.claude/memory/known_issues.md`）

## 隐患排查命令

```bash
grep -rn "#ifdef\|#ifndef" src/pages src/components     # 应为空
grep -rn "safe-area-inset" src/pages src/components     # 应为空
grep -rn "uni\.navigateTo\|uni\.switchTab\|uni\.reLaunch" src/pages src/components  # 应为空（走 route.*）
```

## 来源

> ★ **2026-11-16：`.claude/rules/` 目录已删除** —— 其硬约束已全量迁入各 rule-skill（删前逐条审计过缺口，共补 28 条）。
> 下文出现的 `.claude/rules/xxx.md` 是**历史出处**，不是可读路径；需要规则正文时就地看本 skill。


提炼自 `.claude/rules/architecture.md`（§6 多端适配规则）、
`.claude/memory/architecture.md`（§7 多端适配、§6 样式体系）、
`.claude/rules/coding_style.md`（§4 CSS 段的安全区规则）、
`.claude/agents/frontend_engineer.md`（禁止事项），最后同步于 2026-10-26。