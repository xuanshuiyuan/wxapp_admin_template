# templates/integration-test — 集成测试模板

> ## ⚠️ 默认不允许执行测试
> 本模板用于**生成**测试代码。**执行需用户明确要求**
> （`.claude/skills/rule-testing/` 第一条、`.claude/CLAUDE.md` §9.3）。

## 项目现状（必读 —— 决定了本类测试的可行性）

| 项 | 现状 | 影响 |
|---|---|---|
| 测试框架 | **未安装** | 需用户决策引入 vitest |
| `uni.request` | 全局对象，**依赖 uni 运行时** | 必须 **mock** 才能测请求链路 |
| 页面 | 依赖 uni 生命周期 | ❌ **不做集成测试**，走手工清单 |
| `services/http/*` | 可测（若 mock 掉 `transport.js`） | ★ 集成测试的主要目标 |

**结论**：本项目的集成测试**聚焦请求链路**（`request.js` 的六段策略），
用 mock 替换 `transport.js` 的 `send`。**页面级集成不做**（成本远高于收益）。

## 文件

| 文件 | 用途 |
|---|---|
| `request.integration.test.js` | 请求链路集成测试模板（mock transport） |

## 集成测试 vs 单元测试

| | 单元测试 | 集成测试 |
|---|---|---|
| 范围 | 单个函数 | 跨模块链路 |
| mock | 无 | **mock 边界**（如 transport） |
| 本项目目标 | `utils/*`、`error.js` | `request.js` 的六段策略、守卫链路 |
| 成本 | 低 | 中（需 mock uni 全局） |

## 请求链路必须覆盖的六段策略

来自 `src/services/http/request.js` 的实际逻辑：

| # | 策略 | 断言什么 |
|---|---|---|
| 1 | **补会话** | 无 token 时先调 `authHandler`；**失败不拦请求**（公开接口不依赖登录态） |
| 2 | **签名注入** | header 含 7 个字段；`sign` 为大写 MD5 |
| 3 | **HTTP 状态** | 非 2xx → `ApiError(type='http')` |
| 4 | **业务码** | `code===0` 成功；**无 `code` 字段视为成功**；非 0 → `business` |
| 5 | **40005 重登重放** | 自动重登 → **只重放一次**（`authRetry:false` 防死循环） |
| 6 | **全局守卫** | 命中 → `ApiError(type='guard')`；★ **toast 强制 false**；守卫动作被调用一次 |

外加 **`loading` 托管**：`{ loading: true }` 时 `showLoading`/`hideLoading` 成对调用
（**失败路径也要 hide** —— 收敛在 `finally`）。

## 本项目**无法**自动化、必须走手工清单的项

| 项 | 原因 |
|---|---|
| 真机签名（`apiKey` + 后端校验） | 依赖运行时 `.env.*.local` 的密钥与后端 |
| `wx.login` / `getPhoneNumber` 链路 | 依赖微信真机能力 |
| 守卫 **busy 去重 + 1s 冷静期** | 依赖并发时序 + 真实后端配合 |
| 多端差异（MP 样式隔离、`env()` 兼容） | 需真机 |
| **`.u-popup` 在 MP 端是否被挤压** | ⚠️ **未确证**（`known_issues.md` K-08） |

## 输出必须包含

1. 测试文件（完整内容 + 中文 why 注释）
2. 用例清单表
3. **★ 未覆盖清单 + 原因**（尤其是「必须走手工清单」的部分）
4. 手工验证步骤（可直接照着做）
5. 执行命令（**供用户自行执行**）

## 跨栈对照

| 栈 | 集成测试做法 |
|---|---|
| **本项目** | mock `transport.js` 的 `send`，测 `request.js` 策略 |
| Go | `httptest.Server` + 真实 handler |
| Java | `@SpringBootTest` + MockMvc |
| Python | `TestClient` + 依赖覆盖 |
| PHP | `TestCase` + HTTP 内核 |
| Node | `supertest` + 应用实例 |

**不变的部分**：mock 在**边界**（不 mock 被测模块自身）、覆盖失败路径、
未覆盖项必须声明。