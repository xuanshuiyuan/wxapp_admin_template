<!--
  通用字段编辑页（v1.1.0）：一次只编辑一个字段，确认后把值回传给来源页。

  为什么单独成页而不是页内 input（用户 2026-10-30 定，参照 C 端电池回收表单）：
  键盘弹层在各机型（刘海屏 / 小屏 / H5）的遮挡与高度表现不一，整页承载控件最稳，
  也不会与列表抢高度；调用方 `const v = await editField(...)` 拿值。

  ★ 页壳 = C 档（app-navbar + **页面级滚动**，不套 scroll-view）：键盘弹起时整页要能上滚，
    否则输入框会被键盘顶掉（rule-add-page 的 C 档定义）。

  ★ 回传契约（services/pickPage.js 的硬要求，破了调用方 Promise 会永挂）：
    · 确认：**先回传、再返回**；`emitted` 标志防 onUnload 再补一次「放弃」覆盖结果；
    · 返回键 / 手势 = 放弃（ok:false，调用方保持原值）。
    · `''`（确认空值）与 `null`（放弃）是两件事 —— 选填字段要能真的清空。
-->
<template>
	<view class="fed">
		<app-navbar :title="title || '编辑'" :show-back="true" />

		<view class="fed__body">
			<view class="card">
				<text class="field__label">
					{{ title }}<text v-if="!optional" class="fed__req">*</text>
				</text>

				<!-- 多行：描述 / 备注 -->
				<view v-if="type === 'textarea'" class="field__box fed__area-box">
					<textarea
						class="fed__area"
						v-model="text"
						:focus="autoFocus"
						:maxlength="maxlength"
						:placeholder="placeholder || '请输入' + title"
						placeholder-class="c-muted"
						auto-height
					/>
				</view>

				<!-- 单行：数字 / 密码 / 文本。
				     ⚠️ 数字档必须用**独立的静态 `type="number"` 节点**：微信端在同一个 input 上
				     动态改 type，原生键盘不会跟着换（真机反馈「手机号键盘没变数字」）。
				     `inputmode="numeric"` 是 H5 端的同一意图兜底。 -->
				<view v-else class="field__box" :class="{ 'field__box--focus': focused }">
					<!-- 金额档：微信 `type="digit"` 是**带小数点**的数字键盘（`number` 只有整数键，
					     填 100.50 时打不出小数点）；H5 用 `inputmode="decimal"` 达到同一意图。
					     仍用独立静态节点，不在 number 节点上动态改 type（同下方数字档的注释）。 -->
					<input
						v-if="type === 'decimal'"
						class="field__input"
						type="digit"
						inputmode="decimal"
						v-model="text"
						:focus="autoFocus"
						:maxlength="maxlength"
						:placeholder="placeholder || '请输入' + title"
						placeholder-class="c-muted"
						confirm-type="done"
						@focus="focused = true"
						@blur="focused = false"
						@confirm="onConfirm"
					/>
					<input
						v-else-if="type === 'number' || type === 'phone'"
						class="field__input"
						type="number"
						inputmode="numeric"
						v-model="text"
						:focus="autoFocus"
						:maxlength="maxlength"
						:placeholder="placeholder || '请输入' + title"
						placeholder-class="c-muted"
						confirm-type="done"
						@focus="focused = true"
						@blur="focused = false"
						@confirm="onConfirm"
					/>
					<input
						v-else-if="type === 'password'"
						class="field__input"
						type="text"
						:password="!pwdVisible"
						v-model="text"
						:focus="autoFocus"
						:maxlength="maxlength"
						:placeholder="placeholder || '请输入' + title"
						placeholder-class="c-muted"
						confirm-type="done"
						@focus="focused = true"
						@blur="focused = false"
						@confirm="onConfirm"
					/>
					<input
						v-else
						class="field__input"
						type="text"
						v-model="text"
						:focus="autoFocus"
						:maxlength="maxlength"
						:placeholder="placeholder || '请输入' + title"
						placeholder-class="c-muted"
						confirm-type="done"
						@focus="focused = true"
						@blur="focused = false"
						@confirm="onConfirm"
					/>
					<!-- 密码眼睛：点一下在明文/密文间切换（只在密码档出现） -->
					<view v-if="type === 'password'" class="fed__eye" @click.stop="pwdVisible = !pwdVisible">
						<u-icon :name="pwdVisible ? 'eye-off' : 'eye'" size="20" :color="theme.textMuted" />
					</view>
				</view>

				<text class="fed__hint">
					{{ optional ? '选填；清空后确认即可清除该项。' : '带 * 为必填项。' }}
				</text>
			</view>

			<view class="btn btn--aurora btn--lg fed__cta" hover-class="btn--hover" @click="onConfirm">
				确认
			</view>

			<text class="version">{{ APP_VERSION_TEXT }}</text>
		</view>

		<app-loading :mask="true" />
		<app-modal />
	</view>
</template>

<script setup>
import { ref } from 'vue';
import { onLoad, onReady, onUnload } from '@dcloudio/uni-app';
import { consumeFieldValue, emitFieldResult } from '@/services/fieldEditor';
import { route } from '@/services/route';
import { toast } from '@/services/toast';
import { APP_VERSION_TEXT } from '@/config/app';
import { theme } from '@/config/theme';
import { safeDecodeURIComponent } from '@/utils/text';

const title = ref('');
const type = ref('text');
const text = ref('');
const placeholder = ref('');
const maxlength = ref(64);
const optional = ref(false);
const focused = ref(false);
const autoFocus = ref(false);
// 密码可见性：只影响编辑页的显示，不影响回传值与落盘
const pwdVisible = ref(false);

// 是否已回传：确认后 onUnload 不再补发「放弃」，否则会覆盖刚回传的结果
let emitted = false;

onLoad((query) => {
	const q = query || {};
	// query 解码：openPickPage 侧已 encodeURIComponent，小程序端 onLoad 的 options 不自动解码
	title.value = q.title ? safeDecodeURIComponent(q.title) : '编辑';
	type.value = q.type ? safeDecodeURIComponent(q.type) : 'text';
	// 当前值从 fieldEditor 的模块内存取（不走 URL，避免手机号/密码进页面栈）
	text.value = consumeFieldValue();
	placeholder.value = q.placeholder ? safeDecodeURIComponent(q.placeholder) : '';
	maxlength.value = Number(q.maxlength) || 64;
	optional.value = String(q.optional) === '1';
});

onReady(() => {
	// 进页自动弹键盘：onLoad 就置 focus 时页面转场还没结束，微信端不会弹 ——
	// 等 onReady 再延一拍越过转场（与 C 端 field-editor 同一口径；这是平台键盘时序，不是掩盖竞态）
	setTimeout(() => {
		autoFocus.value = true;
	}, 300);
});

// 放弃（返回键 / 手势 / 顶栏返回）也要回传，调用方的 Promise 不能永挂
onUnload(() => {
	if (!emitted) emitFieldResult({ ok: false });
});

function onConfirm() {
	if (emitted) return;
	// 密码保留原样（不 trim：密码里的首尾空格可能是用户有意输入的）；其余字段 trim
	const value = type.value === 'password' ? text.value : text.value.trim();
	if (!optional.value && !value) {
		toast(`请填写${title.value}`);
		return;
	}
	// 先回传、再返回（顺序反了会先卸载本页、监听可能已摘，值就丢了）
	emitted = true;
	emitFieldResult({ ok: true, value });
	route.back();
}
</script>

<style lang="scss" scoped>
/* C 档：页面级滚动（不套 scroll-view，见文件头） */
.fed {
	min-height: 100vh;
	background-color: $bg-page;
}

.fed__body {
	padding: $sp-3 $page-padding 0;
	padding-bottom: $sp-5;
}

.fed__req {
	margin-left: 4rpx;
	color: $color-danger;
	font-weight: $fw-semibold;
}

.fed__area-box {
	height: auto;
	min-height: 240rpx;
	padding: $sp-3;
	align-items: flex-start;
}

.fed__area {
	width: 100%;
	min-height: 200rpx;
	font-size: $fs-lead;
	color: $text-title;
	line-height: $lh-base;
}

.fed__eye {
	flex: none;
	width: 44rpx;
	height: 44rpx;
	margin-left: $sp-2;
	display: flex;
	align-items: center;
	justify-content: center;
}

.fed__hint {
	display: block;
	margin-top: $sp-2;
	font-size: $fs-micro;
	color: $text-muted;
	line-height: $lh-micro;
}

.fed__cta {
	margin-top: $sp-4;
}
</style>