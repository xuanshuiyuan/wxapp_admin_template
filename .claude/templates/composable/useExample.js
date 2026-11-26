// ---------------------------------------------------------------------------
// __NAME__ 复用逻辑（一个完整能力的封装）。
//
//   import { use__NAME__ } from '@/composables/use__NAME__'
//
//   const { data, loading, error, action, reload } = use__NAME__({
//     params: () => ({ keyword: keyword.value })   // 每次请求前取最新条件
//   })
//
// 设计约定（与 useList / usePullRefresh 保持一致）：
//   · 返回对象供解构
//   · 生命周期在 composable 内注册，页面只接线
//   · 必须做在飞判重（防 onShow 重复触发）
//   · 失败置 error 状态位交给页面，不做全局 toast
//   · 不含 HTTP 细节（接口由参数传入，不 import @/api）
// ---------------------------------------------------------------------------

import { ref, computed } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import { isApiError } from '@/services/http';

/**
 * @param {object} [config]
 * @param {Function} [config.fetcher] 取数函数，形如 (query, options) => Promise<body>
 *                                    —— 直接传 @/api 里的方法，本 composable 不耦合具体接口
 * @param {Function} [config.params]  返回额外的查询条件（★ 响应式取值必须放这里，
 *                                    闭包提前取会拿到初始化时的旧值）
 * @param {boolean}  [config.immediate=true] 进入页面是否自动取一次
 */
export function use__NAME__(config = {}) {
	const {
		fetcher = async () => ({ data: null }),
		params = () => ({}),
		immediate = true
	} = config;

	// null = 还没取到，区别于「取到了但为空」—— 不要用 !! 合并这两态（UI 会误报）
	const data = ref(null);
	const loading = ref(false);
	const error = ref('');

	/** 首屏态：加载中且没有数据（用于骨架屏 / loading 转圈） */
	const firstLoading = computed(() => loading.value && data.value === null);
	/** 空态：加载完、无错、但确实没数据 */
	const isEmpty = computed(() => !loading.value && !error.value && data.value === null);

	/**
	 * 取数。★ 在飞判重：onShow / 下拉 / 按钮可能同时触发，不能重复打接口。
	 * 失败保留在 error 状态位（不弹 toast）—— 进页/下拉这类自动路径不该弹错打断用户。
	 * guard 型错误直接忽略：弹框/跳页已由全局守卫处理。
	 */
	async function load() {
		if (loading.value) return;
		loading.value = true;
		error.value = '';
		try {
			const body = await fetcher({ ...params() }, { toast: false });
			data.value = (body && body.data) || null;
		} catch (e) {
			if (isApiError(e) && e.type === 'guard') return;
			error.value = (e && e.message) || '加载失败';
		} finally {
			// 托管资源收敛到 finally —— 调用方不需要手写收尾
			loading.value = false;
		}
	}

	/** 强制重取（清掉旧数据，用于条件变化） */
	function reload() {
		data.value = null;
		return load();
	}

	if (immediate) {
		onLoad(() => {
			load();
		});
	}

	// 切回页面时刷新 —— 有在飞判重，重复触发是安全的
	onShow(() => {
		load();
	});

	return {
		data,
		loading,
		error,
		firstLoading,
		isEmpty,
		load,
		reload
	};
}

export default use__NAME__;

// ---------------------------------------------------------------------------
// 模板自带的提醒（接入后删除本段）
//
// · 若本能力与「分页列表」有关 → 直接用现成的 @/composables/useList，不要重造。
// · 若本能力是「Promise 化弹窗」 → 用 @/composables/useModal。
// · 若本能力是「下拉三段态」 → 用 @/composables/usePullRefresh。
// · 若本能力需要跨页共享状态 → 不该用 composable，应建 store（真相源仍在服务端/存储）。
// · 若只有 1 个页面用 → 不该抽，留在页面里（过度抽象同样违规）。
// ---------------------------------------------------------------------------