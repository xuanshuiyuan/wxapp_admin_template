# templates/api-domain — 接口域模板

**适用栈**：本项目（前端接口层）。**后端栈的等价物见文末对照。**

## 文件

| 文件 | 用途 |
|---|---|
| `domain.js` | `src/api/<域>.js` 模板 —— 一个业务域一个文件 |

## 使用步骤（**顺序不可颠倒**）

```
1. 拿到后端契约（没契约不动手，见 .claude/agents/api_designer.md）
        ↓
2. src/config/endpoints.js 追加 ENDPOINT_<域>_<动作>（按文档章节分组，每条带 why 注释）
        ↓
3. 复制本模板 → src/api/<域>.js，替换 __DOMAIN__ / __ENDPOINT_*
        ↓
4. src/api/index.js 加一行 export
        ↓
5. 若引入新错误码 → src/config/dict.js 加常量；
   判断是否进全局守卫 → 进则在 src/services/guards.js 登记（页面层零改动）
        ↓
6. 同步 `modules/<m>/business-logic.md` / `api-*.md`；真重要变更在 commit message 写一行（见 `CLAUDE.md` §11.1）
```

## 铁律

1. ✅ **URL 先登记 `endpoints.js`**，再在 `api/<域>.js` 包方法。
   ❌ 页面里**禁止**出现路径字符串。
2. ✅ `endpoints.js` 的值**不带** `/v2` 前缀、**不带**前导斜杠
   （`request.js` 的 `resolveURL` 统一拼 `rootPath + routeVersion + path`）。
3. ✅ **一个域一个文件**，导出 `xxxApi` 命名空间对象。
4. ✅ **失败统一抛 `ApiError`**（`curl` 已保证），默认自动 toast。
   ❌ 禁止 catch 后 `return null` 吞掉。
5. ✅ **方法不加业务规则** —— 只做「参数整形 + 调用 + 返回」。
   业务逻辑归 `services/`（`backend_service`）。
6. ✅ 每个方法**标注 `options` 默认值的 why**。

## `options` 速查（最容易错的地方）

| 场景 | 必须的 options | why |
|---|---|---|
| 登录 / 绑定类接口 | `{ authRetry: false }` | 否则登录接口返回 40005 会递归 |
| 守卫目标页自己的接口 | `{ guard: false }` | 否则弹框与页面自身逻辑打架 |
| **失败即隐藏的装饰位模块** | `{ guard: false }` | 它**有能力弹阻断框**，不该有 |
| 进页 / 下拉等自动路径 | `{ toast: false }` | 不弹错，交给页面状态位 |
| **按钮点击链路** | `{ loading: true }` | 双保险（托管 loading + 页内 + 按钮 in-flight） |
| 需要静默自行处置 | `{ toast: false }` + 页面 catch | — |

## 跨语言对照（后端栈怎么落地）

| 栈 | 落点 | 说明 |
|---|---|---|
| **本项目** | `src/api/<域>.js` | 远程 HTTP 封装（本模板） |
| Go | `internal/api/<域>/` + `service/` | 接口定义与实现分离 |
| Java | `Controller` + `Service` + `Mapper` | ⚠️ Controller **不许**写业务逻辑 |
| Python | `router/` + `service/` | 同上 |
| PHP | `Controller` + `Service` | 同上 |
| Node | `routes/` + `controllers/` + `services/` | 同上 |

**不变的部分**：① 契约先行 ② 路径/路由集中登记 ③ 统一响应 `{code,msg,data}`
④ 统一错误形态 ⑤ 入口层不写业务逻辑。