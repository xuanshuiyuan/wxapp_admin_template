// ---------------------------------------------------------------------------
// 分页列表通用逻辑：下拉刷新、触底加载、搜索重载、空态、失败重试。
// 管理后台一半的页面都是这个形态，抽在这里，页面只写「调哪个接口 + 怎么渲染」。
//
//   import { useList } from '@/composables/useList'
//   import { vehicleApi } from '@/api'
//
//   const { items, loading, finished, error, reload } = useList(vehicleApi.valuationList, {
//     params: () => ({ keyword: keyword.value })   // 每次请求前取最新筛选条件
//   })
//
// 后端分页契约（v1.0.5 文档 bind_valuation/list）：query 传 page/page_size，
// 响应 data 为 { list, total, page, page_size } —— 与 defaultPick / 默认键名完全吻合，零配置可用。
//
// 页面需要配套：pages.json 里该页开 "enablePullDownRefresh": true，
// 并在 scroll-view 之外依赖页面级触底（onReachBottom 已自动注册）。
// ---------------------------------------------------------------------------

import { ref, computed } from 'vue';
import { onLoad, onReachBottom, onPullDownRefresh, onShow } from '@dcloudio/uni-app';
import { clearListDirty, consumeListDirty } from '@/services/listDirty';

/**
 * 后端分页结构尚未统一，这里做一层容错取值；
 * 若某接口字段特殊，给 useList 传自定义 pick 即可，不必改本文件。
 */
export function defaultPick(body) {
	const d = (body && body.data) || {};
	if (Array.isArray(d)) return { list: d, total: d.length };
	const list = d.list || d.data || d.rows || [];
	const total = Number(d.total || d.count || 0);
	return { list, total };
}

/**
 * @param {Function} fetcher 形如 (query, options) => Promise<body>，直接传 api 里的方法
 * @param {object} [config]
 * @param {number} [config.pageSize=20]
 * @param {string} [config.pageNumKey='page']       后端页码字段名
 * @param {string} [config.pageSizeKey='page_size'] 后端每量字段名
 * @param {boolean} [config.immediate=true]         进入页面自动加载第一页
 * @param {Function} [config.params]                返回额外的查询条件（响应式取值放这里）
 * @param {Function} [config.pick]                  从响应里取 { list, total }
 * @param {boolean} [config.toastOnError=false]     失败是否弹 toast（默认只置 error，交给页面重试 UI）
 * @param {boolean} [config.refreshOnReturn=false]  从子页返回本页时，**被标脏**才 reload（见下）
 * @param {string}  [config.dirtyKey='']           刷新标记的 key（通常传本页路径常量）；不传则退化为「每次返回都 reload」
 */
export function useList(fetcher, config = {}) {
	const {
		pageSize = 20,
		pageNumKey = 'page',
		pageSizeKey = 'page_size',
		immediate = true,
		params = () => ({}),
		pick = defaultPick,
		toastOnError = false,
		refreshOnReturn = false,
		dirtyKey = ''
	} = config;

	const items = ref([]);
	const body = ref(null); // 最近一次原始响应：后端附带字典（如 meal_type_list）时从这里取
	const total = ref(0);
	const page = ref(0);
	const loading = ref(false);
	const refreshing = ref(false);
	const error = ref('');
	const finished = ref(false);
	// 在飞期间被丢弃的「重新加载」请求：当前请求结束后补拉第一页。
	// 不加它的话，用户改完筛选立刻点搜索、而上一页还在飞时，这次操作会被静默丢弃，
	// 列表停留在旧条件的数据上（用户以为搜索没生效）。
	let pendingReload = false;

	const isEmpty = computed(() => !loading.value && !error.value && items.value.length === 0);
	const firstLoading = computed(() => loading.value && items.value.length === 0);

	async function fetchPage(targetPage) {
		if (loading.value) {
			// 只排队「回到第一页」的请求；翻页请求在飞时本来就该被忽略
			if (targetPage <= 1) pendingReload = true;
			return;
		}
		loading.value = true;
		error.value = '';
		try {
			const query = { ...params(), [pageNumKey]: targetPage, [pageSizeKey]: pageSize };
			const response = await fetcher(query, { toast: toastOnError });
			body.value = response;
			const parsed = pick(response);
			const list = Array.isArray(parsed.list) ? parsed.list : [];
			items.value = targetPage <= 1 ? list : items.value.concat(list);
			total.value = parsed.total || items.value.length;
			page.value = targetPage;
			// 无 total 时靠「不足一页」判断到底，有 total 时以总数为准
			finished.value = list.length < pageSize || (parsed.total > 0 && items.value.length >= parsed.total);
		} catch (e) {
			error.value = (e && e.message) || '加载失败';
		} finally {
			loading.value = false;
			if (refreshing.value) {
				refreshing.value = false;
				uni.stopPullDownRefresh();
			}
			// 在飞期间被丢弃的 reload：补一次（只补一次，避免高频点击无限重拉）
			if (pendingReload) {
				pendingReload = false;
				fetchPage(1);
			}
		}
	}

	/** 回到第一页重新拉（筛选条件变化时调用） */
	function reload() {
		finished.value = false;
		return fetchPage(1);
	}

	/** 触底加载下一页 */
	function loadMore() {
		if (loading.value || finished.value) return Promise.resolve();
		return fetchPage(page.value + 1);
	}

	/** 下拉刷新：不立刻清空列表，避免刷新过程中白屏 */
	function refresh() {
		refreshing.value = true;
		finished.value = false;
		return fetchPage(1);
	}

	onLoad(() => {
		// 进页取到的一定是最新数据：把之前遗留的脏标记作废，
		// 否则紧接着的首次 onShow 判定会白刷一次（见下）
		if (dirtyKey) clearListDirty(dirtyKey);
		if (immediate) reload();
	});

	// ★ 管理列表的「返回刷新」口径（2026-11-12 用户定，取代 v1.1.0 的「返回即无条件刷新」）：
	//   只有子页**确实改了数据**（表单保存 / 删除 / 启停…成功后 markListDirty）才重取。
	//   无条件 reload 会让「点进去看一眼再返回」也把列表整体替换
	//   （setData 重绘 + 底部「没有更多了」翻转），视觉上闪一下。
	//   ⚠️ 首次 onShow 与 onLoad 相邻触发，跳过它，否则进页会连打两次。
	let shown = false;
	onShow(() => {
		if (!refreshOnReturn) return;
		if (!shown) {
			shown = true;
			return;
		}
		if (dirtyKey && !consumeListDirty(dirtyKey)) return;
		reload();
	});

	onReachBottom(() => {
		loadMore();
	});

	onPullDownRefresh(() => {
		refresh();
	});

	return {
		items,
		body,
		total,
		page,
		loading,
		refreshing,
		finished,
		error,
		isEmpty,
		firstLoading,
		reload,
		refresh,
		loadMore
	};
}

export default useList;
