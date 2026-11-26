# context/current_sprint.md — 当前迭代上下文

> **用途**：会话之间的**短期上下文**（当前在做什么、卡在哪、下一步）。
> 与 `.claude/memory/` 的区别：memory 是**长期知识**，本文件是**当下状态**（做完即清空）。
>
> **更新时机**：迭代开始 / 迭代结束 / 遇到阻塞。**至少每轮改动结束更新一次。**

最后更新：2026-11-26（模板 v1.0.0）

---

## 当前迭代

| 项 | 值 |
|---|---|
| **迭代目标** | 模板 v1.0.0：从业务工程抽离通用底座（请求链 / 登录态 / 权限菜单 / 上传 / 样式 / 工程系统） |
| **状态** | 已过一轮独立评审（3.4/5 有条件通过）；5 个阻断 + 主要建议已修复（见 `versions/v1.0.0/CHANGELOG.md`）；真机 / 联调未验证；**待用户决定是否复评** |
| **涉及模块** | `demo`（范本） |

## 模板验收记录（**未执行就写未执行，不许写通过**）

| 项 | 命令 | 结果 |
|---|---|---|
| 依赖安装 | `npm install` | ✅ 通过（up to date） |
| 微信小程序构建 | `npm run verify:mp-weixin` | ✅ 通过（development 配置） |
| 微信小程序生产构建 | `npm run build:mp-weixin` | ✅ 通过（产物含 `REPLACE_API_BASE_URL`，替换后方可发布） |
| H5 构建 | `npm run verify:h5` | ✅ 通过 |
| 系统自检 | `node .claude/scripts/check_system.mjs` | ✅ 全部通过 |
| 模板审计 | `node .claude/scripts/check_templates.mjs` | ✅ 通过 |
| 权限菜单（演示模式） | esbuild 打包 `config/access.js` + `config/demo.js` 后 Node 断言 | ✅ 逻辑层通过：可见入口 2 个、隐藏入口不出现、`PAGES` 准入码正确 |
| 子菜单 0/1/≥2 规则 | 同上（换不同权限子集断言） | ✅ 逻辑层通过（2 子项 → 弹层；1 子项 → 直跳；0 子项 → 入口消失） |
| 上传（真后端） | 演示页 → 添加文件 | 未执行（需后端 `AdminUploadTypes` 就绪） |
| 连通性自测 | 演示页 → 调用列表 | 未执行（需 `VITE_SOURCE=1010` / develop 旁路） |
| 发布闸门 | `npm run check:release` | ❌ 预期失败（占位 + demo 页未剥离），拦截项正确 |
| 演示旁路防护 | `VITE_DEMO_MODE=true npm run build:mp-weixin` | ✅ 产物启动即 throw |
| 开发者工具 / 真机 | 微信开发者工具打开首页、真机预览 | 未执行（本机无开发者工具） |

## 下一步（接新项目时）

1. 按 `README.md` 第 1 节跑 `init.sh` + 填占位。
2. 替换 `PERM_DEMO_*` / `config/access.js` / `config/endpoints.js` 为真实业务。
3. 完成后端 RBAC 登录 / 绑定后把 `DEMO_MODE` 改为 `false`。
4. 清空本文件，按新项目迭代重写。

## 已知阻塞

无。