# 统一 API 返回格式（人类可读版）

> 机器可校验版：`response.schema.json`。
> 前端消费方：`src/services/http/request.js`（**唯一**解析响应的位置）。

---

## 1. 基本格式

```json
{ "code": 0, "msg": "ok", "data": {} }
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `code` | number | ✅ | `0` = 成功。**必须数字**（后端若返回字符串，前端 `Number()` 归一） |
| `msg` | string | ⚠️ | 面向用户的提示，**可直接展示**。失败时建议必填 |
| `data` | any | ❌ | 业务数据。失败时可为 `null` |

---

## 2. 分页

**入参**：`page`（从 1 开始）/ `page_size`

**响应**：

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "list": [],
    "total": 0,
    "page": 1,
    "page_size": 20
  }
}
```

| 字段 | 说明 |
|---|---|
| `list` | ★ **必须是 `list`**。`useList` 对 `data` / `rows` 有容错，**但容错不是契约** |
| `total` | 总条数。为 0 或缺失时，`useList` 靠「返回条数不足一页」判断到底 |
| `page` / `page_size` | 回显，便于前端校验 |

---

## 3. 错误码表

### 通用（`config/dict.js`，管理端 B 端契约）

| 码 | 常量 | 含义 | 前端处置 |
|---|---|---|---|
| `0` | `CODE_SUCCESS` | 成功 | — |
| `40005` | `CODE_LOGIN_EXPIRED` | 登录失效 | **自动**静默重登 + 重放一次（页面无感） |
| `60003` | `CODE_WX_UNAVAILABLE` | 微信侧失败（code 过期/已用过/网络） | **换新 code 重试一次**（原样重发必然还是它） |

### 需全局动作（守卫）—— 本工程**只有两枚**

| 码 | 常量 | 含义 | 动作 |
|---|---|---|---|
| `50008` | `CODE_ACCOUNT_DISABLED` | 账号已被禁用（登录**与绑定**都回它） | 弹框「请联系管理员恢复」，**无跳转**（不给假出口） |
| `58004` | `CODE_ADMIN_NO_ROLE` | 未配置角色权限 | 弹框「请联系管理员分配后重试」 |

### ★ 流程分支（**不是错误**，但也不是守卫）

| 码 | 常量 | 含义 | 前端处置 |
|---|---|---|---|
| `58001` | `CODE_ADMIN_NOT_BOUND` | 该微信未绑管理员 | 登录门识别后**清栈跳绑定页** —— 这是**首次使用的正常路径** |
| `58002` | `CODE_BIND_CREDENTIAL_ERROR` | 账号或密码错误 | 照后端 msg 提示（后端**故意不区分**是哪一项，防账号枚举） |

### 页面自行处置（**刻意不进守卫**）

| 码 | 常量 | 含义 | 前端处置 |
|---|---|---|---|
| `40102` | `CODE_NO_PERMISSION` | 无权限操作 | 就地提示 / 置灰 / 无权限空态，**不自动重试**（弹全局阻断框会让"一个子模块无权"变成整个模块不可用） |
| `58003` | `CODE_BIND_RATE_LIMITED` | 绑定频控（同手机号 60s 内失败 5 次） | 绑定页置灰 + **60s 倒计时**（`BIND_COOLDOWN_SECONDS`），**不自动重试** |
| `58005` | `CODE_ACCOUNT_BOUND_OTHER_WX` | 该账号已绑其他微信 | 提示联系管理员解绑，不引导重试 |
| `58006` | `CODE_WX_BOUND_OTHER_ACCOUNT` | 该微信已绑其他管理员 | 同（弹全局框会遮住刚填的表单） |

### ⚠️ 关于错误码的诚实声明

- **契约错误码表不全。** 原文：「哪些接口会回哪些码以**后端实现 + 真机**为准，
  契约错误码表不全 —— 不确定时问后端。」
- **禁止先塞占位码。** C 端曾塞 `40011`（未实名）/ `40012`（冻结）两枚**后端文档未定义**的占位值，
  管理端契约里不存在，**已删除** —— 占位码会被后来的人当成真值使用。
- **禁止臆造错误码。** 新增码必须：① `config/dict.js` 加常量
  ② 判断是否进全局守卫（进 → `services/guards.js` 登记）③ 同步 `business-logic.md` / `api-*.md`；真重要变更在 commit message 写一行（见 `CLAUDE.md` §11.1）。
- `registerCodeGuard` 对**空码值直接忽略** —— 把常量改成 `0` 即关闭该守卫。

---

## 4. 前端解析流程（`request.js` 实际行为）

```
响应到达
  ├─ HTTP 非 2xx        → ApiError(type='http', '请求失败（状态码）')
  ├─ body.code 为 undefined/null → ★ 视为成功，直接返回 body
  ├─ Number(body.code) === 0     → 成功，返回 body
  ├─ === 40005                    → authHandler 单飞重登 → 重放一次（authRetry:false 防递归）
  │                                 重登失败 → ApiError(type='auth')
  ├─ 命中全局守卫表               → fireCodeGuard → ApiError(type='guard')，★ toast 强制 false
  └─ 其它非 0                     → ApiError(type='business', msg)，默认 toast
```

**关键设计**：
- `toast` 由请求层统一决定（`bail(err, toast)`），**页面不需要写提示逻辑**。
- `guard` 型错误的 toast **强制为 false** —— 提示由守卫的弹窗/目标页给，
  页面 catch 到 `type === 'guard'` **直接忽略即可**。
- `raw` 字段保留原始响应，**仅供排查**，不用于展示。

---

## 5. 后端落地要求

| 要求 | 说明 |
|---|---|
| **所有出口经统一包装** | ❌ 禁止在 handler 里直接拼 `{...}` 返回 |
| **HTTP 与业务码职责分离** | HTTP 表传输，`code` 表业务 |
| **`msg` 面向用户** | ❌ 禁止堆栈 / SQL / 表名 / 文件路径 |
| **列表字段用 `list`** | 不用 `data` / `rows` / `items` / `records` |
| **分页入参 `page` / `page_size`** | 页码从 1 开始 |
| **错误码集中定义** | 与前端 `config/dict.js` 保持可对照 |

**跨栈落点**：Go `response.Success/Error` + 中间件 · Java `Result<T>` + `@ControllerAdvice`
· Python 统一 `jsonify` + 异常处理器 · PHP `Response` 类 + 全局异常 · Node `res.json` 包装 + 错误中间件。

---

## 6. 例外

**第三方接口**可能不遵循本格式（如直接返回业务数据、无 `code`）。
此时：

1. `request.js` 已兼容「无 `code` 视为成功」。
2. 若结构差异更大 → **在调用处注明原因**并做适配，**不污染统一层**。
3. 完整 http(s) 地址（第三方）**不放 `endpoints.js`**，就近写在调用处并注明原因。