# QUICK_START — AI 工程系统使用手册（模板版）

> 面向「今天就要用」的人。读完这一篇即可上手，细节查 `.claude/CLAUDE.md`。
> 系统版本 `v1.0.0` · 更新 2026-11-26

---

## 一、30 秒上手

```bash
cd <你的项目目录>
bash init.sh      # 第一次：改名 / 填 appid / 填域名
npm install
claude            # 启动 Claude Code
```

开场只需说清「做什么」：

```
新增「订单管理」列表页：分页、下拉刷新、点进详情。走 feature 流程。
```

Claude 会自动读取 `.claude/CLAUDE.md`（真相源）→ `.claude/skills/rule-*/`（规则，按需加载）
→ 按 `.claude/workflows/feature.yaml` 编排各 Agent。

---

## 二、如何提问

### 2.1 三种粒度

| 粒度 | 说法 | 走什么 |
|---|---|---|
| **简单改动** | 「绑定页副标题改一下」「修 `maskMobile` 长度边界」 | 直接改，不排队、不计划 |
| **中等改动** | 「给首页加一个筛选栏」 | `frontend_engineer` + 收尾问一次评审 |
| **完整流程** | 「新增订单管理模块」 | `workflows/feature.yaml` 全链路 |

> **简单改动直接做**是既定规则。只有「新模块 / 新接口 / 新页面设计 / 跨层大改 / 需求模糊」
> 才需要完整流程。

### 2.2 开场模板（复制即用）

```
【任务】<一句话目标>
【类型】feature | bugfix | refactor | release
【范围】<涉及模块/页面/接口，不确定就写"待你判断">
【约束】<后端契约有没有到位、能否改 endpoints.js>
【验收】<怎么算做完>
```

❌ 差的开场：「优化一下代码」「看看有没有问题」——**没有验收标准，Agent 会发散**。

---

## 三、如何调用 Agents

Agent 定义在 `.claude/agents/*.md`（标准 Claude Code 子代理格式，含 frontmatter）。

| 方式 | 用法 | 适用 |
|---|---|---|
| **自然语言** | 「用 architect 评估一下这个模块该怎么分层」 | 日常 |
| **并行** | 「同时让 security_agent 和 reviewer 看这份改动」 | 独立视角 |
| **点名链路** | 「按 `workflows/feature.yaml` 走」 | 正式迭代 |

### 3.1 重要口径（模板版）

- **AI 不自动起子代理**：评审由用户在**新窗口**手动触发；收尾时只问一次「是否评审」。
- **默认不执行测试 / 构建 / 装依赖**：除非用户本轮明确要求。
- **不确定就问**：字段名 / 错误码 / 接口路径不许猜。

---

## 四、新页面怎么建（最短路径）

1. `config/access.js`：加 `PAGE_X` 路径常量 + `HOME_ENTRIES` 入口（或页内清单）+ `PAGES` 准入。
2. `config/endpoints.js`：登记接口路径；`api/<域>.js` 包方法。
3. `pages/<模块>/xxx.vue`：照 `.claude/templates/page/` 或 `pages/demo/page-a.vue` 的骨架写。
4. `pages.json`：登记页面（第一项是启动页）。
5. `config/dict.js`：新增权限码（如需要）。
6. 自检：页面无业务逻辑 / 无路径字面量 / 无 `#ifdef`；样式走 token。

> 详细规则：`skills/rule-add-page`、`skills/rule-layering`、`skills/rule-api-registry`。

---

## 五、接真后端（RBAC 自建）

后端模板 `go_project_template` 的 admin 分组中间件已保留（签名 + token + 逐路径权限），
但**不含账号体系**。最小落地：

1. `POST /admin/login/login`：`code` → 校验 → 签发 token；
   把角色授权路径列表写进登录缓存容器的 `api` 字段（后端 `conf.CacheFieldApi`）。
2. `POST /admin/login/bind`：手机号 + 密码 + **新** code，响应与登录同构。
3. 登录响应把 `permission` 数组一起下发（前端显隐判据）。
4. 前端：`DEMO_MODE=false`，替换 `PERM_DEMO_*` 与 `config/access.js`。

完整步骤与响应结构见 `README.md` 第 5 节。

---

## 六、常见问题

| 现象 | 原因 / 处理 |
|---|---|
| 所有接口被拒（`40003` / `Im Invalid Request!`） | `edition` 未在后端 `EditionList` 登记 |
| 所有接口 `40003` | 签名密钥不对：`VITE_API_KEY` 与 `source` 不匹配，或时钟偏差 >300s |
| 一直回 `40005` 并重登失败 | 登录接口本身失败（看 `services/session.js` 的 `lastLoginCode` 与后端日志） |
| 首页入口全部隐藏 | 会话里 `permission` 为空（旧会话 / 后端未下发）→ 重新登录 |
| 上传报 `40001` | 后端 `AdminUploadTypes` 未注册该 `type` |
| 微信端选图无反应（errno 112） | 公众平台《用户隐私保护指引》未声明「相册 / 摄像头」 |

---

## 七、文档地图

| 想知道 | 读哪 |
|---|---|
| 全局约束 / 红线 | `.claude/CLAUDE.md` |
| 快速开始 / 占位清单 / 后端对接 | 工程根 `README.md` |
| 某类代码怎么写 | `.claude/skills/rule-*/SKILL.md` |
| 一次完整改动的产物长什么样 | `.claude/examples/feature-walkthrough.md` |
| 业务模块文档怎么写 | `.claude/project-meta/modules/demo/` |
| 提交 / 评审 / 发布前检查 | `.claude/checks/` |
| 设计稿怎么出 | `.claude/skills/design-preview/` |