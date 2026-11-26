---
name: rule-api-registry
description: 当需要新增接口、新增错误码/枚举、新增环境或应用常量时使用（接口 URL 登记、config/dict.js 加码、config/app.js 加常量）。也用于判断「这个字面量该不该抽到 config」。提供本工程的常量登记约定，不涉及具体业务逻辑。
---

# rule-api-registry

本工程的**常量与接口 URL 登记约定**：**代码里不写字面量，一律从 `config/` 取。**

**存在理由**（`endpoints.js` 文件头原文）：把 URL 集中到一个文件，
「改路径只动本文件，`api/` 与 `services/` 的方法名/参数不受影响」。

## 新增一个接口：三步，顺序不可颠倒

```
① src/config/endpoints.js 追加 ENDPOINT_<域>_<动作>（按后端文档章节分组，带 why 注释）
        ↓
② 新建/追加 src/api/<域>.js，方法包一层 curl.*（方法里不写路径，引常量）
        ↓
③ src/api/index.js 加一行 export
```

**若引入新错误码** → 再走两步：
```
④ src/config/dict.js 加 CODE_XXX 常量
⑤ 判断是否进全局守卫 → 进则在 src/services/guards.js 登记动作（页面层零改动）
```

## `endpoints.js` 的登记约定

```js
// —— <域>（后端文档 <章节>）——
// <业务语义一句话>；<调用方 + 失败时回什么码>
export const ENDPOINT_<域>_<动作> = '<路径>';
```

| 规则 | 说明 |
|---|---|
| 值**不带** `/v2` 版本前缀 | `request.js` 的 `resolveURL` 统一拼 `rootPath + routeVersion` |
| 值**不带**前导斜杠 | `request.js` 兼容两种写法，但登记表统一不带 |
| 命名 | `ENDPOINT_<域>_<动作>` |
| **完整 http(s) 地址（第三方）不放这里** | 就近写在调用处并注明原因 |
| 按后端文档章节**分组** | 每组一个 `// —— <域> ——` 小节 |

> 放 `config/` 层的原因：`services/session`（基础设施）与 `api/`（业务）都要引它，
> `config` 是最底层，两边向下引用都不会形成环。

## `dict.js` 的登记约定

**页面里不写字面量数字，一律从这里取。**

```js
export const CODE_SUCCESS = 0;
export const CODE_LOGIN_EXPIRED = 40005;        // http 层自动重登重放（全项目唯一自动重试）
export const CODE_ADMIN_NOT_BOUND = 58001;      // ★ 流程分支不是错误：登录门据此清栈跳绑定页
export const CODE_BIND_RATE_LIMITED = 58003;    // 页面自行处置（置灰倒计时），不进全局守卫
// 需全局动作的码：命中即触发 services/guards.js 登记的动作（本工程只有这两枚）
export const CODE_ACCOUNT_DISABLED = 50008;     // 账号已被禁用
export const CODE_ADMIN_NO_ROLE = 58004;        // 未配置角色权限
```

**注意**：`registerCodeGuard` 对**空码值直接忽略** —— 把常量改成 `0` 即关闭该守卫。

⚠️ **哪些码刻意不进守卫**（`58003` 频控 / `40102` 无权限 / `58005`·`58006` 绑定冲突）
与新增一枚码的两步走法，见 `rule-session-guards`。
⚠️ **占位码禁止入库**：C 端曾有 `40011`（未实名）/ `40012`（冻结）两枚**后端文档未定义**的占位值，
管理端契约里没有它们，**已删除**。不确定的码**必须问后端**，不要先塞一个占位值进来

**业务变多后**按域拆成 `config/dict/<domain>.js`，再在本文件汇总导出。

## `app.js` / `env.js` 的边界

| 内容 | 位置 |
|---|---|
| 与环境**无关**的应用常量（来源标识、版本协商头、客服电话、存储前缀、`SESSION_FIELDS`） | `config/app.js` |
| 与**环境相关**的（host / 密钥） | `config/env.js`（读 `.env.*`） |

## 跨语言对照（后端栈怎么落地）

| 栈 | 接口登记 | 错误码/枚举 |
|---|---|---|
| **本工程（前端）** | `src/config/endpoints.js` | `src/config/dict.js` |
| Go | `internal/router/routes.go` 集中注册 | `conf/enum_*.go` |
| Java | `@RequestMapping` 常量类 | `enum` 包 |
| Python | `urls.py` / `router` | `constants.py` |
| PHP | `routes/` | `app/Enum/` |
| Node | `routes/index.js` | `constants/` |

**不变的部分**：① 路径集中登记，调用处不写字面量 ② 错误码集中定义
③ 统一响应格式 `{code,msg,data}`。

## 硬性禁令（MUST / MUST NOT）

> **本节是本主题 MUST / MUST NOT 的唯一权威。**

1. ❌ **页面 / 组件里写接口路径字符串** —— 这是评审阻断项。
2. ❌ **在 `endpoints.js` 里写 `/v2` 或前导斜杠** —— 会重复拼接。
3. ❌ **臆造接口路径、字段名、错误码** —— ⚠️ **契约错误码表不全，不确定必须问后端**
   （原文：「哪些接口会回哪些码以**后端实现 + 真机**为准」—— 契约错误码表不全）。
4. ❌ **擅自把某错误码加进全局守卫** —— 守卫是**全局行为**，改动前须经 `security_agent` + 用户确认。
5. ❌ **改 `edition` 值不与后端确认** —— 全局协商头，传未登记值会被 fail-closed 拒。
6. ❌ **改存储前缀 `PREFIX` 不评估** —— 与 C 端撞前缀会导致 H5 同域下**互相串登录态**。
7. ⚠️ 新增常量时**同时更新注释里的 why** —— 否则下一个人不知道它为什么是这个值。

## 本模板现有登记

**接口（`config/endpoints.js`）**：

| 组 | 常量 |
|---|---|
| 登录 / 绑定 | `ENDPOINT_ADMIN_LOGIN` · `ENDPOINT_ADMIN_BIND` |
| 首页 | `ENDPOINT_ADMIN_HOME`（模板演示模式不调用，接真后端时用） |
| 上传 | `ENDPOINT_ADMIN_UPLOAD`（= 后端 `AdminUploadTypes` 机制的唯一上传口） |
| 演示自测 | `ENDPOINT_DEMO_LOGIN` · `_LIST` · `_CREATE` · `_DELETE`（后端 demo 模块，可删） |

**错误码**（`config/dict.js`）：`CODE_SUCCESS` · `CODE_PARAM_INVALID`(40001) ·
`CODE_LOGIN_EXPIRED`(40005) · `CODE_NO_PERMISSION`(40102) · `CODE_TOO_FREQUENT`(40205) ·
`CODE_ACCOUNT_DISABLED`(50008) · `CODE_ADMIN_NOT_BOUND`(58001) · `CODE_BIND_CREDENTIAL_ERROR`(58002) ·
`CODE_BIND_RATE_LIMITED`(58003) · `CODE_ADMIN_NO_ROLE`(58004) · `CODE_WX_UNAVAILABLE`(60003) ·
`CODE_UPLOAD_INVALID`(60004) · `CODE_UPLOAD_FORMAT_INVALID`(40203) · `CODE_UPLOAD_SIZE_INVALID`(40204) ·
`CODE_SIGN_INVALID`(40003) · `CODE_EDITION_INVALID`(40107，预留：edition 未登记当前回 40003)

**同文件里的非错误码登记**：权限码 `PERM_DEMO_*` · 模块类型 `MODULE_TYPE_*` ·
上传类型 `UPLOAD_TYPE_DEMO_FILE` · 频控窗口 `BIND_COOLDOWN_SECONDS`。

★ **权限码的两级粒度**：
① **模块 / 子入口级** —— `PERM_DEMO_SUBMENU`（入口码）+ `PERM_DEMO_PAGE_A/B`（子入口码）；
② **操作级** —— `PERM_DEMO_REQUEST`（页内区块 / 按钮）。
两级**同在登录时一次性下发**（`data.permission`）。
⚠️ **码值登记在 `dict.js`，但「哪个码管哪个入口/按钮」在 `src/config/access.js`**。

## 来源

> ★ **2026-11-16：`.claude/rules/` 目录已删除** —— 其硬约束已全量迁入各 rule-skill（删前逐条审计过缺口，共补 28 条）。
> 下文出现的 `.claude/rules/xxx.md` 是**历史出处**，不是可读路径；需要规则正文时就地看本 skill。


来源：源工程的 api_conventions / architecture / coding_style（已随业务剥离）；
现行约定以本 skill 与 `.claude/CLAUDE.md` 为准。
最后同步 2026-11-26（随业务剥离替换为模板现有登记）。