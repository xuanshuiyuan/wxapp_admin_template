<!--
  示例页 B · 表单行 + 「跳页取值」两条 IPC

  本工程的两条硬口径（照抄即可）：
    ① **所有表单输入都跳页编辑**，页面里不内联 <input>（键盘弹层各机型表现不一）。
       行本身是按钮：app-form-row（或同款玻璃行）+ services/fieldEditor.editField()；
    ② 省 / 市 / 区选择同理，走 services/regionPicker.pickRegion()。

  回传判据必须是 `v !== null`：`null` = 用户放弃（保持原值），`''` = 用户确认了空值。
-->
<template>
	<view class="page pb">
		<app-navbar title="示例页 B" :show-back="true" />

		<view class="pb__body">
			<view v-if="guardError" class="card">
				<app-list-state :error="guardError" @retry="retry" />
			</view>

			<view class="card">
				<view class="card__hd">
					<text class="card__title">表单行（跳页编辑）</text>
				</view>

				<app-form-row
					label="展示名称"
					required
					arrow
					:value="form.name"
					placeholder="请输入名称"
					@tap="onEditName"
				/>
				<app-form-row
					label="联系人手机"
					arrow
					:value="form.mobile"
					placeholder="请输入手机号"
					divider
					@tap="onEditMobile"
				/>
				<app-form-row
					label="所在地区"
					arrow
					:value="regionText"
					placeholder="请选择省 / 市 / 区"
					divider
					@tap="onPickRegion"
				/>
				<app-form-row label="备注" :value="form.remark" placeholder="（未填写）" wrap divider @tap="onEditRemark" arrow />

				<text class="pb__note">
					值只在本页内存里，不落请求；真实表单提交时把 form 组装成接口入参即可。
				</text>
			</view>

			<view class="card">
				<view class="card__hd">
					<text class="card__title">当前值</text>
				</view>
				<text class="pb__json">{{ formText }}</text>
			</view>
		</view>

		<app-loading :mask="true" />
		<app-modal />
	</view>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import { editField } from '@/services/fieldEditor';
import { pickRegion } from '@/services/regionPicker';
import { usePageGuard } from '@/composables/usePageGuard';
import { PAGE_DEMO_B } from '@/config/access';

const form = reactive({
	name: '',
	mobile: '',
	remark: '',
	province: '',
	city: '',
	district: '',
	province_code: '',
	city_code: '',
	district_code: ''
});

const regionText = computed(() => [form.province, form.city, form.district].filter(Boolean).join(' / '));
const formText = computed(() => JSON.stringify(form, null, 2));

// 登录门 + 权限门统一接线（本页无首屏取数，故不传 onReady）
const guardError = ref('');
const { retry } = usePageGuard({
	path: PAGE_DEMO_B,
	onDenied: (res) => {
		guardError.value = res.reason === 'unresolved' ? '参数不完整' : '登录失败，请检查网络后重试';
	}
});

async function onEditName() {
	const value = await editField({
		title: '展示名称',
		type: 'text',
		maxlength: 32,
		value: form.name,
		placeholder: '请输入名称'
	});
	// `null` = 放弃（保持原值）；`''` = 确认清空 —— 判据不能写成 if (value)
	if (value !== null) form.name = value;
}

async function onEditMobile() {
	const value = await editField({
		title: '联系人手机',
		type: 'phone',
		maxlength: 16,
		value: form.mobile,
		placeholder: '请输入手机号'
	});
	if (value !== null) form.mobile = value;
}

async function onEditRemark() {
	const value = await editField({
		title: '备注',
		type: 'textarea',
		maxlength: 200,
		value: form.remark,
		optional: true,
		placeholder: '选填'
	});
	if (value !== null) form.remark = value;
}

async function onPickRegion() {
	const picked = await pickRegion(
		{
			province: form.province,
			city: form.city,
			district: form.district,
			province_code: form.province_code,
			city_code: form.city_code,
			district_code: form.district_code
		},
		'district'
	);
	if (!picked) return; // null = 放弃
	Object.assign(form, {
		province: picked.province || '',
		city: picked.city || '',
		district: picked.district || '',
		province_code: picked.province_code || '',
		city_code: picked.city_code || '',
		district_code: picked.district_code || ''
	});
}
</script>

<style lang="scss" scoped>
.pb__body {
	padding: $sp-3 $page-padding 0;
}

.pb__note {
	display: block;
	margin-top: $sp-3;
	font-size: $fs-caption;
	color: $text-muted;
	line-height: $lh-body;
}

.pb__json {
	display: block;
	padding: $sp-2;
	border-radius: $rd-chip;
	background-color: $bg-fill;
	color: $text-sub;
	font-size: $fs-micro;
	line-height: $lh-body;
	word-break: break-all;
}
</style>