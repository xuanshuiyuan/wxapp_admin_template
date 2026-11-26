---
name: rule-add-page
description: 在本工程新增页面、新界面、新业务模块页，或要把一份后端数据渲染成列表页/表单页/详情页时使用。给出完整流程：建 api 方法 → 按骨架现写页面 → 注册 pages.json → 接 useList/usePullRefresh → 定下拉档位 → 样式走 token；含可直接照抄的列表页骨架、表单页骨架与 u-form 三个坑。
---

# rule-add-page

> **本文件是流程与骨架。硬性「必须 / 禁止」分布在各 rule-skill 的「硬性禁令」小节：
> 页面层通用禁令在 `rule-layering`，请求在 `rule-request-chain`，弹窗跳转在 `rule-page-services`，
> 样式在 `rule-style-tokens`，组件在 `rule-ui-components` —— 写完页面逐条自查
> （**skill 不会级联加载**，需要时显式调用）。**

「加一个页面」= 动 **5** 个地方：`api/<域>.js`（取数）→ `pages/<模块>/index.vue`（渲染）
→ **`config/access.js`（登记路径 + 准入 + 它在首页/父页的入口）** → `src/pages.json`（注册路由）
→ 必要时 `config/dict.js`（枚举）。

> ⚠️ **中间那两步必须成对做**（2026-10-27 v1.0.1 起）：`config/access.js` 的 `PAGE_*` 与
> `src/pages.json` 的注册页面由 `node .claude/scripts/check_system.mjs` 的**第 ⑧ 条
> `checkPageRegistry()` 一一比对** —— 只做一步必然报错
> （声明了没注册 → 页面**跳不过去**；注册了没声明 → 直接报错）。

> 📌 **来源**：源工程同名 skill（已随本次抽离去业务化），
> 本次适配（**逐项实测，未照抄**）：
> ① C 端说「无模板可 `cp`」，**本工程有 `.claude/templates/page/`** —— 已改为指向它；
> ② 下拉**不是两档而是三档**（本工程实测 `pages/bind` 是 C 端没覆盖的第三种形态，见下）；
> ③ 剔除 C 端业务引用（已随本次抽离去业务化）；
> ④ 「现役页现状核对」改为本工程实际的页面（当前 7 页：首页 / 绑定 / 演示页 / 示例页 A / 示例页 B / 字段编辑 / 地区选择）；
> ⑤ 剔除分包规则中本工程暂不适用的部分（保留为预留说明）。

## 起点：本工程已有的可抄模板

| 模板 | 用途 |
|---|---|
| `.claude/templates/page/page-list.vue` | **列表页骨架**（B 档下拉已接好） |
| `.claude/templates/page/page-detail.vue` | **详情页骨架**（单次取数 + 错误重试） |
| `.claude/templates/page/README.md` | 使用步骤 + 页壳六个必备件 |
| `src/pages/admin-home/index.vue` | **B 档页壳活样板**（最完整的接线示范） |
| `src/pages/bind/index.vue` | **第三种形态**（整屏极光品牌底 + 居中玻璃卡 + 页面级滚动，短内容表单页；**无 `app-navbar`、无 `scroll-view`**） |

> ⚠️ C 端说「模板页已删除、无文件可 `cp`」—— **那是 C 端的情况。本工程有模板，直接抄。**
> 但抄完**必须删掉不适用的分支**（不留死代码）。

## 流程（列表页，最常做的一种）

1. **加接口方法** —— URL 先去 `config/endpoints.js` 登记常量（**全工程唯一登记表**，
   值不带 `/v2` 前缀与前导斜杠），再在 `api/<域>.js` 加方法：
   ```js
   // config/endpoints.js
   export const ENDPOINT_XXX_LIST = 'web/xxx/list';
   // api/xxx.js —— export const xxxApi = { ... }
   list(params, options) { return curl.get(ENDPOINT_XXX_LIST, params, options) }
   ```
   再在 `api/index.js` 加一行 export。写法与 options 语义见 `rule-request-chain` / `rule-api-registry`。
2. **建页面文件** —— 抄 `.claude/templates/page/page-list.vue` 到 `pages/<模块>/index.vue`
   （本工程页面目录形态统一是「**一屏一目录 + `index.vue`**」，如 `pages/admin-home/index.vue`）。
3. **改三处**：`useList` 第一个参数 → 你的接口方法；`params()` → 你的筛选字段；
   列表项渲染字段 → 你的数据字段。
   ★ **本列表能进子页改数据时**：加 `refreshOnReturn: true` + `dirtyKey: PAGE_XXX_LIST`，
   并在子页**写成功后** `markListDirty(PAGE_XXX_LIST)`（机制在 `services/listDirty.js`）。
   ❌ 不要回到「子页返回就无条件 reload」——那是 v1.1.0 的旧口径，返回会整体替换列表闪一下（v1.2.2 改）。
4. **登记访问配置** —— `src/config/access.js`（★ 页面路径 / 展示清单 / 权限码归属的**唯一真相源**）：
   ```js
   // ① 页面路径常量：全工程**唯一的字面量处**
   export const PAGE_XXX_LIST = '/pages/xxx/list';
   // ⚠️ 再到 services/route.js 的 `export { ... } from '@/config/access'` 块**加一行转出**，
   //    否则页面 import { PAGE_XXX_LIST } from '@/services/route' 会编译失败（re-export 不会自动带上新常量）

   // ② 页面准入表 PAGES —— 三种语义，按本页实际情况选一种
   [PAGE_XXX_LIST]:    { name: 'XXX',      login: true },                                        // 无权限门（登录即可）
   [PAGE_XXX_LIST]:    { name: 'XXX',      login: true, entries: XXX_ENTRIES },                  // 子入口**任一命中**
   [PAGE_XXX_DETAIL]:  { name: 'XXX 详情', login: true, entries: XXX_ENTRIES, byParam: 'type' }, // 码**随 URL 参数变**
   // 不需要登录门的页（如工具页、落地页）：login: false

   // ③ 若本页要从首页宫格进来：在 HOME_ENTRIES 加一条（type / name / code / icon / page / children）
   ```
   ⚠️ 用到的权限码先在 `config/dict.js` 登记 `PERM_XXX_*`，**码值必须问后端要，不许猜**
   （见 `rule-api-registry`；**「每个操作一个码」**—— 页内按钮也各配一个码，挂在子入口的 `actions` 上）。
5. **注册路由** —— `src/pages.json` 的 `pages` 数组加一项：
   `path` 写 `pages/<模块>/index`（⚠️ **不带前导斜杠**，而 `config/access.js` 的常量**带** ——
   第 ⑧ 条校验会归一化后比对，两边写法照各自的惯例写即可）；
   **自绘头部 / 整屏品牌底的页**同时写 `"navigationStyle": "custom"`
   ＋ `backgroundColor` / `backgroundColorTop`（**与页面底色一致，回弹不露色差**）
   ＋ `navigationBarTextStyle`（**custom 下系统仍按它决定状态栏文字色**：极光底上必须 `white`，
   否则吃 `globalStyle` 的 `black`，黑字压在紫上约 4.6:1）。
   **是否开 `"enablePullDownRefresh"` 取决于走哪档下拉 —— 见下面「下拉的三档」**
   （本工程 `pages.json` 目前 **0 处**该配置）。
6. **改样式** —— 只动 `<style scoped>` 里该页独有的结构；通用的一律用原子类与
   `.card` / `.kv` / `.rows` / `.entry-grid` / `.btn`（页壳走 `.page-shell*`，
   首屏/品牌页走 `.aurora-bg` + `.glass` + `.on-aurora`）
   ⚠️ **没有** `hud-*` 这一套、也**没有** `.list-item` / `.chip` / `.footer-bar` / `.badge`
   —— 那是 C 端的版式块（HUD 那套管理端换「流光玻璃」时已整体删除），见本节末尾的修正说明
   + `rule-style-tokens` 的实测清单。
7. **编译验证** —— `npm run verify:mp-weixin`（+ `verify:h5`）。
   ⚠️ **默认不执行** —— 除非用户本轮明确要求（`.claude/CLAUDE.md` §9.3）。
   替代：跑 `node .claude/scripts/check_system.mjs`（静态自检，含路由一致性）。

> ★ **进页与页内显隐的三句话**（配置驱动，详见 `rule-session-guards`）：
> · **首选一行接线**：`usePageGuard({ path: PAGE_XXX_LIST, onReady: reload })`
>   —— 内部完成「onLoad 权限门 + onShow 登录门 + 首次取数」，新页面**必须**接；
> · 手写等价语义（不要在项目里另造第三套）：
>   `onLoad` 里 `const access = requirePageAccess(PAGE_XXX_LIST, query); if (!access.allowed) return;`
>   （`byParam` 型页面要**先**校验参数与类型是否本版认识 —— 参数问题不该被当成权限问题踢回上一页）；
>   取数前 `if (pageNeedsLogin(PAGE_XXX_LIST) && !(await requireAdminLogin())) return;`
> · 页内 tab / 按钮：`byPermission(清单, permission.value)`
>   —— **不要自己写 `.filter(x => codes.includes(x.code))`**，那是这条口径的唯一实现

## ★ 下拉的三档（决定 `pages.json` 要不要开 `enablePullDownRefresh`）

`useList` 内部注册的是**页面级** `onPullDownRefresh` / `onReachBottom`，
所以能不能用它自带的下拉/触底，**取决于滚动容器是谁**。

| 档 | 特征 | 本工程实例 | 怎么接 |
|---|---|---|---|
| **A 页面级滚动 + 原生导航栏** | 不自绘顶栏、页面本身滚动 | （暂无） | `pages.json` 该页 `style` 开 `"enablePullDownRefresh": true`；`useList` 的 `onPullDownRefresh → refresh()`、`onReachBottom → loadMore()` **自动生效，页面零代码** |
| **B `scroll-view` 容器 + 自绘顶栏** | `.page-shell*` + `app-navbar` + `<scroll-view scroll-y enable-flex>` | `pages/admin-home` | ⚠️ **`useList` 的两条通道都不触发**（滚动在 `scroll-view` 内，页面级事件收不到）→ 自己接（见下方骨架） |
| **C 页面级滚动 + 自绘头部** | `min-height:100vh` + 自绘头部（`app-navbar` **或** 自己让出状态栏），**无 `scroll-view`** | `pages/bind`（品牌底 + 玻璃卡） | 短内容页用。**无下拉刷新**（也不需要）；若有长列表应改走 B 档 |

> ⚠️ **C 档是本工程实测出来的、C 端文档没覆盖的形态**（C 端 15 个页面全走 B 档）。
> 判定口诀：**看有没有 `<scroll-view>`** —— 有 = B 档；没有且用 `app-navbar` = C 档。
>
> ⚠️ **本工程现状**：`src/pages.json` 全文 **0 处** `enablePullDownRefresh`；
> 五个页面**都**是 `navigationStyle: "custom"`。**新建二级页（流光玻璃口径）走 B 档，不要开 A 档配置。**

### B 档骨架（列表页，照抄 `.claude/templates/page/page-list.vue`）

```vue
<template>
	<!-- 根节点接 touch：下拉距离的兜底来源（原生不给 dy 时用） -->
	<view class="page-shell" @touchstart="onTouchStart" @touchmove="onTouchMove">
		<app-navbar title="标题" />
		<app-loading :show="firstLoading" />      <!-- 局部：跟首屏 -->
		<app-loading :mask="true" />              <!-- 全局：接请求托管（每页必须） -->
		<app-modal />                             <!-- 全局弹窗渲染器（每页必须） -->
		<app-refresher :show="visible" :state="pullState" :last-at="lastRefreshAt" :offset="offset" />

		<!-- ⚠️ enable-flex 必须带：小程序端 scroll-view 的**子节点默认不吃 flex**，
		     而 .page-shell__body 是列向 flex 容器（版式约定）—— 漏了会静默退化成普通块 -->
		<scroll-view
			class="vlist-page__scroll" :scroll-y="!firstLoading"
			enable-flex
			refresher-enabled refresher-default-style="none" refresher-background="transparent"
			:refresher-triggered="refreshing" :refresher-threshold="threshold"
			@refresherpulling="onPulling" @refresherrefresh="onRefresh"
			@refresherrestore="onPullEnd" @refresherabort="onPullEnd"
			@scrolltolower="loadMore"
		>
			<!-- 槽内只放 0 高占位：原生 refresher 区无内容，回弹收缩无东西可溢出/遮盖 -->
			<template #refresher><view class="vlist-page__refresher-slot"></view></template>

			<view class="page-shell__body vlist-page__body">
				<view v-for="item in items" :key="item.id" class="card vlist-page__cab" @click="onItemTap(item)">
					<view class="card__hd">
						<text class="card__title">{{ item.title }}</text>
					</view>
				</view>

				<!-- ★ 四态编排必须放**列表之后**（骨架/空/失败/加载更·到底 全在这一个组件里，
				     useList 状态直传）：它同时承担「— 没有更多了 —」——
				     放在 v-for 之前会把那句印到**列表上方**（2026-10-26 真机反馈，BUG-010） -->
				<app-list-state
					:first-loading="firstLoading" :empty="isEmpty" :error="error"
					:loading="loading" :finished="finished" @retry="reload"
				/>
			</view>
		</scroll-view>
	</view>
</template>
```

> ⚠️ **2026-10-26 修正**：上面骨架原先写的是 `.hud-page*` / `.hud-frame` / `.hud-panel` ——
> 那是 **C 端「浅色 HUD 座舱」**的版式块，管理端换「流光玻璃」时已从 `scaffold.scss` **整体删除**。
> 照抄会得到**没有样式且不报错**的页面。已全部改指现役块
> （`.page-shell` / `.page-shell__scroll` / `.page-shell__body` / `.card` / `.btn`），
> 与 `.claude/templates/page/` 两个模板保持一致。

<script setup>
import { useList } from '@/composables/useList';
import { usePullRefresh } from '@/composables/usePullRefresh';
import { route } from '@/services/route';
import { yourApi } from '@/api';

// 零配置：useList 默认 pageSize=20、pageNumKey='page'、pageSizeKey='page_size'，
// 与本工程后端真分页契约（page / page_size，data.{list,total}）逐字吻合，不要再传 override。
// 只有个别接口字段不同时才传 pageNumKey/pageSizeKey 或自定义 pick（见 rule-request-chain）。
// ⚠️ useList 必须在 setup 顶层调用（内部注册 onLoad/onReachBottom/onPullDownRefresh），
//    不能放条件分支或 onLoad 回调里。
const { items, body, total, loading, firstLoading, finished, error, isEmpty, reload, refresh, loadMore } =
	useList(yourApi.list, {
		params: () => ({ type_id: filter.value || undefined }),  // undefined 由 http 层丢掉
		// 列表能进子页改数据时加这两项：返回时**只有子页 markListDirty 过才重取**
		// （见 services/listDirty.js；无条件重拉会让「点进去看一眼再返回」也整体替换列表闪一下）
		refreshOnReturn: true,
		dirtyKey: PAGE_YOUR_LIST
	});

// 三段态交给公共件，页面不再自己存 pulling/pullVisible
// `can` = 在飞判重（refresh() 在 loading 时直接 return，不挡就是白转一圈指示器）
const { pullState, refreshing, lastRefreshAt, offset, visible, threshold,
        onPulling, onRefresh, onPullEnd, onTouchStart, onTouchMove }
	= usePullRefresh({ can: () => !loading.value, onRefresh: refresh });

function setFilter(v) {
	if (String(filter.value) === String(v)) return;
	filter.value = v;
	reload();          // ★ 条件变化必须手动 reload（onLoad 只跑首次）
}
</script>
```

**页面里从此不出现** `v-if="loading" / v-else-if="empty" / …` 四件套 ——
优先级只在 `app-list-state` 内定义一次。

#### B 档五条不可省的口径（漏一条就出**可见**故障）

1. **`:refresher-triggered` 必须绑 `usePullRefresh` 给的 `refreshing`** ——
   它是**唯一**能把原生刷新区收回去的东西，漏绑 = **指示器转圈卡死**。
2. **`:refresher-threshold` 必须绑它给的 `threshold`**（= `PULL_THRESHOLD`，**45px**，
   平台默认值）—— 它**一身两职**：既是判箭头朝哪边的依据，
   **也是原生刷新区回弹后停留的高度 = 指示器要装进去的那段空档**。
   指示器骑在这段空档里走 —— **改小它会让指示器顶到导航栏下缘**。
3. **根节点的 `@touchstart` / `@touchmove` 别删** ——
   下拉距离的兜底来源（`usePullRefresh` 的 `dyOf`）。
4. **指示器不要自己包 `position: fixed` 的壳**，也不要往 `#refresher` 槽里放视觉内容
   （原生回弹会溢出遮盖）—— 它**自己骑在下拉空档里**，钉住不动的写法会让空档还浅时
   指示器与内容挤在一起。
5. ★ **页面没有自绘导航栏时，必须给 `app-refresher` 传 `:top`，值与「滚动区上沿 y 坐标」
   一致**（真机踩过：下拉指示器落进灵动岛）。
   上面骨架里的 `<app-refresher … />` **不带 `:top`** —— 那是「顶部有 `app-navbar`」的写法，
   组件默认取 `getLayout().customBarHeight`，正好等于栏内滚动区的上沿。
   **没有导航栏的页面（如首页的极光头部）**：滚动区从屏幕顶端开始，下拉空档就开在 y=0，
   指示器会落进 **iPhone 灵动岛/状态栏的物理遮挡区**。两种错法与正解：
   - ❌ 传 `:top="0"` → 撞灵动岛（几何自洽，真机更糟）；
   - ❌ 用默认值 → 多算一根导航栏，指示器被头部内容压住；
   - ✅ 页壳顶部加**透明状态栏让位块**（`height = layout.statusBarHeight`），
     并传 `:top="layout.statusBarHeight"` —— **两处必须同源**，
     不要在两处各留一次状态栏内距（会多空出一个状态栏）。
     让位块内透明即可：极光挂在页根上是整屏铺满的，让位不改变观感。

## 表单页 / 详情页骨架

详情页见 `.claude/templates/page/page-detail.vue`（单次取数 + 错误态重试 + 无分页）。
表单页**本工程还没有模板**（`templates/page/` 目前只有 list / detail 两个），按下面结构现写；
**现役先例**（比骨架更可信，可直接读）：`src/pages/bind/index.vue`（表单 + 主 CTA）、
`src/pages/common/field-editor.vue`（**C 档**：顶栏 + 页面级滚动的短表单页）。

```vue
<template>
	<!-- ⚠️ 短表单页走 **C 档**：顶栏 + 页面级滚动（**不要 scroll-view**，也不要用 .page-shell）——
	     键盘弹起时整页必须能上滚，而 .page-shell 是 height:100vh + overflow:hidden（靠内部滚动区）
	     时输入框会被键盘顶掉、内容被裁。见本文件「下拉的三档」的 C 档 -->
	<view class="fform">
		<app-navbar title="编辑" />
		<view class="fform__body">
			<view class="card">
				<!-- 表单控件优先用 uview-plus：u-form / u-form-item / u-input / u-textarea /
				     u-picker / u-datetime-picker / u-radio / u-checkbox / u-switch / u-upload -->
				<u-form ref="formRef" :model="form" :rules="rules"
				        errorType="toast" labelPosition="left" labelWidth="90">
					<u-form-item label="名称" prop="name">
						<!-- ★ 单行输入必挂 `confirm-type="done"` + `@confirm="submit"`（2026-11-25 与 C 端对齐）：
						     进页自动 focus 弹键盘，`adjust-position` 默认 true 会把整页顶上去，下方主 CTA
						     被键盘盖住 → 用户得先收键盘再点按钮。挂完成键 = 一次操作提交，且必须与点按钮
						     走**同一个**处理函数（校验失败留在本页，别另写一套）。
						     多行 `<textarea>` **不挂**（回车留给用户换行）。
						     ⚠️ 两个平台限制：① 微信端 confirm-type **只在 `type="text"` 生效**，number / digit
						     档上只是兜底，只有 Android 数字键盘的完成键会触发 `@confirm`；
						     ② **iOS 数字键盘没有回车键**，金额 / 数字输入天生无法从键盘提交 → CTA 必须在
						     文档流里（不塞固定底栏），页壳走 C 档页面级滚动、键盘收起后能滚到。
						     现役范例：`src/pages/common/field-editor.vue`（text / password / number·phone /
						     digit 四档全挂）· `src/pages/common/field-editor.vue`（`confirm-type="done"`，与页内
						     搜索按钮同一条路径）。 -->
						<u-input v-model="form.name" placeholder="请输入" confirm-type="done" @confirm="submit" />
					</u-form-item>
				</u-form>
			</view>
			<!-- 主 CTA 放内容流里（本工程**没有** .footer-bar 这个版式块，别照着旧稿写） -->
			<view class="btn btn--primary btn--block btn--lg" hover-class="btn--hover" @click="submit">保存</view>
		</view>
		<app-modal />
		<app-loading :mask="true" />
	</view>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { onLoad, onUnload } from '@dcloudio/uni-app';
import { yourApi } from '@/api';
import { successToast, toast, resetLoading } from '@/services/toast';
import { confirm } from '@/composables/useModal';
import { route } from '@/services/route';

const form = reactive({ name: '' });
const formRef = ref(null);
const submitting = ref(false);

// ⚠️ rules 不能留空对象：u-form.validate() 在 rules 为空时开发环境直接 return undefined（校验被静默跳过）
const rules = { name: [{ required: true, message: '请输入名称', trigger: ['blur', 'change'] }] };

onLoad((q) => { if (q && q.id) form.id = q.id; });
onUnload(() => resetLoading());   // ★ loading 引用计数兜底（漏减会让后面所有页面卡住转圈）

async function submit() {
	if (submitting.value) return;                 // 自己挡重复提交

	// ★ 表单校验单独挡：reject 的是 errors 数组，不是 ApiError，别和下面的错误分支混在一起
	try {
		await formRef.value.validate();           // errorType="toast" 时组件内部已提示第一条错误
	} catch (errors) {
		return;
	}

	submitting.value = true;
	try {
		// 按钮点击请求 = 双保险：请求层 { loading: true } 托管全局 loading
		//                    + 按钮 in-flight 态（submitting 防重入）
		await yourApi.save({ ...form }, { loading: true });
		successToast('保存成功');
		await toast('已保存');                    // 要「提示后再返回」就 await（resolve 于消失后）
		route.back();                             // ★ 空栈时自动回落首页，不白屏
	} catch (e) {
		// 失败已被 http 层 toast 过，这里只兜需要页面自己处理的分支
		if (e.type === 'business') { /* 按业务码走特殊 UI */ }
	} finally {
		submitting.value = false;
	}
}
</script>
```

### ⚠️ `u-form` 三个坑（照抄前必读）

| # | 坑 | 后果 / 对策 |
|---|---|---|
| 1 | **`labelWidth` 单位是 `px` 不是 `rpx`**（默认 45） | 按 rpx 写会窄到看不清 |
| 2 | **`rules` 传空对象时 `validate()` 开发环境只打一条日志然后 `return undefined`** | **校验被静默跳过** —— 表单能提交但没校验。**`rules` 不能留空对象** |
| 3 | **`validate()` reject 的是 `errors` 数组，不是 `ApiError`** | 混进统一错误分支会拿不到 `.type` / `.message`。**必须单独 `try/catch`** |

## 目录约定

- **主包页面**：`pages/<模块>/index.vue` —— **一屏一目录**（如 `pages/admin-home/index.vue`、
  `pages/bind/index.vue`、`pages/demo/list.vue`）。**不要用扁平 `pages/<模块>/<page>.vue`**。
- **页面专属子组件**：写在**页面同级** `pages/<页>/components/` + **页面显式 import**
  （不进 easycom 扫描域，与 `rule-layering` 口径一致）。
  两种落盘形态任选：目录式（`components/xxx/xxx.vue`）或平铺单文件式（`components/xxx.vue`）。
  **通用（第二个页面也要用）才提升到根 `components/app-*/` 走 easycom。**
- **跨页复用的「能力」（不是 UI）** 才抽 `composables/`。
- **只有「一段渲染逻辑、构不成组件」的**才留在页面 `<template>` 里。

### 分包（⚠️ 本工程尚未启用）

页面变多时用 `pages.json` 的 `subPackages` + `preloadRule`：

```json
"subPackages": [{
  "root": "packages/<模块>",
  "pages": [{ "path": "<页>/index",
              "style": { "navigationStyle": "custom", "navigationBarTitleText": "标题" } }]
}]
```

**分包规则**：分包可 import 主包，**主包不能 import 分包**，**分包之间不能互引**。
首屏页 / 高频页留主包；跨包跳转一律走 `services/route.js` 的路径常量。
（本工程当前 `pages/` 只有 2 页、**无 `packages/`**，此节为预留。）

## 本文件独有的坑

- ⚠️ **`useList` 必须在 `setup` 顶层调用**（内部注册 `onLoad/onReachBottom/onPullDownRefresh`），
  不能放条件分支或 `onLoad` 回调里。
- ⚠️ **下拉/触底要先定档**（见上面「下拉的三档」）：
  **A 档**必须在 `pages.json` 该页 `style` 里开 `"enablePullDownRefresh": true`，
  否则 `useList` 注册的 `onPullDownRefresh` **永不触发**；
  **B 档**开了也没用，得自己接 `@refresherrefresh` / `@scrolltolower`；
  **C 档**没有下拉刷新。
- ⚠️ **写操作成功后刷新**：`await` 接口再 `reload()`。后端回传字段不全，
  **不要做乐观更新**。
- ⚠️ **每页必备件一个都不能少**（B 档七个：根节点 touch 双事件、`app-navbar`、`enable-flex`、
  局部 `app-loading :show`、**全局 `app-loading`（不带 `show`）**、**`app-modal`**、`app-refresher`（B 档）。
  漏了全局 loading → 请求 loading **静默降级**成原生 `uni.showLoading`（样式不符、不报错）；
  漏了 `app-modal` → `pushModal` 什么都不弹，且**滞留队列会在切页后才突然冒出**。
  （真实事故：漏挂全局组件时 loading 降级、守卫弹窗不出现）
- ⚠️ **`pages.json` 必须登记新页**（第一项是启动页）；
  将来加 tabBar 必须**两处同步**：`pages.json` 的 `tabBar` 段 + `services/route.js` 的 `TAB_PAGES`
  —— 漏改后者会让 `route.to` 用 `navigateTo` 跳 tab 页而**失败**。

### 骨架的可信度级别（诚实声明）

本文件与 `templates/page/` 的骨架是**按当前源码签名逐字核对**过的
（`useList` 返回值 / `usePullRefresh` 返回值 / `app-list-state` props / `u-form` 三坑），
**但本工程至今只有 5 个页面、且 `useList` 尚无现役消费者**（`src/api/` 是空骨架）。

**结论**：骨架的可信度到「语法与签名正确」这一级，**不等于真机跑通过**。
首次落地请先真机验一遍再当模板复用（本工程真机行为整体**未验证**，
见 `memory/known_issues.md` K-09）。

## 2026-10-26 增补：两条「新页必踩」的坑（真机反馈）

### ① ★ 页壳的直接子项里，凡是 uview 组件先查它根类有没有 `flex: 1`

uview 有**一整族**组件根节点自带 `flex: 1`：`.u-popup`（`$u-popup-flex`）、
`.u-datetime-picker`、`.u-picker`、`.u-search`、`.u-input`、`.u-loadmore`。
而本工程的页壳 `.page-shell` 是 **flex 列 + 滚动区 `flex:1`** ——
弹层一旦是它的直接子项，就会**与滚动区瓜分剩余高度**：

- 一个弹层吃掉半屏：把 `<u-datetime-picker>` 直接放进页壳，下半屏成了弹层的空盒子，
  列表被挤到屏外，表现得像「切 tab 不换数据」（真机反馈，见 `bug_history.md` BUG-008）；
- 三个弹层能把内容区挤到只剩四分之一。

**写新页时的动作**：弹层（`u-popup` / `u-datetime-picker` / `u-picker` / `u-calendar`）
若必须是页壳的直接子项，就**给它传一个 class** 并在本页 scoped 里写
`flex: none !important`（先例：`pages/admin-home/index.vue` 的 `.ahome__popup`）。
`scaffold.scss` 已有全局兜底（`.u-popup, .u-datetime-picker { flex: none !important }`），
但 **MP 端全局样式能否命中组件根节点未真机确证**（K-08）→ **两道都要留**。

### ② 搜索/输入类控件：**跳页输入**，不在列表页内联

`u-search` / `u-input` 内联在列表页会与下方列表**抢高度**，键盘弹层又在各机型遮挡不一，
还容易写成「逐字都重查」（连点打爆后端）。本工程口径：
**点一个「长得像搜索框的按钮」→ 跳编辑页输入 → 返回即查询**。

机制已收在 `services/pickPage.js`（`uni.$on` + Promise + 跳转失败释放监听 + 在飞去重），
**照 `services/fieldEditor.js` + `pages/common/field-editor.vue` 这一对抄**，两侧契约必须守：
取值页**先 emit 再返回**、`emitted` 标志防 `onUnload` 覆盖、`onUnload` 补发一次「放弃」；
取值侧 `safeDecode`（openPickPage 会 encodeURIComponent，**MP 端 onLoad 的 options 不解码**）。

## 来源

移植自 C 端工程 `.claude/skills/rule-add-page/SKILL.md`（2026-10-26）。
C 端原版提炼自其 `docs/ARCHITECTURE.md`（§2 composables、§3.3、§6 页面模板、§7 落点表）
+ `composables/useList.js` / `components/app-list-state` 实测签名；
2026-10-23 重写 B 档下拉骨架（三段态 `app-refresher` + `usePullRefresh`）。

本次适配（逐项实测）：
① 起点改为本工程的 `.claude/templates/page/` 与现役页（C 端模板已删，情况不同）；
② **下拉由「两档」扩为「三档」** —— 实测 `pages/bind` 是「自绘头部 + 页面级滚动」，
C 端二分法未覆盖；
③ `pages.json` 现状核对改为本工程实际（全 `navigationStyle: custom`、0 处 `enablePullDownRefresh`，
   当前 7 页：首页 / 绑定 / 演示页 / 示例页 A / 示例页 B / 字段编辑 / 地区选择）；
   ⚠️ 2026-10-26 第二轮：`hud-*` 版式块全量改指 `page-shell*`（管理端已删那套），
   两个骨架补 `enable-flex`，并新增文末「两条新页必踩的坑」（uview 根节点 `flex:1`、跳页输入）；
④ 剔除源工程业务引用与分包实例（已随本次抽离完成）；
⑤ **保留** `u-form` 三坑（本工程同样适用，且本工程无表单模板，更需此知识）。
⚠️ **2026-10-26 冷启动过渡轮**：`pages/login`（**该页已整页删除**，职责由 `pages/bind` 承接）
全部改指 `pages/bind`；除 `hud-*` 外又清掉一批 C 端残留版式块名
（`.list-item` / `.chip` / `.footer-bar` / `.badge` 在本工程**不存在**）；
`pages.json` 注册步骤补 `navigationBarTextStyle`（custom 下它仍决定状态栏文字色）。
最后同步于 2026-11-25（键盘提交轮）：
**表单页骨架的单行 `<u-input>` 补 `confirm-type="done"` + `@confirm`**，并把三条 why 写进骨架注释
（键盘顶掉 CTA / textarea 不挂 / iOS 数字键盘无回车键）。触发原因：C 端
> 2026-11-26 随业务剥离复核：`pages/common/field-editor.vue` 已四档全挂 `confirm-type`，
> 真机行为仍未验证（见 `memory/known_issues.md`）。
