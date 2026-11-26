// ---------------------------------------------------------------------------
// 路由统一入口：页面里不要直接写 uni.navigateTo 和路径字符串。
// 集中在这里之后，改目录、加分包、换 tabBar 只会影响一个文件。
//
// ⚠️ 本文件**不提供登录拦截函数**：管理端的拦截要按「登录失败的**原因**」分流
//    （未绑定→去绑定页；网络失败→重试；禁用/无角色→守卫弹框），不是「未登录就跳登录页」。
//    拦截入口统一在 services/session.js 的 requireAdminLogin()，页面 onShow 调用它。
// ---------------------------------------------------------------------------

import { toQueryString } from '@/utils/qs';
import { isMP } from '@/services/platform';
import { toast } from '@/services/toast';
// 本文件内部要用（relaunch / back 的默认兜底页）；下面的 `export { … } from` 是**转出**、
// 不产生本地绑定，故必须单独 import 一次
import { PAGE_ADMIN_HOME } from '@/config/access';

/**
 * ★ 页面路径常量：**定义在 `config/access.js`**，这里只把它们**转出**。
 *
 * 为什么路径下沉到 config：`config/access.js` 是「页面清单 + 谁需要什么权限」的唯一真相源，
 * 路径必须与它同处；但页面禁止出现路径字面量，故这里转出给页面引。
 * ⚠️ 之所以不在这里定义：config/ 不能反向 import services/（依赖方向红线）。
 */
export {
	PAGE_ADMIN_HOME,
	PAGE_BIND,
	PAGE_DEMO,
	PAGE_DEMO_A,
	PAGE_DEMO_B,
	PAGE_FIELD_EDITOR,
	PAGE_REGION_PICKER
} from '@/config/access';

/**
 * tabBar 页面路径。**当前为空**（模板未开 tabBar，无导航结构设计稿，不编造）。
 * 将来加 tabBar 时两处要同步：
 *   1) 本数组补上各 tab 页路径
 *   2) src/pages.json 加 tabBar 段（含 iconPath 图标实体文件）
 * route.to 据此自动决定走 switchTab 还是 navigateTo——漏改这里会导致跳 tab 页失败。
 */
export const TAB_PAGES = [];

function normalize(path) {
	if (!path) return path;
	return path.startsWith('/') ? path : `/${path}`;
}

function withQuery(path, query) {
	if (!query || typeof query !== 'object') return path;
	const qs = toQueryString(query);
	return qs ? `${path}?${qs}` : path;
}

export const route = {
	/** 普通跳转（压栈） */
	to(path, query, options = {}) {
		const url = withQuery(normalize(path), query);
		// 判 tab 必须拿**未拼 query 的路径**比：tabBar 页 navigateTo 必失败，
		// 而带 query 的串永远匹配不上 TAB_PAGES
		if (TAB_PAGES.includes(url.split('?')[0])) return uni.switchTab({ url, ...options });
		return uni.navigateTo({ url, ...options });
	},

	/** 关闭当前页再跳转（用于「上一页使命已尽」的场景） */
	redirect(path, query, options = {}) {
		return uni.redirectTo({ url: withQuery(normalize(path), query), ...options });
	},

	/** 回到 tabBar 页 */
	tab(path, options = {}) {
		return uni.switchTab({ url: normalize(path), ...options });
	},

	/** 关闭所有页面（登录失效、切换身份等场景） */
	relaunch(path = PAGE_ADMIN_HOME, options = {}) {
		return uni.reLaunch({ url: normalize(path), ...options });
	},

	/**
	 * 返回上一页；页面栈为空时（H5 直接打开链接、分享落地页）回落到 fallback
	 * @param {string} [fallback] 兜底页面路径
	 */
	back(fallback = PAGE_ADMIN_HOME, options = {}) {
		const pages = getCurrentPages();
		if (pages && pages.length > 1) {
			return uni.navigateBack({ delta: 1, ...options });
		}
		return uni.relaunch(fallback, options);
	},

	/**
	 * 跳到另一个小程序。
	 * 端差异与失败兜底都收在这一处，页面只调这个出口。
	 * ⚠️ 微信端还需在 src/manifest.json 的 mp-weixin.navigateToMiniProgramAppIdList 声明目标 appId，
	 *    否则**首次**跳转会被微信拦一次（编译不报错，属静默体验损失）。
	 * @param {string} appId 目标小程序 appId
	 * @param {object} [options] 其余参数（path / extraData / envVersion）
	 * @returns {Promise<boolean>} 是否真的发起了跳转
	 */
	toMiniProgram(appId, options = {}) {
		if (!isMP) {
			// H5 / App 没有「跳其他小程序」这条能力，明说出来比静默无反应好
			toast('请在微信中打开');
			return Promise.resolve(false);
		}
		return new Promise(resolve => {
			uni.navigateToMiniProgram({
				appId,
				...options,
				success: () => resolve(true),
				fail: err => {
					// 用户自己取消也是 fail：取消不提示，真失败才提示
					const msg = String((err && err.errMsg) || '');
					if (!/cancel/i.test(msg)) toast('打开失败，请稍后重试');
					resolve(false);
				}
			});
		});
	}
};