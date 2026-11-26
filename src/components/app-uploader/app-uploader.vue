<!--
  文件上传列表（easycom 自动注册）：图片 / PDF 附件通用。

  ★ 交互口径：
    · 图片（`imagesOnly`）：**一次可选多张**（用户 2026-11-24 定），选完**逐张串行上传**
      （微信 `wx.uploadFile` 不支持多文件；后端按管理员每分钟 30 次配额，正常批量无间隔）。
    · 文件（含 PDF）：仍**一次一个**（用户 2026-11-10 定），点「添加」选一个、立即上传。
  ★ 本组件只做「选文件 → 上传 → 展示/删除」，文件校验与失败文案在
    `services/uploader.js`（端差异与业务码都在那层收口，页面/组件不写 #ifdef）。
  ★ v-model 的值 = 后端要回传的文件元数据数组 `{ url, name, type, size }`，
    **url 必须原样使用上传接口返回值**（外部链接会被业务接口拒绝）。
  ★ 图片点击预览、PDF 点击打开；删除只改本地数组，提交时整组回传（城市 / 证照同理）。
-->
<template>
	<view class="upl">
		<view v-for="(file, index) in files" :key="file.url || index" class="upl__item">
			<image
				v-if="isImage(file)"
				class="upl__img"
				:src="file.url"
				mode="aspectFill"
				@click="onPreview(index)"
			/>
			<view v-else class="upl__doc" @click="onOpenDoc(file)">
				<u-icon name="file-text" size="28" :color="theme.primary" />
				<text class="upl__doc-ext">{{ extText(file) }}</text>
			</view>
			<view v-if="!readonly" class="upl__del" @click.stop="onRemove(index)">
				<u-icon name="close" size="12" :color="theme.textInverse" />
			</view>
		</view>

		<view
			v-if="!readonly && files.length < max"
			class="upl__add"
			:class="{ 'upl__add--busy': busy }"
			hover-class="upl__add--hover"
			@click="onAdd"
		>
			<u-icon name="plus" size="26" :color="theme.textMuted" />
			<text class="upl__add-text">{{ busy ? busyText : '添加' }}</text>
		</view>
	</view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { pickAndUpload, pickAndUploadImages } from '@/services/uploader';
import { openDocument } from '@/services/platform';
import { toast } from '@/services/toast';
import { theme } from '@/config/theme';

const props = defineProps({
	/** 文件数组（v-model）：`{ url, name, type, size }` */
	modelValue: { type: Array, default: () => [] },
	/** 上传类型：`config/dict.js` 的 UPLOAD_TYPE_* */
	type: { type: String, required: true },
	/** 最多几个文件（证照 / 凭证都够用；超过 9 个会让表单过长） */
	max: { type: Number, default: 9 },
	/** 只读展示（流水里的凭证查看用）：不渲染「添加」与删除角标 */
	readonly: { type: Boolean, default: false },
	/** v1.3.0 履约附件：只收 png/jpg/jpeg（不弹「选择文件」，PDF 选得到也会被后端拒） */
	imagesOnly: { type: Boolean, default: false },
	/** v1.3.0 单文件上限（字节）；不传走 uploader 的 20MB 默认 */
	maxBytes: { type: Number, default: 0 }
});

const emit = defineEmits(['update:modelValue']);

const files = computed(() => (Array.isArray(props.modelValue) ? props.modelValue : []));
const busy = ref(false);
/** 多选批量上传时的进度文案（「上传中 2/5」）；单张 / 文件档固定「上传中」 */
const busyText = ref('上传中');

function isImage(file) {
	return ['jpg', 'jpeg', 'png'].includes(String((file && file.type) || '').toLowerCase());
}

function extText(file) {
	return String((file && file.type) || 'file').toUpperCase();
}

/** 当前图片在「图片子集」里的下标（预览只在该子集里左右滑，不把 PDF 混进去） */
function onPreview(index) {
	const images = files.value.filter(isImage);
	const current = files.value[index];
	const urls = images.map((f) => f.url);
	uni.previewImage({ urls, current: current.url });
}

function onOpenDoc(file) {
	openDocument(file.url).catch(() => toast('文档打开失败，请稍后重试'));
}

function onRemove(index) {
	const next = files.value.slice();
	next.splice(index, 1);
	emit('update:modelValue', next);
}

async function onAdd() {
	if (busy.value) return;
	const remaining = Math.max(0, props.max - files.value.length);
	if (remaining <= 0) return;
	busy.value = true;
	busyText.value = '上传中';
	try {
		// 图片：一次多选 + 逐张串行上传；文件：仍一次一个（含 PDF 的证照 / 凭证）
		if (props.imagesOnly) {
			const picked = await pickAndUploadImages(props.type, {
				count: remaining,
				maxBytes: props.maxBytes,
				onProgress: (done, total) => {
					busyText.value = total > 1 ? `上传中 ${done}/${total}` : '上传中';
				}
			});
			if (picked.length) emit('update:modelValue', files.value.concat(picked));
			return;
		}
		const file = await pickAndUpload(props.type, {
			imagesOnly: false,
			maxBytes: props.maxBytes
		});
		if (file) emit('update:modelValue', files.value.concat(file));
	} finally {
		busy.value = false;
	}
}
</script>

<style lang="scss" scoped>
.upl {
	display: flex;
	flex-wrap: wrap;
	/* 间距用子项 margin（iOS 微信不支持 flex gap，见 theme.scss 的间距 token 注释）；
	   负边距抵消末列 / 末行多出来的一格，与 gap 的视觉效果等价 */
	margin-right: -$sp-2;
	margin-bottom: -$sp-2;
}

.upl__item,
.upl__add {
	position: relative;
	width: 150rpx;
	height: 150rpx;
	margin: 0 $sp-2 $sp-2 0;
	border-radius: $rd-chip;
	overflow: hidden;
}

.upl__img {
	width: 100%;
	height: 100%;
	background-color: $bg-fill;
}

.upl__doc {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	width: 100%;
	height: 100%;
	background-color: $bg-fill;
}

.upl__doc-ext {
	margin-top: $sp-1;
	font-size: $fs-micro;
	color: $text-sub;
}

/* 删除按钮压在右上角：底色用墨色半透明，任何缩略图上都看得清 */
.upl__del {
	position: absolute;
	top: 0;
	right: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 40rpx;
	height: 40rpx;
	background-color: $bg-badge;
	border-bottom-left-radius: $rd-chip;
}

.upl__add {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	background-color: $bg-fill;
	border: 1rpx dashed $border-color;
}

.upl__add--hover {
	background-color: $bg-hover;
}

.upl__add--busy {
	opacity: 0.6;
}

.upl__add-text {
	margin-top: $sp-1;
	font-size: $fs-micro;
	color: $text-muted;
}
</style>