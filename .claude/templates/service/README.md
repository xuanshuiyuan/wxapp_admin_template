# templates/service — 服务层模板

**适用栈**：本项目 = `src/services/`（基础设施 + 业务服务）。
**后端栈** = `service/` 层（Go / Java / Python / PHP / Node）—— 见文末对照。

## 文件

| 文件 | 用途 |
|---|---|
| `service.js` | 服务层模板 —— 含注册模式、单飞、错误策略 |

## 定位（★ 最重要的认知）

**服务层是「业务逻辑」的唯一合法落点。**

```
❌ 页面 / 组件 / controller / handler / component  →  禁止写业务规则
✅ services/（本项目）或 service/（后端栈）        →  业务规则的唯一落点
```

**判定口诀**：把入口层文件删掉换成 CLI，业务规则应该**完全不受影响**。
若受影响，说明逻辑写错层了。

## 本项目的两类服务

| 类型 | 例子 | 特征 |
|---|---|---|
| **基础设施服务** | `session` / `route` / `storage` / `toast` / `platform` / `guards` | 与业务域无关，横切能力；可被任何层向下引用 |
| **业务服务** | （本项目暂无，待契约到位后建） | 编排业务规则，可能调 `api/` |

⚠️ **业务服务调 `api/` 是合法的**（`services/` 在 `api/` 之上还是之下？
—— 本项目把**基础设施**服务放最底层，**业务**服务与 `api/` 同属业务层。
若业务服务需调 `api/`，注意**不要形成环**；成环时用注册模式解）。

## 模板包含的三个关键范式

### 1. 注册模式（打破循环依赖的唯一合法解法）

```js
let handler = null;
export function registerXxxHandler(fn) { handler = fn; }
```

**本项目实例**：
- `services/session.js` → `registerAuthHandler(relogin)` → `http/request.js` 持有引用
- `services/guards.js` → `registerCodeGuard(code, fn)` → `http/guard.js` 持有查表

❌ **禁止**用动态 `import()` / 延迟 `require` / `globalThis` 挂载来绕环。

### 2. 单飞（single-flight）

```js
let pending = null;
export function doOnce() {
	if (pending) return pending;
	pending = realWork().finally(() => { pending = null; });
	return pending;
}
```

**本项目实例**：`session.login()` —— 请求层并发补会话时只真登录一次。

### 3. 错误策略收敛

失败**永远抛 `ApiError`**，按 `type` 分支（`network`/`http`/`business`/`auth`/`guard`/`unknown`）。
❌ **禁止** catch 后 `return null` / `return {}` 吞掉。

## 铁律

1. ✅ 端差异收在服务层（`services/platform.js`）。❌ 页面里禁止 `#ifdef`。
2. ✅ 副作用的注册 import 必须在 `main.js`（删了会**静默**失去机制 —— 两行都不可删）。
3. ✅ 常量（错误码 / 路径 / 环境值）从 `config/` 取，**不写字面量**。
4. ✅ 非显然分支写**中文 why 注释**。
5. ❌ 不引上层（`services/` 不 import `api/`、不 import `pages/`）。
6. ❌ 不直读写 `uni.getStorageSync`（走 `services/storage.js`）。
7. ❌ 不绕过 `curl` 直调 `uni.request`。

## 跨语言对照

| 栈 | 落点 | 业务逻辑写法 |
|---|---|---|
| **本项目** | `src/services/<name>.js` | 导出函数 / 对象 |
| Go | `internal/service/<域>.go` | struct + method，error 返回 |
| Java | `@Service` 类 | 注解 + 异常 |
| Python | `services/<域>.py` | 函数 / 类 |
| PHP | `app/Service/<域>.php` | 类 |
| Node | `services/<域>.js` | 导出函数 |

**不变的部分**：① 业务逻辑只在服务层 ② 统一错误形态 ③ 不重复造轮子 ④ 入口层保持薄。