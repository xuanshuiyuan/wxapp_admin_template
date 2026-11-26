# Rule-Skill 清单

由 `project-skill-manager` 的 RULES-TO-SKILLS 流程生成与维护。
这是 `project-dev` 判断「这次需求要不要引用某个基础设施用法」的**查表依据**。

**当前 13 个 rule-skill + 2 个工作流 skill。按需加载，不要每轮全读。**

## rule-*（基础设施用法）

| skill | 何时用 |
|---|---|
| `rule-layering` | 新建文件 / 不确定代码该放哪层 / 判断「这段逻辑是不是写错层了」 |
| `rule-coding-basics` | 命名、注释、函数长度、const/let、魔法数字、调试代码 |
| `rule-request-chain` | 发 HTTP 请求、处理接口失败、设置 `toast/loading/authRetry/guard` |
| `rule-session-guards` | 登录态读写、登录拦截、权限门、账号受限状态、新增全局业务码 |
| `rule-api-registry` | 新增接口 / 错误码 / 枚举 / 环境常量（`endpoints.js` / `dict.js` / `app.js`） |
| `rule-page-services` | 弹窗、loading、跳转返回、登录拦截跳转、多弹窗叠层问题 |
| `rule-ui-components` | 选组件、封装公共组件、uview 不生效 / easycom 报错 |
| `rule-style-tokens` | 颜色 / 字号 / 间距 / 圆角 / 阴影、scaffold 版式块、流光玻璃 |
| `rule-multi-platform` | 区分运行端、设备能力、条件编译、多端行为差异 |
| `rule-add-page` | 新增页面 / 列表页 / 表单页 / 详情页的完整流程 |
| `rule-performance` | 长列表、渲染体积、请求去重、分包、图片 |
| `rule-security` | 密钥、手机号 / token、鉴权、发布产物、敏感信息展示 |
| `rule-testing` | 写测试、回归验证清单、判断「能不能自动化测」 |

## 工作流 skill

| skill | 何时用 |
|---|---|
| `project-dev` | 开发新功能 / 修 bug / 做优化，需要版本化需求与业务文档 |
| `design-preview` | 出设计稿 / 照截图做模板 / 页面预览（产物在 `docs/design/`，本机留存） |

---

## 维护约定

- 新增或修改 rule-skill **必须**走 `project-skill-manager` 的 RULES-TO-SKILLS（唯一入口），
  并同步更新本表与 `.claude/CLAUDE.md` §4.2。
- 一个 skill 只回答一个主题；同一能力出现两次以上就该抽到 skill 或代码里。
- skill 里引用的符号必须真实存在（新增/改名时全局 grep 一遍）。