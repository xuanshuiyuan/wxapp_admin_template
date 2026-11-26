// ---------------------------------------------------------------------------
// 请求核心：签名注入 → 发送 → HTTP 状态 → 业务码 → 登录失效静默重登重放 → 错误归一。
// request 与 uploadFile 共用这一套策略，不再各写一份。
//
// 与 session 的关系：本层不认识「怎么登录」，只认识「谁来处理登录失效」，
// 由 services/session.js 在模块加载时注册 handler，以此打破 http <-> session 循环依赖。
// ---------------------------------------------------------------------------

import { rootPath } from '@/config/env';
import { routeVersion } from '@/config/app';
import { CODE_SUCCESS, CODE_LOGIN_EXPIRED } from '@/config/dict';
import { getToken } from '@/services/storage';
import toastS from '@/services/toast';
import { buildSignHeader } from './sign';
import { send, TRANSPORT_REQUEST, TRANSPORT_UPLOAD } from './transport';
import { ApiError, ERROR_TYPE } from './error';
import { getCodeGuard, fireCodeGuard } from './guard';

export const DEFAULT_TIMEOUT = 10000;
export { TRANSPORT_REQUEST, TRANSPORT_UPLOAD };

/** 登录失效处理器：由 session.js 注册，返回是否重登成功 */
let authHandler = null;
export function registerAuthHandler(fn) {
	authHandler = fn;
}

/** 相对路径自动拼 rootPath + 版本前缀（/v2，文档通用约定），完整 http(s) 地址原样使用 */
function resolveURL(url) {
	if (/^https?:\/\//.test(url)) return url;
	// 兼容带/不带前导斜杠两种写法（api/ 业务路径带、endpoints.js 不带），统一去掉再拼
	const path = url.startsWith('/') ? url.slice(1) : url;
	// rootPath 为空 = H5 同域部署：必须补前导斜杠，否则会相对「当前页面目录」解析
	const base = rootPath || '/';
	return `${base}${routeVersion}/${path}`;
}

/** 拼 GET 查询参数；数组**一律逗号串**（与 POST 的 toQueryString 同口径，后端表单/查询解码器不认 key[]=） */
function buildURL(url, params) {
	if (!params || typeof params !== 'object') return url;
	const qs = Object.keys(params)
		.filter(key => params[key] !== undefined && params[key] !== null)
		.map(key => {
			const value = params[key];
			if (Array.isArray(value)) {
				return `${encodeURIComponent(key)}=${encodeURIComponent(value.join(','))}`;
			}
			return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
		})
		.join('&');
	if (!qs) return url;
	return url + (url.indexOf('?') === -1 ? '?' : '&') + qs;
}

/** 失败统一出口：按需提示后抛出 ApiError（调用处直接 bail(...)，后续代码不再执行） */
function bail(err, toast) {
	if (toast) toastS.toast(err.type === ERROR_TYPE.network ? '连接超时，请重试' : err.message);
	throw err;
}

/**
 * @typedef {object} RequestOptions
 * @property {string} url 相对路径（自动拼 rootPath）或完整地址
 * @property {'GET'|'POST'|'PUT'|'DELETE'} [method]
 * @property {object|string} [data] 请求体
 * @property {object} [params] query 参数
 * @property {string} [contentType] 请求体类型
 * @property {string} [transport] request / upload
 * @property {boolean} [toast=true] 失败是否自动提示
 * @property {boolean} [loading=false] 是否自动托管 loading
 * @property {boolean} [authRetry=true] 登录失效时是否静默重登并重放（登录接口本身传 false）
 * @property {boolean} [guard=true] 命中全局业务码守卫（services/guards.js）时是否执行其动作；
 *                                  守卫目标页自己的接口、或只想本地静默处理时传 false
 * @property {boolean} [rawResponse=false] 跳过统一响应校验（**仅第三方接口**用）：
 *                                  默认响应必须是对象且带 `code`；置 true 则原样返回 body。
 * @property {number} [timeout]
 */

/**
 * 发一次请求：成功返回响应体（{ code, msg, data }），失败抛 ApiError
 * @param {RequestOptions} options
 */
export function request(options = {}) {
	const { loading = false } = options;
	if (loading) toastS.showLoading();
	// loading 的关闭收敛到一个 finally：业务代码不再需要手写 hideLoading
	return sendWithPolicy(options).finally(() => {
		if (loading) toastS.hideLoading();
	});
}

async function sendWithPolicy(options) {
	const {
		url,
		method = 'GET',
		data,
		params,
		contentType,
		transport = TRANSPORT_REQUEST,
		toast = true,
		authRetry = true,
		guard: guardEnabled = true,
		rawResponse = false,
		timeout = DEFAULT_TIMEOUT,
		...rest
	} = options;

	// 请求前先补会话：静默登录的 token 有时效（7200s），本地 token 为空的场景
	// （冷启动登录未返回/失败、登出清空）直接打接口只会白吃一次 40005 往返，
	// 且占位头可能被后端当非法 token。复用 authHandler（session.login 内部单飞，
	// 并发请求只真登录一次）；失败不拦请求——公开接口不依赖登录态，
	// 带上 token 后失效的场景仍由下方 40005 重登重放兜底。
	// authRetry:false 即登录/绑定接口自身，必须跳过，否则登录依赖登录造成递归。
	if (authRetry && authHandler && !getToken()) {
		await authHandler();
	}

	const header = buildSignHeader({
		contentType: transport === TRANSPORT_UPLOAD ? null : contentType || 'application/x-www-form-urlencoded; charset=UTF-8'
	});

	let res;
	try {
		res = await send(transport, {
			url: buildURL(resolveURL(url), params),
			method,
			header,
			data,
			timeout,
			...rest
		});
	} catch (e) {
		// 拿不到响应：断网 / 超时 / H5 未启动 CORS 代理
		bail(new ApiError(ERROR_TYPE.network, '连接超时，请重试', { raw: e }), toast);
	}

	if (res.statusCode < 200 || res.statusCode >= 300) {
		bail(new ApiError(ERROR_TYPE.http, `请求失败（${res.statusCode}）`, { status: res.statusCode, raw: res }), toast);
	}

	// 204 No Content：HTTP 语义是「成功且无响应体」，按统一结构归一，避免被当成格式错误
	if (res.statusCode === 204) return { code: CODE_SUCCESS, msg: '', data: null };

	const body = res.data;
	// 第三方接口显式声明 rawResponse:true 时跳过统一响应校验（数组 / 纯文本 / 非包装结构都原样返回）
	if (rawResponse) return body;
	// 其余一律要求 { code, msg, data }：非对象（HTML 错误页 / 纯文本 / 顶层数组）按 unknown 抛
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		bail(new ApiError(ERROR_TYPE.unknown, '响应格式异常（期望 { code, msg, data }）', { raw: body }), toast);
	}

	// 后端 code 可能是字符串，统一按数字比较；缺失/非数字一律按「响应结构不合法」处理
	const numericCode = Number(body.code);
	if (!Number.isFinite(numericCode)) {
		bail(new ApiError(ERROR_TYPE.unknown, '响应格式异常（缺少 code）', { raw: body }), toast);
	}
	if (numericCode === CODE_SUCCESS) return body;

	if (numericCode === CODE_LOGIN_EXPIRED) {
		if (authRetry && authHandler) {
			// 并发请求同时 40005 时 handler 内部单飞，只会真登录一次
			const ok = await authHandler();
			if (ok) return request({ ...options, authRetry: false }); // 只重放一次，杜绝死循环
		}
		bail(new ApiError(ERROR_TYPE.auth, body.msg || '登录已失效，请重新进入', { code: body.code, raw: body }), toast);
	}

	// 全局业务码守卫（登记处见 services/guards.js）：命中即触发登记的全局动作
	// （跳页/弹窗，http/guard.js 负责去重），本请求以 ApiError(type='guard') 终止。
	// toast 强制 false：提示由守卫的弹窗/目标页给，页面 catch 到 type='guard' 直接忽略即可。
	if (guardEnabled) {
		const guardEntry = getCodeGuard(numericCode);
		if (guardEntry) {
			fireCodeGuard(guardEntry);
			bail(new ApiError(ERROR_TYPE.guard, body.msg || '账号状态受限', { code: body.code, raw: body }), false);
		}
	}

	bail(new ApiError(ERROR_TYPE.business, body.msg || '请求失败', { code: body.code, raw: body }), toast);
}
