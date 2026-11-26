# wxapp_admin_template

可复制的 **uni-app B 端管理小程序**骨架（Vue 3 + uview-plus，多端：微信小程序 / H5 / App）。
`clone` → `bash init.sh` 改名 → 填占位 → 直接开始写业务。

从一个真实业务工程抽离，**只保留基础设施**：请求链（签名 / 重登重放 / 错误归一）、
登录态、**按权限点渲染的菜单机制**、页面准入、通用上传、样式三层体系、通用组件与 composables。

> 契约真源：后端模板 [`go_project_template`](https://github.com/xuanshuiyuan/go_project_template)。
> 本模板的请求层 / 登录态 / 权限机制与它对齐，**不自创契约**。
> 工程约定真相源：`.claude/CLAUDE.md`；上手手册：`.claude/QUICK_START.md`。

---

## 1. 快速开始

```bash
# 1. 初始化：改项目名（全局替换 wxapp_admin_template）+ 可选填 appid / 接口域名
bash init.sh

# 2. 安装依赖
npm install

# 3. 跑起来（默认 DEMO_MODE=true，不依赖后端）
npm run dev:mp-weixin     # 微信开发者工具导入 dist/dev/mp-weixin
npm run dev:h5            # 浏览器
```

此时首页按 `config/demo.js` 的演示权限渲染菜单，绑定页任意账号 + 6 位以上密码即可进入
（仅当 `.env.development` 的 `VITE_DEMO_MODE=true`；生产默认 false）。

### REPLACE_* 占位清单（上线前必须全部替换）

```bash
grep -rn 'REPLACE_' . --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=unpackage
```

| 文件 | 占位项 | 说明 |
|---|---|---|
| `src/manifest.json` | `REPLACE_WX_APPID` | 微信小程序 appid（init.sh 可填） |
| `.env.production` | `REPLACE_API_BASE_URL` ×3 | 接口域名（mp / h5 / app；H5 同域可留空走相对路径） |
| `.env.production` | `REPLACE_OSS_HOST` | OSS / CDN 域名（没有就留空） |
| `.env.*.local`（不进 git） | `VITE_API_KEY` | 签名密钥，按 source 向后端线下领取 |

此外这几处是「带默认值、按项目改」而不是安全占位：

- `src/config/app.js`：`APP_NAME` / `APP_VERSION` / `edition` / `source` / `DEMO_MODE`
- `src/config/dict.js`：权限码 `PERM_*`、业务码、上传类型
- `src/config/access.js`：页面路径、首页入口、页面准入表 `PAGES`
- `src/config/endpoints.js`：接口路径登记

---

## 2. 目录与本模板保留了什么

```
src/
  services/       基础设施（唯一入口都在这层）
    http/         request（签名注入→发送→业务码→40005 单飞重登重放→错误归一）
                  · transport（request / upload 同形状）· error（ApiError 六类）
                  · guard（全局业务码守卫机制）· sign（签名头）
    session.js    登录态唯一入口（演示模式 / 真实模式双分支）
    pageAccess.js ★ 页面准入 + 「配置 ∩ 权限点」的唯一判据处
    storage.js    本地存储与登录态结构（唯一读写入口）
    guards.js     全局业务码「业务语义」登记（50008 / 58004 弹框）
    uploader.js   选文件 + 上传（端差异、业务码文案、批量串行）
    platform.js   多端差异适配（布局 / 滚动锁 / 拨号 / 复制 / 文档 / 扫码 / 更新）
    route.js      跳转统一入口（路径常量从 config/access 转出）
    toast.js      toast + 引用计数 loading（200ms 上屏 / 300ms 最短停留）
    pickPage.js   「跳页取值」通用桥（Promise + 全局事件 + 在飞去重）
    fieldEditor.js / regionPicker.js   两条具体取值桥
    listDirty.js  列表「返回即刷新」的一次性脏标记
    appUpdate.js  小程序版本更新提示
    location.js   定位（预留能力，无消费方）
  config/
    access.js     ★ 访问配置唯一真源（页面路径 + 入口/子入口/按钮 + PAGES 准入表）
    app.js        应用常量（edition / source / 品牌 / 存储前缀 / DEMO_MODE）
    dict.js       业务码 + 权限码 + 上传类型
    endpoints.js  接口 URL 唯一登记表
    env.js        .env 读取与按端分流
    demo.js       演示会话（DEMO_MODE=true 时使用）
    （区划表已随 region-picker 移入 pages-sub，不在 config/）
    theme.js      theme.scss 的 JS 镜像（u-icon color 这类 prop 用）
  composables/    useList · useModal · usePullRefresh · useServerClock · useAdminHome · usePageGuard
  components/     app-*（easycom 免 import）：brand / modal / loading / navbar / refresher /
                  skeleton / list-state / form-row / bottom-bar / uploader
  pages/
    admin-home/   工作台（权限菜单 + 冷启动判定态 + 下拉刷新）
    bind/         绑定管理员账号（stub 先例，UI 与流程完整）
    demo/         演示页（请求链路上手 + 上传上手 + 列表骨架 + 跳页取值）
    common/       field-editor（跳页取值工具页）
  pages-sub/      分包：common/region-picker + 区划表（约 160KB，按需下载）
  store/          user / modal / loading（都是视图，真相源在 storage 与服务端）
  styles/scaffold.scss  版式块 + 流光玻璃视觉语言（极光 / 玻璃卡 / 宫格 / 按钮…）
  common/css/theme.scss ★ 样式 token 唯一值源（换主色只改这里 + config/theme.js）
```

**剥离掉的内容**：原工程的全部业务页面、业务 `api/` 模块、业务 `utils/`、业务组件与静态资源、
`.claude` 里的业务知识库与历史记录。

---

## 3. 核心机制（照抄即可的三块）

### 3.1 请求链

```js
// api/<域>.js —— 路径必须先登记 config/endpoints.js
import { curl } from '@/services/http';
export function list(params) {
  return curl.get(ENDPOINT_X_LIST, params);        // 读接口：GET + query
}
export function save(data) {
  return curl.post(ENDPOINT_X_SAVE, data);         // 写 / 查询：POST form-urlencoded
}
export function upload(filePath, type) {
  return curl.upload({ filePath, name: 'file', formData: { type } }, ENDPOINT_ADMIN_UPLOAD);
}
```

- 成功返回响应体 `{ code, msg, data }`，`code === 0`；失败**永远抛 `ApiError`**，
  按 `type`（`network` / `http` / `business` / `auth` / `guard`）分支。
- options：`{ toast: false }` 静默 · `{ loading: true }` 托管 loading ·
  `{ authRetry: false }`（登录/绑定**必传**）· `{ guard: false }`（豁免全局守卫）。
- 新接口**禁止 `curl.postJSON`**；数组字段用 `joinIdsParam` 逗号串，禁止 `key[]=`。
- 签名头：`source / timestamp / sign / random / edition / token / userid`，
  `sign = MD5("Source=..&TimeStamp=..&Key=<apiKey>&Weight=<random>").toUpperCase()`。
  local / develop 后端可用 `VITE_DEVELOP_BYPASS=develop` 跳过签名（生产禁用）。

### 3.2 登录态

```
首屏 onShow → requireAdminLogin()
   ├─ 本地会话够用（token + permission）→ 直接放行
   ├─ 未登录 → wx.login code → admin/login/login
   ├─ 58001 未绑定 → 清栈跳 pages/bind（手机号 + 密码绑定）
   └─ 40005（任意请求）→ 单飞重登 + 原请求重放一次（http 层自动，页面无感）
```

`App.vue` 的 `onLaunch` **刻意不做登录**：登录失败要跳页，而 onLaunch 阶段页面栈未就绪。
`main.js` 有两条**不可删**的副作用 import：`@/services/session`、`@/services/guards`。

### 3.3 ★ 权限菜单（本模板的核心资产）

三方分工：

| 谁 | 内容 |
|---|---|
| `config/access.js` | 有哪些页面 / 入口 / 子入口 / 按钮，各自属于哪个权限码，点进哪一页 |
| 登录响应的 `data.permission` | **现在能用哪几个**（`permission.includes(code)`） |
| 后端接口 | 真防线：按登录缓存里的「角色授权路径列表」逐路径校验，无权回 `40102` |

页面里两行：

```js
// 权限门（onLoad，一行）
if (!requirePageAccess(PAGE_X).allowed) return;
// 登录门（onShow）
if (!(await requireAdminLogin())) return;
```

页内入口 / 按钮：

```js
import { byPermission } from '@/services/pageAccess';
const visibleActions = computed(() => byPermission(ACTIONS, permission.value)); // 没权限根本不渲染
```

首页「0 / 1 / ≥2 个子项」规则：过滤后 0 个 → 入口不渲染；1 个 → 直跳；≥2 个 → 底部弹层。
实现见 `composables/useAdminHome.js` + `pages/admin-home/index.vue`。

> ⚠️ 权限是**登录时快照**（变更要重新登录才刷新）→ 显隐可能短暂过期，所以
> 凡是按权限调的接口**仍必须处理 `40102`**（就地提示 / 置灰 / 无权限空态，**不进全局守卫**）。
> 免权限接口（如通知）**不要**给它编权限码，否则「后端不下发 → 入口永远不显示」。

---

## 4. 演示模式与接真后端

`DEMO_MODE` 由**环境变量**驱动（`VITE_DEMO_MODE`，**不允许硬编码**）：

| | `.env.development` = `true` | `.env.production` = `false` |
|---|---|---|
| 登录 | 不请求网络，写入 `config/demo.js` 的会话 | `admin/login/login` |
| 绑定 | 任意账号 + 6 位密码 | `admin/login/bind` |
| 首页数据 | 本地会话（权限点 + 管理员信息） | 同上（本模板不依赖首页接口） |
| 防护 | — | 生产若误开 `VITE_DEMO_MODE=true`，**启动即抛错**；`npm run check:release` 也会拦 |

切换步骤：

1. 按下一节完成后端 RBAC 登录 / 绑定；
2. 填 `.env.*.local` 的 `VITE_API_KEY`；
3. 确认 `.env.production` 的 `VITE_DEMO_MODE=false`（不要用 `.env.production.local` 覆盖成 true）；
4. 用真实权限码替换 `config/dict.js` 的 `PERM_DEMO_*` 与 `config/access.js` 的入口 / `PAGES`；
5. 按 §4.1「去演示化」删除演示页 / 会话 / 接口，然后跑 `npm run check:release`。

### 4.1 去演示化清单（发布前必须做完）

```bash
# 1) 删演示页面与会话/接口
rm -rf src/pages/demo
rm -f src/config/demo.js src/api/demo.js

# 2) pages.json 里删掉三个 demo 页面条目（pages/demo/list、page-a、page-b）
# 3) config/access.js：删掉 DEMO_* 导入、DEMO_SUBMENU_ENTRIES、DEMO_PAGE_ACTIONS、
#    三个 HOME_ENTRIES 演示项中的 demo 项、PAGES 里三条 demo 准入
# 4) services/session.js：删掉 DEMO_SESSION 导入与演示分支（DEMO_MODE 相关）
# 5) config/dict.js：删掉 PERM_DEMO_*、UPLOAD_TYPE_DEMO_FILE 与 UPLOAD_TYPE_DEFS 里的 demo 项
# 6) config/endpoints.js：删掉 ENDPOINT_DEMO_*
# 7) api/index.js：删掉 demo 导出
# 8) 自检（★ 必须用 build:mp-weixin：verify 是 development 构建，含 localhost，check:release 必然失败）
npm run build:mp-weixin && npm run check:release
```

> 第 3–6 步也可以保留（`DEMO_MODE=false` 时它们不生效），但 `check:release` 会因
> `pages.json` 仍有 demo 页而拦下 —— 演示代码不进生产包是硬口径。

---

## 5. 后端对接指引（含 RBAC 自建）

> 后端模板的 admin 分组**中间件已保留**（签名 + B 端 token + 角色接口权限逐路径比对），
> 但**不含账号体系**：登录 / 绑定 / 管理员 / 角色接口需要新项目自建。
> 接入说明原文见后端 `internal/controllers/admin/init.go` 头注释。

### 5.1 必须对齐的契约

| 项 | 值 / 规则 |
|---|---|
| 统一响应 | HTTP 恒 200，body `{ code, msg, data }`，`code=0` 成功 |
| source | B 端小程序 `1001`（网页 B 端 `0101`）；每个 source 有**独立签名密钥** |
| edition | 白名单起点 `v1.0.0`（后端 `EditionList`，未登记整体拒绝） |
| 登录态头 | `token` + `userid`（`userid` = `admin_info.id`），TTL 7200s |
| 错误码 | `40005` 登录失效 → 重登 · `40102` 无权限 · `40205` 频控 · `6xxxx` 系统 |

### 5.2 自建账号体系的三步

1. **登录**：`POST /admin/login/login`（adminlogin 组：签名 + source 属 B 端，免 token）
   入参 `code`（wx.login）→ 返回
   ```json
   { "code": 0, "msg": "ok", "data": {
       "token": "…",
       "source": "1001",
       "admin_info": { "id": 1, "user_name": "张三", "nick_name": "张三", "mobile": "138…",
                       "role_names": ["运营"], "api": ["/v2/admin/xxx/list", "…"] },
       "permission": ["DEMO_MANAGE", "…"]
   } }
   ```
   **关键**：把角色已授权的接口路径列表写入登录缓存容器的 `api` 字段
   （后端 `conf.CacheFieldApi`）——`AdminVerification` 的逐路径比对随即生效。
2. **绑定**：`POST /admin/login/bind`（手机号 + 密码 + **新** code），成功响应与登录完全相同；
   该微信没绑过管理员时登录回 `58001`（流程分支 → 前端去绑定页）。
3. **权限点**：`permission` 是前端显隐 / 准入的唯一判据。建议按「每个操作一个码」下发，
   并与 `config/access.js` 一一对应；后端仍按路径校验，前端只是体验层。
   登录/绑定错误码沿用本项目标准号段 `58001–58006`（后端模板未内置，需在后端落同一组常量）。

### 5.3 上传

后端只建一个上传口（建议 `POST /admin/upload`），业务类型由 `type` 声明：
`conf.AdminUploadTypes` 里注册（目录 + 格式白名单 + 大小上限），前端 `type` 传同一个键
（前端在 `config/dict.js` 的 `UPLOAD_TYPE_DEFS` 镜像同一份白名单 / 限额）。

**响应契约**（新项目必须按此返回；后端模板尚未实现该控制器）：

```json
{ "code": 0, "msg": "ok", "data": { "url": "https://oss.example.com/demo_file/xxx.png" } }
```

前端兼容 `data.urls[0]`（多图接口写法），但**以 `data.url` 为准**。
失败码按 `40203`（格式）/ `40204`（大小）/ `40205`（频控）/ `40001`（类型未注册）/ `60004`（通用）分档。
前端链路：`<app-uploader v-model="files" type="demo_file" />`。

### 5.4 连通性自测（可选）

后端模板当前唯一真实可调的是 demo 模块（web 组，C 端 source）。用本模板的请求层去打它：

```bash
# .env.local
VITE_SOURCE=1010
VITE_DEVELOP_BYPASS=develop     # local/develop 后端跳过签名
```

然后在演示页点「调用列表 / 创建一条」。
⚠️ 这**只是**验证「签名 → 发送 → 统一响应 → ApiError」链路，不是业务接口，不要写进真实页面。

---

## 6. 验证

```bash
npm install
npm run verify:mp-weixin    # 用 development 环境配置构建（产物在 dist/build/mp-weixin）
npm run verify:h5
npm run build:mp-weixin     # 发布产物（production 配置）
npm run check:release       # 发布闸门：占位 / 演示代码 / 联调旁路 / host 一致性（必须通过才能发）
```

模板交付前的验证结论记录在 `.claude/context/current_sprint.md`；未跑过的项写「未执行，待验证」。

---

## 7. .claude 工程系统

本模板自带一套 Claude Code 工程系统（从原工程抽离并去业务化）：

| 目录 | 内容 |
|---|---|
| `CLAUDE.md` | 全局约束与红线（分层 / 请求链 / 登录态 / 权限 / 样式 / 禁止事项） |
| `QUICK_START.md` | 新人 / 新窗口的最短上手路径 |
| `skills/rule-*` | 13 个编码规则 skill（按需加载，不要全读） |
| `skills/project-dev` | 版本化需求记录工作流（多轮商讨 → `project-meta/versions/vN/`） |
| `skills/design-preview` | 设计稿生成流程（`docs/design/` 本机留存，不进 git） |
| `agents/` · `workflows/` | 10 个单职责子代理 + 4 条流程编排 |
| `project-meta/` | 业务知识库骨架 + demo 模块范本 |

不需要这套系统时**整目录删除**不影响编译；保留它则按 `CLAUDE.md` 的同步契约维护。