# templates/page — 页面模板（uni-app / Vue 3）

**适用栈**：uni-app 3.x + Vue 3.4 + uview-plus（本项目）。

## 文件

| 文件 | 用途 |
|---|---|
| `page-list.vue` | **列表页模板** —— 含分页 / 下拉刷新 / 四态编排（最常用） |
| `page-detail.vue` | **详情页模板** —— 含首屏加载 / 单次取数 / 错误重试 |
| `page-form.vue` | **表单页模板** —— 跳页取值 / 格式校验 / 固定底栏提交 / 两道门 |

## 使用步骤

1. **复制**到 `src/pages/<your-page>/index.vue`。
2. **全局替换** `__PREFIX__` 为你的页面前缀（如 `vlist`）——
   出现在所有类名里（`__PREFIX__-page`、`__PREFIX__-page__scroll`）。
   > ⚠️ 前缀 **≥3 字母**，且**不要**用 ColorUI 已有的类名
   > （先 `grep -n "^\." src/common/css/main.css` 确认）。
3. **全局替换** `__TITLE__` 为页面标题。
4. **接上真实 api**：把 `// TODO: 换成真实 api` 处替换为 `@/api` 里的方法。
5. **页面路径常量**：在 `src/config/access.js` 定义 `PAGE_*` + `PAGES` 准入；
   再到 `src/services/route.js` 的 `export { ... } from '@/config/access'` 块**加一行转出**，
   最后从 `@/services/route` import（漏了这步首次编译会报「未导出」）。
   模板里的 `PAGE___UPPER__` / `PAGE___DETAIL__` 是占位；**页面里禁止写路径字面量**。
6. **两道门**：模板已接 `usePageGuard({ path, onReady })`，不要删；它同时完成登录门与权限门。
7. **登记 `src/pages.json`** 的 `pages` 数组（第一项是启动页）。
   > 分包页另加 `subPackages` + `preloadRule`。
   > 若要加 tabBar → 必须**同步** `src/services/route.js` 的 `TAB_PAGES`。
8. **删除** 不适用的分支（如详情页不需要下拉刷新就整块删掉，**不留死代码**）。

## 页壳的六个必备件（**一个都不能少**）

| # | 件 | 少了会怎样 |
|---|---|---|
| 1 | 根节点 `@touchstart` / `@touchmove` | 下拉距离无兜底来源（原生不给 dy 时） |
| 2 | `<app-navbar>` | 无自绘顶栏（高度含状态栏、让位微信胶囊） |
| 3 | `<app-loading :show>`（局部） | 首屏无 loading |
| 4 | **`<app-loading :mask>`（不带 `show`）** | ★ 请求层 `{ loading:true }` **静默降级**成原生 `uni.showLoading`，样式不符 |
| 5 | **`<app-modal />`** | ★ `pushModal` 什么都不弹，且滞留队列会在**切页后才冒出**（真实事故：漏挂 `<app-modal>` 时守卫弹窗不出现） |
| 6 | `<app-refresher>` + `scroll-view` 的 `refresher-*` 接线 | 下拉三段态无指示器 |

## 页面里**禁止**出现

- ❌ 业务逻辑（校验规则 / 状态机 / 计算规则 / 权限判定）→ 归 `services/` 或 `api/`
- ❌ `#ifdef` / `#ifndef`（端差异 → `src/services/platform.js`）
- ❌ 接口路径字符串（→ `src/config/endpoints.js` + `src/api/<域>.js`）
- ❌ 硬编码色值 / 字号 / 间距（→ `src/common/css/theme.scss`）
- ❌ 手写 `env(safe-area-inset-*)`（→ `$safe-bottom` / `$safe-top`）
- ❌ 类名 <3 字母，或未 grep `main.css` 就用类名前缀

## ★ 下拉的三档（**先定档，再决定 `pages.json` 怎么配**）

`useList` 内部注册的是**页面级** `onPullDownRefresh` / `onReachBottom`，
**能不能用它自带的下拉/触底，取决于滚动容器是谁**。

| 档 | 特征 | 本工程实例 | 怎么接 |
|---|---|---|---|
| **A 页面级滚动 + 原生导航栏** | 不自绘顶栏、页面本身滚动 | （暂无） | `pages.json` 该页 `style` 开 `"enablePullDownRefresh": true`；`useList` 的下拉/触底**自动生效，页面零代码** |
| **B `scroll-view` + 自绘顶栏** | `.page-shell*` + `app-navbar` + `<scroll-view scroll-y>` | `pages/admin-home` · `pages/ledger` · **本目录两个模板** | ⚠️ **`useList` 的两条通道都不触发** → 自己接 `@refresherrefresh` / `@scrolltolower` |
| **C 页面级滚动 + 自绘顶栏** | `app-navbar` + `min-height:100vh`，**无 `scroll-view`** | `pages/bind`（整屏极光，无顶栏） | 短内容页用。**无下拉刷新**（也不需要）；长列表应改走 B 档 |

> ⚠️ **C 档是本工程实测出来的形态**（C 端文档只写了 A/B 两档）。
> **判定口诀：看有没有 `<scroll-view>`** —— 有 = B 档；没有且用 `app-navbar` = C 档。

**本工程现状**：`src/pages.json` 全文 **0 处** `enablePullDownRefresh`；
三个页面**都**是 `navigationStyle: "custom"`。**新建内容页走 B 档。**

> ⚠️ **2026-10-26（v1.0.0）版式块改名**：管理端视觉从 C 端的「浅色 HUD 座舱」换成「流光玻璃」，
> `scaffold.scss` 里的 `.hud-page*` / `.hud-frame` / `.hud-panel` / `.list-item*` **已整体删除**，
> 现役的是 `.page-shell*` / `.page-shell__body` / `.glass` / `.card` / `.rows` / `.kv`。
> 本目录两个模板原先写的是旧块名（照抄会得到**没有样式且不报错**的页面），**已于同次修正**。

### B 档五条不可省的口径（漏一条就出**可见**故障）

1. **`:refresher-triggered` 必须绑 `usePullRefresh` 给的 `refreshing`** ——
   它是**唯一**能把原生刷新区收回去的东西，漏绑 = **指示器转圈卡死**
2. **`:refresher-threshold` 必须绑它给的 `threshold`**（= `PULL_THRESHOLD`，**45px**）——
   **一身两职**：既判箭头朝哪边，**也是原生刷新区回弹后停留的高度 = 指示器要装进去的空档**。
   **改小它会让指示器顶到导航栏下缘。**
3. **根节点的 `@touchstart` / `@touchmove` 别删** —— 下拉距离的兜底来源
4. **指示器不要自己包 `position: fixed` 的壳**，也不要往 `#refresher` 槽里放视觉内容
   —— 它**自己骑在下拉空档里**
5. ★ **页面没有自绘导航栏时，必须给 `app-refresher` 传 `:top`（= 滚动区上沿 y 坐标）**
   —— 骨架里不带 `:top` 是「顶部有 `app-navbar`」的写法；无导航栏的页面下拉空档开在
   `y=0`，指示器会落进 **iPhone 灵动岛**的物理遮挡区（真机踩过：下拉指示器落进灵动岛）。
   正解：页壳顶部加透明状态栏让位块（`height = layout.statusBarHeight`）+ 同值传 `:top`

> 📖 完整流程（含表单页骨架与 `u-form` 三个坑）见 `.claude/skills/rule-add-page/`。

## 跨栈对照

| 栈 | 等价模板 |
|---|---|
| React | 页面组件 + `useEffect` 取数 + 状态枚举 |
| Vue 2 | Options API + `mounted` + `data/computed` |
| 原生小程序 | `.wxml` + `.js` + `.wxss` 三文件 |
| 后端（Go/Java/…） | 见 `templates/api-domain/` 与 `templates/service/` |

**不变的部分**：页壳必备件（loading / modal / 错误态）、四态编排、
「页面不写业务逻辑」。