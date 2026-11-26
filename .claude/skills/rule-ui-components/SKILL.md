---
name: rule-ui-components
description: 在本工程写界面 UI、要选组件（按钮/输入/弹窗/列表/表格/上传/日期/轮播…）、要封装自定义公共组件、或发现 uview 组件不生效/easycom 报错时使用。规定 easycom 免 import 规则、color 类 prop 必须走 config/theme.js、本工程自有 7 个 app-* 组件的真实 props，以及自定义组件的目录与命名约定。
---

# rule-ui-components

**造任何 UI 之前，先翻组件速查表**（本工程替代物见下）。
本工程的原则：**视觉控件一律用 uview-plus，自己的组件只做「状态编排 + 委托渲染」**，
不重复实现按钮 / 输入框 / 空态这类东西。

> 📌 **来源**：源工程同名 skill（已随本次抽离去业务化），
> 本次适配：C 端依赖 `docs/uview-plus-components.md`（**本工程没有 `docs/`**），
> 已换成替代物；C 端自有 8 个 `app-*`（含 2 个业务组件），
> 本工程只有 7 个（2026-10-26 第四轮新增 `app-brand`），**props 表按本工程源码逐个实测重列**（未照抄 C 端）。

## 组件速查表在哪

| | |
|---|---|
| **本工程** | `src/uni_modules/uview-plus/types/comps.d.ts`（**85 条 `['up-*']` 登记**，键统一 `up-` 前缀，按类分组）+ `src/uni_modules/uview-plus/components/` 各组件源码 |
| 官方文档 | uview-plus 官网（`uview-plus` 的 components 章节） |

> ⚠️ **C 端有一份 `docs/uview-plus-components.md`**（139 个组件 6 类速查，从源码 JSDoc 生成），
> **本工程没有**（README 已声明本工程不带 `docs/`）。
> 若要那份速查表，请查 uview-plus 官方文档（模板未附带）。

## 硬性禁令（MUST / MUST NOT）

> **本节是本主题 MUST / MUST NOT 的唯一权威。**

- ❌ **不要重复造 uview-plus 已有的控件**（按钮 / 输入框 / 空态 / 弹层 / 上传 / 日期选择…）
- ❌ **不要手改 `src/uni_modules/uview-plus/`** —— 第三方整包，升级即丢改动
- ❌ **`color` / `textColor` / `iconColor` / `activeColor` 类 prop 禁止写字面色值** ——
  必须从 `config/theme.js` 取
- ❌ **`<style>` 里禁止 import `config/theme.js` 去拼字符串** —— 反过来用 SCSS 变量（`$color-primary`）
- ❌ 自定义组件不写进 `pages.json` 的 `easycom.custom` 就去用（会发现标签渲染不出来）
- ❌ 组件类名**禁止 <3 字母**、禁止撞 ColorUI 原子类（先 grep `common/css/main.css`）
- ❌ **弹层 / 底部抽屉里禁止放 `input` / `textarea`**（含 `u-input` / `u--input` / `u-search` / `u-number-box`）。
  选容器前先问一句「**会不会弹软键盘**」：
  · **会弹键盘 → 整屏页承担**：多字段表单 / 筛选点行 → `pages/common/field-editor`
    （`services/fieldEditor.editField`）、省市区联动 → `pages-sub/common/region-picker`（分包，按需下载）；
    **单字段的独立页就在页内直接写 input，不再二次跳**（`pages/common/field-editor` 即此形态）。
    理由：微信 input 默认 `adjust-position=true`，键盘弹起会把 `position: fixed` 的弹层整个顶上去，
    底部输入框被键盘盖住、弹层高度还会跳变 —— 逐端调避让的成本远高于整页承载。
  · **不会弹（纯选择 / 单选 / 确认）→ 弹层优先**（`u-popup` / `u-datetime-picker` / `u-picker` / 自绘 option 行）；
    只有**联动多列**（省市区）、**长列表**、需要整屏承载时才跳页。
  ★ 现役范例：`pages/operation/components/reject-sheet.vue`（弹层里只放单选，备注点行跳 `field-editor`）·
    `pages/demo/page-b.vue` 的金额类字段可照此用 `field-editor` 的 `decimal` 档。
  ⚠️ 页内**单行** input 的 `confirm-type="done"` + `@confirm` 要求见 `rule-add-page` 的表单页骨架。

## 用法约定

### 1) 组件怎么引：easycom，不 import

`pages.json` 已配（**本工程与 C 端逐字相同**）：

```json
"easycom": { "autoscan": true,
  "custom": { "^u--(.*)": "@/uni_modules/uview-plus/components/u-$1/u-$1.vue",
              "^up-(.*)": "@/uni_modules/uview-plus/components/u-$1/u-$1.vue",
              "^u-([^-].*)": "@/uni_modules/uview-plus/components/u-$1/u-$1.vue" } }
```

- `<u-xxx>` / `<up-xxx>` / `<u--xxx>` **直接写，不需要 import**；`main.js` 里也不 `app.component()`
- **本工程自有组件同理自动注册**（`components/app-xxx/app-xxx.vue`，**目录名 = 文件名 = 标签名**）：
  `<app-navbar />` `<app-loading />` `<app-modal />` `<app-refresher />`
  `<app-list-state />` `<app-skeleton />` `<app-brand />`
- `main.js` 只装插件：`app.use(uviewPlus)`

### 2) 场景 → 先考虑这些组件

| 要做的东西 | 首选 |
|---|---|
| 按钮 | `.btn` 版式块（脚手架统一观感）或 `u-button`；行内小按钮 `.btn--sm`，主 CTA `.btn--lg btn--block` |
| 文字/图标/图片 | `u-icon` / `u-image`（带加载失败兜底）/ `u-text` / `u-avatar` / `u-tag` / `u-badge` |
| 输入 | `u-form` + `u-form-item` + `u-input` / `u-textarea`（⚠️ **`u-form` 三坑见 `rule-add-page`**） |
| 选择 | `u-select`（本地数组）/ `u-picker`（多列）/ `u-datetime-picker` / `u-calendar` / `u-cascader` / `u-radio(+group)` / `u-checkbox(+group)` / `u-switch` / `u-subsection` / `u-slider` / `u-rate` / `u-number-box` |
| 搜索 | `u-search` —— ⚠️ **先确认后端支持关键词字段**（契约错误码表不全，不确定问后端） |
| 弹层容器 | `u-popup`（上下左右中，内容自绘）/ `u-action-sheet` / `u-modal`（**确认框别用它，见下**） |
| 提示反馈 | `u-toast` / `u-notify` / `u-alert` / `u-empty` / `u-no-network` / `u-overlay` / `u-tooltip` / `u-popover` |
| 列表结构 | `u-cell` + `u-cell-group`（设置页那种一行一项）/ `u-collapse` / `u-swipe-action`（左滑删）/ `u-divider` / `u-gap` |
| 长列表性能 | `u-list` / `u-virtual-list` / `u-refresh-virtual-list`（几千条必须用，不能一次渲染完） |
| 布局 | `u-row` + `u-col`（12 分栏）/ `u-grid` + `u-grid-item` / `u-box` / `u-sticky` / `u-safe-bottom` / `u-status-bar` / `u-transition` / `u-back-top` |
| 数据展示 | `u-card` / `u-table`(`u-tr/u-th/u-td`) / `u-swiper` / `u-scroll-list` / `u-waterfall` / `u-album` / `u-tabs` / `u-navbar` / `u-tabbar` / `u-steps` / `u-index-list` / `u-dropdown` / `u-pagination` |
| 进度/数值 | `u-line-progress` / `u-circle-progress` / `u-count-to` / `u-count-down` |
| 富文本/特殊 | `u-parse`（HTML）/ `u-markdown` / `u-read-more` / `u-qrcode` / `u-barcode` / `u-poster` / `u-cropper` / `u-canvas` / `u-copy` |
| 上传 | `u-upload`（配 `curl.upload`，见 `rule-request-chain`） |

### 3) 组件的颜色：只从 `config/theme.js` 拿

uview 的 `color` / `textColor` / `iconColor` / `activeColor` 这类 prop **只收字符串**，
读不到 SCSS 变量 —— 所以有 JS 镜像（**本工程 24 个键**）：

```js
import { theme } from '@/config/theme';
// <u-icon name="account" :color="theme.primary" />          ← 主色（紫）
// <u-empty :icon-color="theme.textSub" :text-color="theme.textMuted" />
```

| 组 | 键（值 = `theme.scss` 的同名 token） |
|---|---|
| 品牌色（紫） | `primary`(#6D5BFF) `primaryDark`(#5A48E8) `primaryLight`(#EFEDFF) |
| 数据强调 | `data`(#22C3E6) —— 语义**独立于主色**（数字/图表） |
| 状态色 | `success` `warning` `danger` `info` |
| 文字 | `textTitle` `textMain` `textSub` `textMuted` `textDisabled` `textInverse` `textOnPrimary`(主色底上的字) `textOnAurora`(极光上的字) |
| 背景/填充 | `bgPage` `bgCard` `bgFill` `bgHover` |
| 描边 | `border` `divider` |
| 占位 | `iconPlaceholder`(图标缺省色) |
| 组件尺寸（rpx） | `sizeTabbarH`(92) —— ★ 只有**页面做布局算术要算进去**的尺寸才镜像（见该文件头） |

> ⚠️ **两个真源都是 `theme.scss`**：这里的值必须与它一致，**改色两处一起改**。
> ⚠️ **别凭印象编键名**：`config/theme.js` 只有上面这 24 个。
> 需要新键时先加进该文件（并按 `rule-style-tokens` 的「换肤」节同步 `theme.scss`）。
>
> ⚠️ **大多数场景根本不用传色**：主色 / 文字色 / 边框色已由 `base.scss` 的
> `page { --up-primary: … }` 覆盖，按钮/开关/选中态**自动跟项目 token**
> （见 `rule-style-tokens` 的「组件库跟色机制」）。只有**读不到 SCSS 变量**的 `color` 类 prop 才需要这里。

**样式表里反过来**：`<style scoped>` 用 SCSS 变量 `$color-primary` / `$sp-4` / `$fs-body`…
（经 `uni.scss` 全局注入，**不需要 import**），**不要** import `theme.js` 去拼字符串。

**改主色时两处一起改**：`common/css/theme.scss`（**真源**）+ `config/theme.js`（**镜像**）。
详见 `rule-style-tokens`。

**不需要传色的场景**：主色/文字色/边框色已被 `base.scss` 覆盖，
按钮、开关、选中态**自动跟项目 token**，别逐个组件传色。

### 4) 本工程自有七个组件（真实 props，逐个实测）

> ⚠️ C 端有 8 个（多出 `app-score-ring` / `app-plate-keyboard` —— **那两个是 C 端业务组件，本工程没有**）。
> 下表 props 按**本工程源码实测**重列（`defineProps` 定义），不是照抄 C 端。

#### `<app-modal />`
全局弹窗容器。**每页模板放一次**，配合 `useModal` 使用。
**无 props。** `close: true` 才允许点蒙层/✕ 关闭。

> **为什么不用 `u-modal`**：它的 ✕ 会落进白色内容区（白压白看不见）+ 遮罩挡不住底层滚动。

#### `<app-loading />`
全屏 loading 渲染方（`showLoading` 与请求层 `{ loading: true }` 最终都驱动它）。

| prop | 说明 |
|---|---|
| `show` | **显式传真/假 = 切「局部模式」**；**默认 `null` = 全局模式**（接 `store/loading`） |
| `text` | 转圈下方文案 |
| `image` | OSS 相对路径（经 `ossUrl()` 拼域名）；不传则用 `config/app.js` 的 `LOADING_IMAGE`，为空串时**默认纯 CSS 品牌色转圈**；加载失败退 `LOADING_IMAGE_FALLBACK` |
| `mask` | 暗遮罩。**按钮请求的页要 `:mask="true"`** |

#### `<app-list-state />`
列表状态区（骨架 → 空 → 失败 → 加载更 → 到底，**优先级在组件内定义一次**）。
与 `useList` 状态**一一对应直传**：

```html
<app-list-state :first-loading="firstLoading" :empty="isEmpty" :error="error"
                :loading="loading" :finished="finished" @retry="reload" />
```

| prop | 默认 | 说明 |
|---|---|---|
| `firstLoading` | false | 来自 `useList` |
| `empty` | false | 来自 `useList`（`isEmpty`） |
| `error` | `''` | **收字符串或 ApiError 对象**（组件内归一 `message`） |
| `loading` | false | 分页加载中 |
| `finished` | false | 已到底 |
| `skeletonType` | `'list'` | **传空串退回转圈** |
| `skeletonCount` | 4 | |
| `emptyIconMode` | `'data'` | uview `u-empty` 预置图标：data/list/search/wifi… |
| `emptyText` | `'还没有数据'` | |
| `emptyRetryText` | `'刷新一下'` | |
| `errorRetryText` | `'点击重试'` | |
| `loadingText` | `'加载中…'` | |
| `finishedText` | `'— 没有更多了 —'` | |

**事件**：`@retry`（空态与失败态的重试按钮统一 emit，怎么重试由页面决定，一般是 `reload`）

#### `<app-skeleton />`
骨架屏（`u-skeleton` 的薄包装，形状预设对齐 scaffold 版式）。

| prop | 说明 |
|---|---|
| `loading` | 传了则**包内容模式**（`<app-skeleton :loading="x">真实内容</app-skeleton>`）；不传则**条件渲染模式** |
| `type` | `list`（方头像+标题+两行，模仿 `.rows/.row`）/ `card` / `text` |
| `rows` | 行数 |
| `count` | 重复块数 |
| `animate` | 动画开关 |

#### `<app-navbar />`
自绘顶栏（**高度含状态栏、自动让位微信胶囊、H5 状态栏为 0**）。
依赖 `services/platform.js` 的 `getLayout()`。

| prop | 说明 |
|---|---|
| `title` | 标题 |
| `showBack` | 是否显示返回 |

> ⚠️ 用它的页面在 `pages.json` 要写 `"navigationStyle": "custom"`。

#### `<app-brand />`
品牌区（渐变圆徽标「估」+ 主标题 + 可选副标）。**2026-10-26 第四轮新增。**

| prop | 说明 |
|---|---|
| `title` | **必传**。主标题 —— 绑定页给「绑定管理员账号」，首页启动态给品牌名（`APP_NAME`） |
| `sub` | 副标，**默认 `''` = 整行不渲染**（不是渲染空 text —— 空行会吃掉上距与行高，两屏高度就对不上）。启动态给中性的「正在进入…」 |

**文字是卡内深墨**（`$text-title` / `$text-muted`）：两个消费方都把它放在 `.glass` 玻璃卡里。
要压在极光上得另加 tone 档（照 `app-refresher` 的 `tone` 模式），**别在调用方用 scoped 覆盖颜色**。

⚠️ **两个消费方共用它是刻意的**：首页冷启动的「启动判定态」与绑定页之间只隔一次
`reLaunch`（微信端**整屏瞬切、无转场动画**），品牌区是两屏之间**唯一内容与尺寸不变的锚点**
（⚠️ 不指屏幕位置：卡垂直居中，绑定页的卡更高 → 徽标会随卡高上移一截）——
各写一份、尺寸稍有差，切换瞬间就会看出位移。改它的取值要**同时看两页**
（规则见 `.claude/CLAUDE.md` §3.3 的冷启动说明）。

#### `<app-refresher />`
三段跟手下拉指示器（下拉刷新 / 松开立即刷新 / 正在刷新数据中…）。
**浮层壳内聚在组件里**（页面不自己包 `position: fixed` 的壳）。

| prop | 说明 |
|---|---|
| `show` | 是否可见 |
| `state` | 三段态（由 `usePullRefresh` 给的 `pullState`） |
| `lastAt` | 最后刷新时刻（`usePullRefresh` 给的 `lastRefreshAt`） |
| `offset` | 跟手位移（`usePullRefresh` 给的 `offset`） |
| `top` | 浮层挂载高度 = **滚动区上沿 y 坐标**。默认 `null` = `customBarHeight`（适用于**顶部有 `app-navbar`** 的页面）。★ **没有自绘导航栏的页面必须传**（传 `layout.statusBarHeight`）—— 否则指示器落进 iPhone 灵动岛被物理遮住（真机踩过：落进灵动岛） |
| `tone` | `'ink'`（默认） / `'aurora'` —— 下拉空档露出**深色极光底**时传后者整组转白（否则墨色文字≈1.5:1 对比度，等于看不见） |

> 完整接线（含五条不可省口径）见 `rule-add-page`。

### 5) 什么时候才自己封装组件

| 情况 | 怎么做 |
|---|---|
| 页面**专属**的子组件 | 写在**页面同级** `pages/<页>/components/`，**页面显式 import**（不进 easycom 扫描域） |
| **跨页通用**（≥2 个页面要用） | 提升到根 `components/app-<name>/`，走 easycom 免 import |
| 只是一段**渲染逻辑**、构不成组件 | 留在页面 `<template>` 里 |
| 跨页复用的**能力**（不是 UI） | 抽 `composables/` |

**命名约定**：目录名 = 文件名 = 标签名（`components/app-foo/app-foo.vue`）。
**类名**：≥3 字母 + 语义前缀，页面私有类名带页面前缀（BEM，如 `vlist-page__cab`）。
详见 `rule-style-tokens`。

### 6) 本文件独有的坑

- ⚠️ **组件类名撞 ColorUI**：`common/css/main.css` 有全局原子类（如 `.fr { float: right }`）。
  某表单行组件用 `.fr` 当根类名 → 真机上被浮动到右边、行内 flex 全废。
  **写类名前先 grep**：`grep -n "^\." src/common/css/main.css`
- ⚠️ **uview 弹层族根节点被页面滚动区挤压**（★ 2026-10-26 修过一次真实故障）：
  uview **一整族**组件的根节点自带 `flex: 1` —— `.u-popup`（`$u-popup-flex`）、
  `.u-datetime-picker`、`.u-picker`、`.u-search`、`.u-input`、`.u-loadmore`。
  而本工程页壳是「flex 列 + 滚动区 `flex:1`」→ 它一旦成为页壳的直接子项，
  就**与滚动区瓜分剩余高度**：一个弹层吃掉半屏（把 `<u-datetime-picker>` 直接放页壳，
  下半屏变成弹层空盒子，表现得像「切 tab 不换数据」，见 `bug_history.md` BUG-008）。
  **口诀：页壳/内容区的直接子项里凡是 uview 组件，先查它根类有没有 `flex: 1`。**
  修法两道并存（`scaffold.scss` 的全局兜底 + 页面传 `class` 自己收口），
  因为 **MP 端全局样式能否命中组件根节点未真机确证**
  （状态：🟡 未确证，见 `memory/known_issues.md` K-08；MP 侧已有机制证据：
  uni-app 运行时给组件设了 `styleIsolation: 'apply-shared'`，页面/全局样式能进组件内部）。
  ⚠️ `.u-search` / `.u-input` 常作**行向** flex 子项靠 `flex:1` 占满整行，
  **不要**把它们加进全局 `flex: none` 名单（会让搜索行/输入行塌掉）——
  那种场合由使用方（如 `app-list-state` 的 `.state__more`）自己收口。

## 来源

移植自 C 端工程 `.claude/skills/rule-ui-components/SKILL.md`（2026-10-26）。
C 端原版含 `rules/scaffold-musts.md` §7。

本次适配：
① 组件速查表依赖由 `docs/uview-plus-components.md`（本工程无 `docs/`）改为
`src/uni_modules/uview-plus/types/comps.d.ts`（**85 条 `['up-*']` 登记**）；
② 自有组件从 C 端 8 个减为**本项目实际 6 个**（**2026-10-26 第四轮新增 `app-brand` 后为 7 个**），**props 表逐项从源码 `defineProps` 实测重列**；
③ 色值键表按本工程 `config/theme.js` 实测的 **24 个键**重列
（⚠️ 2026-10-26 冷启动过渡轮更正：原表整段是 **C 端键**（`brandYellow`/`brandRed`/`track`/
`textOnYellow`/`bgFillWeak`…），且写「28 个键」—— 与本工程实际**一个都不对**）；

④ 剔除 C 端业务引用（`app-score-ring` / `app-plate-keyboard` / 车牌键盘等）。
2026-11-25「输入 / 选择容器判据」轮：§硬性禁令补**弹层不放 input** + **纯选择优先弹层、联动多列才跳页**
（与 C 端同口径；本工程代码**本来就合规**，属文档补漏，无代码改动）。
