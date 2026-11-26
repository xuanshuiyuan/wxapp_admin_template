# project-dev 模板在本工程的差异覆盖

`skills/project-dev/SKILL.md` 是从通用模板派生的，有几处默认行为不适用于本工程。
**以本文件为准**，执行 project-dev 时逐条替换。

## 1. 收尾必须问一次「是否评审」

模板原本没有评审环节。本工程约定：

- `project-dev` 收尾时**问用户一次**「是否评审」；
- 用户确认后，**在本仓新开一个窗口**跑 `reviewer`（AI 不自动起子代理、不在代码窗口自评）；
- 用户明确说不做 → `versions/vN/CHANGELOG.md` 记 `评审：跳过（用户确认）`。

## 2. 「执行编译验证」默认不执行

模板步骤里的「写完就编译」在本工程默认**不执行**：

- 除非用户本轮明确要求，否则**不跑测试 / 构建 / 装依赖**；
- 改为产出验证清单，写进 `versions/vN/CHANGELOG.md` 第四节；
- 未执行就如实写「未执行，待验证」，**禁止编造通过**。

本工程的验证命令：

```bash
npm run verify:mp-weixin    # development 配置构建，用于自检
npm run verify:h5
npm run build:mp-weixin     # 发布产物（production 配置）
```

## 3. 轻微改动免流程

单文件 / 需求明确 / 不涉新模块、权限、状态机 / 照抄既有模式 → **直接改**，
不建 `versions/vN/`、不问评审。边界从严：涉及登录态 / 请求链路 / 全局守卫 / 权限 / 口径时
就不是轻微改动。

## 4. 业务文档落点

- 业务规则 → `modules/<m>/business-logic.md`（带 block id + 版本）
- 一次改动 → `versions/vN/`（`requirement.md` / `CHANGELOG.md`，复评 `review.md`）
- 模块索引 → `index.md`

模板里「建 `sql/`」「跑后端 migration」「改 controller」等环节在本工程**不适用**（前端仓）。