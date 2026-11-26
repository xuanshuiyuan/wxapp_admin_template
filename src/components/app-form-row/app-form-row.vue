<!--
  表单行（easycom 自动注册）：左标签（+ 红色必填星）+ 右值 + 箭头。

  为什么抽成公共件：一张表单里十几行，绝大多数是同一个骨架。
  逐行手写必然漂移（行高、字号、箭头位置各写各的），收成一份。
  ★ 值区只读、点击由整行触发 —— 输入行为统一是「点行 → 跳通用字段编辑页」，
    组件本身**不含 input**（用户 2026-10-30 定：所有 input 都跳新页面编辑）。

  ★ 类名前缀是 `frow`（**不是 `fr`**）：`common/css/main.css` 有全局 `.fr{float:right}`，
    撞名会把整行浮动到右边（真机踩过，见 memory/bug_history.md BUG-001）。
  ★ 行间发丝线由页面显式传 `divider`：MP 端自定义组件的宿主是真实节点，
    跨实例的相邻兄弟选择器不可靠（同 C 端 app-form-row 的结论）。
-->
<template>
	<view
		class="frow"
		:class="{ 'frow--divider': divider, 'frow--wrap': wrap }"
		:hover-class="arrow ? 'frow--hover' : ''"
		:hover-stay-time="120"
		@click="onTap"
	>
		<text class="frow__label">
			{{ label }}<text v-if="required" class="frow__req">*</text>
		</text>
		<view class="frow__val">
			<text class="frow__text" :class="{ 'frow__text--ph': !value }">{{ value || placeholder }}</text>
			<text v-if="unit && value" class="frow__unit">{{ unit }}</text>
		</view>
		<text v-if="arrow" class="frow__arrow">›</text>
	</view>
</template>

<script setup>
const props = defineProps({
	label: { type: String, default: '' },
	required: { type: Boolean, default: false },
	value: { type: String, default: '' },
	placeholder: { type: String, default: '' },
	arrow: { type: Boolean, default: false },
	unit: { type: String, default: '' },
	divider: { type: Boolean, default: false },
	/** 长文本（描述 / 备注）允许折行，不截断成省略号 */
	wrap: { type: Boolean, default: false }
});

const emit = defineEmits(['tap']);

function onTap() {
	// 没有箭头 = 只读行，不响应点击（箭头与可点是同一件事，不给「能点」的错觉）
	if (!props.arrow) return;
	emit('tap');
}
</script>

<style lang="scss" scoped>
.frow {
	display: flex;
	align-items: center;
	padding: $sp-3 0;
}

.frow--wrap {
	align-items: flex-start;
}

/* 行间发丝（页面给分组内第 2..n 行传 divider） */
.frow--divider {
	border-top: 1rpx solid $divider-color;
}

.frow--hover {
	opacity: 0.7;
}

/* 标签列定宽：窄了「电池品牌」这类四字标签会贴到值上，右缘也跟着参差 */
.frow__label {
	flex-shrink: 0;
	width: 200rpx;
	font-size: $fs-body;
	color: $text-sub;
	line-height: $lh-body;
}

.frow__req {
	margin-left: 4rpx;
	color: $color-danger;
	font-weight: $fw-semibold;
}

.frow__val {
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: flex-end;
	min-width: 0;
}

.frow__text {
	font-size: $fs-body;
	font-weight: $fw-semibold;
	color: $text-title;
	text-align: right;
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}

/* 折行档：值占满、左对齐（长描述右对齐会很难读） */
.frow--wrap .frow__text {
	text-align: left;
	white-space: normal;
	word-break: break-all;
}

.frow__text--ph {
	color: $text-muted;
	font-weight: $fw-medium;
}

.frow__unit {
	margin-left: 6rpx;
	font-size: $fs-caption;
	font-weight: $fw-regular;
	color: $text-sub;
}

.frow__arrow {
	flex-shrink: 0;
	margin-left: $sp-2;
	font-size: $fs-cta;
	line-height: 1;
	color: $text-muted;
}
</style>