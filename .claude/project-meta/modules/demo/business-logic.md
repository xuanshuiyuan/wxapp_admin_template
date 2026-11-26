# demo · 业务规则

> block 格式：`### <block-id>（v<版本>）` —— 供代码注释与 `versions/vN/` 引用。
> 本文件只写**规则**（为什么这样、边界在哪），不抄代码。

### permission-menu（v1.0.0）

**规则**：首页显示哪些入口 = `config/access.js` 的 `HOME_ENTRIES` ∩ 登录响应的 `permission`。
两处都命中才渲染。判据只有一处实现：`services/pageAccess.js` 的 `byPermission()`。

**为什么**：后端会加模块、权限会按角色变；入口清单放本地才能「老版本小程序不白屏」，
权限判据放登录响应才能「配置了但没授权就不出现」。

**边界**：
- 权限是**登录时快照**，变更最长 2h（重新登录即生效）→ 显隐可能短暂过期；
- 真防线在服务端（`40102`），页面必须就地处置；
- 免权限接口**不要**配权限码（否则后端不下发 → 入口永远不显示）。

### home-submenu-rule（v1.0.0）

**规则**：`page: null` + `children` 的入口，子项按权限过滤后：
0 个 → 入口不渲染；1 个 → 直接跳；≥2 个 → 底部弹层。

**为什么**：点开是空菜单的入口是坏入口；只剩唯一去处还让用户点两次是绕路；
弹层的副标题由配置的 `sheetSub` 给（页面不写 if-else，加模块不用改页面）。

### page-admission（v1.0.0）

**规则**：页面 `onLoad` 调 `requirePageAccess(path, query)`：
- `open`（无 `entries`）→ 放行；
- `granted` → 放行；
- `denied` → 已 toast + `route.back()`；
- `unresolved`（`byParam` 解析不出目标）→ **不提示不跳页**，页面给「参数不完整」空态。

**为什么**：`byParam` 解析失败是参数问题不是权限问题；混成「无权限」会误导用户找管理员。

### entry-vs-action-code（v1.0.0）

**规则**：页面准入用**入口码**；页内区块 / 按钮用**操作码**（`byPermission(ACTIONS, permission)`）。
缺操作码时给「无权限」空态或直接不渲染按钮，**不被权限门退页**。

**为什么**：「只勾了菜单节点」的角色应该能进页面看到自己有什么，
而不是点一次被弹回一次。

### demo-mode（v1.0.0）

**规则**：`DEMO_MODE=true` 时 `session.login/bindAdmin` **不请求网络**，
直接把 `config/demo.js` 的会话写进本地存储（结构与真实登录响应完全一致）。

**为什么**：权限菜单是模板的核心资产，必须在没有后端时也能被验证 / 演示。
切真实模式只改一个常量，机制层零改动。

**边界**：演示会话不下发 `PERM_DEMO_HIDDEN` —— 用来演示「配置里有但永远不显示」。

### demo-request-self-test（v1.0.0）

**规则**：`api/demo.js` 打后端 demo 模块（`web/demo/*`，web 组校验 C 端 source）。
只用于验证请求链路；需要 `VITE_SOURCE=1010`（+ 可选 `VITE_DEVELOP_BYPASS=develop`）。

**为什么单独说明**：B 端 source=1001 打 web 组会被拒，容易被误判成「模板请求层坏了」。