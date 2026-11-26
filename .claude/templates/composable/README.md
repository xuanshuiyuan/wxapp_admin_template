# templates/composable — 复用逻辑模板

**适用栈**：uni-app / Vue 3（组合式 API）。
**其它栈等价物见文末对照。**

## 文件

| 文件 | 用途 |
|---|---|
| `useExample.js` | composable 模板 —— 含生命周期接线、在飞判重、返回解构 |

## 何时该抽 composable

| 信号 | 该抽吗 |
|---|---|
| 一个「完整能力」被 ≥2 个页面用 | ✅ 抽 |
| 页面里有一大段与渲染无关的状态逻辑 | ✅ 抽 |
| **只有 1 处使用** | ❌ **不抽**（过度抽象同样违规） |
| 只是几行纯计算 | ❌ 放 `utils/` |
| 需要跨页共享状态 | ❌ 放 `store/` |
| 是横切基础设施（请求/存储/路由） | ❌ 放 `services/` |

## 本项目已有的 composables（**先看有没有，别重造**）

| Composable | 能力 |
|---|---|
| `useList(fetcher, config)` | 分页列表：下拉刷新 / 触底加载 / 空态 / 失败重试 |
| `useModal` | Promise 化弹窗（`alert` / `confirm` / `settle`），多次调用**排队**不互相覆盖 |
| `usePullRefresh({ onRefresh })` | 下拉三段态状态机 |

## composable 设计规则

1. **返回对象供解构**（`const { a, b, action } = useXxx()`）——
   与 `useList` / `usePullRefresh` 一致。
2. **在 composable 内注册生命周期**（`onLoad` / `onShow` / `onReachBottom` / `onPullDownRefresh`），
   页面只接线 —— 参考 `useList` 内部就注册了 `onReachBottom` / `onPullDownRefresh`。
3. **必须做在飞判重**：`if (loading.value) return;` —— 防止 `onShow` 重复触发造成请求风暴。
4. **响应式取值用函数传入**（`params: () => ({ keyword: keyword.value })`），
   不要闭包提前取值 —— 否则拿到的是初始化时的旧值。
5. **失败不吞**：置 `error` 状态位交给页面渲染，不做全局 toast
   （除非明确是用户主动点击链路）。
6. **不含 HTTP 细节**：接口调用由页面传入的 `fetcher` 参数提供，composable 不 import `api/`。

## 反模式

| ❌ 反模式 | 为什么错 |
|---|---|
| composable 里 `import { xxxApi } from '@/api'` | 耦合具体接口，无法复用；应接收 `fetcher` 参数 |
| composable 持有模块级单例状态 | 多页面共享同一份状态 → 真相源分裂 |
| composable 里写业务规则 | 业务规则归 `services/` |
| 返回一堆内部 ref 而不封装动作 | 调用方要自己拼流程，等于没抽 |
| 没有在飞判重 | 页面切回/下拉会重复打接口 |

## 跨栈对照

| 栈 | 等价物 |
|---|---|
| React | 自定义 Hook（`useXxx`） |
| Vue 2 | mixin（不推荐）或 `setup()` 内的工厂函数 |
| Svelte | store + action |
| 后端（Go/Java/…） | 无直接等价物；对应「可复用的服务方法」 |

**不变的部分**：一个完整能力、可复用、不含具体 IO 细节、必须有在飞判重。