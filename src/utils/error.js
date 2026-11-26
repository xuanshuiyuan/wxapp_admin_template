// ---------------------------------------------------------------------------
// 日志用的错误摘要（纯函数）
//
// 为什么需要它：`ApiError.raw` 对 business 型是响应体、对 http 型是**整个响应对象**
// （含响应头）。页面把 `e` 整包丢进 console.error 时，H5 控制台会打印整份响应头 ——
// 本次安全审查指出的低风险项。排障真正需要的是 type / code / message 三个字段。
//
// ⚠️ 本函数**只用于日志**，不改变错误本身：页面的错误分支仍按 `e.type` / `e.code` 判断。
// ---------------------------------------------------------------------------

/**
 * @param {*} e 任意错误（通常是 ApiError）
 * @returns {{type: string, code?: any, message?: string}}
 */
export function errorBrief(e) {
	if (!e) return { type: 'unknown' };
	if (typeof e === 'string') return { type: 'unknown', message: e };
	return {
		type: e.type || 'unknown',
		code: e.code,
		message: e.message || ''
	};
}

export default errorBrief;