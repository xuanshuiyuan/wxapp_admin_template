<!--
  列表主体状态区（easycom 自动注册：<app-list-state /> 直接用，无需 import）。

  把 useList 的四个互斥状态收敛成一条链，页面里从此不用重复写
  骨架 / 空态 / 失败重试 / 加载更·到底 的 v-if-v-else 模板：
    firstLoading → 空 → 失败 → 加载中(分页) → 到底
  优先级在 status 计算属性里统一维护，页面各分支不可能再写出不一致的顺序。

  渲染全部委托 uview-plus 现成组件，本组件只做「状态编排」，不造轮子：
    骨架 → u-skeleton（经 app-skeleton 预设形状）
    空态/失败 → u-empty（mode data/wifi 内置图标）+ 插槽放重试按钮
    加载更/到底 → u-loadmore（loading/nomore 两态）
  颜色经 config/theme.js 传入组件 props（uview 的 color 类 prop 只收字符串）。

  与 useList 的接线（props 名字一一对应，直传即可）：

    <app-list-state
      :first-loading="firstLoading" :empty="isEmpty" :error="error"
      :loading="loading" :finished="finished" @retry="reload"
    />

  定制：文案/图标都有默认值可整体覆盖；skeleton-type 传 '' 可退回转圈占位；
  空态与失败态的重试按钮统一 emit('retry')，怎么重试由页面决定（一般是 reload）。
-->
<template>
	<!-- 首屏加载：骨架屏预演结构；skeleton-type 为空则退回转圈 -->
	<app-skeleton v-if="status === 'skeleton'" :type="skeletonType" :count="skeletonCount" />
	<view class="state" v-else-if="status === 'spinner'">
		<u-loading-icon mode="circle" size="34" :color="theme.primary" />
		<text class="state__text">{{ loadingText }}</text>
	</view>

	<!-- 空态：u-empty 默认 mode=data 即 empty-data 图标；重试按钮放它的插槽 -->
	<u-empty
		v-else-if="status === 'empty'"
		:mode="emptyIconMode"
		:text="emptyText"
		:icon-size="56"
		:icon-color="theme.textSub"
		:text-color="theme.textMuted"
		text-size="24rpx"
	>
		<!-- `empty-retry-text` 传空串 = 不渲染重试按钮（如详情页的互动预览：有数据才显示整块，
		     空态本来就不出现；留空串是为了不把「刷新一下」硬塞到只读预览里） -->
		<text v-if="emptyRetryText" class="state__retry" @click="$emit('retry')">{{ emptyRetryText }}</text>
	</u-empty>

	<!-- 失败：列表默认不弹 toast（useList toastOnError:false），错误文案即 error -->
	<u-empty
		v-else-if="status === 'error'"
		mode="wifi"
		:text="errorText"
		:icon-size="56"
		:icon-color="theme.danger"
		:text-color="theme.textMuted"
		text-size="24rpx"
	>
		<text class="state__retry" @click="$emit('retry')">{{ errorRetryText }}</text>
	</u-empty>

	<!-- 加载更 / 到底：u-loadmore；关掉横线与粗点，保持原「一行灰字」观感。
	     ⚠️ 必须带 `.state__more`（见 <style>）：它的根节点自带 flex: 1 -->
	<u-loadmore
		v-else-if="status === 'more-loading' || status === 'more-finished'"
		class="state__more"
		:status="status === 'more-loading' ? 'loading' : 'nomore'"
		:loading-text="loadingText"
		:nomore-text="finishedText"
		:color="theme.textMuted"
		font-size="24rpx"
		:line="false"
		:is-dot="false"
	/>
</template>

<script setup>
import { computed } from 'vue'
import { theme } from '@/config/theme'

const props = defineProps({
	// —— 来自 useList 的五个状态，直传 ——
	firstLoading: { type: Boolean, default: false },
	empty: { type: Boolean, default: false }, // isEmpty
	// 错误消息。useList 给的是字符串，但页面自管的取数逻辑可能直接存原始 ApiError 对象，
	// 故两种都收，由 errorText 统一归一
	error: { type: [String, Object], default: '' },
	loading: { type: Boolean, default: false }, // 分页加载中
	finished: { type: Boolean, default: false }, // 已到底

	// —— 骨架屏（app-skeleton）配置 ——
	skeletonType: { type: String, default: 'list' }, // 传 '' 退回转圈
	skeletonCount: { type: [String, Number], default: 4 },

	// —— 文案/图标定制，默认值即脚手架观感 ——
	emptyIconMode: { type: String, default: 'data' }, // u-empty 预置图标：data/list/search/wifi…
	emptyText: { type: String, default: '还没有数据' },
	emptyRetryText: { type: String, default: '刷新一下' },
	errorRetryText: { type: String, default: '点击重试' },
	loadingText: { type: String, default: '加载中…' },
	finishedText: { type: String, default: '— 没有更多了 —' }
})

defineEmits(['retry'])

// 状态优先级只在这一处定义：首屏 > 空 > 失败 > 分页加载 > 到底
const status = computed(() => {
	if (props.firstLoading) return props.skeletonType ? 'skeleton' : 'spinner'
	if (props.empty) return 'empty'
	if (props.error) return 'error'
	if (props.loading) return 'more-loading'
	if (props.finished) return 'more-finished'
	return 'none'
})

// 错误文案归一：字符串直接用；ApiError（对象）取 message——u-empty 的 text 是
// `{{ text ? text : … }}`，把对象丢进去会渲染成一坨 JSON（含 raw/type 字段），
// 用户看到的首屏失败提示就不可读了。空 message 兜一句通用文案，不留空白。
const errorText = computed(() => {
	const e = props.error
	if (typeof e === 'string') return e
	if (e && typeof e === 'object') return e.message || '请求失败，请稍后重试'
	return ''
})
</script>

<style lang="scss" scoped>
/* ★ uview 的 `.u-loadmore` 根节点自带 `flex: 1`，而它在本项目里**总是**被放进
   **列向 flex 的内容区**（.page-shell__body / 各页 body）—— flex-grow 一生效，
   这一行「加载更 / 到底」就吃掉整块剩余高度：列表被顶成中间一条、下半屏全空白
   （列表页真机反馈「下半部被遮住了」，与 .u-datetime-picker 那处同一个根源：
   页壳/内容区里凡是 uview 组件，都要先看它根类有没有 flex: 1）。
   ⚠️ `!important` 必须带：uview 的规则是 scoped 编译产物（.u-loadmore.data-v-xxx），
   与本文件同优先级，谁赢取决于产物里的先后顺序 —— 口径同 scaffold.scss 的弹层族修复。
   ⚠️ 这里**只**收 loadmore：`.u-search` / `.u-input` 常作为行向 flex 的子项靠 flex:1
   占满整行，不能一起改（见 scaffold.scss 同段注释）。 */
.state__more {
	flex: none !important;
}
</style>
