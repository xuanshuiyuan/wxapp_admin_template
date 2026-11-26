// ---------------------------------------------------------------------------
// 页面「两道门」的统一接线（登录门 + 权限门）。
//
// 为什么要有它：CLAUDE.md 要求每个页面 onLoad 走权限门、onShow 走登录门，
// 但两行样板散在每个页面里，新页面照抄时最容易漏（漏了就是「无权页面先渲染再靠 40102 兜底」）。
// 收成一个 composable 后，页面只写：
//
//   usePageGuard({ path: PAGE_X, onReady: refreshAll });
//
// ★ 顺序很关键：**先登录、再判权限**。
//   冷启动 / 分享深链 / 清缓存后，本地 `permission` 还是空的 —— 若先跑权限门，
//   有权限的用户也会被 toast 退回首页，而且会让登录门被跳过（页面永远进不来）。
//   故 onLoad 只记 query，onShow 里先 `requireAdminLogin()`，拿到会话后再判权限。
//
// 语义：
//   · onShow：登录门（是否执行由 PAGES.login 决定）→ 权限门 → 首次 onReady；
//   · 通过后不再重复判（`ready` 短路）：返回本页不重新取数，
//     列表刷新由 listDirty / 页面自己的 onShow 决定；
//   · 权限门无权时它已 toast + 退回；`unresolved`（byParam 解析不出）由 onDenied 给空态。
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
 * @param {Function} [options.onReady] 首次通过两道门后执行（参数 = onLoad 的 query）
 * @param {Function} [options.onDenied] 未通过时回调：`{ allowed:false, reason, codes, config }`
 * @returns {{ isAllowed: () => boolean }}
 */
export function usePageGuard(options = {}) {
	const { path, onReady, onDenied } = options;
	let allowed = false;
	let ready = false;
	// onLoad 的 query 要在 onShow 里可用（onReady 的取数常需要 id/type 这类参数）
	let lastQuery = {};

	// onLoad 只记录参数：此时本地可能还没有 token / permission，判权限一定是错的
	onLoad((query) => {
		lastQuery = query || {};
	});

	onShow(async () => {
		if (ready) return;

		// ① 登录门：先拿到会话（含 permission 快照），再判权限
		if (pageNeedsLogin(path)) {
			const ok = await requireAdminLogin();
			// 登录在飞期间 onShow 可能再次触发（切后台再回）：回来后先复查，
			// 否则两个并发回调都会走到 onReady，首屏请求会重复一次
			if (ready) return;
			if (!ok) {
				if (typeof onDenied === 'function') onDenied({ allowed: false, reason: 'login' });
				return;
			}
		}

		// ② 权限门：无权时 requirePageAccess 已 toast + route.back()
		const access = requirePageAccess(path, lastQuery);
		allowed = access.allowed;
		if (!allowed) {
			if (typeof onDenied === 'function') onDenied(access);
			return;
		}

		// ③ 首次通过：取数只跑一次（返回本页不重复取数）
		ready = true;
		if (typeof onReady === 'function') onReady(lastQuery);
	});

	return { isAllowed: () => allowed };
}

export default usePageGuard;
