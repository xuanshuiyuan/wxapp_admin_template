# v1.0.0 短复评（review-r3）

| 项 | 值 |
|---|---|
| 复评对象 | `wxapp_admin_template`，diff `778de32..ad177a6`（15 files，+410/−66） |
| 依据 | `review-r2.md`（1 阻断 R-1 + 5 高优先回归）+ `CHANGELOG.md` §二-b |
| 方式 | 只审不改；R-2/R-4 用 `/tmp` 脚本复现；未执行构建 |
| 结论 | **通过** |

---

## 0. 结论

- **R-1 已正确关闭**：顺序改为「onShow → 登录门 → 权限门 → onReady」，onLoad 只记 query；冷启动 / 分享深链 / 清缓存三种场景不会再误拒，正常返回本页也不重复取数。`demo/list` 的权限快照改为 onReady 后重读。
- **R-2 / R-3 / R-4 / R-5 已关闭**，均有代码或实测证据（见 §1）。
- **R-6 只关了 2/3**：`route.js` 注释与 `templates/page/README.md` 已写明「必须加一行转出」；`rule-add-page` 仍只写「services/route.js 会转出」，没有「在 export 块加一行」的动作。属**文档级、非阻断**（r2 原分类也是高优先建议，不是阻断）。
- **发现 1 个新回归（N-1，非阻断）**：`usePageGuard` 在「登录 await 期间 onShow 再次触发」时会重复执行 `onReady`。修法一行，见 §2。
- 无新的阻断项。**结论：通过。** 剩余非阻断建议清单见 r2 §3（代码/文档建议）与 r2 §4（待用户拍板），外加本文件 §2 的 N-1 与 §1 的 R-6 尾项。

---

## 1. 逐项关闭核对

### R-1 · `usePageGuard` 先登录后判权限 —— ✅ 关闭

- `src/composables/usePageGuard.js:45-48`：`onLoad` 只 `lastQuery = query || {}`，不再调 `requirePageAccess`。
- `:50-73`：`onShow` 里 `if (ready) return` → `pageNeedsLogin(path)` 时先 `await requireAdminLogin()` → 再 `requirePageAccess(path, lastQuery)` → 通过后 `ready = true` + `onReady(lastQuery)`。
- 冷启动 / 深链 / 清缓存：`onShow` 时先走 `requireAdminLogin`（内部单飞 `session.login`，成功后 `writeSession` 写入 permission），权限门读到的是刚写入的快照 → 有权限的用户能进。✓
- 返回本页：`ready` 在第一次成功后置 true，后续 `onShow` 在 `:51` 直接返回，不重复判权限、不重复 `onReady`。✓
- `demo/list.vue:101-105`：`permission = ref([])` + `grantedActions = computed(...)`；`:116` `onReady` 里 `permission.value = getPermission()`，冷启动登录后页内区块能正确显隐。✓
- 配套：`page-a.vue` / `page-list.vue` 仍是 `useList(..., { immediate:false })` + `onReady: reload`，只取一次；`page-detail` / `page-form` 的 `onReady` 拿到 onLoad 的 query。✓

### R-2 · `check:release` 裸 `localhost` 误报 —— ✅ 关闭

- `check_release.mjs:72-77` 改为正则：`/localhost:\d+/`、`/127\.0\.0\.1:\d+/`、`/REPLACE_/`、`/demo-token-not-a-real-one/`；`:79-81` 用 `RegExp.test`（无 `g` 标志，无 lastIndex 问题）。
- 本轮实测：
  - `src/uni_modules/uview-plus/libs/util/async-validator.js`（含 `|localhost)` 的 URL 正则）→ **不命中**；
  - `http://localhost:15000/...` → 命中；`https://api.example.com/...` → 不命中。
- 回归风险极低：开发 host 一定带端口；无端口的 `http://localhost/` 会漏（可忽略）。
- 实跑 `check:release` 仍能报出 `dist/build/mp-weixin/config/env.js` 的 `localhost:<端口>`。✓

### R-3 · README 去演示化自检命令 —— ✅ 关闭

- `README.md:210-211` 已改为 `npm run build:mp-weixin && npm run check:release`，并加注释说明 `verify:*` 是 development 构建、必然含 localhost。
- 两份文档一致：`check_release.mjs:10` 也是 `build:mp-weixin && check:release`。
- 全仓再无「`verify:*` + `check:release`」的可执行命令（只剩历史评审文档里的描述）。✓

### R-4 · 删 `UPLOAD_TYPE_DEMO_FILE` 后 `uploadTypeDef` —— ✅ 关闭

- `src/config/dict.js:103-109`：先取 `UPLOAD_TYPE_DEFS[type]`，未注册时 `console.warn` + 返回字面默认 `{ exts: UPLOAD_ALLOWED_EXTS, maxBytes: UPLOAD_MAX_BYTES, imagesOnly: false }`，**不再引用** `UPLOAD_TYPE_DEMO_FILE`。
- 在 `/tmp` 复现：删掉 demo 常量与 `UPLOAD_TYPE_DEFS` demo 项后调用 `uploadTypeDef('foo')` → 输出 `OK def: {"exts":["jpg","jpeg","png","pdf"],"maxBytes":20971520,"imagesOnly":false}`，**不再 ReferenceError**。✓
- 副作用符合预期：未注册类型走全局白名单 + 一条 warn（比静默套 demo 白名单更安全）。✓

### R-5 · 批量上传 `loading:false` 透传 —— ✅ 关闭

- `src/services/uploader.js:265`：`const { loading = true, ...rest } = options;`
- `:272`：`{ toast: false, loading, ...rest }` —— 调用方传 `false` 即 `false`，单张不传默认 `true`。
- `uploadSequential` 的 `{ loading:false }`（`:330,:334` 附近）现在真正生效，逐张上传不再弹全屏遮罩，`app-uploader` 的「上传中 x/y」可见。✓

### R-6 · `PAGE_*` 转出步骤 —— ⚠️ 2/3 关闭（非阻断）

| 位置 | 状态 | 证据 |
|---|---|---|
| `src/services/route.js` | ✅ | `:21-25` 新增注释：「必须**在下面这个 export 块加一行**，否则编译失败」 |
| `.claude/templates/page/README.md` | ✅ | `:22-24` 明确「到 `route.js` 的 export 块**加一行转出**，漏了首次编译会报未导出」 |
| `.claude/skills/rule-add-page/SKILL.md` | ❌ | `:63` 仍只写「（services/route.js 会转出，页面不写路径字符串）」，没有「加一行」的动作 |

- 影响：读 `rule-add-page` 建页的人仍可能漏这一步，首次编译报 `does not provide an export named 'PAGE_XXX'`。
- 修法：把 `rule-add-page:63` 的括号改成「定义后**到 `services/route.js` 的 export 块加一行转出**」。
- **判断：文档级，不阻断**（错误自曝、一行修复；r2 也把它列为高优先建议而非阻断）。

---

## 2. 新回归检查

### N-1（非阻断，低/中）· `onShow` 并发时 `onReady` 可能执行两次

- 位置：`src/composables/usePageGuard.js:50-73`。
- 场景：首次 `onShow` 正在 `await requireAdminLogin()`（真实后端下可能 1–3s），用户切后台再切回，`onShow` 再次触发。两次调用都在入口 `ready===false` 时通过；登录 Promise 单飞、同时 resolve；A 先恢复 → `requirePageAccess` → `ready=true` → `onReady`；B 恢复后**没有再检查 `ready`** → 再次 `requirePageAccess` + `onReady` → 列表可能重复取一次。
- 对比：r2 的写法在 await 之后还有 `if (!ready)` 检查，所以这个竞态是 R-1 重排后新引入的。
- 影响：重复一次首屏请求（不重复渲染错数据，无安全问题）；若权限门在两次中都被拒，可能 toast/back 两次。
- 最小修法（加法，不改结构）：
  ```js
  const ok = await requireAdminLogin();
  if (ready) return;            // ← 登录期间已有另一次 onShow 完成了首屏
  ```
  或在入口加 `let checking = false;`，`onShow` 开头 `if (ready || checking) return; checking = true;` 并在 `finally` 复位。
- **不阻断通过**：需要「登录在飞 + 快速切后台再回」才触发，结果是多一次请求，不是错误状态。

### 其他已确认无回归的项

- `platform.requirePrivacyAuthorize()` 迁走后，`uploader.js` 不再有 `#ifdef`（只剩注释）；`platform.js` 15 处、`config/runtime.js` 3 处条件编译，符合「端判定在 runtime、能力在 platform」；`uploader → platform` 无循环（platform 不反向引 uploader）。✓
- `check_system.mjs` ✅ 全部通过；`check_templates.mjs` ✅ 22 个 `.vue`。
- `check:release` 实跑仍按预期失败（当前 dist 是 development 产物：host 占位 / localhost:端口 / REPLACE / demo token / 3 个 demo 页），闸门有效。✓
- `demo/list.vue` 的 `grantedActions` 改为 computed 后，模板里的 `v-for="code in permission"` 仍正确（ref 自动解包）。✓
- `page-a` / `page-list` 的 `immediate:false` + `onReady` 组合未被本轮改动破坏。✓

### 仍存在但 r2 已归为非阻断的项

- 模板与 demo 页仍未传 `onDenied`：登录失败时列表会落到「还没有数据」而不是失败态（r2 R-7）。
- `check_release` 的 H5 平台仍只查 `VITE_HOST_MP`、不扫 `subPackages`、`:92` 注释「不阻断」与代码不符（r2 R-9）。
- `request` 对顶层数组 / 204 空响应的处理（r2 R-8）、GET 数组仍展开（r2 R-12）。
- `pre_release.md:19` 的 `K-02/K-03`、`templates/page/README.md:37` 的 `BUG-003`、`rule-ui-components:226` 的 `BUG-007` 等悬空编号；`CHANGELOG §三` 仍写「清单正确列出三项」（实跑 5 项）。
- 7 项待用户拍板（5800x / .claude 全套 / region-code / tabBar / vitest / 后端 upload / 链接检查）。

以上均不阻断。清单见 r2 §3（建议）与 r2 §4（待拍板）。

---

## 3. 验证记录（只读 / `/tmp`）

| 项 | 方法 | 结果 |
|---|---|---|
| 系统自检 | `check_system.mjs` | ✅ |
| 模板审计 | `check_templates.mjs` | ✅ 22 个 `.vue` |
| 发布闸门 | `check_release.mjs` | ✅ 按预期失败（5 项，均为模板未替换/未去演示化的真实项） |
| R-2 正则 | Node 直接对 `async-validator.js` / dev / prod 字符串 test | ✅ 仅 dev 命中 |
| R-4 去演示化 | `/tmp` 删 demo 常量与定义后调 `uploadTypeDef` | ✅ 无 ReferenceError，回落全局默认 |
| R-5 | 静态核对 `uploadOne` 解构与传参 | ✅ `loading:false` 透传 |
| R-1 顺序 | 静态核对 `usePageGuard` 生命周期与消费者 | ✅ 先登录后权限；返回不重取；新发现并发竞态 N-1 |
| 构建 / 真机 | 未执行 | — |

---

## 4. 结论

**通过。** R-1…R-5 已真正关闭；R-6 仅 `rule-add-page` 一处文案未同步（非阻断）；新发现 N-1 并发竞态（非阻断，一行修复）。剩余非阻断建议见 r2 §3/§4 与本文件 §1 R-6、§2 N-1。