# checks/pre_commit.md — 提交前检查清单

> **用法**：改完代码、提交之前逐条过。**可以在 Claude Code 里直接说
> 「按 `.claude/checks/pre_commit.md` 自查」**，让它逐条跑并报告。
>
> 大部分项目**可自动化**（下面的命令是只读的，随时可跑）。
> 少数需要人判断的标了 👁️。

---

## A. 红线自查（`.claude/CLAUDE.md` §9，18 条）

### 可自动化（跑命令）

```bash
# A1. 页面里禁止 #ifdef（端差异必须收进 services/platform.js）
grep -rn "#ifdef\|#ifndef" src/pages src/components
# → 期望：无输出

# A2. 密钥不得出现在 src/
grep -rn "VITE_API_KEY\|apiKey" src/ --include=*.js --include=*.vue
# → 期望：无输出（config/env.js 读取 import.meta.env 是合法的，会命中 apiKey 变量名，需人工确认）

# A3. 不得绕过存储层
grep -rn "getStorageSync\|setStorageSync\|removeStorageSync" src/ | grep -v "services/storage.js"
# → 期望：无输出

# A4. 不得绕过 http 层
grep -rn "uni\.request\|uni\.uploadFile" src/ | grep -v "services/http/transport.js"
# → 期望：无输出

# A5. 敏感信息不得进日志
grep -rn "console\.\(log\|warn\|error\)" src/ | grep -iE "token|mobile|phone|apiKey|header"
# → 期望：无输出

# A6. 不得手改第三方整包
git status --porcelain | grep "src/uni_modules/"
# → 期望：无输出

# A7. 不得提交密钥/产物/编辑器目录
git status --porcelain | grep -E "\.env\.|dist/|unpackage/|\.idea/"
# → 期望：无输出

# A8. 明文 http
grep -rn "http://" src/
# → 期望：无输出（localhost 调试字样也不应有）

# A9. 不得用 v-html 渲染用户输入
grep -rn "v-html" src/
# → 期望：无输出

# A10. guard:false 的使用点（逐个评估合法性，见 B4）
grep -rn "guard:\s*false" src/
```

### 需人工判断 👁️

| # | 检查 | 判定 |
|---|---|---|
| A11 | 登录/绑定接口是否都传了 `authRetry: false` | 漏传 → 递归登录 |
| A12 | 每个 `guard: false` 是否属于两种合法用途（守卫目标页自己的接口 / 失败即隐藏的装饰位模块） | 滥用 → 绕过安全动作 |
| A13 | 手机号展示是否脱敏（参考 `admin-home` 的 `maskMobile`） | 未脱敏 → 阻断 |
| A14 | token 是否只显示「已获取 / 未获取」（不渲染原文） | 渲染原文 → 阻断 |
| A15 | 新页面是否已登记 `src/pages.json`；若加 tabBar 是否同步 `services/route.js` 的 `TAB_PAGES` | 漏 → 跳页失败 |
| A16 | 是否手改了 `src/uni_modules/uview-plus/` | 手改 → 升级即丢 |

---

## B. 架构自查（`.claude/skills/rule-layering/`）

### 可自动化

```bash
# B1. 页面/组件里是否有接口路径字符串（应走 endpoints.js）
grep -rnE "['\"](admin|utils)/[a-z_/]+['\"]" src/pages src/components
# → 期望：无输出

# B2. 页面/组件是否直接调 curl（应走 @/api）
grep -rn "curl\.\|@/services/http" src/pages src/components
# → 期望：无输出

# B3. 硬编码色值（样式值应走 theme.scss）
grep -rnE "#[0-9a-fA-F]{3,8}\b" src/pages src/components
# → 期望：无输出（.vue 的 <style> 里不应出现字面色值）

# B4. 手写 env(safe-area-inset-*)
grep -rn "safe-area-inset" src/pages src/components
# → 期望：无输出（应用 $safe-bottom / $safe-top）

# B5. 常量字面量（错误码应在 config/dict.js）
grep -rnE "\b(40005|40102|50008|5800[1-6]|60003)\b" src/pages src/components
# → 期望：无输出
```

### 需人工判断 👁️

| # | 检查 | 判定 |
|---|---|---|
| B6 | **业务逻辑是否漏进页面/组件**（校验规则 / 状态机 / 计算规则 / 权限判定） | 有 → 阻断（红线第 1 条） |
| B7 | 依赖方向是否只向下；有无反向依赖或同级循环 | 有环 → 必须用注册模式，不可用动态 import |
| B8 | 是否重造了已有能力（`useList` / `useModal` / `usePullRefresh` / `platform` / `storage` / `toast` / `endpoints` / `dict`） | 重造 → 阻断 |
| B9 | 同一能力是否出现 ≥3 次重复 | 是 → 必须抽取 |
| B10 | 是否 catch 后静默吞异常（`return null` / `{}` / 空 catch） | 是 → 阻断 |
| B11 | 每页是否挂了不带 `show` 的 `<app-loading>` 与一个 `<app-modal>` | 漏 → 静默降级 / 弹窗不弹（BUG-003/004） |
| B12 | 是否改了 C 端共用目录（`services/` `composables/` `utils/` `components/app-*` `common/css/` `styles/`） | 改了 → 已评估是否需双向下发？ |
| B13 | 列表页能进子页改数据时，是否接 `refreshOnReturn` + `dirtyKey`，且子页**写成功后** `markListDirty` | 漏标脏 → 返回吃旧快照；无条件 reload → 列表整体替换闪一下（v1.2.2 口径）。结构级部分已由 `check_system.mjs` 第 ⑨ 条拦截，「写成功后」这一步仍需人工看 |
| B14 | 是否在页面里自己补 loading 延时 / 最短驻留（`setTimeout` 包 `showLoading` 等） | 有 → 阻断：上屏节奏统一在 `services/toast.js`（延迟 200ms / 最短 300ms） |

---

## C. 风格自查（`.claude/skills/rule-coding-basics/`）

### 可自动化

```bash
# C1. 是否混用了空格缩进（现网全 Tab）
grep -rnP "^    " src/ --include=*.js --include=*.vue | grep -v node_modules | grep -v uni_modules
# → 期望：无输出

# C2. 双引号（现网单引号）
grep -rnE '^\s*(import|export).*"' src/ --include=*.js | grep -v uni_modules
# → 期望：无输出

# C3. 调试残留
grep -rn "console\.log\|debugger" src/ --include=*.js --include=*.vue | grep -v uni_modules
# → 期望：无输出（关键路径的 console.error 记录失败是允许的，需人工确认）

# C4. 死代码（被注释掉的大段实现）
grep -rn "^\s*//\s*\(const\|function\|return\|if\|await\)" src/ --include=*.js | grep -v uni_modules

# C5. ★ 模板完整性：注释收尾符写错会**静默吞掉**后面的节点（或让说明文字渲染成正文）
node .claude/scripts/check_templates.mjs
# → 期望：输出「✓ 模板审计通过」且退出码 0（BUG-011；改了任何 .vue 都跑一次）
```

### 需人工判断 👁️

| # | 检查 | 判定 |
|---|---|---|
| C6 | ★ **每个非显然分支上方是否有 why 注释**（中文） | 缺 → 建议项；核心基础设施缺 → 阻断 |
| C7 | 组件类名是否 ≥3 字母 + 语义前缀；写前缀前是否 grep 过 `main.css` | 撞 ColorUI → 阻断（BUG-001） |
| C8 | `<style>` 是否加了 `scoped` | 未加 → 阻断（污染全局） |
| C9 | 命名是否符合规范（文件 kebab-case / 常量 UPPER_SNAKE / 布尔 is-has-can 前缀） | 不符 → 建议项 |
| C10 | 是否用了 `!!` 合并「未查到」与「确实为空」两态 | 是 → 建议项（UI 会误报） |

---

## D. 重要变更记录（按 `CLAUDE.md` §11.1，**只记真重要变更**）

### 需人工判断 👁️

| # | 检查 | 判定 |
|---|---|---|
| D1 | 改了 `agents` / `workflows` / `rules` / `templates` / `memory` 或工程目录结构 → **是否同步了 `.claude/CLAUDE.md`** | 未同步 → **阻断** |
| D2 | **真重要变更**（新表 / 新接口 / 状态机 / 权限 / 口径变更 / 数据迁移）→ 是否在 **git commit message 写了一行**（含 why）？ | 未写 → **阻断** |
| D2b | 业务规则 / 口径 / 状态机 / 权限变了 → **是否更新了 `project-meta/modules/<m>/business-logic.md`**？ | 未更新 → **阻断** |
| D2c | 是否**误新增**了 `CHANGELOG.md` / `versions/vN/` / 模块 `changelog.md` 条目？ | 新增 → **提示**（三处已冻结） |
| D3 | 是否留下未登记的 `⚠️ TODO` | 有 → 登记到 `memory/known_issues.md` |
| D4 | 修了 bug → 是否补了 `memory/bug_history.md`（含防复发措施） | 未补 → **阻断** |
| D5 | 发现了新知识 / 新坑 → 是否更新了 `memory/` | 未更新 → 建议项 |

**普通修 bug / 文案 / 样式 / 字段微调**：**不要求** D2、D2b、D2c。
原 8 字段格式仅用于已冻结的历史归档，**不再新增**。

---

## E. 一键自查（把命令打包）

```bash
node .claude/scripts/check_system.mjs   # 系统自检（空文件 / Agent 段落 / YAML 合法性）
```

然后把这句丢给 Claude Code：

```
按 .claude/checks/pre_commit.md 逐条自查本次改动：
A/B/C 段跑命令并把输出给我，👁️ 项你自己判断并说明依据。
最后按 D 段检查变更登记是否完整。
任何阻断项列在最前面。
```

---

## F. 检查结果的处理

| 结果 | 处理 |
|---|---|
| 全部通过 | 提交 |
| 有**红线违反** | **必须改**，不可提交（红线不因改动量小而失效） |
| 有**建议项** | 可延后，但登记到 `known_issues.md` |
| 未确证项 | **标注「未确证」**，不可写成「已验证」 |
| 无法判定 | 问用户，**不要猜** |