<!--
  通用组件模板（__NAME__）。

  easycom 自动注册：放进 src/components/app-example/app-example.vue 后，
  页面直接写 <app-example /> 即可，无需 import。

  ⚠️ 使用前：
    1. 目录名与文件名必须同名（easycom 约定）
    2. 全局替换 __NAME__ / PREFIX
    3. 写类名前先 grep src/common/css/main.css 的 ColorUI 类名（防撞名，见 BUG-001）
-->
<template>
	<!-- 根节点类名：≥3 字母 + 语义前缀。禁止用 ColorUI 已有的单/双字母类名（如 .fr .fl） -->
	<view class="PREFIX" :class="{ 'PREFIX--disabled': disabled }">
		<!-- 状态优先级只在 computed 里定义一处：模板里不散落 v-if 顺序 ——
		     否则各页会写出不一致的分支顺序（参考 app-list-state 的 status） -->
		<view v-if="status === 'loading'" class="PREFIX__loading">
			<u-loading-icon mode="circle" size="30" :color="theme.brandOrange" />
		</view>

		<u-empty
			v-else-if="status === 'empty'"
			mode="data"
			:text="emptyText"
			:icon-size="48"
			:icon-color="theme.textSub"
			:text-color="theme.textMuted"
			text-size="24rpx"
		/>

		<!-- 渲染全部委托 uview 现成组件，本组件只做编排，不造轮子 -->
		<view v-else class="PREFIX__body">
			<slot />
		</view>
	</view>
</template>

<script setup>
import { computed } from 'vue';
// 给 uview 组件传色值只能用字符串 → 从 config/theme 的 JS 镜像取（theme.scss 的 JS 侧对应物）
import { theme } from '@/config/theme';

const props = defineProps({
	// 数据源。null = 还没取到，区别于 [] = 取到了但为空（不要用 !! 合并这两态）
	data: { type: [Array, Object], default: null },
	loading: { type: Boolean, default: false },
	disabled: { type: Boolean, default: false },
	emptyText: { type: String, default: '暂无数据' }
});

// 事件显式声明（避免隐式透传导致调用方不知道能监听什么）
const emit = defineEmits(['retry']);

// 状态优先级只在这一处定义，页面各分支不可能再写出不一致的顺序
const status = computed(() => {
	if (props.loading) return 'loading';
	if (props.data === null) return 'loading'; // 未取到 与 加载中 同态
	const isEmpty = Array.isArray(props.data) ? props.data.length === 0 : !props.data;
	if (isEmpty) return 'empty';
	return 'content';
});
</script>

<style lang="scss" scoped>
/* 只写本组件私有样式；值一律从 theme.scss 的 token 取（uni.scss 已全局注入） */
.PREFIX {
	width: 100%;
}

.PREFIX__loading {
	display: flex;
	align-items: center;
	justify-content: center;
	padding: $sp-6 0;
}

.PREFIX__body {
	width: 100%;
}

.PREFIX--disabled {
	opacity: 0.5;
	/* 禁态不拦截事件：由使用方决定是否 @click，组件不擅自 pointer-events 劫持 */
}
</style>