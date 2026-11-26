# 一次完整 feature 的产物示例（以「给演示页加一个只读列表」为例）

> 规则文档说「该怎么做」，本文件说「做出来长什么样」。
> **示例中的业务字段是虚构的**，但流程、文件位置、记录格式都是本工程真实口径。

---

## 阶段 0 · 用户开场

> **任务**：在演示页加一个「演示记录」只读列表（分页 + 下拉刷新）。
> **类型**：feature
> **范围**：`pages/demo/page-a.vue` 已有列表骨架，本次把它接到真实接口。
> **约束**：后端契约未到位，先用本地 mock；不要动登录态。
> **验收**：`npm run verify:mp-weixin` 通过；演示模式下能翻页。

---

## 阶段 1 · 需求商讨（project-dev）

**AI**：有三个点需要确认 —— ① 列表数据从哪来（后端接口还是本地 mock）？
② 空态文案；③ 是否需要在返回本页时刷新？

**用户**：先用 mock；空态「还没有演示记录」；写操作以后再加，现在不刷新。

**产出** `project-meta/versions/v1.0.1/requirement.md`：

```markdown
# v1.0.1 需求

## 原始需求
演示页加「演示记录」只读列表（分页 + 下拉刷新）。

## 澄清结论
- 数据源：本地 mock（契约未到位，接口留 TODO 指向 `api/demo.js`）
- 空态：还没有演示记录
- 返回刷新：暂不需要（无写操作）

## 不做
- 新增 / 编辑 / 删除（等后端契约）

## 验收
- `npm run verify:mp-weixin` 通过
- 演示模式下翻页正常、空态可见
```

---

## 阶段 2 · 架构判断（architect，只读）

**结论**：无需新分层 —— 列表页已有 `useList` + `app-list-state` 骨架，
数据访问留 `api/demo.js` 的方法位（不把 mock 写进页面）。

**影响面**：`pages/demo/page-a.vue` · `api/demo.js`（预留签名） · 无新页面 / 新权限码。

---

## 阶段 3 · 契约（api_designer）

（本次无真实后端，只登记预期签名）

```js
// api/demo.js
/** 演示记录列表（契约待定：预期 GET /admin/demo/list?page&page_size） */
export function list(params) {
	return curl.get(ENDPOINT_DEMO_LIST, params);
}
```

`config/endpoints.js`：

```js
// ⚠️ 示例沿用已有登记（演示模块）；真实接口路径待后端确认后再加常量，不要在页面里写字符串
export const ENDPOINT_DEMO_LIST = 'web/demo/list';
```

---

## 阶段 4 · 实现（frontend_engineer）

`pages/demo/page-a.vue` 的关键改动：

```diff
-	const { items, loading, firstLoading, isEmpty, error, finished, reload } = useList(fetchRows, {
-		pageSize: 10
-	});
+	// 契约到位后把 fetchRows 换成 demoApi.recordsList（分页字段已与后端一致）
+	const { items, loading, firstLoading, isEmpty, error, finished, reload } = useList(fetchRows, {
+		pageSize: 10
+	});
```

页面里**没有**新增业务规则；mock 只存在于页面私有函数，替换点写清楚。

---

## 阶段 5 · 测试（test_agent，默认只生成）

产出清单：

| 用例 | 预期 |
|---|---|
| 首屏 10 条 | `items.length === 10`，`finished === false` |
| 触底 | 追加下一页，`page` 递增 |
| 最后一页 | `finished === true` |
| 清空后刷新 | `isEmpty === true`，显示空态 |

（本模板未装测试框架，以上为手工回归清单。）

---

## 阶段 6 · 安全（security_agent，只读）

**未发现阻断项**。检查范围：无新增接口路径字符串、无手机号 / token 展示、无 `guard:false` 滥用。

---

## 阶段 7 · 文档记录

`versions/v1.0.1/CHANGELOG.md`：

```markdown
# v1.0.1 变更

## 一、代码变更
| 文件 | 动作 | 原因 |
|---|---|---|
| src/pages/demo/page-a.vue | 改 | 接 `useList`（原为静态假数据） |
| src/api/demo.js | 改 | 预留 `recordsList` 签名（契约待定） |
| src/config/endpoints.js | 改 | 沿用 `ENDPOINT_DEMO_LIST`（示例） |

## 二、业务规则
无（`business-logic.md` 不变）。

## 三、验证
| 项 | 命令 | 结果 |
|---|---|---|
| 构建 | `npm run verify:mp-weixin` | 未执行，待验证 |

## 四、评审
评审：<待用户确认后填写 / 跳过（用户确认）>
```

---

## 阶段 8 · 收尾提问

> AI：这次改动要评审吗？要的话请在本仓**新开一个 Claude 窗口**，开好回我一声；
> 不做的话我在 CHANGELOG 记「评审：跳过（用户确认）」。

**用户**：不评审。

`CHANGELOG.md` 落一行 `评审：跳过（用户确认）`，commit：

```
feat: 演示页接 useList 只读列表 —— 统一分页/空态/重试，mock 替换点留在页面注释
```

---

## 这个示例想说明的三件事

1. **记录的量**：一个小 feature 的 requirement + CHANGELOG 合计不到 60 行，不是写论文。
2. **契约不确定就明说**：占位路径 +「待后端确认」，不许编字段。
3. **验证不编造**：没跑就写「未执行，待验证」。