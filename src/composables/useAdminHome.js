// ---------------------------------------------------------------------------
// 管理端首屏数据能力：**可见功能入口**（权限菜单机制的核心实现）。
//
// ★ 入口显隐的判据：
//   「有哪些入口」由**本地配置**决定（config/access.js 的 HOME_ENTRIES），
//   「现在显示哪几个」由**登录返回的权限点**决定（登录/绑定响应的 data.permission）。
//   两者都命中才显示 → 后端加一种模块时，小程序只需在配置里加一行。
//   过滤本身走 services/pageAccess.js 的 byPermission()（与页内 tab / 按钮同一口径）。
//
// ⚠️ 本模板**不依赖首页接口**：管理员信息取本地会话，列表也没有「今日单量」这类数据。
//    如果你的后端有 admin/home/index（返回 admin_info + modules 数量块），
//    按原工程的写法加一个 api/home.js，在 load() 里取数并给入口拼 countText 即可 ——
//    本文件已经把「数量块缺失就不显示数字」这条口径留好了（hasCount 恒 false）。
//
// ⚠️ 权限点是**登录时的快照**（权限变更最长 2h 才刷新），故显隐可能短暂过期 ——
//    服务端才是防线，页面必须保留 40102 处置。
// ---------------------------------------------------------------------------

import { computed, ref } from 'vue';
import { getPermission, getUserInfo } from '@/services/storage';
import { byPermission, resolveEntryPage } from '@/services/pageAccess';
import { HOME_ENTRIES, DEFAULT_ENTRY_ICON } from '@/config/access';

export function useAdminHome() {
	// 三态：loading（骨架）/ ok（可渲染）/ fail（失败可重试）
	const state = ref('loading');
	const error = ref('');
	// 权限点（登录时下发的快照）。每次 load 时重读：重新登录后即为最新
	const permission = ref([]);
	// 管理员信息（本地会话；登录/绑定写入）
	const adminInfo = ref({});

	/**
	 * 首页可见功能入口 = `HOME_ENTRIES`（本地配置） ∩ `permission`（登录权限点）。
	 *
	 * ★ 入口是**模块级**的。模块下的子项有两种形态：
	 *   ① 直达页：`page` 有值（如「演示功能」）；
	 *   ② 子菜单：`page: null` + `children`，按权限过滤后决定「不渲染 / 直跳 / 弹层」。
	 *      0 个 → 整个入口不渲染；1 个 → 直跳；≥2 个 → 底部弹层。
	 *
	 * ⚠️ 必须显式传 `permission.value`（而不是让 byPermission 自己读会话）：
	 *    本 computed 的重算依赖那个 ref，省略了它就不会在重新登录后刷新。
	 */
	const entries = computed(() =>
		byPermission(HOME_ENTRIES, permission.value)
			.map((entry) => {
				const children = entry.page
					? (entry.children || [])
					: byPermission(entry.children || [], permission.value);
				return {
					// `code` 是模块的**身份**（菜单码）—— 模板用它做 :key
					code: entry.code,
					type: entry.type,
					name: entry.name,
					icon: entry.icon || DEFAULT_ENTRY_ICON,
					// `page` 为 null = 点开弹子菜单；有值 = 直接跳
					// `pageBy` 可按权限码切换落点（解析收在 pageAccess.resolveEntryPage）
					page: resolveEntryPage(entry, permission.value),
					query: entry.query || null,
					desc: entry.desc || '',
					sheetSub: entry.sheetSub || '',
					children,
					childCount: children.length,
					// 子项名称串给入口卡副说明用（如「A · B」）；弹层里仍用全名
					childNames: children.map((c) => c.shortName || c.name).join(' · '),
					// 本模板没有数量接口 → 恒 false（卡片只显示子项名或 desc，**不编造 0**）
					hasCount: false,
					countText: ''
				};
			})
			// 子菜单型入口：**过滤后 0 个子项 → 整个入口不渲染**
			// （点开是空菜单的入口不该存在）
			.filter((entry) => entry.page || entry.childCount > 0)
	);

	/**
	 * 取数：本模板只重读本地会话（权限点 + 管理员信息）。
	 * 真实项目若接入首页接口，在这里 await api 并把失败置 state='fail'。
	 */
	async function load() {
		if (state.value !== 'ok') state.value = 'loading';
		error.value = '';
		permission.value = getPermission();
		adminInfo.value = getUserInfo() || {};
		state.value = 'ok';
	}

	/** 页面在非取数失败场景下直接置失败态（如登录不可用），保证失败态写法只有一处 */
	function fail(message) {
		error.value = message || '加载失败';
		state.value = 'fail';
	}

	return { state, error, permission, adminInfo, entries, load, fail };
}

export default useAdminHome;