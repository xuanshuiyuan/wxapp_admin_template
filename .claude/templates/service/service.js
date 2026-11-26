// ---------------------------------------------------------------------------
// __NAME__ 服务层。
//
// 本文件是「业务逻辑」的落点 —— 页面 / 组件只调这里，不自己写规则。
//   ❌ 页面里写校验规则 / 状态机 / 计算规则 / 权限判定
//   ✅ 全部写在这里
//
// 判定口诀：把页面删掉换成 CLI，本文件的业务规则应该完全不受影响。
//
// ⚠️ 本模板演示三个本项目关键范式（注册模式 / 单飞 / 错误策略收敛），
//    按需保留，不需要的整段删掉（不留死代码）。
// ---------------------------------------------------------------------------

import { curl } from '@/services/http';
// 常量一律从 config 取，不在代码里写字面量（错误码 / 路径 / 环境值）
// import { ENDPOINT___DOMAIN_____ACTION__ } from '@/config/endpoints';
// import { CODE_XXX } from '@/config/dict';

// ===========================================================================
// 范式 1：注册模式 —— 打破循环依赖的唯一合法解法
// ===========================================================================
// 本层不认识「上层怎么做事」，只认识「谁来处理」。上层在启动时把能力注册进来。
// 本项目实例：services/session.js 向 http/request.js 注册 authHandler。
//
// ⚠️ 禁止用动态 import() / 延迟 require / globalThis 挂载来绕循环 ——
//    那会把「编译期环」变成「运行期时序炸弹」，更难排查。

/** 由上层注册的处理器（无则为 null，调用前必须判空） */
let handler = null;

/**
 * 注册处理器。上层在模块加载时调用一次即完成接线。
 * @param {Function} fn 处理器
 */
export function registerHandler(fn) {
	handler = fn;
}

// ===========================================================================
// 范式 2：单飞（single-flight）—— 并发调用只真正执行一次
// ===========================================================================
// 本项目实例：services/session.js 的 login()。
// 请求层并发补会话时，只会真登录一次，其余复用同一个 Promise。

let pending = null;

/**
 * 单飞执行：并发调用复用同一个 Promise。
 * @returns {Promise<any>}
 */
async function doSomethingOnce() {
	// TODO: 真实实现
	return null;
}

/**
 * 对外的单飞入口。
 * @returns {Promise<any>}
 */
export function somethingOnce() {
	if (pending) return pending;
	pending = doSomethingOnce().finally(() => {
		// 无论成功失败都清空 —— 失败后下一次调用应能重试
		pending = null;
	});
	return pending;
}

// ===========================================================================
// 范式 3：错误策略收敛 —— 失败永远抛 ApiError，按 type 分支
// ===========================================================================
// ApiError 的 type：network / http / business / auth / guard / unknown
//   · network  —— 请重试
//   · business —— 展示 msg
//   · auth     —— 交给重登逻辑（请求层已自动处理，通常页面不用管）
//   · guard    —— 弹框/跳页已由全局守卫处理，页面 catch 到「直接忽略」
//
// ❌ 禁止 catch 后 return null / {} 吞掉异常 —— 调用方无法区分「空数据」与「失败了」

/**
 * 业务动作（示例）。
 *
 * @param {object} params 入参
 * @param {object} [options] 透传给请求层
 * @returns {Promise<object>}
 */
export async function doBusinessAction(params = {}, options = {}) {
	// 参数整形与前置校验（格式层面）放这里，不放页面
	const payload = { ...params };

	// 默认静默：本动作的失败由调用方决定怎么提示（可能渲染错误态而非 toast）
	const body = await curl.post(ENDPOINT___DOMAIN_____ACTION__, payload, { toast: false, ...options });

	return body.data;
}

// ===========================================================================
// 导出（推荐同时给具名导出与 default，便于控制台调试）
// ===========================================================================

export default {
	registerHandler,
	somethingOnce,
	doBusinessAction
};

// ---------------------------------------------------------------------------
// 模板自带的提醒（接入后删除本段）
//
// · 端差异（#ifdef）只允许出现在服务层的适配函数里，页面不允许写。
//   参考 services/session.js 的 getLoginCredential（MP 用 uni.login，其他端走 mock）。
// · 若本服务有副作用注册（如 registerHandler），必须在 main.js 里 import 一次 ——
//   删了不会报错，但会「静默」失去机制（本项目 session / guards 两行都不可删）。
// · 存储读写必须经 services/storage.js，禁止直接 uni.getStorageSync。
// · 若本服务可能被并发调用，检查是否需要单飞。
// · 有副作用（注册/写存储/发请求）的函数必须在 JSDoc 里说明。
// ---------------------------------------------------------------------------