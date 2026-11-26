# tools/ — 可用工具与命令说明

> **用途**：本项目**实际可用**的工具清单、命令、以及**使用边界**。
> **原则**：本文件只列「真的能用」的东西，不列「理论上该有」的。

---

## 1. 构建与运行（★ 执行前须用户确认）

| 命令 | 产物目录 | 环境 | 用途 |
|---|---|---|---|
| `npm run dev:mp-weixin` | `dist/dev/mp-weixin` | development | ★ **真机联调**用这个导入 |
| `npm run dev:h5` | `dist/dev/h5` | development | H5 本地调试 |
| `npm run verify:mp-weixin` | `dist/build/mp-weixin` | development | 编译校验 |
| `npm run verify:h5` | `dist/build/h5` | development | 编译校验 |
| `npm run build:mp-weixin` | `dist/build/mp-weixin` | **production** | ★ **发布**用 |
| `npm run build:h5` | `dist/build/h5` | **production** | ★ **发布**用 |
| `npm run dev:prod:mp-weixin` | `dist/dev/mp-weixin` | production | 本地连生产后端调试 |

### ⚠️ 三条口径（**违反任一条都可能把开发包发到生产**）

1. **目录由 `dev:*`/`build:*` 决定，环境由 `--mode` 决定，两轴正交。**
   `dev:*` 写 `dist/dev/`；**`verify:*` 与 `build:*` 共用 `dist/build/` —— 后跑者覆盖前跑者**。
2. **发布前必须最后跑一次 `build:*`。**
   只跑过 `verify:*` 就上传，会把 host 指向 `localhost:15000` 的开发包发到生产。
   **分辨只能靠 `grep localhost:15000`，别靠目录名。**
3. **真机测试包必须来自 `npm run dev:mp-weixin`**（development 环境）。

> 背景：这三条是 C 端工程踩坑后带过来的（源工程发布事故的教训）。

---

## 2. `.claude/` 系统脚本（只读为主，随时可跑）

| 命令 | 作用 | 会改文件吗 |
|---|---|---|
| `node .claude/scripts/detect_stack.mjs` | 技术栈指纹识别（输出应与 `CLAUDE.md` §2 一致） | 否 |
| `node .claude/scripts/detect_stack.mjs --json` | 机器可读（喂给 AI） | 否 |
| `node .claude/scripts/check_system.mjs` | 系统自检**八件事**：空文件 / Agent 段落 / YAML / **reviewer 是否在最后** / CLAUDE.md 一致性 / rules↔rule-skill 同步（日期） / ★ **符号存在性**（`.claude/` 提到的**六个常量族**（`ENDPOINT_*`/`CODE_*`/`PERM_*`/`FORM_TYPE_*`/`FIELD_GROUP_*`/`MODULE_TYPE_*`）·SCSS 变量必须在 `src/` 真实存在；类名·`name()` 为警告级） / ★ **路由一致性**（`config/access.js` 的 `PAGE_*` ⟶ `src/pages.json` 注册页面**一一对应**，缺失/多余都报错） | 否 |
| `node .claude/scripts/sync_claude_md.mjs` | 报告 `CLAUDE.md` 与实际文件的漂移 | 否 |
| `node .claude/scripts/sync_claude_md.mjs --fix` | 更新 `CLAUDE.md` 的自动索引区块 + 刷新同步日期 | **是** |
| `node .claude/scripts/new_change_entry.mjs` | **已冻结**：CHANGELOG 不再新增条目（见 `CLAUDE.md` §11.1） | 否 |
| `node .claude/scripts/new_change_entry.mjs --dry-run` | 只打印不写入 | 否 |
| `node .claude/scripts/new_change_entry.mjs --from-file e.json` | 从 JSON 读（批处理） | **是** |

**脚本的依赖**：**零第三方依赖**（只用 Node 内置模块）。**不装任何包即可运行。**

**推荐节奏**：
```bash
# 每次改动后
node .claude/scripts/check_system.mjs      # 若动了 .claude/
node .claude/scripts/sync_claude_md.mjs    # 若动了 agents/ 或 workflows/

# CHANGELOG 已冻结：不再运行 new_change_entry.mjs（见 CLAUDE.md §11.1）
```

---

## 3. 只读诊断命令（安全，随时可用）

### 3.1 红线自查

```bash
# 页面里不得有 #ifdef（端差异应收进 services/platform.js）
grep -rn "#ifdef\|#ifndef" src/pages src/components

# 密钥不得出现在 src/
grep -rn "VITE_API_KEY\|apiKey" src/ --include=*.js --include=*.vue

# 不得绕过存储层
grep -rn "getStorageSync\|setStorageSync" src/ | grep -v "services/storage.js"

# 不得绕过 http 层
grep -rn "uni\.request\|uni\.uploadFile" src/ | grep -v "services/http/transport.js"

# 敏感信息不得进日志
grep -rn "console\.\(log\|warn\|error\)" src/ | grep -iE "token|mobile|phone|apiKey|header"

# 不得手改第三方整包
git status --porcelain | grep "src/uni_modules/"

# 误提交检查
git status --porcelain | grep -E "\.env\.|dist/|unpackage/|\.idea/"
```

### 3.2 架构自查

```bash
# 页面/组件里不得有接口路径字符串
grep -rnE "['\"](web|utils)/[a-z_/]+['\"]" src/pages src/components

# 页面/组件不得直接调 curl
grep -rn "curl\.\|@/services/http" src/pages src/components

# 硬编码色值
grep -rnE "#[0-9a-fA-F]{3,8}\b" src/pages src/components

# 手写安全区（应用 $safe-bottom / $safe-top）
grep -rn "safe-area-inset" src/pages src/components

# 错误码字面量（应从 config/dict.js 取）
grep -rnE "\b(40005|40102|50008|5800[1-6]|60003)\b" src/pages src/components

# guard:false 的使用点（逐个评估合法性）
grep -rn "guard:\s*false" src/

# authRetry 使用点
grep -rn "authRetry" src/
```

### 3.3 类名撞名自查（★ 真机踩过 BUG-001）

```bash
# 列出 ColorUI 的全部类名，用于比对
grep -n "^\." src/common/css/main.css | head -100

# 检查组件根类名是否撞名（把 <你的类名> 换掉）
grep -rn "class=\"<你的类名>\"" src/components
```

### 3.4 产物与环境自查（发布前）

```bash
grep -rn "localhost:15000" dist/build/mp-weixin/     # ★ 应为空
grep -rn "VITE_API_KEY" dist/build/mp-weixin/        # 应为空
cat dist/build/mp-weixin/project.config.json | grep -i appid   # 应为本项目自己的 appid（与 manifest 一致）
```

### 3.5 未决项盘点

```bash
grep -rn "⚠️ TODO\|TODO" src/
```

---

## 4. 查阅类工具（非命令）

| 需求 | 去哪 |
|---|---|
| 代码结构 / 调用关系 | CodeGraph（若已 `codegraph init`）→ `codegraph explore "<symbol>"` |
| 接口路径总表 | `src/config/endpoints.js` |
| 错误码 / 枚举 | `src/config/dict.js` |
| 样式 token 总表 | `src/common/css/theme.scss`（SCSS）+ `src/config/theme.js`（JS 镜像） |
| 版式块与 HUD 类 | `src/styles/scaffold.scss` |
| 项目全貌 | `README.md`（工程）+ `.claude/CLAUDE.md`（AI 系统） |
| 历史坑 | `.claude/memory/bug_history.md` |
| 未确证项 | `.claude/memory/known_issues.md` |

---

## 5. ❌ 本项目**没有**的工具（别假设存在）

| 工具 | 现状 | 含义 |
|---|---|---|
| **测试框架** | 未安装（无 vitest / jest） | 默认**只生成**测试；引入需用户决策 |
| **ESLint / Prettier** | 未安装 | 格式靠人工对齐现网风格（Tab / 单引号 / 带分号） |
| **TypeScript** | 未使用（只有 `jsconfig.json` 服务编辑器） | 不要写 `.ts` |
| **CI 配置** | 无 `.github/workflows` / `.gitlab-ci.yml` | 无自动化流水线 |
| **E2E 框架** | 无 | 不写 E2E |
| **埋点 SDK** | 无 | 新增埋点需用户决策；且**必须脱敏** |

---

## 6. ⚠️ 使用边界（重要）

| 规则 | 说明 |
|---|---|
| **默认不执行测试 / 构建 / 装依赖** | 除非用户在本轮**明确要求**（`.claude/CLAUDE.md` §9.3） |
| **构建/发布命令执行前必须确认** | 说明「要跑什么、为什么、产物在哪」，获确认后才执行 |
| 只读诊断命令随时可跑 | 上面 §3 的全部命令都是只读的 |
| **不替用户上传** | 微信开发者工具 / HBuilderX 的提交动作由用户完成 |
| **不擅自引入依赖** | 新 npm 包需上报用户决策 |