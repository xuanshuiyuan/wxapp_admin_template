<!--
  品牌区（渐变圆徽标 + 主标题 + 可选副标）——管理端**启动视觉的唯一锚点**。

  ★ 为什么要抽成组件（而不是两页各写一份）：
    两处消费，且它们之间只隔一次 `reLaunch`：
      ① 绑定页的玻璃卡顶部（pages/bind）
      ② 首页冷启动的「启动判定态」（pages/admin-home）——会话未就绪时整屏极光 + 玻璃卡，
         卡内只有本组件
    微信端 `reLaunch` 是**整屏瞬切**（无转场动画），小程序也**不支持共享元素过渡**，
    所以「平滑」只能靠「两屏底色一致 + 有一块**内容与尺寸不变**的锚点」。品牌区就是那块 ——
    ⚠️ 说「不变」指的是**它自身**（徽标直径 / 字号 / 间距 / 配色逐字一致），
      不指**屏幕位置**：卡是垂直居中的，绑定页的卡因表单+hint+CTA 而更高 →
      徽标会随卡高上移约「(两卡高差)/2」。这是已知且接受的（真机项见 known_issues K-21）——
    一旦两处各写一份，尺寸/字号/间距稍有一处不同，切换时就会看到徽标「跳一下」，
    正是本次要消除的观感问题（机制见 .claude/CLAUDE.md 的冷启动说明）。

  ⚠️ 文字用**卡内深墨**（$text-title / $text-muted）：两个消费方都把本组件放在 `.glass`
     玻璃卡里。若将来有页面要把它直接压在极光上，深墨会看不清（scaffold 有 `.on-aurora`
     那套专门口径），届时再按 app-refresher 的 `tone` 模式加 prop —— **不要**在调用方
     用 scoped 样式覆盖颜色（会漂移）。
-->
<template>
	<view class="brand">
		<!-- 徽标字符是**品牌标记**：新项目把它换成自己的一个字（如品牌首字） -->
		<view class="brand__badge"><text>{{ mark }}</text></view>
		<text class="brand__name">{{ title }}</text>
		<!-- ⚠️ 副标为空时**整行不渲染**（不是渲染一个空 text）：空行仍会吃掉 $sp-1 上距 +
		     一行行高，两屏的卡高就对不上，切换时锚点会跳 -->
		<text v-if="sub" class="brand__sub">{{ sub }}</text>
	</view>
</template>

<script setup>
defineProps({
	// 主标题：绑定页给「绑定管理员账号」（说明本页要干什么），启动态给品牌名（APP_NAME）
	title: { type: String, required: true },
	// 徽标字符：品牌标记本身（一个字），新项目按品牌改
	mark: { type: String, default: '管' },
	// 副标：启动态给中性的「正在进入…」—— 存量会话（有 token 但没权限点）的用户也会看到
	// 启动态，用绑定口径的文案（"首次使用需绑定"）对他们是错的
	sub: { type: String, default: '' }
});
</script>

<style lang="scss" scoped>
/* 徽标直径：设计稿 56pt。token 里最近的一档 $size-icon-disc 是 40pt，差一档半，
   硬套会明显小于稿 —— 故收一个组件内局部变量（组件内唯一一处非 token 尺寸）。
   ⚠️ 两个消费方共用本组件，正是为了让这个值只有一处（原在 pages/bind 里叫 $bind-badge）。 */
$brand-badge: 112rpx;

.brand {
	display: flex;
	flex-direction: column;
	align-items: center;
}

/* 渐变圆徽标：渐变配方取 CTA 那支（$bg-aurora-cta），彩影取 $shadow-cta */
.brand__badge {
	width: $brand-badge;
	height: $brand-badge;
	border-radius: $rd-pill;
	background: $bg-aurora-cta;
	box-shadow: $shadow-cta;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: $fs-hero; // 稿内 26pt，取最近档 $fs-hero（24pt）
	font-weight: $fw-semibold;
	color: $text-on-primary;
	line-height: 1;
}

.brand__name {
	margin-top: $sp-4;
	font-size: $fs-display; // 19pt，取页面主标题档
	font-weight: $fw-semibold;
	color: $text-title;
	line-height: $lh-display;
}

.brand__sub {
	margin-top: $sp-1;
	font-size: $fs-caption;
	color: $text-muted;
	line-height: $lh-caption;
}
</style>