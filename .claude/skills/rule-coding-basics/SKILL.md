---
name: rule-coding-basics
description: 在本项目写任何代码时用：定命名（文件/变量/组件/常量/API 路径）、写注释（中文、解释 why）、控函数长度与参数、决定 const/let、处理魔法数字与调试代码，或需要 Go/Java/Python/PHP 侧风格适配时使用。分层归位禁令在 rule-layering，不在本文件。
---

# rule-coding-basics

本工程的**通用编码规范**（命名 · 注释 · 函数 · 通用禁止）。
跨主题禁令在各自 rule-skill 的「硬性禁令」小节，查表见 `.claude/project-meta/skills-index.md`。

> 📌 **来源**：源工程同名 skill（已随本次抽离去业务化），
> 2026-10-26。C 端原版零业务污染，故**近乎原样采用**；
> 仅调整了指针（指向本工程的 `rule-layering` / `templates/`）与补了本工程实测的两条格式口径。

## 硬性禁令（MUST / MUST NOT）

> **本节是本主题 MUST / MUST NOT 的唯一权威。**

- ❌ 禁止把调试用 `console.log` / `debugger` 提交上去。
  （`App.vue` `onLaunch` 的启动自检日志与 `console.error/warn` 是**刻意保留的例外** ——
  失败必须留痕，见 `rule-request-chain` 的「不用裸 `.catch(() => {})`」）
- ❌ 注释必须解释 **why** 而不是 what；禁止无意义注释（如 `// i++`）。
- ❌ 禁止魔法数字与魔法字符串散落 —— 先入 `config/dict.js` 或 `config/app.js` 再引用。
- ❌ 禁止拼音命名。
- ❌ 禁止单行超过 120 字符。
- ❌ 禁止复制粘贴已有逻辑（DRY；重复出现先问该不该抽）。

## 通用规范

### 注释

- **所有代码注释使用中文**；注释解释 **why** 而非 **what**。
- 关键逻辑必须有详细中文注释。

**什么样的 why 值得写**（按价值排序，取自本工程真实先例）：

| 类型 | 例子 |
|---|---|
| **反直觉决策** | 「`authRetry:false` 防止登录接口本身返回 40005 时递归」 |
| **看似多余的代码** | 「槽内只放 0 高占位：原生 refresher 区无内容，回弹收缩时才不会溢出/遮盖」 |
| **历史踩坑** | 「`main.css` 有全局 `.fr{float:right}`，用它当根类名会被浮动到右边、行内 flex 全废（真机踩过）」 |
| **两态不能合并** | 「`null` = 还没查到，区别于 `false` = 确实未绑，别用 `!!` 兜底合并这两态」 |
| **为什么不用更"标准"的写法** | 「不用 `uni.showModal`：`useModal` 把多次调用排队，不会互相覆盖」 |

**噪音注释**（禁止）：逐行翻译代码、无内容的 `// TODO`、大段被注释掉的死代码（用 git 记住它）。

### 命名

| 类型 | 规范 | 示例 |
|---|---|---|
| 文件/目录 | 小写，短横线分隔 | `app-list-state.vue` · `use-pull-refresh.js` |
| 变量/函数 | 驼峰 | `refreshBound` · `maskMobile` |
| 类 | 大驼峰 | `ApiError` |
| 常量 | 全大写 + 下划线 | `CODE_SUCCESS` · `ENDPOINT_ADMIN_LOGIN` · `SESSION_FIELDS` |
| 布尔 | `is` / `has` / `can` / `should` 前缀 | `isLogin` · `isApiError` · `canContact` |
| 事件处理器 | `on` + 动作 | `onPulling` · `onRefresh` · `onLogout` |
| 接口 URL 常量 | `ENDPOINT_<域>_<动作>` | `ENDPOINT_ADMIN_BIND` |
| 页面私有类名 | `<页面前缀>__<块>`（BEM） | `ahome__hdr` · `pb__note` · `demo__json` |
| 组件类名 | **≥3 字母 + 语义前缀** | `frow__`（**不是** `fr` —— 撞 ColorUI 全局浮动类） |
| 数据库表/字段 | 小写 + 下划线 | `tmp_form.created_at` |
| API 路径 | 小写 + 下划线（统一无前导斜杠、无 `/v2`） | `admin/login/bind` |

### 函数

- 单一职责；**长度控制在 50 行以内**。
- **参数超过 5 个改用对象参数**。
- 返回值必须统一、明确。

## 前端（uni-app + Vue3 + JS）

### 格式（本工程实测口径，勿"顺手改成主流风格"）

| 项 | 现状 |
|---|---|
| 缩进 | **Tab** |
| 引号 | 单引号 `'` |
| 分号 | **写** |
| 尾逗号 | 不写 |
| 箭头函数单参数 | **带括号** `(e) => …` |

> ⚠️ **本工程未装 ESLint / Prettier**，格式靠人工对齐现网。
> 不要引入默认配置去"统一"格式 —— 默认配置与现网不符（如缩进会变 2 空格）。

### SFC 结构

```
<template>（只渲染）→ <script setup>（一律组合式，不用 Options API）→ <style lang="scss" scoped>
```

- `<style>` **必须** `scoped`（全局样式归 `common/css/` 与 `styles/`）。
- 全局组件 `app-*` 经 easycom 自动注册，**页面无需 import**。
- 完整可抄骨架见 `.claude/templates/page/`（`page-list.vue` / `page-detail.vue`）与 `rule-add-page`。

### ES6+

优先 `const`，需重新赋值才用 `let`，**避免 `var`**；字符串优先单引号；
`async/await` 处理异步，避免回调地狱。

> ⚠️ 页面层的「禁止 / 必须」清单（`uni.request`、`uni.showModal`、裸色值、字面量枚举等）
> → 见 `rule-layering` 与各主题 rule-skill 的「硬性禁令」。

## 后端语言适配（本工程无后端，跨模块 / 未来后端预留）

> 本工程与 C 端**共用同一后端**，后端代码不在本仓库。以下为跨栈对照，供将来后端模块参考。

- **Go**：`gofmt`；包名小写简短；每个 error 必须检查；`fmt.Errorf("...: %w", err)` 包装错误。
- **Java**：4 空格缩进；类名大驼峰、方法名小驼峰；`Slf4j` 日志；异常必须处理或显式抛出。
- **Python**：PEP 8；函数名小写 + 下划线；推荐类型注解；用 `logging` 而非 `print`。
- **PHP**：PSR-12；类名大驼峰、方法名小驼峰；使用类型声明；异常处理完整。

## 目录约定

- **常量归位**：业务枚举/码值 → `config/dict.js`；全局配置常量 → `config/app.js`；
  环境 → `config/env.js`；接口路径 → `config/endpoints.js`。（详见 `rule-api-registry`）
- **纯函数 → `utils/`；有副作用 → `services/`**（判定三问见 `rule-layering`）。
- 样式值 → `common/css/theme.scss`（SCSS 变量）+ `config/theme.js`（JS 镜像）。
  **禁止硬编码色值/字号/间距**（详见 `rule-style-tokens`）。

## 文件与模块（2026-11-16 从 `rules/coding_style.md` 迁入）

- **一个文件一个主要导出**（组件 / service 模块 / 纯函数集合）—— 多个主要导出会让「这段代码属于哪一层」失去判据。
- ❌ **禁止 barrel 文件层层转发**：`index.js` 只做出口汇总、不写逻辑 —— 层层 re-export 会掩盖真实依赖，
  循环引用变得无从排查。
- **模块内私有成员靠「不导出」表达，不加下划线前缀** —— 下划线是 Python 口径，JS 里只会造成与现网不一致。

## 补充硬约束

- 组件 props **必须**用对象形式 `{ type, default }`，❌ 不用数组形式 ——
  数组形式拿不到默认值与类型校验，漏传时静默变成 undefined。
- ❌ **禁止用假值兜底掩盖失败**（`|| 0` / `|| []` / `|| '--'` 用在可能失败的取数上）——
  那会把「失败」伪装成「空数据」，用户与日志都无法区分。

## 来源

移植自 C 端工程 `.claude/skills/rule-coding-basics/SKILL.md`（2026-10-26）。
C 端原版迁入自其 `.claude/rules/coding_style.md` 全量 + `rules/scaffold-musts.md` §9。
本次适配：指针改指本工程的 `rule-layering` / `rule-api-registry` / `rule-style-tokens` / `templates/page/`；
补入本工程实测的格式口径（Tab / 单引号 / 带分号 / 无 ESLint）与「什么样的 why 值得写」表。
规则文档更新后，重新跑一遍 `project-skill-manager` 的 RULES-TO-SKILLS 流程来同步。
最后同步于 2026-10-26。
