# v1.0.0 评审报告 —— 能否作为公司 B 端小程序的标准起点

| 项 | 值 |
|---|---|
| 评审对象 | `wxapp_admin_template`（HEAD `7eafb01`，全量，无 diff 基线） |
| 契约真源 | `go_project_template`（`README` / `internal/route/verification.go` / `internal/conf/err_code.go` / `enum_upload.go` / `internal/controllers/admin/init.go`） |
| 评审日期 | 2026-11-26 |
| 评审口径 | 只审不改；验证脚本放在 `/tmp`，未改动仓库内源码与配置 |
| 未执行项 | 微信开发者工具 / 真机 / 真实后端联调（本机不具备，不算缺陷，但列入 §6 风险） |

---

## 0. 结论与打分

### 0.1 结论摘要

1. **骨架成立，但还不能直接作为公司标准起点发版。** 请求链 / 登录态 / 权限菜单三块的核心设计是对的，且有大量「为什么这样」的注释，这是本模板最值钱的部分；但存在 **1 处架构红线、1 处生产鉴权旁路、2 处发布闸门失效、1 处自创上传契约**（§3.1 的 BLK-1…BLK-5）。
2. **与后端契约大体对齐**：`source=1001`、`edition=v1.0.0`、签名公式、请求头、`routeVersion=/v2`、统一响应、`40005/40102/40205/50008` 均与后端模板一致；但 **upload 的响应结构与错误码是前端单方面假设，且与 README 自相矛盾**，`edition` 失败码在 5 处文档里写成 `40107`（后端实际回 `40003`）。
3. **权限菜单机制本身可用**（本次用 esbuild 打包 `config/access.js + config/demo.js` 后 Node 断言：可见入口 2 个、隐藏入口不出现、子菜单 0/1/≥2 三态正确）；但 **「两道门」只在首页落地**，页面模板不带登录门 / 权限门，新项目照抄会默认绕过这块核心资产。
4. **`DEMO_MODE` 是有价值的设计**（无后端也能完整验证权限菜单），但当前是**硬编码常量 + 无发布闸门**：生产包只要漏改一行，绑定页「任意账号 + 6 位密码」即可进入，属于真实鉴权旁路。必须改成构建期开关并加发布检查。
5. **`.claude` 工程系统规则密度高、抽象层基本正确**，但语义漂移已经出现（`localhost:15200`、`BUG-00x` / `K-0x` 悬空引用、`modules/login` 不存在、`rule-style-css` 旧名）。`check_system.mjs` 覆盖不到这些，需要补「链接 / 陈旧值」检查。

### 0.2 评分表（1–5 分）

| # | 维度 | 分数 | 一句话理由 |
|---|---|---|---|
| 1 | 正确性 / 运行时 | **4** | 请求链、单飞重登、守卫、loading 引用计数实现扎实；边缘有 `useList` reload 丢弃、相对 URL、无 code 视为成功等小坑。 |
| 2 | 契约对齐 | **3** | 签名 / source / edition / 主要错误码对齐；upload 响应与错误码是自创，`40107` 文档错误，5800x 未标注为「新项目自定」。 |
| 3 | 权限菜单核心资产 | **4** | 机制正确且已断言验证；但只在首页接门，模板与示例页未覆盖，资产会被复制时降级。 |
| 4 | 分层与红线 | **3** | 存在真实反向依赖（`services/uploader → api/upload`）；`#ifdef` 散落在 session / env / platform 三处；`toQueryString` 造出被明令禁止的 `key[0]=`。 |
| 5 | 安全 | **3** | 密钥 / token / 手机号 / appid 卫生良好；但 `DEMO_MODE` 无发布闸门 = 生产可任意密码进入，`api/demo` 也会留在生产包里。 |
| 6 | 模板可用性 | **3** | `init.sh` 可用但会在 `dist/build` 留开发产物；页面模板缺两道门；演示内容无剥离脚本；首次接入的断点在 README 里未逐条覆盖。 |
| 7 | 工程系统自洽 | **3** | CLAUDE.md 规则可执行度较高，但文档引用与陈旧值已漂移；`check_system` 通过 ≠ 系统自洽。 |
| 8 | 依赖 / 构建 | **4** | 锁与包名一致、构建可通过、uview 整包未手改迹象；但 vendored 版本未登记，`region-code.js` 160KB 在主包。 |

**综合：约 3.4 / 5 —— 有条件通过。** 条件 = 修完 §3.1 的 5 个阻断项，并对 §8 的 4 个产品决策拍板。

### 0.3 阻断项索引

| ID | 阻断项 | 类型 | 级别 |
|---|---|---|---|
| BLK-1 | `services/uploader.js` 反向依赖 `api/upload` | 代码级 | 阻断 |
| BLK-2 | 页面模板 / 次级页缺「登录门 + 权限门」，且模板示范路径字面量 | 代码级（含 1 项需用户定） | 阻断 |
| BLK-3 | `DEMO_MODE` 硬编码 `true` + 无发布闸门 → 生产任意密码可进入 | 代码级 + 需用户定 | 阻断 |
| BLK-4 | 发布产物校验 grep `localhost:15200`，本仓实际是 `15000` → 闸门永不命中 | 代码级 | 阻断 |
| BLK-5 | 上传契约自创：响应 `data.urls[]` 与 README「只返回 url」矛盾；错误码 `60004` 与后端 `40203/40204` 不对应 | 代码级 + 需用户定（后端契约） | 阻断 |

---

## 1. 设计层：是否在解决正确的问题

### 1.1 模板边界：保留「请求链 / 登录态 / 权限菜单 / 上传 / 样式 / 工程系统」，剥离业务

**判断：切法基本正确，但有两处「该保留却被削薄」。**

| 保留项 | 评价 |
|---|---|
| 请求链（签名 / 单飞重登 / 错误归一 / 守卫） | ✅ 这是最难重建、最值得复制的资产，保留正确 |
| 登录态（微信静默 + 58001 分支 + 绑定页） | ✅ 设计成熟；但「两道门」未在页面层统一落地（BLK-2） |
| 权限菜单（`access.js` ∩ `permission`） | ✅ 方向正确；后端无账号体系时它只是「消费端」，生产端（管理员/角色/授权）全部缺失，README 已诚实说明 |
| 上传 | ⚠️ 只保留了「一个口 + 一个全局白名单」，后端 `AdminUploadTypes` 是**按类型分格式/限额**的，前端没有镜像这张表（SUG-2） |
| 样式三层 | ✅ 体系清楚；但 `pages.json` / `index.html` / `uni.scss` 仍是第二值源（SUG-8） |
| 工程系统 | ✅ 抽象层正确（rule 管用法、workflow 管顺序、agent 管职责）；但维护成本高，且已出现漂移（§3.7） |

**建议补回的两件通用能力：**

- **通用表单页骨架**：`rule-add-page` 自己承认「表单页还没有模板」（`.claude/skills/rule-add-page/SKILL.md:237`）。B 端一半页面是表单，`u-form` 三个坑只写在 skill 里，没有可 `cp` 的模板。建议补 `.claude/templates/page/page-form.vue`。
- **按类型收敛的上传定义**：见 SUG-2。

### 1.2 接入路径：clone → init.sh → 填占位 → 写业务

**第一次接入的人最可能卡在这几处：**

1. **`init.sh` 结束时会自动跑构建**（`init.sh:99-101`），产物落在 `dist/build/mp-weixin`（development 配置）。随后若直接上传该目录，就是「开发域名发生产」——正是 `.claude/checks/pre_release.md` 反复警告的坑，而该清单的 grep 端口还是错的（BLK-4）。
2. **没有「去演示化」步骤**：README 只说「删掉 `api/demo.js` 与演示页区块」，没有 `npm run strip-demo`，也没有发布闸门检查 `DEMO_MODE` / `pages/demo` 是否残留（BLK-3）。
3. **改名只覆盖项目名，不覆盖品牌名**：`init.sh` 全局替换 `wxapp_admin_template`，但 `APP_NAME='管理端模板'`、`pages.json` 的 7 个 `navigationBarTitleText`、`index.html` 的 `<title>`、`manifest.json` 的 `name/description` 都是另一组字面量。README 只把 `APP_NAME` 列进「按项目改」，没列 `pages.json` / `index.html`。建议在 README §1 加一条 `grep -rn '管理端模板'`。
4. **`.claude` 文档也在被 sed 替换**（`init.sh:56-71`），包括 `CLAUDE.md` 里的示例。这会把「模板」语境改成「项目」语境，属预期行为；但 `grep -q` 对二进制文件也可能命中（`src/static/loading.png` 也在 `git ls-files` 里），建议只扫文本扩展名或 `grep -I`。

**断点结论：** 能在 10 分钟内跑起来（依赖已装时），但「跑起来 → 能发版」之间缺一道自动化的去演示化 + 产物体检。

### 1.3 与后端模板的契约耦合：单一真相源是否成立

**成立的：**

- `source` / `edition` / `sign` / 请求头 / `routeVersion` / 统一响应 / `40005` / `40102` / `40205` / `50008` —— 与后端模板逐项一致（对照表见 §5）。
- `api/demo.js` 把「这是 C 端 source=1010 的自测接口，不是业务契约」写在文件头，诚实。

**不成立的：**

- **上传链路被描述成「已就绪」，实际上后端没有 `POST /admin/upload` 控制器**；响应结构 `data.urls[]` 只在 `src/services/uploader.js:281` 和 `src/api/upload.js:21` 出现，README 却写「后端只返回 url」（`README.md:235`）。这是本模板最明显的「用前端假设冒充契约」（BLK-5）。
- **`58001/58002/…/58006` 在后端 `err_code.go` 中不存在**（grep 全仓 0 命中）。`src/config/dict.js:26` 已注明「新项目自建 RBAC 时可直接沿用这组码」，这一点是诚实的；但 `.claude/CLAUDE.md:122,145` 把它们写成了既成事实，没有同样的限定（SUG-1）。
- **`edition` 失败码写错**：`src/config/app.js:10`、`.claude/memory/known_issues.md:21`、`.claude/QUICK_START.md:105`、`.claude/project-meta/modules/demo/api-demo.md:26`、`.claude/skills/rule-api-registry/SKILL.md:120` 五处写 `40107`；后端 `internal/route/verification.go` 的 `verification()` 对 `GetEdition(c)==0` 返回的是 `CodeValidationFailed(40003)`，`40107` 在 `err_code.go:33` 明确标为**预留号段**（SUG-3）。

### 1.4 `DEMO_MODE`：这是好设计吗？

**结论：设计有价值，当前实现不合格。**

价值：没有后端也能完整跑通「登录 → 权限菜单 → 页面准入 → 子菜单 0/1/≥2」，这是模板可演示、可验收的前提。如果没有演示模式，这套模板交付时连一张能看的首页都没有。

风险（按严重度）：

1. **生产鉴权旁路**：`src/config/app.js:68` 是硬编码 `export const DEMO_MODE = true`，`src/services/session.js:228-231` 的 `bindAdmin` 在演示模式下**任意非空账号 + 6 位密码直接成功**并写入演示会话。构建期没有任何机制阻止它被发到生产，发布清单也不检查它 → BLK-3。
2. **双轨维护**：`session` / `bind` / `home` 各有一处 `DEMO_MODE` 分支，未来改登录流程要记得改两遍。
3. **残留风险**：`pages/demo/*` 在 `pages.json` 里注册、`api/demo.js` 会随包构建、`config/demo.js` 会被打进产物；即使 `DEMO_MODE=false`，演示页仍可被路径直达（权限门会拦，但暴露面仍在）。
4. **误导**：`code===undefined` 视为成功等行为在演示链路里看不出来。

**替代方案对比：**

| 方案 | 优点 | 缺点 | 建议 |
|---|---|---|---|
| **A. 构建期开关（推荐）** `DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'`，`.env.development` 写 true，`.env.production` 不写 | 生产包不可能误开；与现有双分支代码兼容 | 仍需删除演示页 | ✅ 最小改动解决 BLK-3 |
| B. mock adapter（请求层可切换 mock 数据源） | 演示更真、可覆盖错误码 | 要把 mock 塞进请求链，复杂度高；离「模板」定位更远 | 不推荐一期做 |
| C. 独立 demo 分支 / 独立仓 | 生产包绝对干净 | 分支分叉后模板与演示会漂移，维护成本最高 | 不推荐 |
| D. 不内置演示 | 最干净 | 交付时无法演示，接入方第一小时体验最差 | 不推荐 |

**推荐落地顺序：A + 去演示化脚本 + 发布闸门**：新增 `npm run strip-demo`（删除 `pages/demo`、`config/demo.js`、`api/demo.js` 的请求示例区块并把 `DEMO_MODE` 改为 false），发布清单加两条 grep。

### 1.5 工程系统（`.claude`）：加速还是负担？

**判断：对「会用的人」是加速，对「新接手的人」是负担，但负担主要来自漂移而不是体量。**

- 规则**可执行度**总体高于常见模板：`red line` 能落到 grep（`pre_commit.md` A1–A7 都是真命令），`rule-layering` 的决策树能直接回答「放哪层」，`rule-request-chain` / `rule-session-guards` 与源码签名逐字对得上。
- 但**可验证性不足**：`check_system.mjs` 只查空文件、Agent 段落、YAML、reviewer 顺序、符号存在、路由一致、脏标记（`.claude/scripts/check_system.mjs:1-22`），查不到「文档引用的文件已删除」「示例里的端口是错的」「skill 声称的能力不存在」——而这三类恰好是本次发现的主要漂移。
- **抽象层问题**：`rule-performance` 声称「去重三件套从 `services/location.js` 与 `useList` 提炼」（`.claude/skills/rule-performance/SKILL.md:16-17`），但 `useList` 没有 SWR / 同 key 单飞 / 规范 key；同一文件还写「本工程只有 2 个页面」（现在 7 个）。skill 描述了不存在的能力，比没有 skill 更危险（SUG-6）。
- **建议**：不砍系统，给 `check_system` 加两项检查——(a) `.claude/**` 里出现的路径引用必须存在（排除 `versions/vN`、`__PLACEHOLDER__`）；(b) 全仓关键陈旧值黑名单（`15200`、`BUG-00[2-7]`、`K-0[1237]`、`rule-style-css`、`modules/login`）。这两项能把本次 80% 的文档漂移变成可自动发现。

### 1.6 产品判断：卖点应该是权限菜单，还是请求链 / 工程系统？

**建议的重心排序：请求链 + 登录/权限双门 > 权限菜单 > 工程系统。**

理由：

- 权限菜单的**机制**只有约 200 行（`access.js + pageAccess.js + useAdminHome.js`），复制成本低；它真正的价值是「约定」——而约定依赖后端下发 `permission`，后端模板现在没有账号体系。把它当第一卖点，用户接进来第一周就会撞上「后端没有登录接口」。
- 请求链 + 会话 + 守卫 + loading 引用计数 + 上传，是每个 B 端项目都要重写、且最难写对的部分（单飞重登、并发守卫去重、loading 最短停留），这才是「省一个月」的地方。
- 工程系统是差异化，但它是「使用方式」而不是「产品能力」，放在第三位。

**README 当前确实以请求链开篇（§3.1），但 §1 的定位句把「按权限点渲染的菜单机制」加粗了。** 建议保留，但把「已就绪 / 未就绪」写在同一行（权限菜单 = 消费端已就绪，生产端需自建）。

---

## 2. 架构层：结构是否撑得住演进

### 2.1 分层与依赖方向是否真的成立

**大部分成立，但有一处硬伤。**

- 注册模式用得对：`http/request.js` 只持有 `authHandler`，`services/session.js` 注册；`http/guard.js` 只查表，`services/guards.js` 注册。没有用动态 `import()` / `globalThis` 绕环。
- 依赖方向整体向下；`config` 不引业务、`utils` 无副作用。用脚本扫 `src/**` 的 `@/` 导入（排除注释示例）**未发现真实循环依赖**。
- **硬伤：`src/services/uploader.js:21` `import { uploadFile } from '@/api/upload'`。** 这直接违反 `.claude/CLAUDE.md:92`「禁止反向调用（`services` 不许 import `api`）」与 `:316` 红线第 2 条，也违反 `.claude/skills/rule-layering/SKILL.md` 的依赖图。`uploader` 是基础层，`api` 是它上面的接口层，方向反了（BLK-1）。
- 次要：`services/session.js:49-63` 的 `#ifdef`、`config/env.js:16-22` 与 `services/platform.js:12-18` 各自算一遍 runtime，条件编译并未真正「只收在 platform」（SUG-4）。

### 2.2 扩展点收敛度：改动面矩阵

| 目标 | 必须改的地方 | 处数 | 评价 |
|---|---|---|---|
| 新页面 | `config/access.js`（`PAGE_*` + `PAGES`，可选 `entries`）→ `pages.json` → 页面文件 → `config/endpoints.js` → `api/<域>.js` → `api/index.js` → `config/dict.js`（权限码） | 5–7 | 路径两处（access / pages.json）是有意的（pages.json 读不到 JS），`check_system` 的「路由一致性」已兜底 ✅ |
| 新业务模块 | 上面全部 + `HOME_ENTRIES` + `project-meta/modules/<m>/` 四件套 + `index.md` | 9–11 | 文档四件套是**唯一**偏重的地方；对模板是资产，对项目是负担 |
| 新接口 | `config/endpoints.js` → `api/<域>.js` → `api/index.js` | 3 | ✅ 单点收敛 |
| 新上传类型 | `config/dict.js` 加常量 + 后端 `conf.AdminUploadTypes` 加一行 | 2 | ⚠️ 若新类型格式/限额与全局白名单不同，还要改 `services/uploader.js:68-78` 与 `dict.js:78-80` → 实际 3–4 处（SUG-2） |
| 新权限码 | `config/dict.js` + `config/access.js`（入口 / `PAGES`）+ 后端角色授权数据 | 3 | ✅ 合理 |
| 新全局业务码 | `config/dict.js` + `services/guards.js` | 2 | ✅ 机制正确（页面零改动） |
| 换主色 | `theme.scss` + `config/theme.js` + `src/pages.json` 的 `#6D5BFF` / `#FAFAFE`（+ 可能的 `uni.scss`） | 3–4 | ❌ 与 CLAUDE.md「只改一个文件」不符（SUG-8） |
| 加 tabBar | `pages.json` + `services/route.js` 的 `TAB_PAGES` + 图标实体 | 3 | ✅ 已在注释里写明 |

**结论：** 单点收敛做得不错；主要漏点是「上传类型」和「主题色」这两处被声明为单点、实际不是。

### 2.3 状态与数据流：storage 真相源 / store 视图 / 权限快照 / listDirty

- **模型自洽**：storage 是唯一真相源，`store/user` 只是镜像（`src/store/user.js:1-44`），`useAdminHome` 每次 `load()` 重读（`src/composables/useAdminHome.js:80-86`），重新登录后 `syncUser` + 首页 `onShow` 重载，能收敛。
- **权限快照**：文档明确「最长 2h 才刷新、服务端才是防线」，页面必须处理 `40102`。这条口径在 `pageAccess.js:14-17`、`storage.js:74-79`、CLAUDE.md §3.3 三处一致 ✅。
- **但 `role_names` 的注释是错的**：`src/services/storage.js:34` 写「`role_names` 等首页才有的字段由首页接口现取，不入存储」，实际 `:42` 把整份 `admin_info` 存进 `userinfo`，首页 `src/pages/admin-home/index.vue:233` 正是从存储里读 `role_keys/role_names`。行为对、注释错（SUG-5）。
- **listDirty**：一次性标记 + 首次进页作废 + 只在写成功后标，语义正确（`src/services/listDirty.js` / `useList.js:118-139`）。
- **并发缺口**：`useList.reload()` 在 `loading=true` 时直接返回（`src/composables/useList.js:73-74,100-103`）。用户改了筛选条件立刻点搜索，若上一页请求还在飞，这次 reload 会被静默丢弃，列表停留在旧条件的数据上（SUG-7）。
- **登录门/权限门的覆盖缺口**见 BLK-2。

### 2.4 失败模型是否完整

| 场景 | 现状 | 评价 |
|---|---|---|
| 并发 40005 | `session.login()` 用 pending Promise 单飞；每个请求各自重放一次 | ✅ |
| 重登失败 | `resetUser()` + `clearSession()` + 不重放，抛 `auth` | ✅（注释解释了「只清响应式态会误判已登录」） |
| 登录接口自身 40005 | `authRetry:false` 防递归 | ✅ |
| 守卫并发 | busy + 1s 冷静期 | ✅ |
| 上传 40205 | 等待 3.2s 重试一次 | ✅ |
| 批量上传部分失败 | 保留已成功项、break、toast | ✅（文档已说明） |
| 响应没有 `code` 字段 | **视为成功并原样返回**（`request.js:141`） | ⚠️ 200 + HTML 错误页会被当成成功（SUG-9） |
| `pickPage` 永挂 | `onUnload` 补发放弃 + `route.to` 失败释放监听 | ✅（进程被杀时 inflight 会残留到下次启动，低频） |
| loading 卡死 | 引用计数 + 200/300ms 节奏 + `resetLoading` 兜底 | ✅ |
| 守卫弹窗无消费者 | 页面没挂 `<app-modal>` 时静默入队 | ❌ 示例页正踩这个坑（SUG-10） |

### 2.5 安全边界

- 前端权限只做体验层的前提，在 `pageAccess.js` / `storage.js` / CLAUDE.md 三处都写清楚了，页面示例也演示了 `40102` 就地处置 ✅。
- 密钥只在 `.env.*.local`，仓库内 0 命中；`dist/`、`unpackage/`、`.env.*.local`、`.idea/` 都在 `.gitignore` ✅。
- 手机号展示走 `maskMobile` ✅；密码默认密文且不泄露长度（`bind/index.vue:60-65`）✅。
- **不一致**：演示模式的鉴权旁路（BLK-3）；`api/demo` 在生产包里仍可达（SUG-11）；`VITE_MOCK_LOGIN_CODE` 只在注释里要求生产留空，代码没有硬护栏（SUG-12）。

### 2.6 可测试性

- 可自动验证的：构建（`verify:*` / `build:*`）、`.claude` 自检、模板语法审计、路由一致性、符号存在性。
- **本次额外验证**：演示模式权限菜单（esbuild 打包 + Node 断言，见 §6）。
- 不可自动验证的：真机签名、`wx.login`、守卫时序、MP 弹层是否被挤压、开发者工具首屏。
- **最大缺口**：请求链是最适合单测的部分（`error.js` / `sign.js` / `qs.js` 纯函数，`request.js` 可 mock transport），但仓库没有测试框架，模板自带的 vitest 用例无法执行。建议把「装 vitest + 4 个纯函数/请求策略测试」作为模板 v1.1 的验收项（需用户授权，见 §8）。

### 2.7 演进风险

| 变化 | 影响 | 风险 |
|---|---|---|
| uni-app / Vue 升级 | `@dcloudio/*` 已锁精确版本；升级要整体回归 | 中 |
| uview-plus 升级 | 整包替换；`scaffold.scss` 对 `.u-popup/.u-loadmore` 的 `flex:none !important` 与 `.u-datetime-picker` 修复可能失效 | 中 |
| `edition` 升级 | 前端一行 + 后端三环境 `EditionList` 同步；漏一处该环境全拒 | 低（已文档化） |
| 后端 `RouteVersion` 升级 | 前端 `app.js:16` 一行；后端权限表全表重写（后端约束） | 中 |
| 新增运行端 | `platform.js` 把非 H5/APP 一律当归 `mp`；`mp-alipay` 等无 `chooseMessageFile` / 胶囊 API，需要逐个能力探测 | 中 |
| 租户 / 多环境 | 当前 `source` 与 `VITE_HOST_*` 是单值；多租户要改 `env.js` + 签名 source 选择 | 中 |

### 2.8 架构决策逐条

| 决策 | 现状 | 判断 | 理由 | 代价 |
|---|---|---|---|---|
| 请求链唯一入口（`request + transport + error`） | 已实现 | **保留** | 两种 transport 同形状、错误归一、单飞重放都做对了 | 无 |
| 注册模式打破 http ↔ session | 已实现 | **保留** | 唯一合法解，注释也解释了代价（`main.js` 副作用 import） | 一个隐式依赖 |
| 权限菜单 = 本地配置 ∩ 登录快照 | 已实现 | **保留** | 后端加模块不白屏、权限决定显隐，方向正确 | 权限快照过期，需要 40102 兜底 |
| 页面准入集中在 `pageAccess` | 已实现 | **调整** | 判据收敛好，但只有首页接门；模板未带门 | 需要 `usePageGuard` + 全页接线 |
| `DEMO_MODE` 写进 `config/app.js` | 硬编码 true | **重设计** | 生产可误开 = 鉴权旁路 | 改 env 开关 + strip 脚本 |
| `storage` 真相源 + `store` 视图 | 已实现 | **保留** | 简单、无状态库依赖、跨端一致 | 手动 `syncUser` 易漏（已收敛在 session） |
| 跳页取值（`pickPage` + fieldEditor/regionPicker） | 已实现 | **保留** | 键盘/滚动问题的正确解法，且有在飞判重 | 依赖 `onUnload` 契约 |
| loading 引用计数 + 节奏 | 已实现 | **保留** | 并发/最短停留处理细致 | 需每页挂组件，否则降级原生 |
| uploader 放 services 且 import api | 已实现 | **重设计** | 违反自身分层红线 | 移动调用或下沉 curl |
| 上传格式/限额全局单值 | 已实现 | **调整** | 后端按类型分白名单，前端不跟随 | 需要镜像 `AdminUploadTypes` |
| `region-code.js` 160KB 在主包 | 已实现 | **调整** | 不用地区的项目也背 160KB | 移入分包 / 按需异步 |
| `.claude` 重系统（13 rule + 10 agent + 4 workflow） | 已实现 | **调整（需用户定）** | 规则有用，但漂移无自动化检查 | 维护成本；加 lint |
| uview 整包 vendored | 已实现 | **保留（补登记）** | 离线可构建、版本可控；但升级不可追溯 | README 记录版本 3.8.120 |

---

## 3. 实现层（按 8 个维度细查）

### 3.1 正确性 / 运行时

#### 阻断

**BLK-1 · `services/uploader.js` 反向依赖 `api/upload`（代码级）**

- 位置：`src/services/uploader.js:21`
- 为什么是问题：`CLAUDE.md:92` 与红线 `:316` 明确「`services/` 不许 import `api/`」；`rule-layering` 的依赖图也把 `api` 画在 `services` 之上。这不是风格问题，而是模板的自我一致性：用户照这份规则写业务，第一个反例就在基础设施里。
- 会导致什么：新项目会照抄「service 里直接 import api」；一旦 api 层开始依赖业务配置（域名、权限、字典），`services` 会被动依赖业务，分层名存实亡。
- 最小修法（二选一）：
  1. `services/uploader.js` 直接 `curl.upload({ filePath, name:'file', formData:{ type } }, ENDPOINT_ADMIN_UPLOAD, { toast:false, ... })`，`api/upload.js` 保留为「业务侧薄壳」（`export { pickAndUpload } from '@/services/uploader'`）；
  2. 或把 `uploader` 整体移到 `composables/useUploader.js`（它确实是「一个完整能力」），由页面/组件消费。推荐 1，改动最小。

**BLK-2 · 页面模板与次级页缺「两道门」（代码级；其中「是否每页都跑登录门」需用户定）**

- 位置：
  - `.claude/templates/page/page-list.vue`（全文件无 `requireAdminLogin` / `requirePageAccess`）
  - `.claude/templates/page/page-detail.vue`（同上）
  - `src/pages/demo/page-a.vue:87-90`、`src/pages/demo/page-b.vue:85-88`（只有权限门，没有登录门）
  - `src/pages/common/region-picker.vue`（两道门都没有）
- 为什么是问题：`CLAUDE.md:126-130` 把「登录门（onShow）→ 权限门（onLoad）」列为两道门，`rule-add-page:98` 也要求 `pageNeedsLogin + requireAdminLogin`；但全仓只有 `src/pages/admin-home/index.vue:251,273` 真正用了登录门，`pageNeedsLogin()` 的唯一消费者就是首页。页面模板是所有人 `cp` 的源头，漏门会被复制到每个新页面。
- 会导致什么：
  - 新页面默认**不做权限准入**：H5 深链 / 分享直达一个无权页面时，页面会先渲染再发请求，靠 40102 兜底（体验与安全都更差）；
  - 「登录门由 `PAGES.login` 决定」这条配置实际不生效，`login:false` 只是装饰。
- 最小修法：新增 `src/composables/usePageGuard.js`，把「onLoad 权限门 + onShow 登录门 + 失败态」收成一行：
  ```js
  usePageGuard({ path: PAGE_X, onDenied: () => {}, onReady: refreshAll });
  ```
  两个页面模板与所有 demo 页改用它；`region-picker` / `field-editor` 这类工具页显式 `login:false`（配置已有）也走同一入口。
- 附带（同一文件）：`page-list.vue` 的 `route.to('/pages/__DETAIL__/index')` 是**路径字面量**，违反「页面禁止路径字符串」。模板应示范 `PAGE_DETAIL`（从 `services/route` 转出）而不是让用户自己拼。

#### 建议

**SUG-7 · `useList` 在请求在飞时静默丢弃 reload（代码级）**

- `src/composables/useList.js:73-74` `if (loading.value) return;`；`reload()`（`:100-103`）直接调它。
- 会导致：筛选条件变化 / 点搜索时，如果上一页还在飞，这次操作无任何反馈，列表停在旧数据。
- 最小修法：`reload()` 置一个 `pendingReload` 标志，当前请求 `finally` 里若为真则再拉一次；或让 `fetchPage` 支持 `force`（旧请求结果丢弃）。

**SUG-9 · `request.js` 无 `code` 视为成功（代码级）**

- `src/services/http/request.js:141`：`body.code === undefined || null` → 返回 body。
- 会导致：后端 502/网关错误页返回 200 + HTML 时，页面拿到字符串当成功；`useList.defaultPick` 会把 `data` 当对象取，结果为空列表而不是错误态。
- 最小修法：仅当 `body` 是对象且 `code` 为 `undefined` 时按「非统一包装」放行；字符串 / HTML 一律按 `unknown` 抛 `ApiError`。

**SUG-13 · 相对 URL 在 `rootPath=''` 时缺前导斜杠（代码级，低）**

- `src/services/http/request.js:29-34`：`rootPath=''` → 拼出 `v2/admin/...`。README:40 明确支持「H5 同域留空走相对路径」。在 hash 路由 + 根部署下通常能解析对，但在 history 路由 / 子路径部署下会解析到页面目录下。
- 最小修法：`const base = rootPath || '/';` 或统一 `/${routeVersion}/${path}`。

**SUG-21 · 空白/异常响应与上传解析（代码级，低）**

- `transport.js:33-43` 的 upload `JSON.parse` 失败 → `reject(new Error('响应格式异常'))` → 被归一成 `network` → 页面提示「连接超时」，语义错。建议抛 `unknown` 并保留原文。

### 3.2 契约对齐

#### 阻断

**BLK-5 · 上传契约是前端单方面假设，且与 README 矛盾（代码级；响应结构需用户/后端拍板）**

- 位置：
  - `src/services/uploader.js:281-283` 读 `body.data.urls[0]`
  - `src/api/upload.js:21` 注释 `data.urls[0]`
  - `README.md:235` / `src/api/upload.js:8` 却写「后端只返回 url」
  - 错误码：`src/config/dict.js:83` `CODE_UPLOAD_INVALID = 60004`；`src/services/uploader.js:94-95` 把 `60004` 当「格式/大小不合法」、`40001` 当「类型未注册」
- 后端真源：`internal/conf/err_code.go:63-65` 定义 `40203 上传文件格式错误`、`40204 上传文件大小超限`、`40205 请求过于频繁`；`60004 文件上传失败` 是**通用**上传失败；`internal/conf/enum_upload.go:37` 的类型未注册文案是 `AdminUploadTypeMsg`（由未来控制器决定映射码）。后端模板**没有** `POST /admin/upload` 控制器，也没有 `urls` 数组响应（`post_policy.go:29` 是单个 `url` 字段）。
- 会导致什么：新项目按后端约定实现上传（返回 `{url: "..."}` 或 `{urls:[...]}` 由人拍），前端 `urls[0]` 可能永远 undefined → 上传成功却被判「没有返回文件地址」；`40203/40204` 不会命中友好文案，只会显示后端原始 msg。
- 最小修法：
  1. 在 README §5.3 写死响应契约（建议 `data: { urls: string[] }`，与前端现状一致），并注明「后端模板未实现，新项目必须按此返回」；
  2. `dict.js` 增加 `CODE_UPLOAD_FORMAT_INVALID=40203`、`CODE_UPLOAD_SIZE_INVALID=40204`，`uploader.js` 按 40203/40204/40205/40001/60004 分档；
  3. 对 `data.url`（单个）做兼容：`const urls = data.urls || (data.url ? [data.url] : [])`。

#### 建议

**SUG-1 · `58001/58004` 在 CLAUDE.md 中被当成后端契约（代码级 / 文档）**

- `.claude/CLAUDE.md:122`、`:145`；后端 `grep 5800x` 0 命中，账号体系需新项目自建。
- 最小修法：在 §3.3/§3.4 首次出现处加一句「5800x 为模板建议的新项目 RBAC 码，非后端模板既有契约」；`dict.js:26` 已有同样的限定，移过来即可。

**SUG-3 · `edition` 失败码写成 `40107`（代码级 / 文档）**

- 位置：`src/config/app.js:10`、`.claude/memory/known_issues.md:21`、`.claude/QUICK_START.md:105`、`.claude/project-meta/modules/demo/api-demo.md:26`、`.claude/skills/rule-api-registry/SKILL.md:120`。
- 后端 `verification.go` 对 edition 未登记返回 `40003` + `RequestFailTip`；`40107` 在 `err_code.go:33` 是预留号段。
- 最小修法：统一改成「`40003` + 文案 `Im Invalid Request!`」；`CODE_EDITION_INVALID=40107` 保留但注明「预留，当前后端不会返回」。

**SUG-16 · 上传格式/限额是全局单值，未镜像 `AdminUploadTypes`（代码级）**

- `src/services/uploader.js:68-78` 永远用 `UPLOAD_ALLOWED_EXTS`（jpg/jpeg/png/pdf）与 `UPLOAD_MAX_BYTES`（20MB）；`src/config/dict.js:78-80`。
- 后端 `enum_upload.go` 的类型定义含 `FormatList / MaxSize / MaxSizeTips / FormatTips`，不同业务类型可以不同（视频 100MB、证照 jpg/pdf）。
- 会导致：新增视频/压缩包类型时，前端在选文件前就把它拦掉（`chooseMessageFile` 的 `extension` 也只给 jpg/pdf）。
- 最小修法：在 `dict.js` 建 `UPLOAD_TYPE_DEFS = { demo_file: { exts, maxBytes, imagesOnly } }`，`uploader.pickAndUpload(type)` 按 type 取；缺省回落全局值。

### 3.3 权限菜单核心资产

**机制验证（本次实测）：**

- 打包 `config/access.js + config/demo.js` 后断言：可见入口 2 个（`DEMO_MANAGE`、`DEMO_SUBMENU`）、`DEMO_HIDDEN` 不出现、子菜单 childCount=2。
- 权限子集：`[]` → 入口消失；`[DEMO_PAGE_A]` → 直跳 `/pages/demo/page-a`；`[A,B]` → 弹层。
- `PAGES` 7 条准入码与 `pages.json` 7 页一一对应（`check_system` 也通过）。

**结论：机制本身没问题，问题在接线与示例。**

- **BLK-2** 已述：模板/次级页缺门。
- **SUG-14 · 隐藏入口示例会落到另一权限码的页面**：`src/config/access.js:141-149` 的 `DEMO_HIDDEN` 卡落点是 `PAGE_DEMO_A`，而 `PAGES[PAGE_DEMO_A]` 要 `DEMO_PAGE_A`（`:181`）。默认演示会话同时下发两个码，所以看起来正常；但如果用户按注释「只加 `PERM_DEMO_HIDDEN`」验证，会得到一张点了被退回的卡。建议把落点改成无门的工具页，或注释里说明需要同时下发 `DEMO_PAGE_A`。
- **SUG-10 · 示例页没有挂全局组件**：`src/pages/demo/list.vue`（唯一会发请求的示例页）、`page-a.vue`、`page-b.vue`、`common/region-picker.vue` 都没有 `<app-loading>` / `<app-modal>`。`demo/list` 调 `demoApi.list` 时若后端返回 `50008`，`guards.js` 会 `pushModal`，但本页没有消费者 → 弹窗不出现（直到进入挂了 `app-modal` 的页面才冒出）。这正好复现 `templates/page/README.md:33-34` 自己列的 BUG-003/004。建议给这 4 页补上（region-picker 可只补 modal）。

### 3.4 分层与红线

- **BLK-1**：反向依赖。
- **SUG-4 · `#ifdef` 未真正收口**：`src/services/session.js:49-63`（`getLoginCredential`）、`src/config/env.js:16-22`、`src/services/platform.js:12-18`。页面层确实 0 处（`pre_commit.md` A1 通过），但「端差异一律在 `services/platform.js`」的规则自己没做到。建议把 `getLoginCredential` 移到 `platform.js` 的 `getLoginCode()`；runtime 判定只留一处（需要解决 `platform → env` 的 `rootPath` 依赖，可把 `rootPath` 改成 `getRootPath(runtime)` 或新建 `services/runtime.js`）。
- **SUG-15 · `utils/qs.js` 制造被明令禁止的数组格式**：`src/utils/qs.js:21-34` 把数组序列化成 `key[0]=v1&key[1]=v2`；`src/services/http/index.js:29` 用它序列化**所有 POST body**。CLAUDE.md §3.2 明确「数组字段用 `joinIdsParam` 逗号串，禁止 `key[]=`」。开发者只要把数组直接传给 `curl.post`，就会得到后端 `40001`。建议：`toQueryString` 对数组直接 `join(',')`（与 `joinIdsParam` 同口径），或开发期抛错提示用 `joinIdsParam`。
- **SUG-8 · 主题色不是单点**：`src/pages.json:19,30,41,51,61,72,83,94` 硬编码 `#6D5BFF` / `#FAFAFE`；`src/uni.scss:21-37` 保留 uni-app 默认色板（`#007aff` 等）；`index.html:13` 标题。CLAUDE.md §3.5 与 theme.scss 头部都声称「只改一个文件 + theme.js 镜像」。最小修法：把 `pages.json` / `index.html` 加进「必须同步」列表（并给出 grep 命令），`uni.scss` 的 `$uni-color-*` 改为引用 theme token 或注明「仅框架兜底，勿用」。
- **类名撞 ColorUI**：全仓 grep 后只有 `.fr` 一处冲突，已在 `app-form-row` 的注释里记录 ✅。

### 3.5 安全

- **BLK-3 · `DEMO_MODE` 生产旁路（代码级 + 需用户定）**

  - 位置：`src/config/app.js:68`（硬编码 true）；`src/services/session.js:89,228-231`（演示登录/绑定直接成功）；`src/pages/bind/index.vue:73`（提示「任意账号 + 6 位以上密码即可进入」）。
  - 为什么是问题：`.env` 不能覆盖它；`.claude/checks/pre_release.md` 与 `release.yaml` 都没有 `DEMO_MODE` 检查（grep 全 `.claude` 仅在 CLAUDE/QUICK_START/context 的说明文字里出现）。一个团队 clone 模板、填完域名、直接 `build`，就会得到一个「任何人输入任意手机号 + 任意 6 位密码即可进入」的生产包。
  - 最小修法：
    1. `export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';`；`.env.development` 加 `VITE_DEMO_MODE=true`，`.env.production` 不写（默认 false）。
    2. 发布清单加硬闸门：`grep -rn "DEMO_MODE" dist/build/<端>/` 或直接 `grep -q "demo-token-not-a-real-one" dist/` 必须无命中；再加 `grep "VITE_DEMO_MODE=true" .env.production` 必须无命中。
    3. 绑定页在 `DEMO_MODE` 时显示醒目「演示模式」标记（已有）并在生产构建里由 tree-shaking 去掉整个 `config/demo.js`（改成动态分支或 `if (import.meta.env.DEV)`）。

- **SUG-11 · `api/demo.js` 会进生产包**：`src/api/demo.js` 被 `src/pages/demo/list.vue` 静态 import，页面在 `pages.json` 注册；即使 `DEMO_MODE=false`，路径仍可直达（权限门会拦，但暴露的是「用生产密钥打 `/web/demo/*`」的能力）。建议 strip 脚本一并删除，或在发布检查里 grep `pages/demo`。
- **SUG-12 · `VITE_MOCK_LOGIN_CODE` 缺硬护栏**：`src/config/env.js:53` 读取，`session.js:58-62` 在非微信端使用。生产 `.env.production` 注释掉了，但 `.env.production.local` 仍可设置。建议：`if (isProd && mockLoginCode) throw new Error(...)`（启动即失败），而不是依赖文档。
- **日志卫生**：`src/App.vue:9` 打印 `rootPath`（内网域名）——不是密钥，风险低；`src/services/uploader.js` 的错误日志都走 `errorBrief`（`utils/error.js`），没打印整包响应 ✅。
- **演示数据**：`src/config/demo.js:29-37` 的 token 是 `demo-token-not-a-real-one`、手机号 `13800000000`（保留测试号段）✅。

### 3.6 模板可用性

- **BLK-4 · 发布闸门 grep 错端口（代码级）**

  - 位置：`.claude/checks/pre_release.md:54,55,82,102`；`.claude/workflows/release.yaml:112,124,164`；`.claude/agents/debugger.md:68,83`；`.claude/agents/security_agent.md:58`；`.claude/skills/rule-testing/SKILL.md:72`；`.claude/skills/rule-security/SKILL.md:156`；`.claude/prompts/debug_request.md:78,153`；`.claude/prompts/task_opening.md:87`；`.claude/prompts/review_request.md:84`。
  - 本仓实际开发地址：`.env.development:7-8` = `http://localhost:15000/`。
  - 会导致：`verify:*` 产物的 host 是 `localhost:15000`，而发布清单 grep `localhost:15200` → **无输出 → 判定通过 → 开发包发生产**。这是清单自称「最不可省」的一步，却因数字写错而永久失效。
  - 最小修法：全仓 `15200 → 15000`（或更稳：grep `localhost` / `127.0.0.1`）；并把「产物 host 必须等于 `.env.production` 的 `VITE_HOST_MP`」写成一条可执行的 Node 脚本。
- **SUG-17 · `init.sh` 的自动构建会留下开发产物**：`init.sh:99-101`。建议删掉这一步（或构建到 `/tmp`），并在 README 的开箱步骤里明确「init 之后不要直接上传 `dist/build`」。
- **SUG-18 · `init.sh` 对二进制文件不设防**：`init.sh:66-71` 的 `grep -q` 对 PNG 也可能命中（`git ls-files` 含 `src/static/loading.png`），随后 `sed -i` 会破坏它。建议只处理文本扩展名，或用 `grep -Iq`。
- **SUG-19 · 演示模式的双轨维护**：见 §1.4；最小修法是「env 开关 + strip 脚本 + 发布闸门」，不建议上 mock adapter。
- **SUG-20 · 首次接入缺一张「去演示化清单」**：README §4 有 5 步，但没有覆盖 `pages/demo`、`pages.json`、`config/demo.js`、`PERM_DEMO_*` 的删除/替换；且 `config/access.js` 的 `DEMO_*` 常量与 `dict.js` 的 `PERM_DEMO_*` 是两处。建议加 `npm run strip-demo` 并在 README 第 1 节列出。

### 3.7 文档与工程系统自洽

`check_system.mjs` 与 `check_templates.mjs` 本次均通过（退出码 0），但它们覆盖不到语义漂移。已确认的漂移：

| 类型 | 位置 | 说明 |
|---|---|---|
| 指向已删除文件 | `.claude/skills/rule-session-guards/SKILL.md:3,12` | `project-meta/modules/login/business-logic.md` 不存在（只有 `modules/demo`） |
| 指向已删除文件 | `.claude/skills/rule-api-registry/SKILL.md:137`、`.claude/skills/rule-request-chain/SKILL.md:211` | `memory/api_conventions.md` 不存在 |
| 指向已删除文件 | `.claude/scripts/new_change_entry.mjs:228` | `memory/business_rules.md` 不存在 |
| 指向已删除文件 | `src/services/pageAccess.js:114` | `rules/architecture.md` 不存在（`.claude/rules/` 已迁走） |
| 悬空编号 | `.claude/checks/pre_release.md:7,19,164` | `BUG-005`、`K-02/K-03/K-07` 在 `memory/` 中不存在（只有 BUG-001/008、K-04/08/20/21/26/28/30/33/44/52/100/101） |
| 悬空编号 | `.claude/templates/page/README.md:33,34,80`、`.claude/skills/rule-add-page/SKILL.md:222,375,400`、`.claude/skills/rule-security/SKILL.md:131` | `BUG-003/004/007`、`K-07` 不存在 |
| 业务残留符号 | `.claude/skills/rule-session-guards/SKILL.md:37` | `PAGE_LEDGER_LIST`（台账模块已删） |
| 旧 skill 名 | `.claude/skills/rule-style-tokens/SKILL.md:244` | `rule-style-css`（C 端旧名） |
| 陈旧能力描述 | `.claude/skills/rule-performance/SKILL.md:16-17` | 声称去重三件套由 `useList` 提供，实际没有；且「本工程只有 2 个页面」已过时 |
| 自动索引缺失 | `.claude/CLAUDE.md:396` | 声称 `sync_claude_md.mjs --fix` 刷新文末自动索引，文件末尾没有 `AUTO-INDEX` 区块（脚本会追加，但当前状态是「说明与实体不一致」） |

**建议**：在 `check_system.mjs` 里加「路径引用存在性」与「陈旧值黑名单」两项（见 §1.5），把这类问题从「人工发现」变成「CI 发现」。

### 3.8 依赖 / 构建

- `package.json` 的 `name/version` 与 `package-lock.json` 一致（`wxapp_admin_template@1.0.0`，lockfileVersion 3）✅。
- `@dcloudio/*` 锁精确版本 `3.0.0-5020620260917001` ✅；`vue ^3.4.0` + `sass ^1.77`。
- `src/uni_modules/uview-plus` 版本 **3.8.120**（`package.json`），整包 vendored、4.7MB；仓库只有 1 个提交，**无法用 git 证明未被手改**，建议在 README 记录「上游版本 + 获取渠道 + 升级步骤」，发布前用上游包做一次 diff。
- `region-code.js` **161KB**，在主包（`src/config/region-code.js`），`known_issues.md` K-100 已登记。建议把 `pages/common/region-picker` + `region-code.js` 移入分包，或在不需要地区的项目里由 strip 脚本删除。
- `dist/` / `unpackage/` 已 gitignore，工作区 `git status` 干净 ✅。
- 无 `lint` / `format` / `test` 脚本；`dev:prod:*` 用于本机验证生产配置，设计合理。

---

## 4. 模板级问题 vs 示例级问题

**模板级（会被复制到每个新项目、放大）：**

- BLK-1 反向依赖（基础设施本身）
- BLK-2 页面模板缺两道门 + 模板示范路径字面量
- BLK-3 `DEMO_MODE` 设计
- BLK-4 发布闸门端口错误
- BLK-5 上传契约
- SUG-2 上传类型全局单值
- SUG-4 `#ifdef` 未真正收口
- SUG-8 主题色多值源
- SUG-15 `toQueryString` 数组格式
- SUG-7 `useList` reload 丢弃
- SUG-16 表单页无模板

**示例级（只影响 demo，可随 demo 删除）：**

- SUG-10 `pages/demo/*` 未挂 `<app-loading>/<app-modal>`
- SUG-14 隐藏入口落点需要另一个权限码
- SUG-11 `api/demo.js` 进生产包
- `app-bottom-bar`（0 消费）、`useServerClock`（0 消费）、`location`（预留）—— 建议在 README 标注「未使用，可删」

---

## 5. 契约对齐矩阵（前端 ↔ `go_project_template`）

| 项 | 前端位置 | 后端真源 | 结论 |
|---|---|---|---|
| `source` B 端小程序 = `1001` | `src/config/app.js:22` | `internal/conf/keys/keys.go`（`SourceWxAppAdmin`） | ✅ |
| `edition = v1.0.0` | `src/config/app.js:12` | `internal/conf/{local,develop,production}/config.go` `EditionList` | ✅ |
| edition 未登记的失败码 | `app.js:10` 等 5 处写 `40107` | `route/verification.go` → `40003`；`err_code.go:33` 40107 预留 | ❌ SUG-3 |
| 签名公式 | `src/services/http/sign.js:45` | `conf.SignTemplate = "Source=%s&TimeStamp=%d&Key=%s&Weight=%s"`；`fmt.Sprintf("%X", md5)` | ✅ |
| 签名头 `timestamp/sign/source/random/edition` | `sign.js:42-51` | `Verification.SignHeaders`（三环境一致） | ✅ |
| token / userid 头 | `sign.js:49-50` | `Verification.TokenHeaders`；`CacheFieldId` | ✅（占位 `token`/`userid` 会被后端判 40005，符合预期） |
| `routeVersion = v2` | `src/config/app.js:16` | `conf.RouteVersion = "/v2"` | ✅ |
| 统一响应 `{code,msg,data}`，`code=0` | `request.js:136-163` | `extend/response` | ✅ |
| `40005` 登录失效 | `request.js:143-150` | `CodeTokenExpired = 40005` | ✅ |
| `40102` 无权限、且不进全局守卫 | `dict.js:22`；`guards.js` 未登记 | `CodeForbidden = 40102` | ✅（与审核口径一致） |
| `40205` 频控 | `dict.js:24`、`uploader.js:93` | `CodeRateLimit = 40205` | ✅ |
| `50008` 账号禁用 | `dict.js:41`、`guards.js:32` | `CodeAccountDisabled = 50008` | ✅ |
| `60003` 微信侧失败 | `dict.js:43`、`session.js:94-96` | `CodeThirdPartyError = 60003` | ✅（语义借用，可接受） |
| `58001/58002/58003/58004/58005/58006` | `dict.js:28-41` | **后端不存在** | ⚠️ 新项目自定义；`dict.js` 已标注，CLAUDE.md 未标注（SUG-1） |
| 登录 / 绑定路径 `admin/login/*` | `endpoints.js:18-21` | 后端**未实现**，但 `mvc.go:48` 预留了 adminlogin 分组与中间件 | ✅ 诚实（README §5.2 说明自建） |
| 上传路径 `admin/upload` | `endpoints.js:28` | 后端**未实现**；`enum_upload.go` 只有类型注册表与 helper | ⚠️ 建议路径，非契约 |
| 上传响应 `data.urls[]` | `uploader.js:281`、`api/upload.js:21` | 无；`post_policy.go:29` 是单个 `url` | ❌ BLK-5 |
| 上传错误码 `60004`=格式/大小、`40001`=类型未注册 | `dict.js:83`、`uploader.js:94-95` | `40203` 格式 / `40204` 大小 / `40205` 频控 / `60004` 通用失败 / `AdminUploadTypeMsg` 类型未注册 | ❌ BLK-5 |
| 上传类型键 `demo_file` | `dict.js:76` | `enum_upload.go` `AdminUploadTypeDemoFile`，格式 `.jpg/.jpeg/.png/.pdf`、20MB | ✅（恰好一致） |
| `develop` 旁路 | `env.js:49`、`sign.js:54` | `Verification.DevelopBypass`：local/develop=true，production=false | ✅ |
| token TTL 7200s | 无前端假设 | `RedisTokenExp = 7200` | ✅ |
| RBAC 逐路径（完整 `/v2/...`） | 前端不参与 | `AuthApiVerification` 用 `c.Path()` 逐字比对 | ✅（文档需提醒：新增接口必须登记权限表） |
| `admin/utils/*` 免权限 | 前端不参与 | `conf.AdminUtilsPathPrefix` | ✅（README/CLAUDE 可补一句，避免新项目把写接口放进去） |

---

## 6. 验证建议

### 6.1 本次已执行的验证（只读 / /tmp）

| 项 | 方法 | 结果 |
|---|---|---|
| `.claude` 系统自检 | `node .claude/scripts/check_system.mjs` | ✅ 通过（82 文件 / 10 agents / 4 workflows / 7 页路由一致） |
| 模板语法审计 | `node .claude/scripts/check_templates.mjs` | ✅ 21 个 `.vue` 注释闭合与节点数正常 |
| 演示模式权限菜单 | esbuild 打包 `config/access.js + demo.js` → Node 断言 | ✅ 可见 2 入口、隐藏不出现、子菜单 0/1/≥2 正确 |
| 分层扫描 | grep `services → api`、页面路径字面量、直读写 storage、页面 `#ifdef` | ❌ 命中 1 处反向依赖；其余为 0 |
| 循环依赖 | 脚本扫 `src/**` 的 `@/` 导入 | ✅ 未发现真实环（注释里的 import 示例会误报） |
| 占位 / 密钥 / 域名 / appid | 全仓 grep | ✅ 仅 `REPLACE_*` 与 `localhost:15000`，无真实域名/密钥 |
| 构建 / 真机 | 未执行（本轮评审不跑构建，遵循红线 13） | — |

### 6.2 建议补的自动化（按 ROI 排序）

1. **`scripts/check_release_artifact.mjs`**：读 `.env.production` 的 host，检查 `dist/build/<端>` 里是否出现 `localhost` / `REPLACE_` / 开发 host，并检查 `DEMO_MODE` / `demo-token-not-a-real-one`。这是 BLK-3/BLK-4 的永久解。
2. **`scripts/check_permission_menu.mjs`**：把本次的 esbuild + 断言固化成脚本，纳入 `check_system`。否则「权限菜单可用」永远只能口头声明。
3. **vitest + 4 个测试**：`utils/qs.js`（数组格式）、`services/http/sign.js`（公式/大写字）、`services/http/error.js`（归一）、`request.js`（mock transport：40005 单飞重放 / guard 短路 / 无 code 行为）。请求链是最值得单测的部分。
4. **`.claude` 引用检查**：见 §3.7。
5. **真机清单**：K-08（u-popup flex 在 MP 是否命中）、K-21（冷启动跳页）、隐私协议（相册/摄像头）、上传真机。这些只能人工，但应写进 `checks/pre_release.md` 而不是散落在 `known_issues`。

---

## 7. 如果我接手：前两周路线

### 第 1 周（把「不能发版」变成「能发版」）

| 优先级 | 动作 | 对应 |
|---|---|---|
| P0 | 修 `services/uploader` 反向依赖（下沉 `curl.upload` 或移到 composable） | BLK-1 |
| P0 | 新增 `usePageGuard`，接进两个页面模板 + 所有 demo 页 + 工具页；模板改用 `PAGE_*` 常量 | BLK-2 |
| P0 | `DEMO_MODE` 改 `import.meta.env.VITE_DEMO_MODE`；`.env.development` 写 true；发布清单加两条 hard gate | BLK-3 |
| P0 | 全仓 `15200 → 15000`，并把产物校验改成「host 必须等于 `VITE_HOST_MP`」的脚本 | BLK-4 |
| P0 | 与后端拍定上传响应（建议 `data.urls: string[]`）与错误码（40203/40204/40205/60004）；前端加兼容与分档 | BLK-5 |
| P1 | 新增 `npm run strip-demo`（删 demo 页/会话/自测 api + 关 DEMO_MODE），写进 README §1 | SUG-19/20 |
| P1 | `check_system` 加「路径引用存在性 + 陈旧值黑名单」 | SUG-6/§3.7 |
| P2 | 补 `page-form.vue` 模板 | SUG-16 |

### 第 2 周（把「能发版」变成「敢当标准」）

| 优先级 | 动作 | 对应 |
|---|---|---|
| P1 | 固化 `check_permission_menu.mjs` + 接入 `check_system` | §6.2 |
| P1 | 装 vitest（需用户授权），补 `qs/sign/error/request` 四个测试 | §2.6 |
| P1 | `useList` reload 排队；`request` 无 code 不再当成功；相对 URL 补 `/` | SUG-7/9/13 |
| P2 | 上传类型定义镜像后端 `AdminUploadTypes`（exts/maxBytes/imagesOnly） | SUG-2 |
| P2 | `region-code.js` + region-picker 移入分包 | K-100 |
| P2 | 主题色多值源：pages.json/index.html 进同步清单；uni.scss 去默认色 | SUG-8 |
| P2 | 记录 uview-plus 上游版本与升级流程；发布前 diff 一次 | §3.8 |
| P3 | 清理 `.claude` 悬空引用与 `rule-performance` 的过时能力描述 | §3.7 |

---

## 8. 需要用户拍板（不替用户做产品决策）

1. **`DEMO_MODE` 的最终形态**：接受「env 开关 + strip 脚本 + 发布闸门」（推荐），还是要求「生产包物理不含 demo（分包/独立分支）」？后者更干净，但会带来分支/构建复杂度。
2. **页面治理模型**：是否要求**每个页面**都在 `onShow` 跑登录门（更强的可控性，但每页多一次 `await`），还是接受「首页登录 + 请求层自动补会话」（现状，少一扇门但更省事）？这决定 `usePageGuard` 的默认值。
3. **上传契约**：响应用 `{ urls: string[] }` 还是 `{ url: string }`？错误码是否统一按后端 `40203/40204/40205/60004`？这需要后端负责人一起定。
4. **5800x 账号体系码**：是否作为公司标准码表固化（后端 `err_code.go` 也登记），还是每个项目自选？如果固化，应写进后端模板而不是只写在前端 dict。
5. **`.claude` 工程系统的体量**：作为公司标准保留全套（13 rule + 10 agent + 4 workflow + project-meta），还是提供「lite 版」？保留全套的代价是每个项目都要维护文档漂移。
6. **主包体积**：`region-code.js` 160KB 是否接受？不接受就进分包/按需。
7. **tabBar / 导航结构**：模板当前没有 tabBar。作为公司 B 端标准，是否应该带一个「工作台 / 消息 / 我的」骨架？这是产品形态决策。
8. **测试框架**：是否允许模板默认安装 vitest（会打破「默认不装依赖」的红线 13 的字面执行，但换来请求链可回归）？

---

## 9. 结论

**有条件通过。** 设计与核心机制（请求链、登录态、权限菜单、守卫、loading、跳页取值）达到「可以作为标准起点」的水准，且注释质量明显高于常见模板；但 **5 个阻断项**分别命中架构红线（BLK-1）、核心资产接线（BLK-2）、生产鉴权（BLK-3）、发布安全（BLK-4）、契约诚实性（BLK-5），在这些修完之前不建议对外宣称「可直接作为公司 B 端小程序标准起点」。

修完 BLK-1…BLK-5 + 跑通 §6.2 的 1/2 两项自动化后，可复评为**通过**。