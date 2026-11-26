<!--
  表单页模板（新增 / 编辑共用）

  ★ 本模板示范的是「B 端表单的标准形态」：
    · 页壳走 **C 档**（页面级滚动，不是 scroll-view）：键盘弹起时整页要能上滚，
      `.page-shell` 的 height:100vh + overflow:hidden 会把输入框顶出可视区；
    · 所有输入行都是**按钮**：点一下跳 `pages/common/field-editor` 输入
      （用户口径：页面里不内联 <input>，键盘遮挡/高度各机型不一致）；
    · 提交按钮在**文档流**里（`app-bottom-bar` 固定底栏 + 页面 padding-bottom 让位），
      iOS 数字键盘没有回车键，CTA 不能只靠键盘提交；
    · 两道门走 `usePageGuard`（登录门 + 权限门），无权时不发请求；
    · 页面只做**格式校验**（必填 / 长度），业务规则归 services / 后端。

  ⚠️ 复制后必须：
    1. `__PREFIX__` → 页面前缀（≥3 字母，先 grep ColorUI 类名）
    2. `__TITLE__` → 页面标题
    3. `PAGE___UPPER__` → 在 config/access.js 定义的真实 PAGE_* 常量（再从 services/route 引）
    4. `__DOMAIN__Api` → 真实 api 方法（先在 config/endpoints.js 登记 URL）
-->
<template>
	<view class="page __PREFIX__-form">
		<app-navbar title="__TITLE__" :show-back="true" />

		<view class="__PREFIX__-form__body">
			<view class="card">
				<view class="card__hd">
					<text class="card__title">基本信息</text>
				</view>

				<!-- 输入行：整行点击跳编辑页；回传判据必须是 v !== null -->
				<app-form-row
					label="名称"
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
					label="备注"
					arrow
					wrap
					:value="form.remark"
					placeholder="选填"
					divider
					@tap="onEditRemark"
				/>
			</view>

			<!-- 页面状态：提交失败 / 权限空态都放在这里，不另起 v-if 链 -->
			<app-list-state v-if="error" :error="error" @retry="onSubmit" />
		</view>

		<!-- 固定底栏：内容区必须留出 bottom bar 高度（见样式 padding-bottom） -->
		<app-bottom-bar>
			<view
				class="btn btn--primary btn--lg btn--block"
				:hover-class="submitting ? '' : 'btn--hover'"
				:class="{ '__PREFIX__-form__cta--disabled': submitting }"
				@click="onSubmit"
			>
				{{ submitting ? '保存中…' : '保存' }}
			</view>
		</app-bottom-bar>

		<!-- 全局渲染方：缺了它们，{ loading:true } 降级成原生、守卫弹窗不出现 -->
		<app-loading :mask="true" />
		<app-modal />
	</view>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { usePageGuard } from '@/composables/usePageGuard';
import { editField } from '@/services/fieldEditor';
import { isApiError } from '@/services/http';
import { toast } from '@/services/toast';
import { route } from '@/services/route';
// import { __DOMAIN__Api } from '@/api'; // TODO: 换成真实 api
// 页面路径常量：先在 config/access.js 定义 PAGE_*，services/route.js 转出
import { PAGE___UPPER__ } from '@/services/route';

const form = reactive({
	name: '',
	mobile: '',
	remark: ''
});

const submitting = ref(false);
const error = ref('');
// 编辑态 id（新增留空）；从 onLoad 的 query 取
let formId = '';

// ★ 两道门：首次通过后才算就绪（本页无首屏取数；编辑态需要回填时在 onReady 里取详情）
usePageGuard({
	path: PAGE___UPPER__,
	onReady: (query) => {
		formId = (query && query.id) || '';
		// if (formId) loadDetail();
	},
	// 登录失败落到错误态（保存失败也复用同一个 error）；权限门本身已 toast + 退回
	onDenied: (res) => {
		error.value = res.reason === 'unresolved' ? '参数不完整，请从列表进入' : '登录失败，请检查网络后重试';
	}
});

// ---------------- 跳页取值（所有输入行同一写法） ----------------

async function onEditName() {
	const value = await editField({ title: '名称', maxlength: 32, value: form.name, placeholder: '请输入名称' });
	// null = 放弃（保持原值）；'' = 确认清空 —— 判据不能写成 if (value)
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
		optional: true,
		value: form.remark,
		placeholder: '选填'
	});
	if (value !== null) form.remark = value;
}

// ---------------- 提交 ----------------

/**
 * 只做**格式校验**（必填 / 长度）；业务校验（唯一性、状态机、权限）归服务端。
 * 失败按 ApiError.type 分支：network 提示重试、business 显示 msg、guard 直接忽略。
 */
async function onSubmit() {
	if (submitting.value) return;
	error.value = '';

	const name = form.name.trim();
	if (!name) {
		toast('请输入名称');
		return;
	}

	submitting.value = true;
	try {
		// TODO: 换成真实 api；新增 / 编辑二选一
		// await __DOMAIN__Api.save({ id: formId, name, mobile: form.mobile, remark: form.remark });
		await Promise.resolve();
		// 若本页从列表进入：写成功后标记列表脏，返回时列表 onShow 只消费一次（机制见 services/listDirty.js）
		// markListDirty(PAGE_XXX_LIST);
		toast('保存成功');
		route.back();
	} catch (e) {
		// guard 型（账号禁用 / 未配角色）已由全局守卫弹框，页面直接忽略
		if (isApiError(e) && e.type === 'guard') return;
		// 40102 就地处置：不弹全局阻断框，页面给错误态
		error.value = (e && e.message) || '保存失败，请重试';
	} finally {
		submitting.value = false;
	}
}
</script>

<style lang="scss" scoped>
/* 内容区底部留出固定底栏（80rpx + 安全区），否则最后一行被盖住 */
.__PREFIX__-form__body {
	padding: $sp-3 $page-padding 0;
	padding-bottom: 160rpx;
	padding-bottom: calc(160rpx + #{$safe-bottom});
}

.__PREFIX__-form__cta--disabled {
	opacity: 0.5;
}
</style>