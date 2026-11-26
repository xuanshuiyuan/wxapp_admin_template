# demo · 接口契约

> 代码真源：`src/config/endpoints.js` + `src/api/demo.js`。本文件只记语义与前提。

## 连通性自测接口（后端模板 demo 模块，可选）

| 方法 | 路径（不含 /v2） | 入参 | 说明 |
|---|---|---|---|
| POST | `web/demo/login` | `user_id` | demo 登录 stub，返回 web 组 token |
| GET | `web/demo/list` | `page` / `page_size` | 分页列表 `data: { list, total, page, page_size }` |
| POST | `web/demo/create` | `name` / `remark` | 创建，响应含 `doc_preview_url` |
| POST | `web/demo/delete` | `id` | 软删 |

## 前提（不做这三条会「全部被拒」）

1. **source**：web 组校验 C 端 `1010`；本模板默认 `1001` → 自测时 `.env.local` 设 `VITE_SOURCE=1010`。
2. **签名**：没有 C 端密钥时，local / develop 后端可设 `VITE_DEVELOP_BYPASS=develop` 跳过。
3. **token**：demo 登录返回的是 web 组会话，结构与 B 端 `admin_info` 不同——
   自测只关心「请求是否通」，不要去点首页的登录流程。

## 错误语义

| 码 | 含义 | 本模板处置 |
|---|---|---|
| `40003` | 签名 / source / 时间戳不合法 | 提示后端 msg；检查 `VITE_API_KEY` / `source` / 时钟 |
| `40107` | edition 未登记 | 检查 `config/app.js` 的 `edition` 与后端 `EditionList` |
| `40005` | 登录失效 | http 层自动重登重放；重登失败抛 `ApiError(type='auth')` |
| `40102` | 无权限 | 页面就地提示 / 空态，**不进全局守卫** |

> ⚠️ 这组接口**不是业务契约**。真实项目接后端时删掉本文件与 `api/demo.js`。