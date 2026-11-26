// ---------------------------------------------------------------------------
// 登录态唯一入口：分散在 request / upload 里的「40005 → 重登 → 重试」逻辑收敛到这里。
//
// 页面基本只用三个方法：
//   sessionReady()               **同步**判据：本地会话够用？首屏页用它取「启动态」的初值
//   await requireAdminLogin()    进页拦截：没登录就登录；不可用则按原因分流并返回 false
//   await bindAdmin({...})       绑定页提交
//
// ★ 两种运行模式（config/app.js 的 DEMO_MODE）：
//   true  —— **演示模式**：不请求网络，直接把 config/demo.js 的演示会话写进本地存储
//            （内置 token + admin_info + permission）。权限菜单 / 页面准入可完整跑通。
//   false —— **真实模式**：wx.login 的 code → admin/login/login；
//            没绑过回 58001（流程分支，不是错误）→ 清栈跳绑定页。
//
// ⚠️ 真实模式的两个契约要点（后端模板 admin 组的接入指引）：
//   1. 绑定接口成功响应与登录**完全相同** → 当场 writeSession，不需要再登录一次；
//   2. 登录成功后**后端**要把角色授权接口路径写进登录缓存（admin_info.api），
//      AdminVerification 才会逐路径放行 —— 这是服务端的事，前端只负责把 permission 落地。
// ---------------------------------------------------------------------------

import { curl, isApiError, registerAuthHandler } from '@/services/http';
import { ENDPOINT_ADMIN_LOGIN, ENDPOINT_ADMIN_BIND } from '@/config/endpoints';
import { writeSession, clearSession, isLogin, getPermission } from '@/services/storage';
import { syncUser, resetUser } from '@/store/user';
import { route, PAGE_BIND } from '@/services/route';
import { toast } from '@/services/toast';
import { mockLoginCode } from '@/config/env';
import { DEMO_MODE } from '@/config/app';
import { DEMO_SESSION } from '@/config/demo';
import { CODE_ADMIN_NOT_BOUND, CODE_WX_UNAVAILABLE } from '@/config/dict';

// 最近一次登录失败的**业务码**（null = 没失败过，或失败在网络层没有码）。
// 为什么要有它：登录失败的原因决定「下一步去哪儿」，调用方只能拿到一个 ApiError。
// ⚠️ 只存内存、不落存储：它是**本次启动的过程状态**。
let lastLoginCode = null;

/** 取异常里的业务码（非 ApiError / 无 code 时返回 null） */
function codeOf(e) {
	return isApiError(e) ? Number(e.code) : null;
}

/**
 * 取得登录凭证：微信小程序用 uni.login 换 code（一次性，重复消费后端回 60003），
 * 其他端用联调 mock code。端差异只允许写在这类适配函数里，页面代码不出现 #ifdef。
 * @returns {Promise<{code: string}>}
 */
function getLoginCredential() {
	return new Promise((resolve, reject) => {
		// #ifdef MP-WEIXIN
		uni.login({
			provider: 'weixin',
			success: res => resolve({ code: res.code }),
			fail: reject
		});
		// #endif
		// #ifndef MP-WEIXIN
		// 非微信端拿不到真 code，只能走联调通道；未配置时**明确报错**而不是拿假身份进入
		if (!mockLoginCode) {
			reject(new Error('非微信端未配置 VITE_MOCK_LOGIN_CODE（见 .env.development 注释）'));
			return;
		}
		resolve({ code: mockLoginCode });
		// #endif
	});
}

/**
 * 调一次登录接口并落会话。
 * `authRetry: false` 防递归（登录接口自身返回 40005 时不能再触发重登）；
 * `toast: false` 由调用方决定怎么提示。
 */
async function postLogin(credential) {
	const body = await curl.post(ENDPOINT_ADMIN_LOGIN, credential, { authRetry: false, toast: false });
	writeSession(body.data);
	syncUser();
	return body.data;
}

/** 演示模式：把内置会话写进本地存储（结构与真实登录响应完全一致） */
function loginWithDemoSession() {
	writeSession(DEMO_SESSION);
	syncUser();
	lastLoginCode = null;
	return DEMO_SESSION;
}

async function doLogin() {
	lastLoginCode = null;
	if (DEMO_MODE) return loginWithDemoSession();
	try {
		return await postLogin(await getLoginCredential());
	} catch (e) {
		lastLoginCode = codeOf(e);
		// 60003 = 微信侧失败（code 过期 / 已用过 / 网络）。原样重发同一个 code **必然**还是
		// 60003，故必须换一个新 code 再试一次；只重试一次，仍失败就抛给调用方提示重试。
		if (lastLoginCode !== CODE_WX_UNAVAILABLE) throw e;
		try {
			return await postLogin(await getLoginCredential());
		} catch (e2) {
			// 重试失败要覆盖 lastLoginCode：这次可能回的是 58001（未绑定），
			// 调用方得据此跳绑定页
			lastLoginCode = codeOf(e2);
			throw e2;
		}
	}
}

/**
 * 本地会话是否**已经够用**（有 token，且权限点已取到）—— **同步、零网络**。
 *
 * 首屏页凭它决定第一帧渲染什么：会话够用就立刻进正常骨架，否则显示「启动判定态」。
 * ⚠️ 它回答的是「要不要先走一次登录判定」，**不是**「服务端认不认这个 token」（那是 40005 的事）。
 * ⚠️ 为什么权限点也算「够用」：旧会话可能没有 permission 字段，不补登会让首页入口全部隐藏，
 *    表现成"权限被收了"。
 * @returns {boolean}
 */
export function sessionReady() {
	return isLogin() && getPermission().length > 0;
}

/**
 * 管理端登录拦截：页面 onShow 里 `if (!(await requireAdminLogin())) return`。
 *
 * 已登录直接 true；未登录则登录一次。失败**不抛异常**、只返回 false，
 * 页面据此渲染「加载失败可重试」态（区别于「空数据」）。
 *
 * 分流规则（业务规则，落在服务层，页面不判断）：
 *   · 该微信未绑定管理员（58001）→ **清栈**跳绑定页（此时页面栈里没有有意义的历史）；
 *   · 账号被禁用（50008）/ 未配置角色（58004）→ 不跳页：已登记全局守卫会弹框说明；
 *   · 其余（网络 / 未知）→ 不跳页，页面给重试。
 */
export async function requireAdminLogin() {
	if (sessionReady()) return true;
	try {
		await login();
		return true;
	} catch (e) {
		if (lastLoginCode === CODE_ADMIN_NOT_BOUND) {
			route.relaunch(PAGE_BIND);
		} else if (!(isApiError(e) && e.type === 'guard')) {
			// guard 型已由全局守卫弹框处置，忽略是正确反应；其余至少留一条日志
			console.error('[session] 登录失败：', e && e.message);
		}
		return false;
	}
}

let pending = null;

/**
 * 登录（单飞）：并发调用只会真正发起一次登录请求
 * @returns {Promise<object>} 登录响应 data（token / admin_info / permission）
 */
export function login() {
	if (pending) return pending;
	pending = doLogin().finally(() => {
		pending = null;
	});
	return pending;
}

/**
 * 静默重登，供 http 层在收到 CODE_LOGIN_EXPIRED 时调用
 * @returns {Promise<boolean>} 是否成功（成功则 http 层自动重放原请求）
 */
export async function relogin() {
	try {
		await login();
		return true;
	} catch (e) {
		// 安全退化：清响应式用户态、不放行
		resetUser();
		// ⚠️ 存储里的 token 必须一起清：只清响应式态时 isLogin() 仍为 true，
		// 下一页的 requireAdminLogin() 会误判"已登录"直接放行 → 每次进页白吃一次 40005 往返
		clearSession();
		// 重登时后端说「这个微信没绑管理员」→ 与进页拦截同一处置：去绑定页
		if (lastLoginCode === CODE_ADMIN_NOT_BOUND) route.relaunch(PAGE_BIND);
		return false;
	}
}

// ---------------------------------------------------------------------------
// 权限点（登录 / 绑定响应下发的快照）：**每个页面与操作**的可见性/准入判据
//
// ⚠️ 用途仅限「显示与准入体验」，**真正的防线在服务端**（各接口各自校验权限点）：
//    · 快照会过期（权限在登录时组装，变更最长 2h 后才生效）
//    · 故凡是按权限调接口的地方，**仍必须**处理 `40102`
// ---------------------------------------------------------------------------

/** 是否持有某权限点（码值取 config/dict.js 的 `PERM_*`） */
export function hasPermission(code) {
	return getPermission().includes(code);
}

/** 是否持有其中**任一**权限点（空数组 = 不通过；不写 `|| true` 之类的兜底） */
export function hasAnyPermission(codes) {
	if (!Array.isArray(codes) || !codes.length) return false;
	return codes.some((code) => hasPermission(code));
}

/**
 * 页面级权限门：页面 `onLoad` 里 `if (!requirePermissions([...])) return`。
 * 无权则**提示 + 退回**（route.back 空栈时自动回落首页），返回 false 让页面停止取数。
 * @param {string[]} codes 任一命中即放行
 * @returns {boolean}
 */
export function requirePermissions(codes) {
	if (hasAnyPermission(codes)) return true;
	toast('当前账号无此功能权限，请联系管理员');
	route.back();
	return false;
}

/**
 * 绑定管理员账号（首次使用）：手机号 + 密码把当前微信与管理员账号绑上。
 *
 * 契约要点：
 *   1. **必须用新换的 code** —— 登录接口刚消费过的那个已失效，故本函数每次重新取；
 *   2. 成功响应与登录接口**完全相同** → 当场 writeSession，**不需要**再登录一次；
 *   3. 频控 58003 由**页面**置灰倒计时处置，本层只把错误抛上去。
 *
 * @param {object} payload
 * @param {string} payload.mobile 管理员手机号
 * @param {string} payload.password 密码
 * @returns {Promise<object>} 与登录相同的会话 data
 */
export async function bindAdmin({ mobile, password }) {
	if (DEMO_MODE) {
		// 演示模式：任意非空账号 / 密码都直接成功（校验在绑定页做）
		return loginWithDemoSession();
	}
	try {
		return await postBind(await getLoginCredential(), mobile, password);
	} catch (e) {
		// 同登录：60003 必须换新 code 重试一次
		if (codeOf(e) === CODE_WX_UNAVAILABLE) {
			return postBind(await getLoginCredential(), mobile, password);
		}
		throw e;
	}
}

async function postBind(credential, mobile, password) {
	const body = await curl.post(
		ENDPOINT_ADMIN_BIND,
		{ ...credential, mobile, password },
		{ authRetry: false, toast: false }
	);
	writeSession(body.data);
	syncUser();
	return body.data;
}

/**
 * 退出登录：清本地存储 + 清响应式用户态。
 * ⚠️ 当前无页面消费方（登录是微信静默的，清掉后下次进页又会自动登回来）。
 *    保留它是因为「换人使用同一台手机」是真实场景，属**预留能力**。
 */
export function logout() {
	clearSession();
	resetUser();
}

// 把重登能力交给 http 层（模块被 import 时即完成注册，见 main.js 的副作用 import）
registerAuthHandler(relogin);

export default {
	login,
	bindAdmin,
	relogin,
	sessionReady,
	requireAdminLogin,
	hasPermission,
	hasAnyPermission,
	requirePermissions,
	logout
};