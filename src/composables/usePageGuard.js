// ---------------------------------------------------------------------------
// 页面「两道门」的统一接线（登录门 + 权限门）。
//
// 为什么要有它：CLAUDE.md 要求每个页面 onLoad 走权限门、onShow 走登录门，
// 但两行样板散在每个页面里，新页面照抄时最容易漏（漏了就是「无权页面先渲染再靠 40102 兜底」）。
// 收成一个 composable 后，页面只写：
//
//   usePageGuard({ path: PAGE_X, onReady: refreshAll });
//
// 语义：
//   · onLoad：`requirePageAccess(path, query)` —— 无权时它已 toast + 退回，本页面停止初始化；
//     `byParam` 解析不出目标（unresolved）不跳页，onDenied 里由页面给「参数不完整」空态；
//   · onShow：`pageNeedsLogin(path)` 为真时跑 `requireAdminLogin()`（登录门按配置决定）；
//   · onReady：**首次**通过两道门后执行一次（后续 onShow 只重新校验登录态，不重复取数 ——
//     返回刷新由 listDirty / 页面自己的 onShow 决定，避免每次返回都重拉）。
//
// ⚠️ 本 composable 不接管错误提示：requirePageAccess 已处置「确实无权」，
//    onDenied 只用于页面想额外给空态 / 记录原因的场景。
// ⚠️ 工具页（field-editor / region-picker）也走它：配置里 `login:false`、无 `entries` 时
//    两道门都是空操作，接线成本为零，换来「全工程没有绕过统一入口的页面」。
// ---------------------------------------------------------------------------

import { onLoad, onShow } from '@dcloudio/uni-app';
import { pageNeedsLogin, requirePageAccess } from '@/services/pageAccess';
import { requireAdminLogin } from '@/services/session';

/**
 * @param {object} options
 * @param {string} options.path 页面路径常量（config/access.js 的 PAGE_*）
 * @param {Function} [options.onReady] 首次通过两道门后执行（通常是取首屏数据）
 * @param {Function} [options.onDenied] 未通过时回调：`{ allowed:false, reason, codes, config }`
 * @returns {{ isAllowed: () => boolean }}
 */
export function usePageGuard(options = {}) {
	const { path, onReady, onDenied } = options;
	let allowed = false;
	let ready = false;
	// onLoad 的 query 要在 onShow 里可用（onReady 的取数常需要 id/type 这类参数）
	let lastQuery = {};

	onLoad((query) => {
		lastQuery = query || {};
		const access = requirePageAccess(path, lastQuery);
		allowed = access.allowed;
		if (!allowed && typeof onDenied === 'function') onDenied(access);
	});

	onShow(async () => {
		if (!allowed) return;
		if (pageNeedsLogin(path)) {
			const ok = await requireAdminLogin();
			if (!ok) {
				if (typeof onDenied === 'function') onDenied({ allowed: false, reason: 'login' });
				return;
			}
		}
		if (!ready) {
			ready = true;
			if (typeof onReady === 'function') onReady(lastQuery);
		}
	});

	return { isAllowed: () => allowed };
}

export default usePageGuard;