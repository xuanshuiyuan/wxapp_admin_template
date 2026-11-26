<!--
  列表页模板（__TITLE__）。

  ⚠️ 使用前：
    1. 全局替换 __PREFIX__ 为你的页面前缀（≥3 字母，且不在 ColorUI 类名表里）
    2. 全局替换 __TITLE__ 为页面标题
    3. 把「TODO: 换成真实 api」处换成 @/api 里的方法
    4. 在 src/pages.json 的 pages 数组登记本页（第一项是启动页）
    5. 删掉不适用的分支（不留死代码）

  页壳六个必备件见 .claude/templates/page/README.md。

  ⚠️ 2026-10-26（v1.0.0）修正：本模板原来用的 `.hud-page*` / `.hud-frame` / `.hud-panel` /
  `.list-item*` 是 **C 端「浅色 HUD 座舱」** 的版式块 —— 那套块在管理端换「流光玻璃」时已从
  scaffold.scss **整体删除**，照抄会得到**没有样式且不报错**的页面。已全部改指现役块：
  页壳 `.page-shell` / 内容区 `.page-shell__body` / 卡片 `.card`（含 `.card__hd` / `.card__title`）。
-->
<template>
	<!-- 根节点接 touch：下拉距离的兜底来源（原生不给 dy 时用，见 usePullRefresh 的 dyOf） -->
	<view class="page-shell __PREFIX__-page" @touchstart="onTouchStart" @touchmove="onTouchMove">
		<app-navbar title="__TITLE__" />

		<!-- 首屏加载转圈（局部模式，由本页 loading 驱动；全屏浮层，放滚动容器外） -->
		<app-loading :show="firstLoading" text="" />
		<!-- 全局模式实例（不带 show）：★ 每页必须挂一次，请求层 { loading: true } 才有渲染方。
		     没挂时 toast.js 会静默降级成原生 uni.showLoading，样式与本项目不符。 -->
		<app-loading :mask="true" />
		<!-- 全局弹窗渲染器：★ 每页必须挂一次。少了它 pushModal 什么都不弹，
		     且滞留队列会在切页后才突然冒出。 -->
		<app-modal />
		<!-- 下拉指示器：三段跟手态（下拉刷新 / 松开立即刷新 / 正在刷新数据中…） -->
		<app-refresher :show="visible" :state="pullState" :last-at="lastRefreshAt" :offset="offset" />

		<!-- ⚠️ `enable-flex` 必须带：小程序端 scroll-view 的**子节点默认不吃 flex 布局**
		     （devtools 警告「设置 enable-flex 属性以使 flexbox 布局生效」），
		     而内容区 `.page-shell__body` 是列向 flex 容器（版式约定） -->
		<scroll-view
			class="__PREFIX__-page__scroll"
			:scroll-y="!firstLoading"
			enable-flex
			refresher-enabled
			refresher-default-style="none"
			refresher-background="transparent"
			:refresher-triggered="refreshing"
			:refresher-threshold="threshold"
			@refresherpulling="onPulling"
			@refresherrefresh="onRefresh"
			@refresherrestore="onPullEnd"
			@refresherabort="onPullEnd"
		>
			<!-- 槽内只放 0 高占位：原生 refresher 区无内容，回弹收缩时才不会有溢出/遮盖；
			     真正的指示器是 app-refresher 自己的浮层 -->
			<template #refresher>
				<view class="__PREFIX__-page__refresher-slot"></view>
			</template>

			<view class="page-shell__body">
				<!-- 列表主体：一条一张 `.card`（版式块见 styles/scaffold.scss）。
				     同类信息用 .rows/.row 家族；键值对用 .kv —— 不要在页面里新造版式块 -->
				<view class="card" v-for="item in items" :key="item.id" @click="onItemTap(item)">
					<view class="card__hd">
						<!-- TODO: 换成真实字段。禁止把整条 item 直接渲染出来（会渲染成一坨 JSON） -->
						<text class="card__title">{{ item.title }}</text>
					</view>
					<text class="row__desc">{{ item.desc }}</text>
				</view>

				<!-- ★ 四态编排（骨架 → 空 → 失败重试 → **加载更/到底**）必须放在**列表之后**：
				     它同时承担「— 没有更多了 —」那一行 —— 放在 v-for 之前会把这句话印到**列表上方**
				     （2026-10-26 真机反馈过，见 memory/bug_history.md BUG-010）。
				     空/失败态时没有卡片，它自然就是整块的内容，位置同样正确。
				     props 与 useList 的状态一一对应，优先级只在组件内部定义一次 -->
				<app-list-state
					:first-loading="firstLoading"
					:empty="isEmpty"
					:error="error"
					:loading="loading"
					:finished="finished"
					@retry="reload"
				/>
			</view>
		</scroll-view>
	</view>
</template>

<script setup>
import { useList } from '@/composables/useList';
import { usePullRefresh } from '@/composables/usePullRefresh';
import { route } from '@/services/route';
// TODO: 换成真实 api（必须在 src/config/endpoints.js 先登记 URL，再在 src/api/<域>.js 包方法）
// import { __DOMAIN__Api } from '@/api';

// ⚠️ useList 直接吃 api 方法：形如 (query, options) => Promise<body>
//    后端分页契约 page / page_size + data.list / data.total 零配置吻合。
//    某接口字段特殊时 → 传自定义 pick，不要改 useList 本体。
const {
	items,
	total,
	loading,
	error,
	finished,
	isEmpty,
	firstLoading,
	reload,
	refresh,
	loadMore
} = useList(
	// TODO: 换成真实 api，如 (query, options) => __DOMAIN__Api.__LIST__(query, options)
	async () => ({ data: { list: [], total: 0 } }),
	{
		// 每次请求前取最新筛选条件（响应式取值放这里，不要闭包提前取）
		params: () => ({
			// keyword: keyword.value
		})
	}
);

// 下拉三段态 + 「最后更新」时刻全在公共件里，页面只给取数函数与在飞判重
const {
	pullState,
	refreshing,
	lastRefreshAt,
	offset,
	visible,
	threshold,
	onPulling,
	onRefresh,
	onPullEnd,
	onTouchStart,
	onTouchMove
} = usePullRefresh({ onRefresh: refresh });

/** 点击列表项：跳详情。跳页用 route.to（保留页栈语义由 route 统一决定） */
function onItemTap(item) {
	route.to('/pages/__DETAIL__/index', { id: item.id });
}
</script>

<style lang="scss" scoped>
/* 滚动区：flex 拿剩余高（min-height:0 防 flex 子项默认 auto 撑破列布局） */
.__PREFIX__-page__scroll {
	flex: 1;
	min-height: 0;
}

/* 槽内 0 高占位：原生 refresher 区无内容，避免回弹时溢出 */
.__PREFIX__-page__refresher-slot {
	height: 0;
}
</style>