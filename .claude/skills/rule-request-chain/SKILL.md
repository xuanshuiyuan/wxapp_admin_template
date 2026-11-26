---
name: rule-request-chain
description: 当代码要发 HTTP 请求、处理接口失败、需要设置请求选项（toast/loading/authRetry/guard）时使用。也用于排查「接口失败了怎么提示」「为什么弹了两次框」「登录失效没自动重试」这类问题。提供本工程请求链的用法与 options 语义，不涉及具体业务逻辑。
---

# rule-request-chain

本工程的 HTTP 请求链：**签名注入 → 发送 → HTTP 状态 → 业务码 → 40005 自动重登重放 → 全局守卫 → 错误归一**。

## 用法约定

**只有一条合法路径**（其他一律禁止）：

```
api/<域>.js  →  curl.get / post / upload（**只有这三种请求形态**）
                    ↓
              services/http/request.js
                    ↓
              services/http/transport.js  （uni.request / uni.uploadFile）
```

```js
import { curl } from '@/services/http';

// GET：data 作为 query
curl.get(ENDPOINT_DEMO_LIST, { page: 1, page_size: 20 }, { guard: false });

// POST：默认 x-www-form-urlencoded（★ 本工程全部接口都发表单 —— 已实测收口，见 K-19）
curl.post(ENDPOINT_ADMIN_LOGIN, { code }, { authRetry: false, toast: false });

// ❌ 没有 postJSON：后端统一表单解码；第三方 JSON 接口在 api 层显式
//    request({ url, method:'POST', contentType:'application/json', rawResponse:true })

// 上传：默认落点 ENDPOINT_ADMIN_UPLOAD；**一次一个文件**
// ⚠️ 微信 wx.uploadFile 没有多文件参数（uni 的 files 在微信端不生效），
//    多图由 services/uploader.js 逐张串行（后端按管理员每分钟配额限流）
curl.upload({ filePath, name: 'file', formData: {} }, url, options);
```

**成功**返回响应体 `{ code, msg, data }`；**失败永远抛 `ApiError`**（默认已自动 toast）。

## options 语义（最容易错的地方）

| option | 默认 | 何时改 | **why** |
|---|---|---|---|
| `toast` | `true` | 进页 / 下拉等**自动路径** → `false` | 不弹错，交给页面状态位（列表页有四态编排） |
| `loading` | `false` | **按钮点击链路** → `true` | 双保险：托管 loading + 页内 `app-loading` + 按钮 in-flight |
| `authRetry` | `true` | **登录 / 绑定接口** → `false` | ⚠️ 否则登录接口返回 `40005` 会**递归登录** |
| `guard` | `true` | 守卫目标页自己的接口 / **失败即隐藏的装饰位模块** → `false` | 后者**有能力弹阻断框**，但它失败了本就该隐藏 |
| `timeout` | `10000` | 极少改 | 加大只是让用户等更久 |

> ⚠️ **`{ loading: true }` 不要用在多个串行请求上** —— 托管会在两请求之间闪断。
> 需要包住一整段流程时用 `withLoading()`（`services/toast.js`）。

## 错误处理

**失败一律 `ApiError`**，按 `type` 分支（定义见 `services/http/error.js`）：

| type | 来源 | 处置 |
|---|---|---|
| `network` | 请求未发出 / 超时 / 断网 | 提示「连接超时，请重试」（`errorTip` 有固定文案） |
| `http` | HTTP 非 2xx | 提示「请求失败（状态码）」 |
| `business` | `code` 非 0 | 展示 `msg` |
| `auth` | `40005` 且重登失败 | 「登录已失效，请重新进入」 |
| `guard` | 命中全局守卫码 | ★ **页面 catch 到直接忽略** —— 弹框/跳页已由守卫处理 |
| `unknown` | 其它 | 归一后的 message |

```js
// 页面里：guard 型直接忽略，其余至少留一条日志
//（真例：首页刷新登录态 + 首屏数据，services/session 与 useAdminHome 各自吞错并返回结果）
try {
    data.value = (await homeApi.index()).data || {};
} catch (e) {
    // guard 型（50008 账号禁用 / 58004 未配角色）已由全局守卫弹框说明，本页不重复提示
    if (!isApiError(e) || e.type !== 'guard') console.error('[useAdminHome] 首屏取数失败：', e);
    state.value = 'fail';
}
```

❌ **禁止** catch 后 `return null` / `return {}` / 空 catch —— 调用方无法区分「空数据」与「失败了」。
❌ **禁止**用裸 `.catch(() => {})` 让失败彻底无声。

> ⚠️ 错误文案取 **`e.message`**（不是 `e.msg`）—— `ApiError` 构造时已把 `body.msg` 归一进 `message`。

## 响应约定

| 情形 | 处理 |
|---|---|
| `code === 0` | 成功 |
| **无 `code` 字段** | **视为成功**（兼容不返回统一包装的接口，如第三方地址） |
| `code` 是字符串 `"0"` | `Number()` 归一后比较 |
| `code === 40005` | 静默重登 → **重放一次**（`authRetry:false` 防死循环） |
| 命中守卫码 | 抛 `type='guard'`，**toast 强制 false** |

统一格式：`{ code: number, msg: string, data: any }`（详见 `.claude/templates/response-schema/`）。

## 签名头（自动注入，无需手写）

每个请求带 7 个头：`source` · `timestamp` · `sign` · `random` · `edition` · `token` · `userid`
`sign = MD5("Source=..&TimeStamp=..&Key=<apiKey>&Weight=<random>").toUpperCase()`

**`edition` 是全局协商头**（`config/app.js`）—— 传**未登记**的值会被后端 **fail-closed** 拒
（`Im Invalid Request!`），且动一次**全项目所有接口**一起变。**改前必须与后端确认。**

## 目录约定

| 内容 | 位置 |
|---|---|
| 请求出口 | `src/services/http/index.js`（`curl` / `ApiError` / `registerCodeGuard`） |
| 请求核心 | `src/services/http/request.js`（**唯一**解析响应的位置） |
| 传输层 | `src/services/http/transport.js`（`uni.request` / `uni.uploadFile`） |
| 签名 | `src/services/http/sign.js` |
| 错误归一 | `src/services/http/error.js` |
| 守卫机制 | `src/services/http/guard.js` |
| **接口 URL** | `src/config/endpoints.js`（**唯一登记表**） |

## 硬性禁令（MUST / MUST NOT）

> **本节是本主题 MUST / MUST NOT 的唯一权威。**

1. ❌ **绕过 `curl` 直调 `uni.request` / `uni.uploadFile`** —— 会丢失签名注入、`40005` 自动重登重放、
   统一 `ApiError`、`loading` 托管、全局守卫。
2. ❌ **页面里写接口路径字符串** —— 见 `rule-api-registry`。
3. ❌ **登录 / 绑定接口漏 `authRetry: false`** —— 递归登录。
4. ❌ **用 `setTimeout` 解决时序问题** —— 掩盖根因，且不同端表现不同。
5. ❌ **自动重试写操作**（POST 提交类）—— 可能重复提交。
6. ❌ **串行发无依赖的请求** —— 用 `Promise.all`（但有依赖的必须串行，
   如绑定接口拿到新会话后**才能**用新权限点取数）。
7. ⚠️ **并发去重已有机制**：补会话走 `session.login()` 单飞、守卫有 busy 去重 + 1s 冷静期。
   **不要再自己加一层。**

## ★ loading 的三条口径（引用计数 / 卸载兜底 / 跨页泄露）

`{ loading: true }` 看着简单，但有三个**会产生可见故障**的边界。详见 `rule-page-services`。

### ① `showLoading` / `hideLoading` 是**引用计数**，计数归零才真正关闭

所以**并发请求各自 hide 不会互相把别人的 loading 关掉** —— 这是有意设计，别改成布尔开关。

### ② ★ `onUnload(() => resetLoading())` 是兜底，**不是可选项**

凡本页调用过 `showLoading` / `withLoading`，就在 `onUnload` 挂一次 `resetLoading()`。

**为什么**：`loadingState` 是**全局状态、跨页生效** ——
**计数漏减会让后面所有页面卡住转圈**，且症状出现在**别的页面**，极难排查。

### ③ ★ 跨页 loading 泄露 —— ⚠️ **本工程预留**（未开 tabBar，暂时遇不到）

> 本工程 `TAB_PAGES` 当前为空、**未启用 tabBar**，故本条暂不适用。
> 但**一旦开 tabBar 就会踩**，且症状很迷惑。

**症状**：tabBar 页 `navigateTo` 子页后 **tabBar 页不销毁**，
其上的全局 `<app-loading :mask="true" />` **仍在监听 `loadingState`**。
此时若**子页**请求带 `{ loading: true }`，
**暗遮罩会渲染在底层的 tabBar 页上** —— 用户看到子页内容被**底页**的遮罩盖住。

**修法**：tabBar 页的深层子页**不要用全局 `{ loading: true }`**，
改用局部 `<app-loading :show="localLoading" />` + `try/finally`。

（C 端真实修复样例：`news/detail/index.vue` 2026-09-23。）

### ④ 串行请求不要逐请求传 `{ loading: true }`

托管会在**两个请求之间闪断**（loading 关了又开）。
包住一整段流程用 `withLoading()`（`services/toast.js`）。
本工程先例：`pages/bind` 的 `onSubmit` 用 `withLoading(() => bindAdmin({…}))` 包住整段 ——
`bindAdmin` 内部在 `60003`（微信 code 失效）时会**换新 code 重试一次**，
逐请求传 `loading: true` 会让遮罩在两次请求之间闪断。

## 排查速查

| 症状 | 先查 |
|---|---|
| 所有接口都报 `Im Invalid Request!` | `config/app.js` 的 `edition` 是否改了值却没跟后端确认 |
| 弹框弹了两次 / 并发弹多个 | 守卫 busy 去重是否被改坏（`http/guard.js`） |
| 登录失效没自动重试 | `main.js` 是否少了 `import '@/services/session'`（**删了不报错，静默失效**） |
| loading 一直转圈不消失 | `request.js` 的 `loading` 关闭是否还在 `finally` 里；**换页后仍转圈** → 本页漏了 `onUnload(() => resetLoading())` |
| **遮罩盖在错误的页面上** | ⚠️ **跨页 loading 泄露**（见上 ③）—— tabBar 页的深层子页别用全局 `{ loading: true }` |
| loading 在两个请求之间闪一下 | 串行请求逐请求传了 `{ loading: true }` → 改用 `withLoading()` 包住整段（见上 ④） |
| 请求打到了 localhost | 产物环境口径问题，见 `.claude/QUICK_START.md` §6.1 |

## 补充硬约束（2026-11-16 从 `rules/architecture.md` + `rules/security.md` 迁入）

### 响应约定

- ❌ **HTTP 状态与业务码职责分离**：禁止用 HTTP 200 + 空 body 表示业务失败，也禁止所有错误都回 500。
  HTTP 表传输层、`code` 表业务层 —— 混在一起会出现「请求成功但业务失败」却**无人处理的静默分支**。
- **分页与列表字段的固定口径**：入参 `page` / `page_size`，出参 `{ list, total, page, page_size }`；
  列表字段一律叫 `list`，不要写也不要读 `data` / `rows` / `items`。
  ⚠️ `useList` 的 `defaultPick` 容错**不是契约** —— 靠容错过日子，后端一改字段名就全站静默取空。
- **第三方接口的例外不污染统一层**：不遵循 `{code,msg,data}` 的接口，**在调用处**注明原因并就地适配；
  ❌ 不要改 `request.js` 的统一解析去兼容特例 —— 统一层一旦兼容特例，全站失败判定都会跟着变松。

### 参数与排查

- 数组参数交给 `buildURL` 自动展开成 `key=v1&key=v2` —— ❌ **别自己 `join`**（编码与空值过滤会跟着出错）。
- 「有人绕过请求链」排查：
  ```bash
  grep -rn "uni\.request\|uni\.uploadFile" src/ | grep -v "services/http/transport.js"   # 应为空
  ```
  非空说明有代码绕开了签名 / 重登 / 守卫，必须改回 `curl.*`。

## 来源

> ★ **2026-11-16：`.claude/rules/` 目录已删除** —— 其硬约束已全量迁入各 rule-skill（删前逐条审计过缺口，共补 28 条）。
> 下文出现的 `.claude/rules/xxx.md` 是**历史出处**，不是可读路径；需要规则正文时就地看本 skill。


提炼自 `.claude/rules/architecture.md`（§3.2 请求链路、§3.3 统一 API 返回格式）、
`.claude/memory/architecture.md`（§3 请求链路、§4 登录态）、
源工程的 api_conventions（请求 / 响应 / options 约定，已随业务剥离）、
`.claude/rules/security.md`（§5 注入与输入污染），最后同步于 2026-11-16
（2026-10-26 首次提炼；2026-11-04 复核日志管理页的手机号明文例外；
2026-11-05 复核用户管理页的同款例外；2026-11-06 复核车辆列表 / 车源列表两页的同款例外；
2026-11-26 随业务剥离复核：模板内的 guard:false 用法只剩「守卫目标页自身接口」与「装饰位模块」两类 ——
这几处都属 §2 敏感信息，不影响本主题的请求链 / options 用法）。