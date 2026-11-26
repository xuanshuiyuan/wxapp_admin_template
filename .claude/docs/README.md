# .claude/docs —— AI 系统工程文档

> 规则正文在 `skills/`，流程图在 `workflows/`；本目录只放**系统自身**的说明。

| 主题 | 看哪 |
|---|---|
| 为什么这样分层 / 请求链 / 权限机制 | `memory/architecture.md` + `.claude/CLAUDE.md` §3 |
| 一次完整改动的产物示例 | `examples/feature-walkthrough.md` |
| 怎么用这套系统（开场 / Agent / 粒度） | `QUICK_START.md` |
| 检查清单 | `checks/` |
| 本文件如何维护 | `.claude/CLAUDE.md` §11 |

## 两条容易被忽略的约定

1. **一个事实只有一个真相源**：规则正文在 `skills/rule-*`，业务规则在 `project-meta/modules/`，
   本目录与 `memory/` 只做「为什么」与导航，不复制正文。
2. **文档引用符号必须真实存在**：新增 / 改名时全局 grep；`check_system.mjs` 会静态校验。
