# 项目模块索引

供 `project-dev` 做「用户描述 → 定位模块」的关键词匹配。
**只收录业务模块，不收录基础设施** —— 请求链 / 路由 / 上传 / 权限机制 / 组件库
这些走 `skills-index.md` 里的 rule-skill，**不进这张表**。

## 业务模块

| 模块 (module) | 关键词 | 复杂度 | 前端路径 | 后端路径 |
|---|---|---|---|---|
| `demo` | 演示、示例、请求示例、上传示例、权限菜单、首页入口、子菜单、页面准入、登录 stub、演示会话 | `low` | `src/pages/demo/` · `src/config/demo.js` · `src/api/demo.js` | 后端模板 demo 模块（`web/demo/*`，可选） |

> ⚠️ **当前只有 `demo` 一个模块**（模板自带的范本，接真项目后可整体删除）。
> 新增业务模块时：本表加一行 + `src/config/access.js` 加入口（含落地页）+ 建页面 +
> `src/pages.json` 注册路由，并建 `modules/<m>/` 四件套（照 `modules/demo/` 抄）。
>
> 页面清单 / 入口 / 准入的唯一真相源是 `src/config/access.js`，
> 不要往 `services/route.js` 加「type → 页面」映射。