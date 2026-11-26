# Bug 史（只留跨项目复用的教训）

> 源工程 30+ 条业务 bug 已随业务删除。这里只保留与模板基础设施相关的两条。

## BUG-001 · 组件类名撞 ColorUI 全局原子类，行内 flex 全废

**现象**：某个表单行组件在真机上整行被浮动到右边、内部 flex 布局失效。
**根因**：根类名用了 `.fr`，而 `common/css/main.css`（vendored ColorUI）有全局
`.fr { float: right }`；组件样式优先级压不住全局浮动。
**修法**：类名 ≥3 字母 + 语义前缀（该组件改为 `.frow__*`）；写前缀前
`grep -n "^\." src/common/css/main.css`。
**教训**：vendored CSS 的全局原子类是**命名雷区**，尤其单/双字母类。

## BUG-008 · uview 弹层根节点 `flex:1` 与页面滚动区抢高度

**现象**：页面上弹层打开后，内容区被挤到只剩四分之一，切换看起来「不换数据」。
**根因**：`.u-popup` / `.u-datetime-picker` / `.u-picker` / `.u-search` / `.u-input` /
`.u-loadmore` 的根节点自带 `flex: 1`；它们一旦成为「页壳（flex 列 + 滚动区 flex:1）」的
直接子项，就与滚动区瓜分剩余高度。
**修法**：两道并存 —— `scaffold.scss` 全局兜底 `flex: none !important` +
页面给弹层传 class 自己收口。
**教训**：页壳 / 内容区的直接子项里凡是 uview 组件，先查它根类有没有 `flex: 1`。
（MP 端全局样式能否命中组件根节点仍未真机确证，见 `known_issues.md` K-08）