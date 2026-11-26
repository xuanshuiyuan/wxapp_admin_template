# templates/unit-test — 单元测试模板

> ## ⚠️ 默认不允许执行测试
> 本模板用于**生成**测试代码。**执行测试需用户在本轮明确要求**
> （见 `.claude/skills/rule-testing/` 第一条、`.claude/CLAUDE.md` §9.3）。

## 项目现状（必读）

| 项 | 现状 |
|---|---|
| 测试框架 | **未安装**（`devDependencies` 无 vitest / jest） |
| 已有测试 | 无 |
| **引入框架** | ★ **是用户决策** —— 本系统不擅自 `npm install` |

**推荐**：`vitest`（与项目的 Vite 构建链天然契合，零额外配置负担）。

```bash
# ⚠️ 需用户明确授权后才可执行
npm i -D vitest
# package.json scripts 加： "test": "vitest run"
```

## 文件

| 文件 | 用途 |
|---|---|
| `example.test.js` | 单元测试模板（vitest 风格） |

## 优先测什么（按投入产出排序）

| 优先级 | 目标 | 为什么 |
|---|---|---|
| ★★★ | `src/utils/*` 纯函数（`qs` / `date` / `color` / `number` / `text` / `threshold`） | 零依赖、零 mock，性价比最高 |
| ★★★ | `src/services/http/error.js` 的 `toApiError` / `errorTip` | 每个 `type` 分支一条，覆盖全部错误形态 |
| ★★ | `src/composables/useList.js` 的 `defaultPick` | 纯函数（虽在同文件），分页容错逻辑易错 |
| ★★ | `src/composables/useList.js` 的 `finished` 判定 | 无 `total` 时的到底逻辑 |
| ★ | 状态机（`usePullRefresh` 三段态） | 需 mock 生命周期，成本较高 |
| — | 页面组件 | ❌ 依赖 uni 运行时，**不做单测**，走手工清单 |

## 必测的输入类别

| 类别 | 例子（本项目真实边界） |
|---|---|
| 正常值 | `maskMobile('13812348388')` → `'138****8388'` |
| **边界** | `maskMobile` 长度 `<7` → `'****'`（分界点是 7） |
| 空值 | `''` / `null` / `undefined` / `0` |
| 非法类型 | 数字传给期望字符串的函数 |
| **失败路径** | `ApiError` 六个 `type` 全覆盖 |
| **数组参数** | `buildURL` 的 `key=v1&key=v2` 展开 |
| **空值过滤** | `buildURL` 过滤 `undefined`/`null`，**但保留 `0` / `''` / `false`** |

## 用例设计规则

1. **一条用例一个断言主题**。
2. **名字说清「在什么输入下期望什么」**：
   ```js
   // ❌ it('works', ...)
   // ✅ it('maskMobile：长度 <7 时全星号（不猜格式）', ...)
   ```
3. **测试适配实现，不是反过来** —— ❌ 禁止为让测试通过而改业务代码。
4. **不制造假覆盖率** —— 只测 happy path 或 `expect(true).toBe(true)` 是无效测试。
5. **不写真实敏感数据** —— 用 `13800000000`、`token_fake_xxx` 这类明显假值。

## 输出必须包含

1. 测试文件（完整内容 + 中文 why 注释）
2. 用例清单表：`用例名 · 输入 · 期望 · 覆盖点 · 可自动化?`
3. **★ 未覆盖清单 + 原因**（比覆盖率数字更有价值）
4. 执行命令（**供用户自行执行**）

## 跨栈对照

| 栈 | 框架 | 命令 |
|---|---|---|
| **本项目** | 建议 vitest（未装） | `npx vitest run` |
| Go | 标准库 `testing` | `go test ./...` |
| Java | JUnit 5 + Mockito | `mvn test` |
| Python | pytest | `pytest -q` |
| PHP | PHPUnit | `vendor/bin/phpunit` |
| Node 后端 | vitest / jest | `npm test` |

**不变的部分**：边界必测、失败路径必测、不为测试改实现、未覆盖必须声明。