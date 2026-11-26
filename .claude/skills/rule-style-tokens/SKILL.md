---
name: rule-style-tokens
description: 当需要写样式、调整颜色/字号/间距/圆角/阴影、新建组件类名、使用 scaffold 版式块或**流光玻璃（Aurora Glass）**视觉语言时使用（含 token / 原子类 / 版式块全清单与尺度基准）。也用于排查「真机上布局坏了/被浮动了」「样式改动影响到别的页面」「换主色要改哪几处」。提供本工程的样式三层体系与类名规范。
---

# rule-style-tokens

本工程的**样式三层体系**。核心：**换主色 / 字号 / 间距只改一个文件。**

> ⚠️ **2026-10-26 冷启动过渡轮整篇校正**：原文本是**C 端口径的残留** ——
> 列的是 C 端的「**HUD 座舱**」视觉语言（`.hud-page` / `.hud-frame` / `.hud-panel` / `.hud-tile`）、
> C 端原文列的品牌黄主色（`$color-brand-yellow`）、`$color-nev-plate-*` / `$color-shot-*` / `$color-charge-fast`、
> C 端原文列的 `.list-item` / `.chip` / `.footer-bar` / `.badge` 等 ——
> **本工程要么已删除（HUD 整套随「流光玻璃」改版整段删）、要么从未存在**。
> 照它写样式会得到**一整套无样式的页面**。现清单**全部按 `theme.scss`(116 token) ·
> `base.scss` · `scaffold.scss`(680 行) 实测重列**。

## 三层结构

```
src/common/css/theme.scss   ★ 唯一值源：只写 SCSS 变量，禁止写任何 CSS 规则（116 个）
src/common/css/base.scss    页面默认 + 语义文字类 + 原子类 + `page{--up-*}` 给 uview 跟色
src/common/css/main.css     ColorUI（只用 flex/布局 与 .solid-* 边框原子类）
src/styles/scaffold.scss    通用版式块 + **流光玻璃（Aurora Glass）**视觉语言（680 行）
src/config/theme.js         ★ theme.scss 的 JS 镜像（**24 键**）—— 给 uview 组件
                            color prop 这类只能传字符串的场景用
```

**注入链**：`src/uni.scss` 把 `theme.scss` 注入每个编译块 →
所有 `<style lang="scss">` 可直接用 token（**不需要 import**）。

## 硬性禁令（MUST / MUST NOT）

> **本节是本主题 MUST / MUST NOT 的唯一权威。**

- ❌ **硬编码色值 / 字号 / 间距**（全部走 token）
- ❌ **类名 <3 字母**，或写前缀前不 grep `common/css/main.css`（见下方「真机事故」）
- ❌ `<style>` **不加** `scoped`（会污染全局）
- ❌ **手写 `env(safe-area-inset-*)`**；`calc(... env ...)` 不写不含 env 的回退行
- ❌ **为单个页面的需求改 `scaffold.scss` 的公共版式块**
  （⚠️ `common/css/` 与 `styles/` 是**与 C 端共用的目录**，改动需双向下发）
- ❌ 在 `scroll-view` 内用大面积 `box-shadow` / `filter` / 半透明叠层（小程序端重绘成本高）
- ❌ SCSS 嵌套超过 3 层
- ❌ `<style>` 里 import `config/theme.js` 去拼字符串（反过来用 SCSS 变量）

## Token 全清单（`theme.scss`，**真源**）

> 改样式前先查这里有没有现成的，**不要新造**。命名即语义。
> 复核：`grep -oE '^\s*\$[a-z0-9-]+' src/common/css/theme.scss`

| 组 | Token |
|---|---|
| **主色（紫）** | `$color-primary`(#6D5BFF) `$color-primary-dark` `$color-primary-light` `$color-primary-soft`(12% 透明，控件底) `$color-primary-ring`(16% 透明，聚焦光圈) |
| **语义色** | `$color-success` `$color-warning` `$color-danger` `$color-info` `$color-data`(数据/图表) |
| **语义浅底** | `$color-success-light` `$color-warning-light` `$color-danger-light` |
| **文字** | `$text-title` `$text-main` `$text-sub` `$text-muted` `$text-disabled` `$text-inverse` `$text-on-primary`(紫底/渐变 CTA 上) `$text-on-aurora`(极光上的白) `$text-on-aurora-2`(极光上的 78% 白) |
| **背景** | `$bg-page` `$bg-card` `$bg-fill` `$bg-hover` `$bg-mask` |
| **极光 / 玻璃** | `$bg-aurora`(两光斑 + 160° 三停渐变) `$bg-aurora-cta`(CTA 渐变) `$glass-bg-fallback`(近实心白，MP 降级档) `$glass-bg`(半透) `$glass-line`(玻璃描边) `$glass-blur` |
| **描边** | `$border-color` `$divider-color` |
| **字号（语义档）** | `$fs-micro`(21rpx) `$fs-caption`(23) `$fs-body`(25) `$fs-lead`(27) `$fs-label`(29) `$fs-cta`(33) `$fs-price`(35) `$fs-display`(38) `$fs-hero`(46) |
| **字号（数值档）** | ⚠️ **全是语义档的别名**（写新代码优先用语义档）：`$fs-xs`→micro `$fs-sm`→caption `$fs-base`→body `$fs-md`→body `$fs-lg`→label `$fs-xl`→cta `$fs-2xl`→display `$fs-3xl`→hero |
| **字重** | `$fw-regular` `$fw-medium` `$fw-semibold` `$fw-bold` |
| **字体族** | `$font-timer`（v1.2.5）：**只给秒级倒计时数字**用（DIN Alternate → 等宽回落）。正文 / 标题**不要**套 —— DIN 的中文回落不统一，会变成「中英两套字形」 |
| **行高** | `$lh-hero` `$lh-display` `$lh-price` `$lh-cta` `$lh-label` `$lh-lead` `$lh-body` `$lh-caption` `$lh-micro` `$lh-tight` `$lh-base` `$lh-loose` |
| **间距** | `$sp-0-5`(4rpx) `$sp-1`(8) `$sp-1-5`(12) `$sp-2`(16) `$sp-3`(24) `$sp-4`(32) `$sp-5`(40) `$sp-6`(48) `$sp-7`(56) `$sp-8`(64) `$sp-10`(80) |
| **页面级间距** | `$page-padding` `$card-padding`（两者都 = `$sp-4`）`$card-gap` `$section-gap` `$chip-gap` |
| **圆角** | `$rd-panel`(48rpx，大卡/登录卡档) `$rd-card`(40) `$rd-control`(28，按钮/输入框) `$rd-chip`(12) `$rd-pill`(999)；别名 `$rd-sm`→chip `$rd-md`→card `$rd-lg`→panel `$rd-full`→pill |
| **阴影** | `$shadow-card`(白卡) `$shadow-entry`(列表卡按下抬影) `$shadow-glass`(玻璃卡，带紫彩) `$shadow-float`(浮层) `$shadow-bottom-bar`(固定底栏，向上投) `$shadow-cta`(渐变 CTA 彩影) |
| **固定尺寸** | `$size-cta-h`(92rpx) `$size-control-h`(88) `$size-chip-h`(36) `$size-icon-disc`(80，宫格图标圆盘) `$size-icon-button`(84) `$size-avatar`(68) `$size-tabbar-h`(92) |
| **结构 / 安全区** | `$nav-height` `$bottom-bar-gap` `$safe-bottom` `$safe-top` |
| **层级** | `$z-nav` `$z-bottom-bar` `$z-popover` |
| **动效** | `$ease-standard` `$duration-fast` `$duration-base` |

### JS 镜像（`config/theme.js`，**24 键**）

uview 的 `color` / `textColor` / `iconColor` / `activeColor` 这类 prop **只收字符串**，
读不到 SCSS 变量 —— 故有 JS 镜像。**键表与用法见 `rule-ui-components`**。

> ⚠️ **改主色时两处一起改**：`theme.scss`（**真源**）+ `config/theme.js`（**镜像**）。

## 原子类清单（`base.scss`）

按前缀分组（`grep -nE '^\.[a-z]' src/common/css/base.scss` 看全量；括号内为条数）：

| 前缀 | 用途 | 实例 |
|---|---|---|
| `c-*` (12) | 文字色 | `.c-title` `.c-muted` `.c-sub` `.c-link` `.c-white` |
| `t-*` (10) | 语义文字 | `.t-h1` `.t-desc` `.t-note` `.t-num` `.t-link` |
| `bg-*` (8) | 背景 | `.bg-page` `.bg-card` `.bg-hover` `.bg-primary` |
| `fz-*` (7) | 字号 | `.fz-xs` `.fz-base` `.fz-2xl` |
| `flex*` (7) | 布局 | `.flex1` `.flex-col` `.flex-v-center` `.flex-h-between` |
| `rd-*` (4) | 圆角 | `.rd-sm` `.rd-md` `.rd-lg` `.rd-full` |
| `fw-*` (3) | 字重 | `.fw-normal` `.fw-medium` `.fw-bold` |
| `lh-*` (3) | 行高 | `.lh-tight` `.lh-base` `.lh-loose` |
| `text-*` (3) | 对齐 | `.text-left` `.text-center` `.text-right` |
| `shadow*` (2) `hairline*` (2) `ellipsis` (2) | 其它 | `.shadow-card` `.shadow-float` `.hairline-top` `.ellipsis` `.ellipsis-2` |
| 单例 | — | `.m-auto` `.mt-auto` `.bordered` `.no-border` `.justify-text` `.hidden` `.pointer` `.flex-basis-auto` `.fz-base`… |

> `main.css`（ColorUI）**只消费不新增** —— 只用它的 flex/布局 与 `.solid-*` 边框原子类。

## 版式块清单（`scaffold.scss`，**真源**）

| 组 | 类名 |
|---|---|
| **页面默认** | `.page`（`min-height:100vh` + `$page-padding` 内距 + `$bg-page` 底；**不套** `.page` 的页面由 `base.scss` 的 `page{}` 兜底同款默认） |
| **极光底** | `.aurora-bg`（**加在定高页根上**，见其注释的光斑漂移警告）· `.on-aurora` · `.on-aurora-2` |
| **视口锁定页壳** | `.page-shell` · `.page-shell__scroll` · `.page-shell__body`（★ 三个的写法各有硬约束，见文件内注释） |
| **卡片** | `.card` `.card__hd` `.card__title` `.card__more` |
| **玻璃卡** | `.glass`（★ 两行回退不可反序：MP 端不支持 `backdrop-filter`）`.glass--railed`（骑缝：**只在 flex 父容器里成立**） |
| **区块头** | `.sect` `.sect__hd` `.sect__title` `.sect__more` |
| **指标条（四段等分）** | `.stats` `.stat` `.stat__label` `.stat__value` `.stat__value--wide` `.stat__delta` `.stat__delta--up` `.stat__delta--down` |
| **宫格入口** | `.entry-grid` `.entry` `.entry__inner` `.entry__inner--hover` `.entry__disc` `.entry__name` `.entry__desc` |
| **列表行（键值式）** | `.rows` `.row` `.row--last`（★ **必须按序显式加**，结构伪类在小程序端不可靠）`.row__main` `.row__title` `.row__desc` `.row__side` `.row__time` |
| **标签** | `.tag` |
| **头像** | `.avatar` `.avatar--aurora` |
| **按钮** | `.btn` `.btn--hover` `.btn--aurora`(渐变 CTA) `.btn--primary` `.btn--ghost` `.btn--soft` `.btn--sm` `.btn--lg` `.btn--block` `.btn-row` |
| **表单** | `.field` `.field__label` `.field__box` `.field__box--focus` `.field__input` `.field__eye` |
| **勾选行** | `.checkline` `.checkline__left` `.checkline__link` `.checkline__text` `.checkbox` `.checkbox--on` |
| **键值行** | `.kv` `.kv__k` `.kv__v` |
| **状态块** | `.state` `.state__text` `.state__retry` |
| **辅助** | `.more` `.tip` `.divider` `.version` `.safe-bottom` |
| **uview 弹层族兜底** | `.u-popup` / `.u-datetime-picker`（`flex: none !important`，见下「已知未确证」） |

> ⚠️ **`.footer-bar` 版式类不存在**：固定底栏的现行写法是页面自己写
> `position: fixed` + `z-index: $z-bottom-bar` + `box-shadow: $shadow-bottom-bar` +
> **两行底距**（纯 rpx 回退在前、叠安全区在后）：
> `padding-bottom: $bottom-bar-gap;` 然后 `padding-bottom: calc(#{$bottom-bar-gap} + #{$safe-bottom});`
> —— 见 `pages/admin-home/index.vue` 的子菜单弹层 `.ahome__sheet`。

## ★ 流光玻璃（Aurora Glass）视觉语言（本工程唯一视觉语言）

> ⚠️ 源工程 C 端的「HUD 座舱」（`.hud-frame` / `.hud-panel` / `.hud-tile` 双层斜切 + 流光描边 + 瓷面）
> 在本工程**已从 `scaffold.scss` 整体删除**（2026-10-26 用户定，`rules/architecture.md` §7）。
> **不要**从 C 端同步回来，也不要照着旧文档写 `.hud-*`。

**两种页面口径**（2026-10-26 设计稿 `docs/design/c-aurora-glass/` 定稿；稿不进 git）：

| 口径 | 适用 | 构件 |
|---|---|---|
| **首屏 / 品牌页** | 首页工作台、绑定页 | **整屏极光底**（`.aurora-bg` 挂页根）+ 玻璃卡（`.glass`，可 `.glass--railed` 骑缝）+ **白字**（`.on-aurora` / `.on-aurora-2`）→ `pages.json` 必须 `navigationBarTextStyle: "white"` |
| **二级页** | 列表 / 详情 / 表单 | **白顶栏 + `#FAFAFE` 浅底 + 白卡 + 紫为唯一强调色**；**不上极光与玻璃**（浅底上无处可模糊，玻璃会退化成一团灰白），识别度由「紫主色 + 20px 圆角浅影白卡 + 发丝线分栏」承担 → `navigationBarTextStyle: "black"` |

**四条口径**：

1. **极光只挂定高页根** —— `$bg-aurora` 的光斑百分比是**相对元素盒子**算的，
   元素高度一变光斑就漂；挂在 100vh 页根上才不漂。若将来挂到「高度随内容增长」的块上，
   **必须**补 `background-size: 100% <固定盒高>;`。
2. **玻璃卡两行回退不可反序** —— `.glass` 里 `$glass-bg-fallback`（近实心白）在前、
   `$glass-bg`（半透）在后；微信小程序端**不支持 `backdrop-filter`**，会**预期地**退化成近实心白
   （与安全区两行回退同一思路）。**别把第一行当冗余删掉。**
3. **骑缝只在 flex 父容器成立** —— `.glass--railed` 的负上边距靠「flex 项的负外边距不与容器合并」
   才成立；放进普通块容器会把整个内容区一起上拽、压住头部文字。
4. **页根/页面的 `backgroundColor` 与页面末档底色必须一致**（否则下拉回弹时露色差）——
   首页 `backgroundColorTop: #6D5BFF`（极光顶部紫）/ `backgroundColor: #FAFAFE`（内容区浅底），
   绑定页整屏极光故两者都是 `#6D5BFF`。⚠️ 这两个值写在 `pages.json`（**不是 token**）。

## 尺度基准

小程序里按钮做大很笨重 —— **固定这几档，不要自创**：

| 件 | Token |
|---|---|
| 主 CTA 高 | `$size-cta-h`（92rpx） |
| 控件高（输入框 / 次级按钮） | `$size-control-h`（88rpx） |
| 芯片高 | `$size-chip-h`（36rpx） |
| 图标圆盘 / 图标按钮 | `$size-icon-disc`（80rpx）/ `$size-icon-button`（84rpx） |
| 头像 | `$size-avatar`（68rpx） |

按钮档：`.btn--sm`（行内小）· `.btn`（默认）· `.btn--lg` + `.btn--block`（主 CTA）。

## 组件库跟色机制

**主色 / 文字色 / 边框色已被 `base.scss` 的 `page { --up-primary: … }` 覆盖**，
按钮、开关、选中态**自动跟项目 token** —— **不需要逐个 uview 组件传色**。
只有「读不到 SCSS 变量」的 `color` 类 prop 才需要传（走 `config/theme.js`，见 `rule-ui-components`）。

## 安全区

- 用 `theme.scss` 的 **`$safe-bottom` / `$safe-top`**
- ❌ **禁止手写 `env(safe-area-inset-*)`**
- ⚠️ 凡 `calc(... env ...)`，**必先写一行不含 env 的同属性回退**
  —— 小程序端混 `rpx` 与 `env()` 兼容性不可靠，那行被丢弃时会用到上一条声明
- 固定底栏：`$bottom-bar-gap` 的**两行底距**（回退在前、叠 `$safe-bottom` 在后）+ `$shadow-bottom-bar`
  —— **没有**现成的 `.footer-bar` 版式块（C 端有，本工程没有，见上）

## 类名规范

| 规则 | 说明 |
|---|---|
| **≥3 字母** | ColorUI 有大量单/双字母原子类，短名必撞 |
| **语义前缀** | 写前缀前先 `grep -n "^\." src/common/css/main.css` |
| 页面私有类名 | `<页面前缀>__<块>`（BEM）—— 现有前缀：`ahome__`（首页）· `bind__`（绑定页）· `demo__`（演示页）· `pa__` / `pb__`（示例页） |
| 组件根类名 | ≥3 字母 + 语义前缀 |
| `<style>` | **必须** `scoped` |

### ⚠️ 真机事故：`.fr` 撞名导致行内 flex 全废

`src/common/css/main.css`（ColorUI）有**全局** `.fr { float: right }`（该文件 3323 行）。
某工程一个表单行组件用 `.fr` 当**根类名** → 真机上被浮动到右边 → **行内 flex 布局全部失效**。
本工程的同类件（`app-form-row`）因此定为 `frow__*` 前缀，而**不是** `fr`。
（`.claude/memory/bug_history.md` **BUG-001**）

```bash
grep -n "^\." src/common/css/main.css | head -100   # 写类名前比对
```

## 换肤 / 复用这套样式

**这就是分三层存在的意义**：换主色 / 字号 / 间距只改 `theme.scss`（+ 同步 `config/theme.js` 镜像），
下层全是 token 引用，**不需要动任何页面**。
⚠️ 两处**不在 token 里、要另外同步**的：① `pages.json` 各页的 `backgroundColor*`（写的是色值字面量）；
② `common/css/main.css`（ColorUI，**只消费不新增**）。

## 已知未确证

⚠️ `scaffold.scss` 有 `.u-popup, .u-datetime-picker { flex: none !important }`
（让 uview 弹层族根节点不参与 flex 增长，否则会与页面滚动区瓜分高度、把内容挤到四分之一 ——
真机反馈过「下半部被遮住了」）。

**仅在 H5 语义下确证过** —— MP 端组件有样式隔离，`app.wxss` 未必命中组件内部节点，
且真正的 flex 子项是**宿主元素**而非组件根节点。
**上弹层页面前必须真机验一次**；退路是把 `class` 传给 `<u-popup>` / `<u-datetime-picker>`
（宿主带页面 `data-v-*`，页面样式确定能命中；首页弹层已按此留了 `.ahome__popup`）。
（`.claude/memory/known_issues.md` **K-08**，状态：🟡 未确证）

## 目录约定

| 改什么 | 去哪 |
|---|---|
| 主色 / 字号 / 间距 / 圆角 / 阴影 / 动效 | `src/common/css/theme.scss` |
| 给 uview 传的色值（JS 侧） | `src/config/theme.js`（镜像） |
| 通用版式块 / 流光玻璃语言 | `src/styles/scaffold.scss` |
| 全局原子类 | `src/common/css/base.scss` |
| ColorUI 原子类 | `src/common/css/main.css`（**只消费，不新增**） |
| 页面私有样式 | 页面 `<style scoped>` |
| 组件私有样式 | 组件 `<style scoped>` |

## 来源

> ★ **2026-11-16：`.claude/rules/` 目录已删除** —— 其硬约束已全量迁入各 rule-skill（删前逐条审计过缺口，共补 28 条）。
> 下文出现的 `.claude/rules/xxx.md` 是**历史出处**，不是可读路径；需要规则正文时就地看本 skill。


2026-10-26 从源工程同名 skill（旧名 `rule-style-css`）移植**结构**（Token 全清单 / 原子类清单 /
版式块清单 / 尺度基准 / 视觉语言 五块）。

⚠️ **但原移植把 C 端的「清单正文」一起带了过来**（HUD 类名、品牌黄主色、`$color-nev-plate-*`、
`.list-item` / `.chip` / `.footer-bar`…全在本工程不存在），已于 **2026-10-26 冷启动过渡轮整篇校正**：
清单**逐行从本工程真源重列** ——
`src/common/css/theme.scss`（116 token）· `src/common/css/base.scss`（原子类前缀分布）·
`src/styles/scaffold.scss`（680 行，版式块 + 流光玻璃段）；
视觉语言按 `CLAUDE.md` §3.5 与 `rules/architecture.md` §7 的管理端口径重写。

**冲突时以本文件为准**（它按本工程真源提取）。最后同步于 2026-10-26。