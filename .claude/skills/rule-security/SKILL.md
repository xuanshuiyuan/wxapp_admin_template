---
name: rule-security
description: 当代码涉及密钥、用户敏感信息（手机号/token/openid）、鉴权判断、支付/退款类流程、或需要发布产物时使用。也用于审查某段改动有没有引入安全风险。提供本工程的安全约定与红线，不涉及业务逻辑判断。
---

# rule-security

本工程的安全约定。**先记住这条前提**：

> ⚠️ **前端产物是公开的。** 小程序包可被解包，H5 的 JS 可被读取。
> 因此 `VITE_API_KEY` 进产物是**必然的**（`sign` 需要它），**真正的安全边界在后端**。
> 本规则的目标**不是**「让密钥不可见」（做不到），而是：
> ① 密钥不进 git ② 密钥不硬编码在 `src/` ③ 不制造额外的泄漏面 ④ 后端承担真正的鉴权。

## 密钥与凭证

| 内容 | 位置 | 进 git |
|---|---|---|
| `VITE_API_KEY`（请求签名密钥） | `.env.development.local` / `.env.production.local` | ❌ **禁止** |
| host 配置（`VITE_HOST_*`） | `.env.development` / `.env.production` | ✅ |
| appid / 平台配置 | `src/manifest.json` | ✅ |

**强制**：
1. ❌ 密钥值不写进 `src/` 任何文件（含注释、测试、mock）
2. ❌ 不写进 `.env.development` / `.env.production`（这两个进 git）
3. ❌ 不提交 `.env.*.local`，不复制进 `dist/`，不贴进 issue/日志/截图
4. ❌ 不 `console.log(apiKey)`，不打印请求 header 全文
5. ⚠️ 换机器 / 他人 clone **必须另行向后端领取**（已知的接手阻塞点）

**泄漏处置**：⚠️ **若密钥已进 git 历史，「删掉那一行」是不够的** ——
历史仍在。**必须通知后端轮换密钥**（唯一彻底的解法）。

```bash
grep -rn "VITE_API_KEY\|apiKey" src/ --include=*.js --include=*.vue   # 应为空
git check-ignore -v .env.production.local                            # 应显示被忽略
git log --all --full-history -- .env.production.local                 # 应为空
```

## 敏感信息

| 类别 | 字段 | 规则 |
|---|---|---|
| 会话凭证 | `token` | ❌ 不渲染原文（只显示「已获取 / 未获取」）；❌ 不进日志/埋点 |
| 用户标识 | `openid` / `user_id` | 可展示，❌ 不进对外日志 |
| 联系方式 | `mobile` | **必须脱敏**：只保留前 3 后 4；长度 <7 一律全星号 |
| 内部结构 | 堆栈 / SQL / 表名 / 文件路径 | ❌ 不出现在 `msg` 里（`msg` 是**面向用户**的） |

**参考实现**：`src/pages/admin-home/index.vue` 的 `maskMobile` 与「令牌只显示已获取/未获取」。

> ★ **例外必须登记**：确实需要明文展示手机号 / 车牌 / 证件号的页面，在本 skill 加一条
> （页面路径 + 字段 + 为什么必须明文 + 后端契约依据），并在代码注释里指向本条。
> 审查时**登记过的例外不算遗漏**，也不要「修掉」它 —— 服务端按角色脱敏的值，
> 前端**不要二次脱敏**（会废掉有权限角色的业务能力）。
> 当前模板**没有例外**（业务页面已剥离）；新项目按上述方式登记。

**`ApiError` 的设计已区分**：`message`（给用户）与 `raw`（给排查）—— 技术细节放 `raw`。

## 鉴权闸口

⚠️ **管理端没有「未绑手机号」这道硬闸口**（C 端那套 `auth.CheckUser` → `50011` →
`ensurePhoneBound()` 前置检查**在本工程不存在**，契约里没有这个码，`ensurePhoneBound` /
`promptBindPhone` 两个方法已删）。

**本工程实际的准入分三层**：

| 层 | 判据 | 前端应对 |
|---|---|---|
| **登录门** | 本地有没有 token（`sessionReady()` 同步判 / `requireAdminLogin()` 走网络） | 未登录先**微信静默**登录一次；失败按原因分流 —— 未绑定（`58001`）跳绑定页，其余留在本页给重试 |
| **权限门** | 会话里的权限点 —— 页面 `onLoad` 走 `services/pageAccess.js` 的 `requirePageAccess(path, query)`（内部复用 `session.requirePermissions`），页内 tab/按钮走同文件的 `byPermission` | ⚠️ **只是体验层**：权限点是**登录时快照**（最长 2h 才刷新）；清单在 `config/access.js` |
| **接口级（真防线）** | 服务端各自校验权限点 | **必须**处理 `40102`（就地提示 / 置灰 / 无权限空态，**不自动重试**） |
| **账号态（必须找管理员）** | `50008` 账号禁用 / `58004` 未配角色 | 全局守卫弹框（见 `rule-session-guards`），页面 `catch` 到 `type==='guard'` 直接忽略 |

⚠️ **接口会回哪些码以「后端实现 + 真机」为准** —— 契约错误码表不全，**不确定必须问后端**
（禁止凭印象编造码值，`rules/security.md` 红线 11）。

## 全局守卫的豁免开关（重点）

`guard: false` 是**豁免全局安全动作**的开关，**必须逐点评估**：

| ✅ 合法 | 理由 |
|---|---|
| 守卫目标页自己的接口 | 否则弹框与页面自身逻辑打架 |
| **失败即隐藏的装饰位模块** | 它**有能力弹阻断框**，不该有 |

| ❌ 非法 | 后果 |
|---|---|
| 为了「别弹框打扰我」而全局加 | **绕过了登录态/账号态检查** = 安全缺陷（阻断项） |
| 在登录态相关接口上豁免 | 同上 |

（机制细节见 `rule-session-guards`）

## 会话安全

| 项 | 规则 |
|---|---|
| 登录态真相源 | `services/storage.js`（唯一入口），❌ 禁止直读写 `uni.getStorageSync` |
| 存储 key 前缀 | ⚠️ **必须与同一产品线的其它端不同**（模板为 `wxapp_admin_template_`）—— H5 同域部署共用 `localStorage`，撞前缀会**互相串登录态** |
| 会话字段 | `SESSION_FIELDS` 白名单，白名单外**不进**会话存储 |
| 重登 | **单飞**（并发只真登录一次）；失败 `resetUser()` + 返回 `false`（**安全退化**） |
| 登出 | `clearSession()` + `resetUser()` —— **两者都要**，只清一个会留脏态 |
| 登录/绑定接口 | ❌ **必须** `authRetry: false`（否则递归登录） |
| 重放 | 只允许**重放一次**（防死循环） |

## 注入与输入污染

| 风险 | 防线 |
|---|---|
| URL 参数注入 | `request.js` 的 `buildURL` 对 key/value **都** `encodeURIComponent` —— ❌ 别自己拼 query |
| 路径注入 | endpoints 是**常量** —— ❌ 别用用户输入拼接口路径 |
| XSS | Vue 模板默认转义 —— ⚠️ ❌ 禁止 `v-html` 渲染用户输入（H5 端有 XSS 面） |
| 后端注入（后端栈） | **必须**参数化查询，❌ 禁止拼 SQL / shell |

## 依赖与供应链

1. ❌ **不擅自引入新依赖**（本工程 `dependencies` 仅 `vue` + `blueimp-md5`）。需引入时上报用户决策。
2. ❌ **手改 `src/uni_modules/uview-plus/`** —— 第三方整包。危害有二：升级即丢改动；
   且绕过正常依赖审计（**可被植入**）。
3. ✅ `package-lock.json` 必须提交。

## 发布产物

```bash
grep -rn "localhost:15000" dist/build/<端>/    # ★ 应为空（防把开发包发到生产）
grep -rn "VITE_API_KEY" dist/build/<端>/       # 应为空
git status --porcelain | grep -E "\.env\.|dist/|unpackage/"   # 应为空
cat dist/build/mp-weixin/project.config.json | grep -i appid  # 应为项目自己的 appid（不是 REPLACE_WX_APPID）
```

⚠️ 本工程 `services/session.js` 有 `VITE_MOCK_LOGIN_CODE` 联调通道（**只对非微信端生效**）——
**它依赖后端仅在 local/develop 生效。前端不可假设后端一定关着它。**
**发布前必须与后端确认该通道在生产无效**（`src/config/env.js` 已有启动硬护栏，后端仍需拒绝该通道）。

❌ **不改 `manifest.json` 的 appid**。

## 安全审查触发条件

以下改动**必须**经安全审查：

- 登录 / 会话 / 重登 / 登出 · 请求链路（`services/http/`） · 全局守卫（`services/guards.js`）
- 密钥 / 环境变量 / `.env.*` · 用户数据展示（手机号 / token / openid）
- 新增接口调用（闸口类型判定） · 发布前（强制） · 新依赖引入

## 硬性禁令（MUST / MUST NOT）

> **本节是本主题 MUST / MUST NOT 的唯一权威。**

1. ❌ 密钥写进 `src/`、进 git、进日志、进产物文本
2. ❌ token / 完整手机号被渲染、被打印、被上报
   （**已登记的例外**见上文「敏感信息」—— 不要当违规，改回脱敏前先改规则）
3. ❌ 登录/绑定接口漏 `authRetry: false`
4. ❌ 滥用 `guard: false` 绕过安全动作
5. ❌ 绕过 `services/storage.js` 直读写存储
6. ❌ 改存储 key 前缀不评估与同域其它端撞前缀
7. ❌ 用用户输入拼接口路径 / 自己拼 query
8. ❌ `v-html` 渲染用户输入
9. ❌ 发布产物含 `localhost:15000` 或密钥明文
10. ❌ 手改 `src/uni_modules/`
11. ❌ 错误 `msg` 里含堆栈 / SQL / 表名

## 补充硬约束（2026-11-16 从 `rules/security.md` 迁入）

### 敏感信息

- **车牌 / VIN 默认脱敏**；若业务确实需要完整值（如运营反查），按上面的「例外登记」办。
- ⚠️ **对公联系电话 ≠ 个人手机号**：企业联系人是 ≤16 位的公开号码时，
  按 `mobile` 规则「修掉」会毁掉正常展示；是否属于个人数据以业务口径为准，不确定就问。
- 截图 / 录屏 / issue 里出现真实用户数据前**必须打码** —— 这些媒介绕过代码里的脱敏实现，泄漏面同样真实。

### 密钥泄漏的处置（三步）

① **通知后端轮换密钥（唯一彻底的解法）** ② 前端更新 `.env.*.local` ③ 视需要 `git filter-repo` 清历史。
⚠️ **轮换才是必须的，清历史只是收尾** —— 只删掉那一行，历史仍然在。

### 鉴权闸口

- **公开接口不必加前置检查** —— 加了只是多一次请求，闸口由后端判。

### 依赖与供应链

- 新增依赖前先评估「**是不是几行代码就能解决**」—— 本工程倾向零依赖，能自己写就不引包。

### 提交前自查命令

```bash
grep -rn "console\.\(log\|warn\|error\)" src/ | grep -iE "token|mobile|phone|key|header"   # 应为空
grep -rn "v-html" src/        # 用户输入渲染面（H5 有 XSS）
grep -rn "http://" src/       # 生产地址应走环境配置
```

## 来源

> ★ **2026-11-16：`.claude/rules/` 目录已删除** —— 其硬约束已全量迁入各 rule-skill（删前逐条审计过缺口，共补 28 条）。
> 下文出现的 `.claude/rules/xxx.md` 是**历史出处**，不是可读路径；需要规则正文时就地看本 skill。


> 来源：源工程 `.claude/rules/security.md`（已随 rules 目录迁入本 skill）。
> 最后同步 2026-11-26（随业务剥离清理登记例外与项目路径）。