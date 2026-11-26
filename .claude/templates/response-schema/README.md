# templates/response-schema — 统一 API 返回格式

**全栈通用**（前端 / 后端同一套约定）。

## 文件

| 文件 | 用途 |
|---|---|
| `response.schema.json` | 统一响应体的 JSON Schema（可被校验工具消费） |
| `response.md` | 人类可读的格式说明与错误码表 |

## 统一格式（**全栈强制**）

```json
{ "code": 0, "msg": "ok", "data": {} }
```

| 字段 | 类型 | 含义 | 约束 |
|---|---|---|---|
| `code` | number | 业务码 | **必须数字**；`0` = 成功。**禁止**用字符串（后端可能返回字符串，前端 `Number()` 归一后比较） |
| `msg` | string | 面向用户的提示 | **可直接展示**；**禁止**含堆栈 / SQL / 表名 |
| `data` | any | 业务数据 | 失败时可为 `null`；成功时结构由契约定义 |

## 必有约束

1. **HTTP 状态码与业务码职责分离**
   - HTTP 表**传输层**（200 = 请求到达了）
   - `code` 表**业务层**（0 = 业务成功）
   - ❌ 禁止用 HTTP 200 + 空 body 表示业务失败
   - ❌ 禁止所有错误都用 HTTP 500
2. **列表字段统一为 `list`**
   - ✅ `{ list, total, page, page_size }`
   - ❌ `data` / `rows` / `items` / `records`
   - ⚠️ 本项目 `useList` 的 `defaultPick` 对 `d.list || d.data || d.rows` 做了**容错**，
     **但容错不是契约** —— 新接口必须用 `list`。
3. **分页入参统一为 `page` / `page_size`**（页码从 1 开始）。
4. **`msg` 面向用户**，技术细节走日志（前端 `ApiError` 的 `raw` 字段就是这个用途）。

## 特殊情形（前端已处理的兼容）

| 情形 | 处理 | 位置 |
|---|---|---|
| **无 `code` 字段** | 视为**成功**，直接返回 body | `request.js`（兼容不返回统一包装的第三方接口） |
| `code` 是字符串 `"0"` | `Number()` 归一后比较 | `request.js` |
| `code === 40005` | 静默重登 + **重放一次** | `request.js` |
| 命中全局守卫码 | 抛 `ApiError(type='guard')`，**不 toast** | `request.js` + `guard.js` |

**例外**：第三方接口可能不遵循本格式 → **在调用处注明原因**并做适配，
**不污染统一层**。

## 前端错误类型映射

HTTP / 业务码 → `ApiError.type`：

| 来源 | `type` | 处置 |
|---|---|---|
| 请求未发出 / 超时 / 断网 | `network` | 提示「连接超时，请重试」 |
| HTTP 非 2xx | `http` | 提示「请求失败（状态码）」 |
| `code` 非 0（普通） | `business` | 展示 `msg` |
| `code === 40005` 且重登失败 | `auth` | 提示「登录已失效」 |
| 命中全局守卫码 | `guard` | **页面直接忽略**（弹框/跳页已处理） |
| 其它异常 | `unknown` | 展示归一后的 message |

## 跨栈落地

| 栈 | 落点 |
|---|---|
| Go | 统一 `response.Success/Error` + 中间件 |
| Java | `Result<T>` 泛型 + `@ControllerAdvice` |
| Python | 统一 `jsonify` 包装 + 异常处理器 |
| PHP | 统一 `Response` 类 + 全局异常处理 |
| Node | 统一 `res.json` 包装 + 错误中间件 |
| **本项目（前端）** | 消费方：`services/http/request.js`；**不产生**响应（后端的事） |

**后端强制**：所有出口必须经统一包装，**禁止**在 handler 里直接 `res.json({...})` 拼结构。