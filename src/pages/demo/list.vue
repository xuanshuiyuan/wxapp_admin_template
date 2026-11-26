<!--
  演示页 · 请求链路 + 通用上传（模板自带的两个「照抄起点」）

  页面准入：入口码 DEMO_MANAGE 进页（config/access.js 的 PAGES）；
  页内两个区块各自再判 DEMO_REQUEST（DEMO_PAGE_ACTIONS）—— 缺码给「无权限」空态，
  而不是被权限门 toast 退页。这就是「入口码管能不能进，操作码管能看什么」的口径。

  ① 请求链路示例：调后端 demo 模块（web 组）。**只用于连通性自测**，
     前提（source=1010 / develop 旁路）写在 api/demo.js 与 README。
  ② 通用上传示例：<app-uploader> → services/uploader → POST admin/upload，
     type = demo_file（后端 conf.AdminUploadTypes 的示例键）。
-->
<template>
	<view class="page demo">
		<app-navbar title="演示" :show-back="true" />

		<view class="demo__body">
			<view v-if="guardError" class="card">
				<app-list-state :error="guardError" @retry="retry" />
			</view>

			<!-- 当前权限点：改 config/demo.js 的 permission 后重进本页即可看到变化 -->
			<view class="card">
				<view class="card__hd">
					<text class="card__title">当前账号的权限点</text>
				</view>
				<view class="demo__perms">
					<text v-for="code in permission" :key="code" class="demo__perm">{{ code }}</text>
					<text v-if="!permission.length" class="demo__ph">（空）</text>
				</view>
				<text class="demo__note">
					首页入口与页内按钮都按这张表显隐（config/access.js ∩ 本表）。演示模式下来源是 config/demo.js。
				</text>
			</view>

			<!-- ① 请求链路 -->
			<view v-if="canRequest" class="card">
				<view class="card__hd">
					<text class="card__title">请求链路示例</text>
					<text class="card__more">GET web/demo/list</text>
				</view>
				<text class="demo__note">
					验证「签名头 → 发送 → 统一响应 {code,msg,data} → ApiError 归一」整条链路。
					后端 demo 模块属 web 组（C 端 source），自测前按 api/demo.js 的注释配好
					VITE_SOURCE=1010 与 VITE_DEVELOP_BYPASS=develop（仅 local / develop）。
				</text>
				<view class="demo__actions">
					<view class="btn btn--primary demo__btn" hover-class="btn--hover" @click="onFetchList">
						调用列表
					</view>
					<view class="btn btn--ghost demo__btn" hover-class="btn--hover" @click="onCreate">
						创建一条
					</view>
				</view>
				<text v-if="requestState" class="demo__note demo__note--state">{{ requestState }}</text>
				<text v-if="resultText" class="demo__json">{{ resultText }}</text>
			</view>
			<view v-else class="card">
				<app-list-state :empty="true" empty-text="当前账号无「请求示例」权限" :empty-retry-text="''" />
			</view>

			<!-- ② 通用上传 -->
			<view v-if="canUpload" class="card">
				<view class="card__hd">
					<text class="card__title">通用上传示例</text>
					<text class="card__more">type = demo_file</text>
				</view>
				<text class="demo__note">
					一次一个文件（微信 uploadFile 只支持单文件），失败文案按业务码给。
					新增上传类型只需后端 AdminUploadTypes 加一行 + config/dict.js 加一个常量。
				</text>
				<app-uploader v-model="files" :type="UPLOAD_TYPE_DEMO_FILE" :max="3" />
			</view>
			<view v-else class="card">
				<app-list-state :empty="true" empty-text="当前账号无「上传示例」权限" :empty-retry-text="''" />
			</view>

			<!-- ③ 说明 -->
			<view class="card">
				<view class="card__hd">
					<text class="card__title">模板说明</text>
				</view>
				<text class="demo__note">
					· 所有表单输入都「跳页编辑」：见示例页 B 与 pages/common/field-editor。
					· 列表四态（骨架 / 空 / 失败 / 到底）用 useList + app-list-state，见示例页 A。
					· 40102 无权限由**页面就地处置**（置灰 / 空态），不进全局守卫。
				</text>
			</view>
		</view>

		<app-loading :mask="true" />
		<app-modal />
	</view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { getPermission } from '@/services/storage';
import { byPermission } from '@/services/pageAccess';
import { usePageGuard } from '@/composables/usePageGuard';
import { isApiError } from '@/services/http';
import { toast } from '@/services/toast';
import { demoApi } from '@/api';
import { DEMO_PAGE_ACTIONS, PAGE_DEMO } from '@/config/access';
import { CODE_NO_PERMISSION, UPLOAD_TYPE_DEMO_FILE } from '@/config/dict';

// 本页权限上下文：**必须在登录门之后读**（冷启动时 setup 阶段 permission 还是空的）
const permission = ref([]);
const grantedActions = computed(() => byPermission(DEMO_PAGE_ACTIONS, permission.value));
const canRequest = computed(() => grantedActions.value.some((a) => a.key === 'request'));
const canUpload = computed(() => grantedActions.value.some((a) => a.key === 'upload'));

// 上传结果（v-model：{ url, name, type, size }[]）
const files = ref([]);

const requestState = ref('');
const resultText = ref('');

// 登录门 + 权限门统一接线；onReady 在登录成功后重读权限点（页内区块据此显隐）
const guardError = ref('');
const { retry } = usePageGuard({
	path: PAGE_DEMO,
	onReady: () => {
		permission.value = getPermission();
	},
	onDenied: (res) => {
		guardError.value = res.reason === 'unresolved' ? '参数不完整' : '登录失败，请检查网络后重试';
	}
});

/** 把响应压成可读的一小段（演示用，真实业务不要整包打印响应体） */
function showResult(label, body) {
	resultText.value = `${label}：\n${JSON.stringify(body && body.data ? body.data : body, null, 2).slice(0, 800)}`;
}

/**
 * 统一错误处置（演示层的写法示范）：
 *   · 40102 无权限 → 就地提示（**不要**弹全局阻断框）；
 *   · guard 型 → 已由全局守卫弹框说明，页面直接忽略；
 *   · 其余 → 展示后端 msg（默认 toast 已由请求层做过）。
 */
function handleError(e) {
	if (isApiError(e) && e.type === 'guard') return;
	if (isApiError(e) && Number(e.code) === CODE_NO_PERMISSION) {
		toast('当前账号无此功能权限');
		return;
	}
	toast((e && e.message) || '请求失败');
}

async function onFetchList() {
	requestState.value = '请求中…';
	resultText.value = '';
	try {
		const body = await demoApi.list({ page: 1, page_size: 5 });
		requestState.value = '成功（code=0）';
		showResult('列表响应', body);
	} catch (e) {
		requestState.value = `失败：${(e && e.message) || '未知错误'}`;
		handleError(e);
	}
}

async function onCreate() {
	requestState.value = '提交中…';
	resultText.value = '';
	try {
		const body = await demoApi.create({ name: '模板演示', remark: '来自 wxapp_admin_template' });
		requestState.value = '成功（code=0）';
		showResult('创建响应', body);
	} catch (e) {
		requestState.value = `失败：${(e && e.message) || '未知错误'}`;
		handleError(e);
	}
}
</script>

<style lang="scss" scoped>
.demo {
	padding: 0 0 $sp-10;
}

.demo__body {
	padding: $sp-3 $page-padding 0;
}

.demo__perms {
	display: flex;
	flex-wrap: wrap;
}

.demo__perm {
	margin: 0 $sp-1 $sp-1 0;
	padding: 4rpx $sp-2;
	border-radius: $rd-chip;
	background-color: $color-primary-light;
	color: $color-primary-dark;
	font-size: $fs-micro;
	line-height: $lh-caption;
}

.demo__ph {
	color: $text-muted;
	font-size: $fs-caption;
}

.demo__note {
	display: block;
	margin-top: $sp-2;
	font-size: $fs-caption;
	color: $text-muted;
	line-height: $lh-body;
}

.demo__note--state {
	color: $text-sub;
}

.demo__actions {
	display: flex;
	margin-top: $sp-3;
}

.demo__btn {
	flex: 1;
}

.demo__btn + .demo__btn {
	margin-left: $sp-2;
}

.demo__json {
	display: block;
	margin-top: $sp-2;
	padding: $sp-2;
	border-radius: $rd-chip;
	background-color: $bg-fill;
	color: $text-sub;
	font-size: $fs-micro;
	line-height: $lh-body;
	word-break: break-all;
}
</style>