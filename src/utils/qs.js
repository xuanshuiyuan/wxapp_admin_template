/**
 * 把 id 数组序列化成后端要的「逗号串」（`role_ids=2,3`）。
 *
 * 为什么需要它（别改成直接传数组）：uni.request 在 `x-www-form-urlencoded` 下会把
 * JS 数组序列化成 `role_ids=2%2C3`（管理端小程序实测可用），但 H5 端由浏览器/XHR
 * 决定，可能变成 `role_ids[]=2` —— 后端表单解码器**不认**这种路径，直接回 40001。
 * 先 join 成字符串，两端行为一致。
 *
 * ⚠️ `undefined` / `null` **原样返回**（= 不传该字段）。不能兜底成空串：
 *    覆盖式接口里「不传 = 不改」与「传空 = 清空」是两种语义，兜底会把前者误做成后者。
 * @param {Array|string|undefined|null} ids
 * @returns {string|undefined|null}
 */
export function joinIdsParam(ids) {
	if (ids === undefined || ids === null) return ids;
	return Array.isArray(ids) ? ids.join(',') : ids;
}

// 对象序列化为 x-www-form-urlencoded 字符串（替代 qs.stringify）

export function toQueryString(data) {
	if (!data) return ''
	return Object.keys(data)
		.filter(key => data[key] !== undefined && data[key] !== null)
		.map(key => {
			const value = data[key]
			// 数组一律逗号串（与 utils/qs.js 的 joinIdsParam 同口径）：
			// 后端表单解码器不认 `key[]=` / `key[0]=`，会直接回 40001
			if (Array.isArray(value)) {
				return `${encodeURIComponent(key)}=${encodeURIComponent(value.join(','))}`
			}
			return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
		})
		.join('&')
}
