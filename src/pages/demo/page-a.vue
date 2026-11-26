<!--
  示例页 A · 列表页骨架（纯本地数据，不依赖后端）

  示范三件事：
    ① 两道门：usePageGuard({ path: PAGE_DEMO_A, onReady: reload }) —— 登录门 + 权限门一行接线；
    ② 列表四态：useList + <app-list-state>（骨架 / 空 / 失败 / 到底），页面不自己写 v-if 链；
    ③ 接口替换点：把 fetchRows 换成 `vehicleApi.xxxList` 这类 api 方法即可，
       后端分页契约 `{ list, total, page, page_size }` 与本文件的 mock 完全一致。

  ⚠️ 空态验证：点右上角「清空」把本地数据清掉再下拉刷新，会看到空态与重试按钮。
-->
<template>
	<view class="page pa">
		<app-navbar title="示例页 A" :show-back="true" />

		<view class="pa__body">
			<view class="card">
				<view class="card__hd">
					<text class="card__title">列表四态</text>
					<text class="card__more" @click="onClear">清空</text>
				</view>
				<text class="pa__note">
					useList 自动接管 onLoad / onReachBottom / onPullDownRefresh；
					首屏、空、失败、到底四态交给 app-list-state 编排。
				</text>
			</view>

			<app-list-state
				:first-loading="firstLoading"
				:empty="isEmpty"
				:error="error"
				:loading="loading"
				:finished="finished"
				@retry="retry"
			/>

			<view v-if="items.length" class="card pa__list">
				<view v-for="(row, index) in items" :key="row.id" class="row" :class="{ 'row--last': index === items.length - 1 }">
					<view class="row__main">
						<text class="row__title">{{ row.name }}</text>
						<text class="row__desc">{{ row.remark }}</text>
					</view>
					<text class="pa__meta">#{{ row.id }}</text>
				</view>
			</view>
		</view>

		<!-- 全局渲染方：缺了它们，{ loading:true } 会降级成原生、守卫弹窗不会出现 -->
		<app-loading :mask="true" />
		<app-modal />
	</view>
</template>

<script setup>
import { useList } from '@/composables/useList';
import { usePageGuard } from '@/composables/usePageGuard';
import { PAGE_DEMO_A } from '@/config/access';

// —— 本地假数据（换成真实接口时整段删除）——
const SEED = Array.from({ length: 23 }).map((_, i) => ({
	id: i + 1,
	name: `示例记录 ${i + 1}`,
	remark: i % 3 === 0 ? '这一条挂在第三行，用来演示副说明' : '普通记录'
}));
let rows = SEED.slice();

/** 模拟分页接口：契约与后端一致（page / page_size → list / total） */
function fetchRows({ page, page_size }) {
	return new Promise((resolve) => {
		setTimeout(() => {
			const start = (page - 1) * page_size;
			resolve({
				code: 0,
				msg: 'ok',
				data: {
					list: rows.slice(start, start + page_size),
					total: rows.length,
					page,
					page_size
				}
			});
		}, 300);
	});
}

const { items, loading, firstLoading, isEmpty, error, finished, reload } = useList(fetchRows, {
	pageSize: 10,
	// 首屏取数交给两道门（usePageGuard 的 onReady）—— 无权时不发请求
	immediate: false
});

// 登录门 + 权限门统一接线；首次通过后才取数。
// onDenied 落到列表错误态；retry 同时兜住「门没过」与「取数失败」。
const { retry } = usePageGuard({
	path: PAGE_DEMO_A,
	onReady: reload,
	onDenied: (res) => {
		error.value = res.reason === 'unresolved' ? '参数不完整' : '登录失败，请检查网络后重试';
	}
});

/** 清空本地数据：下一次刷新即进入空态 */
function onClear() {
	rows = [];
	reload();
}
</script>

<style lang="scss" scoped>
.pa__body {
	padding: $sp-3 $page-padding 0;
}

.pa__note {
	display: block;
	font-size: $fs-caption;
	color: $text-muted;
	line-height: $lh-body;
}

.pa__list {
	margin-top: $sp-2;
}

.pa__meta {
	flex-shrink: 0;
	margin-left: $sp-2;
	font-size: $fs-micro;
	color: $text-muted;
	line-height: $lh-body;
}
</style>