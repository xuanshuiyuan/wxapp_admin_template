# v1.0.0 复评报告（review-r2）

| 项 | 值 |
|---|---|
| 复评对象 | `wxapp_admin_template`，diff `7eafb01..778de32`（68 files，+1377/−245） |
| 上一轮 | `versions/v1.0.0/review.md`（有条件通过，5 阻断） |
| 本轮依据 | 逐条核对 5 阻断 + 重点查修复引入的回归 + CHANGELOG §四 未处置项 |
| 评审方式 | 只审不改；验证脚本/打包产物均放 `/tmp`；未执行构建（遵循红线 13） |
| 未执行 | 微信开发者工具 / 真机 / 真实后端联调 |

---

## 0. 复评结论

**结论：有条件通过。**

- 5 个阻断中 **4 个真正关闭**（BLK-1 / BLK-3 / BLK-4 / BLK-5），BLK-2 的「页面没有两道门」在接线层面已关闭，但新机制 `usePageGuard` 引入 **1 个阻断级回归（R-1：权限门跑在登录门之前，冷启动/深链会被直接拒绝）**。
- 修复整体质量高于预期：反向依赖是彻底删除而不是绕过；`DEMO_MODE` 改成环境变量并配了可执行闸门；`check:release` 确实能拦住占位/开发域名/演示 token；上传契约从前端单方面假设变成了 README 明写的契约。没有发现新的安全漏洞（演示旁路是**收紧**而不是放宽）。
- 但修复过程引入了 4 个高优先回归（R-2…R-5），其中两个会让**模板自己的文档流程走不通**：按 README §4.1 去演示化会 ① 让 `uploadTypeDef` 抛 `ReferenceError`，② 用 `verify:mp-weixin` 跑 `check:release` 永远失败。这些不阻断「模板机制可用」的结论，但必须在第一个真实项目接入前修掉，否则会以「模板教的步骤跑不通」的形式被复制出去。
- 结论条件：**修 R-1 后即可判「通过」**；R-2…R-5 建议同批修（都是小改动）。

| 原阻断 | 状态 | 一句话 |
|---|---|---|
| BLK-1 services→api | ✅ 关闭 | `uploader` 直接 `curl.upload`，`api/upload.js` 已删且无悬空引用 |
| BLK-2 两道门缺失 | ⚠️ 接线已关，机制有回归 | `usePageGuard` 被全面接入，但顺序错（R-1） |
| BLK-3 DEMO_MODE 旁路 | ✅ 关闭 | env 驱动 + 生产 false + 启动抛错 + `check:release` 拦截 |
| BLK-4 发布闸门端口错 | ✅ 关闭 | 文档全改 15000，新增可执行 `check:release`（但闸门自身有 R-2 误报） |
| BLK-5 上传契约自创 | ✅ 关闭 | 契约定为 `data.url`（兼容 `urls[0]`），补 40203/40204，README 写明后端未实现 |

**剩余阻断：1 个（R-1）。** 其余为高优先回归/建议，均不阻断「机制可用」。

---

## 1. 阻断关闭核对（逐条带证据）

### BLK-1 · services 反向依赖 api —— ✅ 关闭

- `src/services/uploader.js:19` 现在只 import `{ curl, isApiError } from '@/services/http'`，`:289-293` 直接 `curl.upload(...)`。
- `src/api/upload.js` 已删除；`src/api/index.js:15` 只剩 `export { demoApi }`；`module.md:30` 已改成「直接走 `curl.upload`；services 不 import api」。
- 全仓 `grep "from '@/api" src/services` 为空；`grep "api/upload|uploadApi"` 只命中历史评审文档。
- 分层图（`CLAUDE.md:81`、`rule-layering`）与实际一致。

**判断：根因已消除，不是「换了个文件继续反向依赖」。**

### BLK-2 · 页面模板 / 次级页缺两道门 —— ⚠️ 接线关闭，机制引入 R-1

**已修的部分：**

- 新增 `src/composables/usePageGuard.js`，接入：
  - 模板：`page-list.vue:123`、`page-detail.vue:134`、`page-form.vue:103`
  - 页面：`demo/list.vue:116`、`demo/page-a.vue:93`、`demo/page-b.vue:88`、`common/region-picker.vue:198`、`common/field-editor.vue:156`
- 模板改为 `import { route, PAGE___UPPER__, PAGE___DETAIL__ } from '@/services/route'`（`page-list.vue:91`），不再示范路径字面量；`templates/page/README.md:22` 也写明「页面禁止写路径字面量」。
- `rule-add-page:96-101` 已把 `usePageGuard` 列为首选接线。
- `useList` 配合 `immediate:false`（`page-a.vue:88`、`page-list.vue:118`），首屏取数交给 `onReady`，正常进入不会双取。

**未修干净的部分 → 见 R-1（阻断）与 R-6（文档缺口）。**

### BLK-3 · DEMO_MODE 生产旁路 —— ✅ 关闭

- `src/config/app.js:71`：`export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'`；`:73-75` 生产误开直接 `throw`。
- `.env.development:7` = `true`；`.env.production:8` = `false`，且注释写明「不得被 `.env.production.local` 覆盖为 true」。
- `src/config/env.js:50-52` 对 `VITE_MOCK_LOGIN_CODE` 也加了生产启动硬护栏。
- `check_release.mjs:39-47` 检查 `VITE_DEMO_MODE` / `MOCK_LOGIN_CODE` / `DEVELOP_BYPASS`，并合并 `.env.production.local`（`:37`）。
- 本轮实跑 `node .claude/scripts/check_release.mjs`：能正确报出演示 token 残留（当前 dist 是 development 产物，见 §2.4）。

**关于「throw 构建期不报、运行期才报」：可接受。** 它是最后一道 fail-closed 兜底，主闸门是 `check:release`；运行期抛错的表现是白屏 + 控制台错误，比「演示登录悄悄生效」好。建议（不阻断）：把条件从 `VITE_APP_ENV === 'production'` 换成 Vite 内置的 `import.meta.env.PROD`，避免自定义 `--mode` 且漏写 `VITE_APP_ENV` 时护栏失效；再在 `prebuild` 里跑一次 env 检查，让构建在打包前就失败。

### BLK-4 · 发布闸门 grep 错端口 —— ✅ 关闭（但闸门自身有 R-2）

- 全仓 `15200` 只剩历史评审文档；`pre_release.md:54-55,82,106`、`release.yaml:112,166`、`deploy_agent.md:44,67,68,94` 均为 `15000`。
- 新增 `package.json` 的 `check:release` → `.claude/scripts/check_release.mjs`：
  - 生产 env 旁路（demo / mock / develop）`:39-47`
  - host 非占位、绝对地址 `:49-56`
  - 产物扫 `localhost` / `127.0.0.1` / `REPLACE_` / 演示 token `:72-81`
  - 产物必须包含生产域名 `:83-87`
  - `src/pages.json` 仍有 demo 页即失败 `:92-106`
- 本轮实跑（只读）：退出码 1，正确列出 5 项（host 占位、`localhost`、`project.config.json` 的 `REPLACE_`、演示 token、3 个 demo 页）。

**判断：原来的「闸门永不命中」已变成「闸门能命中」。** 但新闸门有 2 个需修的问题（R-2 误报 / R-3 文档流程走不通），见 §2.4。

### BLK-5 · 上传契约自创 —— ✅ 关闭（有 2 个高优先回归）

- 契约：`README.md:261-268` 明写响应 `data.url`，并注明「后端模板尚未实现该控制器」；兼容 `data.urls[0]`。
- 代码：`src/services/uploader.js:294-296` `data.url || data.urls[0]`；`:289-293` 直接走 `curl.upload`。
- 错误码：`dict.js:87-88` 新增 `40203/40204`；`uploader.js:97-101` 按 40205/40203/40204/60004/40001 分档。
- 类型定义：`dict.js:98-104` `UPLOAD_TYPE_DEFS` 镜像后端 `AdminUploadTypes`（demo_file：jpg/jpeg/png/pdf、20MB，与 `enum_upload.go` 一致）。
- 无 `api/upload.js` 悬空引用。

**但：** `uploadOne` 强制 `loading:true`（R-5）；`uploadTypeDef` 的兜底在去演示化后会抛错（R-4）。

---

## 2. 回归检查（本轮重点）

### 2.1 `usePageGuard` 注册顺序 / 与 `useList` / `onUnload` 契约

**正常进入（从首页进次级页）：✓ 不重复取数。**

- `page-a.vue:86-93`：`useList(..., { immediate:false })` → `usePageGuard({ onReady: reload })`，首屏只取一次。
- `page-list.vue:109-123` 同构。
- 返回本页：`usePageGuard.js:57-59` 的 `ready` 标志保证 `onReady` 只跑一次；`useList` 的 `refreshOnReturn` / `listDirty` 仍按自己的口径工作（`useList.js:143-152`）。✓
- `onUnload`：`usePageGuard` 不注册卸载钩子，与 `fieldEditor`/`regionPicker` 的 `onUnload` 无冲突。✓

**R-1（阻断）· 冷启动 / 深链：权限门跑在登录门之前，未登录会被直接判定「无权限」。**

- 代码顺序：`usePageGuard.js:41-46` 在 `onLoad` 调 `requirePageAccess`；`:48-60` 才在 `onShow` 调 `requireAdminLogin`。uni-app 生命周期里 `onLoad` 永远先于 `onShow`。
- 冷启动时本地无会话 → `getPermission()` 为空 → `requirePageAccess`（`pageAccess.js:105`）→ `requirePermissions`（`session.js:207-212`）→ `hasAnyPermission` 为 false → **toast + `route.back()`**。
- 由于 `allowed=false`，`onShow` 在 `:49` 直接 `return`：**登录门永远不会执行，`onReady` 永远不会跑**。
- 受影响场景：
  - H5 深链直接打开 `pages/demo/page-a`、`page-b`、`demo/list` 或任何新业务页；
  - 微信分享路径直达次级页；
  - 清缓存 / 换存储前缀后的首次进入。
  - 结果：用户被弹回首页（`route.back` 空栈回落首页），需要重新从宫格点进去；模板注释里承诺的「H5 深链/分享直达不先渲染」并没有真正实现，只是从「先渲染再 40102」变成「直接踢回首页」。
- 这恰好与模板的目标相反：**用户是有权限的**，只是还没静默登录。
- 最小修法（把权限门挪到登录门之后，且只判一次）：
  ```js
  onLoad((q) => { lastQuery = q || {}; });          // onLoad 只存 query
  onShow(async () => {
    if (pageNeedsLogin(path)) {
      if (!(await requireAdminLogin())) { onDenied?.({ reason: 'login' }); return; }
    }
    if (!checked) {
      const access = requirePageAccess(path, lastQuery);
      allowed = access.allowed;
      if (!allowed) { onDenied?.(access); return; }
      checked = true;
    }
    if (!ready) { ready = true; onReady?.(lastQuery); }
  });
  ```
- 修这个顺序时，**页面 setup 时读的权限快照也要跟着改**：`demo/list.vue:101` 在 setup 里 `getPermission()`，冷启动时为空；即使 guard 之后登录成功，`grantedActions` 也不会更新（`canRequest/canUpload` 永远 false）。需要把 permission 改成 `onReady` 后重读（或读 `userState.permission` 响应式）。

**R-7（中）· 登录失败 / `byParam` 解析失败时页面没有失败态。**

- `usePageGuard.js:52-55` 在登录失败时调 `onDenied({ reason:'login' })`，但三个模板与所有 demo 页都没传 `onDenied`。
- 对列表模板（`immediate:false`）：登录失败时 `firstLoading=false`、`error=''`、`items=[]` → `isEmpty=true` → 页面显示「还没有数据」，用户会以为是空列表而不是网络/登录失败，也没有重试入口。
- 对 `page-detail`：`error` 为空，页面停在「还没取到」的空白态，没有重试按钮。
- `unresolved`（`byParam` 解析不出）同样被吞：`requirePageAccess` 返回 `allowed:false, reason:'unresolved'`，页面应给「参数不完整」空态，模板未接。
- 建议：模板与 demo 页统一传 `onDenied`，把 `reason==='login'` 写成 `error='登录失败，请重试'`，`unresolved` 写成「参数不完整」；或让 `usePageGuard` 暴露 `status`（`checking/denied/loginFailed`）供页面渲染。

### 2.2 uploader

- **分层**：✓ 直接 `curl.upload`，无 api 反向依赖（BLK-1 已核）。
- **type 白名单 / 限额 / 错误码 / `data.url` 兼容**：✓ 与后端 `AdminUploadTypes` 的 demo_file 一致；40203/40204/40205/60004/40001 分档；`data.url` 优先、`urls[0]` 兼容。
- **R-5（高）· `uploadOne` 强制 `loading:true`，批量上传回归成全屏遮罩。**
  - `uploader.js:286`：`const { loading: _ignore, ...rest } = options;`
  - `:292`：`{ toast:false, loading:true, ...rest }` —— 调用方传的 `loading:false` 被丢掉。
  - `uploadSequential` 在 `:351,355` 明确传 `{ loading:false }`（意图是批量时**不**每张都打全屏 loading），现在被强制改成 true：每张图都会触发一次全局 loading（200ms 上屏 + 300ms 最短停留），`app-uploader` 的「上传中 2/5」进度文案被全屏遮罩盖住。
  - 最小修法：`const { loading = true, ...rest } = options;` 然后 `{ toast:false, loading, ...rest }`（或直接保留 `...options` 放在 `loading:true` 之后）。
- **R-4（高）· 去演示化清单会打断上传链路。**
  - `dict.js:104`：`return UPLOAD_TYPE_DEFS[type] || UPLOAD_TYPE_DEFS[UPLOAD_TYPE_DEMO_FILE];`
  - README §4.1 第 5 步要求删掉 `UPLOAD_TYPE_DEMO_FILE` 与 `UPLOAD_TYPE_DEFS` 的 demo 项；之后 `uploadTypeDef()` 在调用时抛 `ReferenceError: UPLOAD_TYPE_DEMO_FILE is not defined`（本轮已用 /tmp 复现：`THROWS: ReferenceError`）。
  - 同时，未注册的 type 会**静默回落**到 demo 的白名单（jpeg/pdf），新增视频类型时会被前端按图片拦截。
  - 最小修法：兜底改为全局默认值并 `console.warn`：
    ```js
    const FALLBACK_UPLOAD_DEF = { exts: UPLOAD_ALLOWED_EXTS, maxBytes: UPLOAD_MAX_BYTES, imagesOnly: false };
    export function uploadTypeDef(type) {
      const def = UPLOAD_TYPE_DEFS[type];
      if (!def) console.warn(`[upload] 未注册的上传类型：${type}，按全局默认校验`);
      return def || FALLBACK_UPLOAD_DEF;
    }
    ```
    并把 README §4.1 第 5 步补一句「同时确认 `uploadTypeDef` 的兜底不引用被删常量」。

### 2.3 `VITE_DEMO_MODE` 环境化

- `verify:*`（`--mode development`）仍能开演示：`.env.development:7` = true，`verify:mp-weixin` 加载 development → `DEMO_MODE=true`。✓
- 生产 fail-closed：`.env.production:8` = false；`.env.production.local` 若覆盖为 true → `app.js:73-75` 启动抛错；`check_release.mjs:37-41` 合并 `.local` 后拦截。✓
- 当前 `dist/build/mp-weixin` 是 **development 产物**（`config/env.js` 含 `localhost:15000`、`config/demo.js` 含演示 token），所以本轮 `check:release` 报 5 项失败——这是预期，不是闸门误报。生产构建需重新跑 `build:mp-weixin`。
- **R-10（低/中）· 护栏条件用 `VITE_APP_ENV`，不是 `PROD`。** 自定义 `--mode staging` 且 `.env.staging` 写 demo=true / `VITE_APP_ENV=staging` 时，运行期 throw 不触发；`check:release` 只读 `.env.production*`，也会漏。建议用 `import.meta.env.PROD`，并把 env 检查提前到构建前。
- 运行期 throw 的 UX 是白屏（无提示页）。可接受（fail-closed），但建议在 `main.js` 外层 catch 后渲染一句「生产配置错误」，或直接依赖 `check:release` 不让这种包出门。

### 2.4 `check:release` 误报 / 漏报

**已正确处理的：**

- `.env.production.local` 覆盖：`:37` 后读覆盖先读 ✓。
- host 尾斜杠归一：`:84` `replace(/\/+$/, '')`，与 `env.js:31` 的 `rootPath` 一致 ✓。
- `pages.json` 注释剥离：`:95-97` 对当前文件解析成功（本轮实测 `JSON.parse` 通过，7 页）✓。
- 占位 / 演示 token / 开发域名：当前 dist 全部命中，退出码 1 ✓。

**R-2（高）· `localhost` 误报：一旦项目使用 `u-form`，闸门永久失败。**

- `u-form.vue:11` `import Schema from "../../libs/util/async-validator"`；`async-validator.js:306` 的 URL 正则里含字面量 `|localhost)`。
- 任何使用 `u-form`（`rule-add-page` 明确推荐、并写了「u-form 三个坑」）的项目，生产包都会包含这段字符串；`check_release.mjs:73` 的 needle 是裸 `'localhost'` → **必定命中** → 发布闸门永远无法通过。
- 本轮当前 dist 没有触发（模板未用 u-form），所以这是**潜伏**问题，不是当前失败项。
- 最小修法：needle 改成带端口/协议的开发地址：`/localhost:\d+/`、`/127\.0\.0\.1:\d+/`（开发 host 一定带端口），或对 `src/uni_modules/**` 的已知正则做白名单。

**R-3（高）· README §4.1 的自检命令永远失败。**

- `README.md:211`：`npm run verify:mp-weixin && npm run check:release`。
- `verify:mp-weixin` 是 **development** 构建（`.env.development` 的 host 是 `localhost:15000`），产物写进 `dist/build/mp-weixin`；`check:release` 随后扫同一目录 → 必报 `localhost`，即使去演示化全部做完。
- `check_release.mjs:10` 自己写的是 `npm run build:mp-weixin && npm run check:release`，两处矛盾。
- 最小修法：README §4.1 第 8 步改成 `npm run build:mp-weixin && npm run check:release`（或先 `rm -rf dist/build`）。

**R-9（中）· 平台/范围问题：**

- `check_release.mjs:18,49` 无论 `-- h5` 还是 `-- app`，都只检查 `VITE_HOST_MP`：
  - H5 同域部署（`VITE_HOST_H5` 留空走相对路径）时，H5 产物里没有 `VITE_HOST_MP`，`:83-87` 会报「找不到生产域名」；
  - 应改为按 `platform` 取 `VITE_HOST_MP/H5/APP`，H5 允许空 host。
- `:99` 只扫 `pages.pages`，不扫 `subPackages`；演示页一旦进分包就漏。
- `:92` 注释写「不阻断，但必须知情」，代码却 `errors.push`（实际是阻断）——注释应改成「阻断」。
- `:5` 写「检查三件事」，实际四件（多了 pages.json）。

**R-8（中）· `request` 非对象响应的边界。**

- `request.js:138-147`：`!body || typeof body !== 'object' || Array.isArray(body)` → `unknown`。
- HTML/纯文本当错误是对的；但 **204 No Content**（`res.data === ''`）与**第三方返回顶层数组**现在都会变成「响应格式异常」，旧实现分别是 `{}` 成功与数组成功。
- 模板支持「完整 http(s) 地址（第三方）原样使用」，第三方数组响应并不罕见；建议：数组放行（后续 `code` 判断自然走「无 code 视为成功」），空串/null 对 204 放行或单独提示。
- 这不是当前 demo 的回归（demo 接口都返回对象），但会在接第三方时暴露。

**R-12（低）· GET 数组仍与 POST 不一致。**

- `qs.js:29-31` POST 数组已改成逗号串 ✓；但 `request.js:45-47` 的 GET `buildURL` 仍是 `key=v1&key=v2`。
- 后端表单/查询解码器对重复 key 的取法未定义；建议 GET 也 `join(',')`，或在 `buildURL` 里对数组 `encodeURIComponent(value.join(','))`，与 CLAUDE.md §3.2 口径一致。
- 本轮 demo 自测不传数组，未触发；不是回归，是遗留口径不一致。

### 2.5 `useList` / 其他

- `useList.js:69-72,105-108` 的 `pendingReload` 修好了「在飞时 reload 被静默丢弃」：只排队 `targetPage<=1`，在当前请求 `finally` 后补一次，不会无限重拉。✓
- 但 `reload()` 在被排队时返回 `undefined`（不是 Promise）；`usePullRefresh` 的 `await refreshAction()` 会立即返回，原生指示器先收起、补拉在后台跑。可接受，但若调用方 `await reload()` 期望「等数据回来」会落空（模板内没有这种用法）。低。
- `page-a.vue:86-93`、`page-list.vue:109-123` 的 `immediate:false` + `onReady:reload` 组合正确，无双取。✓
- `page-form.vue` 新增后 `app-bottom-bar` 有了消费方（之前 0 使用）✓；但表单保存成功后**没有示范 `markListDirty(PAGE_LIST)`**，`rule-add-page` 里的「返回刷新」口径没有在模板里落地（低，建议补一行注释/示例）。

---

## 3. 剩余建议（含 CHANGELOG §四 的 7 项）

### 3.1 CHANGELOG §四 未处置项：均**不构成阻断**

| # | 项 | 判断 |
|---|---|---|
| 1 | `5800x` 是否固化为公司 RBAC 标准码 | **不阻断**。`CLAUDE.md:124-126` 已标注「模板建议、非后端既有契约」，dict 也有同样限定；属用户/后端决策。 |
| 2 | `.claude` 全套是否保留 | **不阻断**。规则密度高是产品选择，不是缺陷；但需补「链接/陈旧值」自动检查（见 3.2）。 |
| 3 | `region-code.js` 160KB 是否分包 | **不阻断**。功能正确，K-100 已登记；体积是优化项。 |
| 4 | 是否内置 tabBar | **不阻断**。按「不编造」留空是正确取舍。 |
| 5 | 是否引入 vitest | **不阻断**。需用户授权；模板已给测试模板。 |
| 6 | 后端 `POST /admin/upload` 控制器 | **不阻断**。README 已明写「后端模板尚未实现」，前端契约已固定为 `data.url`。 |
| 7 | `.claude` 链接/陈旧值自动检查未实现 | **不阻断**，但本轮又发现 4 处残留（见 3.2），建议尽快补。 |

### 3.2 本轮新增 / 残留的文档与可用性问题（均建议级）

- **R-6（高）· 新 `PAGE_*` 没有说明要加到 `services/route.js` 的 export 块。**
  - `route.js:24-32` 是硬编码的 7 个常量转出；模板 `page-list.vue:91` / `page-form.vue:89` / `page-detail.vue:80` 都 `import { PAGE___UPPER__ } from '@/services/route'`。
  - `templates/page/README.md:22` 说「在 access.js 定义 PAGE_* + PAGES，再 import 自 services/route」；`rule-add-page:63` 说「services/route.js 会转出」——都没说**还要在 route.js 的 export 列表加一行**。新页面替换占位后第一次编译会报 `does not provide an export named 'PAGE_XXX'`。
  - 修法：两处文档各加一句；或把 `route.js` 改成 `export { ... } from '@/config/access'` 的全量转出（注意别把 `HOME_ENTRIES` 等非路径常量也转出）。
- **R-10（中）· `DEMO_MODE` 文档仍按「硬编码开关」描述。**
  - `CLAUDE.md:48`（「`src/config/app.js` | true = ...」）、`:143`（`DEMO_MODE=true`）、`:314`（「把 `DEMO_MODE` 改为 false」）；`README.md:24,47,77`。
  - 实际已是 `VITE_DEMO_MODE` 环境变量 + 生产抛错；`README.md:179` 的新表正确，但前后文没同步。CLAUDE.md 是真相源，应改。
- **`rule-performance:29`** 仍写「本工程目前只有 2 个页面（自检页 + 登录页）」——现在 7 页、且没有登录页。低。
- **残留悬空编号**：`pre_release.md:19` 的 `K-02/K-03`；`templates/page/README.md:37` 的 `BUG-003`；`rule-ui-components:226` 的 `BUG-007`。CHANGELOG 说「清理悬空引用」，这三处没清干净（低）。
- **`uploader.js:149` 仍有 `#ifdef MP-WEIXIN`**（隐私授权），CHANGELOG 第 24 行称「`#ifdef` 只剩 platform/runtime」——不准确（低；隐私预检放在 uploader 是合理的，改文档即可）。
- **`check_release` 文档/注释**：`:5` 三件事 vs 四件；`:92` 「不阻断」vs `errors.push`；CHANGELOG §三说「清单正确列出三项」，本轮实跑是 5 项（host 占位、localhost、REPLACE、demo token、3 个 demo 页）。低，但会让人误判闸门状态。
- **`page-form.vue`** 保存成功后没有 `markListDirty` 示例（低）。
- **`useServerClock` / `location.js`** 仍 0 消费；作为预留能力可以，但 README 的「可删清单」没有列它们（低）。

---

## 4. 需要用户拍板（与 r1 一致，未变）

1. `DEMO_MODE` 最终形态：接受「env 开关 + 去演示化清单 + `check:release`」，还是要求生产包物理不含 demo（分包/独立分支）？
2. 页面治理模型：是否要求**每个页面**都在 `onShow` 跑登录门（`usePageGuard` 默认就是），还是允许「首页登录 + 请求层补会话」？这决定 R-1 修复后 `onDenied` 的默认处置。
3. 上传契约：`data.url`（当前）还是 `data.urls[]`？错误码是否统一按 `40203/40204/40205/60004`？需后端一起拍。
4. `5800x` 是否固化为公司 RBAC 标准码（写进后端 `err_code.go`，而不是只在前端 dict）。
5. `.claude` 全套是否作为公司标准保留（13 rule + 10 agent + 4 workflow）。
6. `region-code.js` 160KB 是否移入分包。
7. 是否内置 tabBar 骨架。
8. 是否引入 vitest（需授权装依赖）。

---

## 5. 本轮验证记录（只读 / `/tmp`）

| 项 | 方法 | 结果 |
|---|---|---|
| 系统自检 | `node .claude/scripts/check_system.mjs` | ✅ 86 文件 / 10 agents / 4 workflows / 7 页一致 |
| 模板审计 | `node .claude/scripts/check_templates.mjs` | ✅ 22 个 `.vue` |
| 发布闸门 | `node .claude/scripts/check_release.mjs` | ✅ 按预期失败（5 项：host 占位 / localhost / REPLACE / demo token / 3 demo 页） |
| 权限菜单逻辑 | esbuild 打包 `access+demo` → Node 断言 | ✅ 可见 `DEMO_MANAGE,DEMO_SUBMENU`；`DEMO_HIDDEN` 不出现；子菜单 2 项 |
| `qs` 数组 | 打包后断言 | ✅ `{ids:[1,2]}` → `ids=1%2C2` |
| 上传类型兜底 | 打包后断言 | ✅ demo_file 定义正确；⚠️ 未注册 type 回落 demo_file 白名单 |
| 去演示化后上传 | 在 `/tmp` 删除 demo 常量与定义后调用 `uploadTypeDef` | ❌ `ReferenceError: UPLOAD_TYPE_DEMO_FILE is not defined`（R-4 证据） |
| 分层 | `grep "from '@/api" src/services` | ✅ 空 |
| `#ifdef` | `grep` | ⚠️ 仍在 `uploader.js:149`（与 CHANGELOG 表述不符） |
| 构建 / 真机 | 未执行（红线 13） | — |

---

## 6. 结论

**有条件通过。** 5 个阻断中 4 个彻底关闭，BLK-2 的接线已补齐但新机制有一个必须在发布前修的阻断级回归：

- **R-1（阻断，代码级）**：`usePageGuard` 的权限门在 `onLoad`、登录门在 `onShow`，冷启动/深链在登录前就被判无权限并踢回首页；`demo/list.vue:101` 的权限快照也会在延迟登录后保持为空。修法见 §2.1。

**高优先、不阻断本轮结论（建议同批修）：**

- R-2 `check:release` 的裸 `localhost` 会因 uview `async-validator` 的正则永久误报（U 型项目用 `u-form` 即触发）。
- R-3 README §4.1 用 `verify:mp-weixin` 跑 `check:release`，去演示化后也永远失败；应改 `build:mp-weixin`。
- R-4 去演示化第 5 步会让 `uploadTypeDef` 抛 `ReferenceError`；兜底应改成全局默认值。
- R-5 `uploadOne` 强制 `loading:true`，批量上传回归成全屏遮罩。
- R-6 新 `PAGE_*` 需手动加到 `services/route.js` 的 export 块，文档没写。

修完 R-1 即可判「通过」；R-2…R-6 建议在第一个真实项目接入前完成。