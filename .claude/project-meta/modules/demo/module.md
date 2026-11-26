# 模块：demo（演示 / 模板范本）

> ★ 本模块的文档结构就是**新业务模块的范本**：`module.md`（本文件，模块全貌）+
> `business-logic.md`（业务规则，带 block id）+ `api-demo.md`（接口契约与语义）+
> `changelog.md`（版本沿革）。新建模块时整目录复制改名即可。

## 定位

模板自带的**可删除示例**，用于在没有后端的情况下验证：

1. 权限菜单（首页入口 ∩ 登录权限点、子菜单 0/1/≥2 规则）；
2. 页面准入（`requirePageAccess`）与登录门；
3. 请求链路（签名 → 发送 → 统一响应 → `ApiError`）；
4. 通用上传（`admin/upload` + `AdminUploadTypes`）；
5. 列表四态（`useList` + `app-list-state`）与「跳页取值」（fieldEditor / regionPicker）。

## 前端路径

| 文件 | 作用 |
|---|---|
| `src/pages/admin-home/index.vue` | 工作台：按权限渲染入口、子菜单弹层、冷启动判定态 |
| `src/pages/demo/list.vue` | 请求示例 + 上传示例 + 权限点展示 |
| `src/pages/demo/page-a.vue` | 列表页骨架（本地 mock 数据，四态演示） |
| `src/composables/usePageGuard.js` | 两道门统一接线（所有页面，含模板） |
| `src/pages/demo/page-b.vue` | 表单行 + 字段编辑 / 地区选择（跳页取值） |
| `src/pages/bind/index.vue` | 绑定页 stub（演示模式直接成功） |
| `src/config/demo.js` | 演示会话（token / admin_info / permission） |
| `src/config/access.js` | `HOME_ENTRIES` / `DEMO_SUBMENU_ENTRIES` / `PAGES` |
| `src/api/demo.js` | 连通性自测接口（后端 demo 模块，可选） |
| `src/services/uploader.js` | 上传链路（直接走 `curl.upload`；services 不 import api） |

## 后端路径

- 后端模板 `go_project_template` 的 demo 模块（`web/demo/*`，C 端 source）——**仅连通性自测**。
- 真实项目不需要任何 demo 接口；删除本模块时前后端一起删。

## 数据流

```
登录（演示模式写 config/demo.js / 真实模式调 admin/login）
  → storage.writeSession（token + admin_info + permission）
  → 首页 useAdminHome：HOME_ENTRIES ∩ permission → 入口宫格
  → 点入口 → route.to(page) → 目标页 requirePageAccess
  → 页内区块 byPermission(ACTIONS, permission) 决定渲染
```

## 删除清单（接真项目后）

1. `src/pages/demo/`、`src/config/demo.js`、`src/api/demo.js`；
2. `config/access.js` 的 `DEMO_*` 与三个入口；
3. `config/dict.js` 的 `PERM_DEMO_*`；
4. `pages.json` 的三个 demo 页面；
5. `endpoints.js` 的 `ENDPOINT_DEMO_*`；
6. 本模块目录。