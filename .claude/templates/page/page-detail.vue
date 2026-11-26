<!--
  详情页模板（__TITLE__）—— 单次取数 + 错误重试，无分页。

  ⚠️ 使用前：同 page-list.vue（替换 __PREFIX__ / __TITLE__、接真实 api、登记 pages.json）。

  与列表页的差异：
    · 不接 useList（无分页语义）
    · 用 detail = null 表达「还没取到」，区别于「取到了但为空」（不要用 !! 合并这两态）
    · 取数失败保留错误态 + 重试按钮，不把整页打成白屏

  ⚠️ 2026-10-26（v1.0.0）修正：本模板原来用的 `.hud-page__body` / `.hud-frame` / `.hud-panel`
  是 **C 端「浅色 HUD 座舱」** 的版式块 —— 那套块在管理端 2026-10-26 换「流光玻璃」时已从
  scaffold.scss **整体删除**，照抄会得到**没有样式且不报错**的页面。已全部改指现役块：
  页壳 `.page-shell` / 内容区 `.page-shell__body` / 卡片 `.card`（含 `.card__hd` / `.card__title`）。
-->
<template>
	<view class="page-shell __PREFIX__-page" @touchstart="onTouchStart" @touchmove="onTouchMove">
		<app-navbar title="__TITLE__" />

		<!-- 首屏加载（局部模式） -->
		<app-loading :show="loading" text="" />
		<!-- ★ 全局实例（不带 show）：请求层 { loading: true } 的渲染方。每页必须挂一次 -->
		<app-loading :mask="true" />
		<!-- ★ 全局弹窗渲染器。每页必须挂一次 -->
		<app-modal />
		<app-refresher :show="visible" :state="pullState" :last-at="lastRefreshAt" :offset="offset" />

		<!-- ⚠️ `enable-flex` 必须带：小程序端 scroll-view 的**子节点默认不吃 flex 布局**
		     （devtools 警告「设置 enable-flex 属性以使 flexbox 布局生效」），
		     而内容区 `.page-shell__body` 是列向 flex 容器（版式约定） -->
		<scroll-view
			class="__PREFIX__-page__scroll"
			:scroll-y="!loading"
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
			<template #refresher>
				<view class="__PREFIX__-page__refresher-slot"></view>
			</template>

			<view class="page-shell__body">
				<!-- 失败态：保留错误文案 + 重试，不白屏。error 可能是字符串或 ApiError 对象，
				     这里只取 message（把对象丢进模板会渲染成含 raw/type 的一坨 JSON） -->
				<view v-if="error" class="__PREFIX__-page__error">
					<text class="__PREFIX__-page__error-text">{{ errorText }}</text>
					<button class="btn btn--ghost btn--lg btn--block" :hover-class="'btn--hover'" @click="retry">
						点击重试
					</button>
				</view>

				<template v-else-if="detail">
					<view class="card">
						<view class="card__hd">
							<text class="card__title">基本信息</text>
						</view>
						<!-- TODO: 换成真实字段 -->
						<view class="kv">
							<text class="kv__k">名称</text>
							<text class="kv__v">{{ detail.name }}</text>
						</view>
					</view>
				</template>
			</view>
		</scroll-view>
	</view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { usePageGuard } from '@/composables/usePageGuard';
import { usePullRefresh } from '@/composables/usePullRefresh';
import { PAGE___UPPER__ } from '@/services/route';
import { isApiError } from '@/services/http';
// TODO: 换成真实 api
// import { __DOMAIN__Api } from '@/api';

// null = 还没取到（区别于「取到了但为空」）—— 不要用 !! 合并这两态，否则 UI 会误报
const detail = ref(null);
const loading = ref(false);
const error = ref('');
let detailId = '';

/** 错误文案归一：字符串直接用；ApiError 取 message；空则兜一句通用文案 */
const errorText = computed(() => {
	const e = error.value;
	if (typeof e === 'string') return e;
	if (e && typeof e === 'object') return e.message || '请求失败，请稍后重试';
	return '请求失败，请稍后重试';
});

/**
 * 取详情。失败保留错误态交给页面重试 UI（不用全局 toast —— 这是进页/下拉路径，
 * 不该弹错打断），但 guard 型错误直接忽略（弹框/跳页已由全局守卫处理）。
 */
async function load() {
	if (loading.value) return;
	loading.value = true;
	error.value = '';
	try {
		// TODO: 换成真实 api
		// detail.value = await __DOMAIN__Api.__DETAIL__({ id: detailId });
		detail.value = { name: '示例' };
	} catch (e) {
		if (isApiError(e) && e.type === 'guard') return; // 守卫已接管，页面无需再提示
		error.value = e && e.message ? e.message : '加载失败';
	} finally {
		loading.value = false;
	}
}

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
} = usePullRefresh({ onRefresh: load });

// ★ 两道门（登录门 + 权限门）统一入口；onReady 拿到 onLoad 的 query。
//   onDenied 落到错误态；retry 同时兜住「门没过」与「取数失败」。
const { retry } = usePageGuard({
	path: PAGE___UPPER__,
	onReady: (options) => {
		detailId = (options && options.id) || '';
		load();
	},
	onDenied: (res) => {
		error.value = res.reason === 'unresolved' ? '参数不完整，请从列表进入' : '登录失败，请检查网络后重试';
	}
});
</script>

<style lang="scss" scoped>
.__PREFIX__-page__scroll {
	flex: 1;
	min-height: 0;
}

.__PREFIX__-page__refresher-slot {
	height: 0;
}

.__PREFIX__-page__error {
	padding: $sp-6 0;
	text-align: center;
}

.__PREFIX__-page__error-text {
	display: block;
	margin-bottom: $sp-3;
	font-size: $fs-body;
	color: $text-muted;
}
</style>