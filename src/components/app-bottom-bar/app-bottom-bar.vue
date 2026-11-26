<!--
  固定底栏（easycom 自动注册）—— 列表页的「新增」与表单页的「保存 / 取消」共用。

  为什么抽成公共件：多个列表 / 表单页都要同一根底栏（高度 / 安全区 /
  分隔线 / z-index 全部要一致）。各页各写一份必然在两处漂移（其中一处写错安全区，
  在全面屏机型上按钮就会贴着屏幕底边）。

  ★ 用法：
    <app-bottom-bar>
      <view class="btn btn--primary btn--lg btn--block" @click="onCreate">新增管理员</view>
    </app-bottom-bar>

  ★ 配套：内容区必须自己留出底栏高度（否则最后一张卡会被盖住）——
    页面里给 scroll-view 的内容 wrapper 加 `padding-bottom`（本组件高度 ≈ 80rpx + 安全区）。
    推荐用 `.bbar-space` 版式类（见本文件样式，scoped 下不可跨页复用，故页面写
    `padding-bottom: 160rpx` 亦可；两处取值要一起看）。

  ⚠️ 本组件**不参与** `.page-shell` 的 flex 布局：position: fixed 脱离文档流，
     page-shell 的高度分配不受影响（与里层滚动区不抢高度）。
-->
<template>
	<view class="bbar">
		<view class="bbar__inner">
			<slot />
		</view>
	</view>
</template>

<script setup>
// 无逻辑：只提供版式（固定定位 + 发丝线 + 安全区）。按钮与事件由调用方给。
</script>

<style lang="scss" scoped>
.bbar {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	// 底栏要盖在滚动内容之上（页面里没有比它更高的浮层）
	z-index: $z-bottom-bar;
	background-color: $bg-card;
	box-shadow: $shadow-bottom-bar;
	// ⚠️ 两行缺一不可（纯 rpx 回退 + 叠安全区）：calc 里混 rpx 与 env 在小程序端兼容性不可靠
	padding-bottom: $bottom-bar-gap;
	padding-bottom: calc(#{$bottom-bar-gap} + #{$safe-bottom});
}

.bbar__inner {
	display: flex;
	align-items: center;
	padding: $sp-2 $page-padding 0;
	/* ⚠️ 这里**不能**写 gap：① iOS 微信不支持 flex gap（见 theme.scss 的间距 token 注释）；
	   ② 插槽内容属于调用方作用域，本组件的 scoped 规则也碰不到它们。
	   按钮间距由各页给：`.__bar-btn + .__bar-btn { margin-left: $sp-2 }`。 */
}
</style>