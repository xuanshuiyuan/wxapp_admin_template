<!--
  自绘顶栏（easycom 自动注册）—— 「流光玻璃」语言版（2026-10-26 随全站换风格重写）。

  ✅ **已被消费**：`pages/demo/page-a`、`pages/demo/page-b`、`pages/common/*` 等二级页
  （要「返回 + 标题」）。不用它的两页：绑定页是整屏极光（无顶栏）、首页是自绘的极光头部
  （「工作台 + 头像」复合头，比通用顶栏复杂）。本组件与 pages.json 的
  navigationStyle:custom、services/platform 的 getLayout() 是配套的基础设施。

  改动要点（与旧 HUD 版的区别）：
  · 去掉「左侧品牌黄竖条 + 栏底流光发丝动画」——新体系禁止装饰动画，标题靠字号字重分层；
  · 底色由「墨纱叠冷蓝」改为白底 + 底部发丝线（压在任意页面底上都成立）；
  · 高度仍只问 getLayout()（状态栏 + 胶囊反推导航高，进程内缓存），页面/组件零条件编译。
-->
<template>
	<view class="nb">
		<!-- 占位块：与固定栏等高，滚动时内容从栏下露出而不是顶到屏幕上沿 -->
		<view class="nb__space" :style="{ height: bar.customBarHeight + 'px' }"></view>
		<view class="nb__bar" :style="{ paddingTop: bar.statusBarHeight + 'px' }">
			<view
				class="nb__content"
				:style="{
					height: bar.navBarHeight + 'px',
					paddingRight: bar.capsuleReserve ? bar.capsuleReserve + 'px' : '',
				}"
			>
				<view v-if="showBack" class="nb__back" hover-class="nb__back--hover" @click="onBack">
					<u-icon name="arrow-left" :size="20" :color="theme.textTitle" />
				</view>
				<view class="nb__title-wrap">
					<text class="nb__title">{{ title }}</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { getLayout } from '@/services/platform';
import { route } from '@/services/route';
import { theme } from '@/config/theme';

defineProps({
	title: { type: String, default: '' },
	showBack: { type: Boolean, default: false },
});

// 布局尺寸进程内固定，无需响应式；H5 状态栏为 0 时 paddingTop 自然为 0
const bar = getLayout();

function onBack() {
	route.back();
}
</script>

<style lang="scss" scoped>
.nb__space {
	width: 100%;
}

.nb__bar {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	z-index: $z-nav;
	// 纯白底 + 底部发丝线：微信下拉回弹会连 fixed 栏一起平移，露出区是窗口纯色底——
	// 栏若带渐变/透明就会与露出区色差成「一大块空白」，故用不透明纯色
	background-color: $bg-card;
	border-bottom: 1rpx solid $divider-color;
}

.nb__content {
	display: flex;
	align-items: center;
	padding: 0 $page-padding;
	// 微信端 paddingRight 由 capsuleReserve 内联覆盖（给原生胶囊让位），其余端走这里的默认值
}

.nb__back {
	width: $size-icon-button;
	height: 100%;
	margin-left: -$sp-2; // 热区外扩，视觉与页面左边距对齐
	display: flex;
	align-items: center;
}

.nb__back--hover {
	opacity: 0.7;
}

.nb__title-wrap {
	flex: 1;
	display: flex;
	align-items: center;
	overflow: hidden;
}

.nb__title {
	font-size: $fs-cta; // 33rpx（17px）
	font-weight: $fw-semibold;
	color: $text-title;
	line-height: $lh-cta;
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}
</style>