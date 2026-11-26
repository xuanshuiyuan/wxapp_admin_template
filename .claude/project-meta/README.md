# project-meta —— 业务知识库与版本化记录

由 `project-skill-manager` 搭建（INIT）。**日常由 `project-dev` skill 读写。**

```
.claude/project-meta/
├── README.md              ← 本文件：真相源分工（★ 先读这个）
├── projects.md            子项目 / 技术栈 / 关联外部仓库
├── index.md               业务模块索引（关键词 → 模块 的匹配表）
├── skills-index.md        rule-skill 清单（基础设施用法，按需引用）
├── project-dev-overrides.md  project-dev 模板在本工程的差异覆盖（★ 必读）
├── modules/
│   └── demo/              ★ 模块文档范本（module / business-logic / api / changelog 四件套）
└── versions/
    └── v1.0.0/            版本记录格式说明（新项目从 v1.0.0 开始写）
```

---

## ★ 真相源分工（本工程最重要的一条约定）

`.claude/`（工程规则）与 `.claude/project-meta/`（业务知识）有重叠面。
若不明确分工，同一条规则会有两处副本 —— 改一处漏一处，且没有权威。

`rule-layering` 第一条写着：
> **「一个数据只能有一个真相源。其余位置都是视图。」**

### 分工表

| 内容 | **唯一真相源** |
|---|---|
| **业务逻辑规则**（流程 / 状态机 / 计算 / 权限判定） | `project-meta/modules/<m>/business-logic.md`（带 block id） |
| **一次改动的全貌** | `project-meta/versions/vN/`（由 `project-dev` 每次改动新建） |
| **接口契约（代码真源）** | `src/config/endpoints.js` + `src/config/dict.js`；模块 `api-*.md` 记语义 |
| ★ **访问配置**（页面 / 入口 / 按钮 / 准入表） | `src/config/access.js`（并与 `src/pages.json` 对齐） |
| **基础设施用法**（某能力怎么调、禁忌） | `.claude/skills/rule-*/` |
| **工程结构与流程编排** | `.claude/CLAUDE.md` |
| **迭代当下状态** | `.claude/context/current_sprint.md` |

### 两条防漂移规则

1. **业务规则正文只写在 `modules/<m>/business-logic.md`**；其它位置只留索引与指针。
2. **只记「真重要变更」**（新页面 / 新接口 / 状态机 / 权限 / 口径 / 数据迁移）：
   commit message 写一行；业务规则变化同步 `business-logic.md`。
   普通修 bug / 文案 / 样式不记。

### 冲突时怎么办

以 `project-meta/` 为准（业务规则）／以代码为准（接口契约，即 `endpoints.js`），
然后把另一处改成指针或删掉重复正文，并在 commit message 写一行「修复：…」。

---

## 日常怎么用

```
开发新功能 / 修 bug / 做优化
  → 调用 project-dev skill（多轮商讨 + 版本化记录）

加一条开发规则（基础设施用法）
  → 调用 project-skill-manager 的 RULES-TO-SKILLS 流程（唯一权威入口）
  → 产出的 rule-skill 登记到 skills-index.md

新增业务模块
  → 建 modules/<m>/ 四件套（照 modules/demo/ 抄）+ index.md 加一行
  → 同时在 src/config/access.js 加入口、pages/<m>/ 建页面、pages.json 注册
```

⚠️ **调用 `project-dev` 前，先看 `project-dev-overrides.md`**。