---
name: rule-page-services
description: 在本工程要弹提示框/确认框、需要用户选择后继续、控制 loading 转圈、做页面跳转或返回、处理登录拦截跳转，或遇到「两个弹窗叠在一起」「loading 关不掉」「返回后白屏」「遮罩盖在错误的页面上」时使用。给出 useModal、toast、route 三个统一入口的完整签名与队列/引用计数语义。
---

# rule-page-services

页面上的三类「副作用」各有**唯一出口**：

**弹窗 → `composables/useModal`，轻提示与转圈 → `services/toast`，跳转 → `services/route`。**

❌ 页面里**不出现** `uni.showModal` / `uni.showToast` / `uni.showLoading` / `uni.navigateTo`。

> 📌 **来源**：源工程同名 skill（已随本次抽离去业务化），
> 实测两边基础设施**完全一致**（`useModal` 导出与 `MODAL_SETTLE`、`toast` 七个 API、
> `store/modal.js` 的 `SWITCH_DELAY = 250`）。
> 本次适配：剔除 C 端业务路径常量，改列本工程 `services/route.js` 的**实际**常量；
> 「跨页 loading 泄露」一条标为**预留**（本工程未开 tabBar，暂时遇不到）。

## 硬性禁令（MUST / MUST NOT）

> **本节是本主题 MUST / MUST NOT 的唯一权威。**

- ❌ 弹窗只用 `useModal`（`await` 后才继续）；**禁止绕过它直接 import `pushModal`**
  （会丢掉 Promise 包装）。
  **唯一例外：`services/` 层文件** —— `services/` 不允许反向 import `composables`，
  直接 `pushModal` 拿队列 Promise 属既定设计（本工程现例：`services/guards.js` 的**两枚**守卫
  `50008` / `58004`）。
  **页面 / 组件 / composable 一律不在此列。**
- ❌ 每页模板**必须**放一次 `<app-modal />`，否则弹窗不渲染。
- ❌ 每页模板**必须**放一次 `<app-loading />`（全局模式，**不带 `show`**），
  否则该页请求 loading 走原生降级样式（**静默**，只有样式变旧、不报错 —— 很难在真机外发现）。
- ❌ **按钮点击请求 = 双保险**：按钮/热区点击发起的接口请求**必须同时**有
  ① 请求层 `{ loading: true }` 托管全局 loading ② 按钮自身 in-flight 态
  （进行中标志防重入 + 转圈/换态反馈），**两个状态同一调用点同起同收**（`finally` 归位）。
  走请求托管的页面一律挂 `<app-loading :mask="true" />` —— 暗遮罩明示「进行中不可操作」。
- ❌ **tabBar 页 `navigateTo` 的深层子页，请求禁止用 `{ loading: true }`**
  （见下方「跨页 loading 泄露」）。
- ❌ 确认类弹窗保持 `close: false`（必须选按钮，**防误触把确认框吞掉**）；
  只有纯信息展示才开 `close: true`。
- ❌ 「提示后再离开」**必须** `await toast(...)` 再 `route.back()`。
- ❌ 页面里**禁止写跳转路径字面量** —— 一律引 `services/route.js` 的常量。

## 用法约定

### 1) 弹窗：Promise 化，await 后才往下走

前提：页面模板里放一次 `<app-modal />`（渲染器，见 `rule-ui-components`）。

```js
import { alert, confirm, settle, MODAL_SETTLE } from '@/composables/useModal';

await alert('保存成功');                                       // 字符串 = content，单按钮
await alert({ title: '提示', content: 'xxx', close: true });    // close:true → 卡片下方出现 ✕
// alert 返回 Promise<'confirm' | 'close'>（showCancel: false，故无 cancel）

if (await confirm({ title: '删除', content: '确定删除这条记录吗？' })) {
	await someApi.del({ id }, { loading: true });                // 返回 boolean：确定 true，取消/关闭 false
}

// 需要区分「确定 / 取消 / 点 ✕」时用 settle
const action = await settle({ title: '选择', content: '…', close: true });
// action: 'confirm' | 'cancel' | 'close'（常量在 MODAL_SETTLE，即
//         MODAL_SETTLE.SETTLE_CONFIRM / SETTLE_CANCEL / SETTLE_CLOSE）
```

配置字段（**都有默认值**，覆盖即可）：
`title` `content` `showCancel`（`alert` 强制 false / `confirm`·`settle` 强制 true）
`confirmText` `cancelText` `close`。

**队列语义**（`store/modal.js`）：全局同时只显示一个，**后来的排队**；
关闭后 **250ms**（`SWITCH_DELAY`，等出场动画）才放下一个。所以：

- 连续 `await` 多个弹窗是**安全的**，不会出现单例互相覆盖；
- 不想等就别 `await`，但顺序仍是调用顺序。

**`close` 的作用不只是显不显示 ✕**：只有 `close: true` 才允许**点蒙层 / 点 ✕** 关闭，
否则用户**必须选按钮**（防误触把确认框吞掉）。

### 2) toast 与 loading：引用计数，不用手写 hide

```js
import { toast, errorToast, successToast, showLoading, hideLoading, resetLoading, withLoading }
	from '@/services/toast';

toast('已复制到剪贴板');       // toast(message, icon='none', duration=2000)，返回 Promise（resolve 于消失后）
successToast('保存成功');
errorToast('格式不对');
await toast('提示后再继续');    // 想串行就 await

// 首选：让 http 层托管，页面完全不碰 loading
await someApi.save(data, { loading: true });

// 非请求型耗时任务
await withLoading(() => doSomethingSlow(), '处理中');   // 自动计数，异常也保证关闭

onUnload(() => resetLoading());   // ★ 页面卸载兜底
```

**★ 计数语义**：`showLoading` / `hideLoading` 是**引用计数**，**计数归零才真正关闭** ——
所以并发请求各自 hide 不会互相把别人的 loading 关掉。

**★ 上屏节奏（2026-11-12）**：`showLoading` **延迟 200ms 才上屏**、上屏后**至少停留 300ms**。
- 快请求（<200ms）在计时器触发前就被 `hideLoading` 取消 → **完全不渲染**（转圈只闪一帧比不转更像页面在抖）；
- 已经上屏的至少转满 300ms，不会被「请求刚回来」立刻掐掉；
- 两个值在 `config/app.js` 的 `LOADING_SHOW_DELAY_MS` / `LOADING_MIN_VISIBLE_MS`，**不要**在页面里另写延时补丁。
- ⚠️ 因此「loading 没出现」不一定是 bug —— 先看请求是不是本来就快。
  ⚠️ 局部模式 `<app-loading :show="...">` **不走上屏节奏**（页面自己控制布尔量，语义上就该立刻响应）。

**★ `onUnload(() => resetLoading())` 是兜底，不是可选项**：
计数**漏减会让后面所有页面卡住转圈**（全局状态，跨页生效）。
凡本页调用过 `showLoading` / `withLoading`，就在 `onUnload` 挂一次 `resetLoading()`。

**渲染载体是 `<app-loading />`**（每页放一次，同 `<app-modal />` 的规矩）：
`showLoading` 只写 `store/loading` 的状态；`toast.js` 用 `hasLoadingInstance()` 判断这页有没有渲染方。

画面：`config/app.js` 的 `LOADING_IMAGE`（**本工程当前是空串 → 默认纯 CSS 品牌色转圈**，无网络依赖）；
给它或组件 `image` prop 填 OSS 相对路径才上图（经 `utils/oss.js` 的 `ossUrl()` 拼域名，
加载失败自动退 `LOADING_IMAGE_FALLBACK` = `/static/loading.png`）。

> ⚠️ **降级是静默的**：当前页面没挂组件时 `toast.js` 自动降级 `uni.showLoading`，
> 不会「发了没人渲染、卡死计数」—— 但**样式变旧、不报错**，漏挂很难在真机外发现。

**局部 vs 全局可同页共存**（先例：`pages/admin-home/index.vue`）：
```html
<app-loading :show="loading" text="" />   <!-- 局部：跟首屏，show 显式传真/假 -->
<app-loading :mask="true" />              <!-- 全局：接请求托管，不带 show -->
```
`show` 显式传真/假即**切局部模式**；**默认 `null` 才是全局模式**。

| 场景 | 用什么 |
|---|---|
| 按钮发请求 | 全局 `{ loading: true }` + `<app-loading :mask="true" />` |
| 首屏取数 | 局部 `<app-loading :show="firstLoading" />`（或 `app-skeleton`） |
| 模块内小转圈 | `u-loading-icon` |
| 列表首屏 | `app-skeleton` |

❌ **不要拿全屏 loading 凑数**。

### 3) 路由：路径集中，空栈有兜底

```js
import { route, PAGE_ADMIN_HOME, PAGE_BIND, PAGE_LEDGER_LIST, PAGE_LEDGER_SEARCH,
	PAGE_LEDGER_DETAIL, TAB_PAGES } from '@/services/route';

route.to(PAGE_LEDGER_DETAIL, { type, order_no });  // 压栈；命中 TAB_PAGES 自动改用 switchTab
route.redirect(SOME_PAGE, { id });           // 关闭当前页再跳（上一页使命已尽时用）
route.tab(PAGE_ADMIN_HOME);                        // 显式回 tabBar 页
route.relaunch();                            // 关闭所有页面（默认 PAGE_ADMIN_HOME）
route.back();                                // 返回；★ 页面栈为空时回落首页，不白屏
route.back(SOME_PAGE);                       // 自定义兜底页
route.toMiniProgram(appId, { path });        // 跳别的小程序（端差异与失败兜底都收在里面）
```

⚠️ **`services/route.js` 里没有登录拦截函数**（C 端的 `requireLogin` 已删）——
管理端登录是**微信静默**的、**没有登录页**，而「未登录」的成因有多种
（网络失败 / 账号被禁用 / 未绑定），只有「未绑定」才该去绑定页，故拦截要**按原因分流**：
入口在 `services/session.js` 的 `requireAdminLogin()`（页面 `onShow` 调，**要不要跑**由
`services/pageAccess.js` 的 `pageNeedsLogin(path)` 按配置决定），
未被拦截时**不跳页**、只返回 `false` 让页面渲染失败态。详见 `rule-session-guards`。

- 路径**前导斜杠可省**（内部 `normalize()` 补）；query 传对象即可（内部走 `toQueryString`）
- 五个方法 `to / redirect / tab / relaunch / back` 都接受第三个 `options` 透传给 uni API

**本工程 `services/route.js` 的路径常量现状**（**唯一登记表** —— 新增跳转必须在此登记常量）：

| 常量 | 路径 | 说明 |
|---|---|---|
| `PAGE_ADMIN_HOME` | `/pages/admin-home/index` | 首页，也是 `relaunch` / `back` 的默认兜底 |
| `PAGE_BIND` | `/pages/bind/index` | 绑定管理员账号页 —— `58001`（该微信未绑管理员）的落地页，**登录拦截里唯一会跳的目标** |
| `PAGE_DEMO` | 定义在 `config/access.js`，这里**转出** | 演示页（入口清单必须与「点进哪一页」放一处；`config/` 不能反向 import `services/`） |
| `PAGE_FIELD_EDITOR` | `/pages/common/field-editor` | 通用**跳页输入**页（桥见 `services/fieldEditor.js`） |
| `PAGE_DEMO_A` / `PAGE_DEMO_B` | `/pages/demo/page-a` · `page-b` | 示例子页（各用自己的页面码做准入） |
| `TAB_PAGES` | **`[]`（空）** | ⚠️ 本工程**未开 tabBar**（无导航结构设计稿，不编造） |

> ⚠️ **不要新增登录页常量**：管理端没有独立登录页（登录是微信静默的，58001 落绑定页）。守卫目标页里也**只有** `PAGE_BIND` 一个跳转目标。

### ★ 跨页 loading 泄露 —— ⚠️ **本工程预留**（未开 tabBar，暂时遇不到）

> **本工程 `TAB_PAGES` 当前为空、未启用 tabBar，故本条暂不适用。**
> 但**一旦开 tabBar 就会踩**，且症状很迷惑，故预先记在这里。

**症状**：tabBar 页 `navigateTo` 子页后，**tabBar 页不销毁**，
其上的全局 `<app-loading />`（尤其 `:mask="true"`）**仍在监听 `loadingState`**。
此时若子页请求带 `{ loading: true }`，**暗遮罩会渲染在底层的 tabBar 页上** ——
用户看到子页内容被**底页**的暗遮罩盖住。

**修法**：tabBar 页的深层子页**不要用全局 `{ loading: true }`**。
若该页有自己的三态渲染逻辑，改用局部 `<app-loading :show="localLoading" />` 驱动：

```js
const pageLoading = ref(false);
async function load() {
	pageLoading.value = true;
	try { /* 取数 */ } finally { pageLoading.value = false; }
}
```

（C 端真实修复样例：`news/detail/index.vue` 2026-09-23，
`{ loading: true }` → `<app-loading :show="pageLoading" />` + `try/finally`。）

## 目录约定

| 能力 | 位置 | 备注 |
|---|---|---|
| 弹窗调用 | `composables/useModal.js` | 页面只 import 这个 |
| 弹窗状态机 + 队列 | `store/modal.js`（`modalState` / `pushModal` / `settleModal`） | **页面不要直接碰** |
| 弹窗渲染 | `components/app-modal/app-modal.vue` | 每页放一次 `<app-modal />` |
| loading 渲染 | `components/app-loading/app-loading.vue` | 每页放一次全局模式（不带 `show`） |
| 轻提示 / loading | `services/toast.js` | **引用计数**与原生降级在这里 |
| 跳转 | `services/route.js` | 五个方法；路径常量**定义在 `config/access.js`**、这里只**转出**（⚠️ **不含**登录/权限拦截，分在 `session.js` 与 `pageAccess.js`） |

> **新加一类需要跨页协作的 UI 状态**（如全局通知栏）照 `modal` 三件套的形态：
> `store/<name>.js` 写状态机 + `components/<name>/` 写渲染 + `composables/use<Name>.js` 做调用入口。

## 本文件独有的说明

- 「提示后离开」的串行写法：`await toast('已删除'); route.back();`
  （`toast()` 返回 Promise，resolve 于**提示消失后**）。
- **列表失败默认不弹 toast 是刻意的**（`useList` 的 `toastOnError: false`），
  错误进 `error` 状态由页面重试 UI 承担（`app-list-state`）。
- **页面级的两道门都不在 `route.js`**（2026-10-27 v1.0.1 起分置两处）：
  登录门 = `services/session.js` 的 `requireAdminLogin()`（`onShow` 调，失败只返回 `false` 不跳页；
  **跑不跑**由 `services/pageAccess.js` 的 `pageNeedsLogin(path)` 读配置决定）；
  权限门 = `services/pageAccess.js` 的 `requirePageAccess(path, query)`（`onLoad` 调，
  内部无权则 toast + `route.back()`，并**一并取回本页有权限的配置**）。
  页面只 `await` / `if (!…) return`，不自己判原因、也不自己拼权限码数组。详见 `rule-session-guards`。
- **`route.back()` 的空栈兜底**是为 H5 直开链接 / 分享落地页准备的
  （`pages.length > 1` 才 `navigateBack`，否则 `relaunch` 兜底页）。

## 来源

移植自 C 端工程 `.claude/skills/rule-page-services/SKILL.md`（2026-10-26）。
C 端原版提炼自其 `docs/ARCHITECTURE.md` §2 + `composables/useModal.js`、
`services/{toast,route}.js`、`store/modal.js`、`components/app-modal` 的**实测签名**，
2026-09-10 并入其 `rules/scaffold-musts.md` §5。

本次适配（逐项实测核对，未凭记忆）：
`useModal` 的 `alert/confirm/settle/MODAL_SETTLE` ✅ 一致；
`toast` 的七个 API ✅ 一致；`store/modal.js` 的 `SWITCH_DELAY = 250` ✅ 一致；
路径常量表改为**本工程实际的五个**（C 端的 12 个业务常量已剔除）；
「跨页 loading 泄露」标为**预留**（本工程未开 tabBar）。
最后同步于 2026-10-27（v1.0.1：路径常量定义下沉到 `config/access.js`、由 `route.js` 转出；
两道门分置 `session.js`（登录）+ `pageAccess.js`（权限））。
