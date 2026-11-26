# 子项目 / 技术栈 / 外部仓库

| 项 | 值 |
|---|---|
| 本仓库 | 前端 · uni-app 管理小程序（多端：mp-weixin / h5 / app） |
| 语言 / 框架 | JavaScript（ESM）+ Vue 3 `<script setup>` + uview-plus |
| 构建 | Vite 5（`uni` CLI） |
| 后端 | 不在本仓库。契约真源：`go_project_template`（Go + Iris + GORM + Redis） |
| 关联外部仓库 | `go_project_template`（后端模板） |
| CodeGraph | 可选；仓库根有 `.codegraph/` 时可用 `codegraph explore` 代替 grep |

## 与本工程的协作边界

- **接口路径 / 字段 / 错误码以 `src/config/endpoints.js` + 后端契约为准**，
  不确定必须问后端，不许猜。
- 后端 admin 分组的中间件（签名 + token + 逐路径权限）已就绪；
  **账号体系（登录 / 绑定 / 管理员 / 角色）需新项目自建**，接入指引见工程根 `README.md` 第 5 节。
- `source` 与签名密钥按端区分：B 端小程序 `1001`、网页 B 端 `0101`、C 端 `1010`。
  换 source 必须同时换 `.env.*.local` 的 `VITE_API_KEY`。