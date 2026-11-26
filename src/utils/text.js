// ---------------------------------------------------------------------------
// 文本工具 — 纯函数，仅做字符串处理
// ---------------------------------------------------------------------------

/**
 * 中间省略：按全角/半角宽度截断字符串，在中间插入「…」。
 * 全角=1、半角≈0.55；首页车辆状态舱（vehicle-status-card）同算法，阈值不同。
 * @param {string} str 原始字符串
 * @param {number} [max=10] 最大显示宽度（全角字符宽度=1，半角=0.55）
 * @returns {string}
 */
export function middleEllipsis(str, max = 10) {
	if (!str) return str;
	const w = (ch) => ((ch.charCodeAt(0) > 255) ? 1 : 0.55);
	const chars = [...str];
	if (chars.reduce((s, c) => s + w(c), 0) <= max) return str;
	const headMax = (max - 1) * 0.6;
	const tailMax = (max - 1) * 0.4;
	let head = '', hw = 0;
	for (const c of chars) {
		if (hw + w(c) > headMax) break;
		head += c;
		hw += w(c);
	}
	let tail = '', tw = 0;
	for (let i = chars.length - 1; i >= 0; i--) {
		if (tw + w(chars[i]) > tailMax) break;
		tail = chars[i] + tail;
		tw += w(chars[i]);
	}
	return head.replace(/\s+$/, '') + '…' + tail.replace(/^\s+/, '');
}

/**
 * 正文分段：把后端格式化后的纯文本按空行拆成段落数组（空段丢弃、每段 trim）。
 *
 * 为什么按 `\n+` 而不是只按 `\n\n`：后端 `FormatContent` 新契约段落间是 `\n\n`，
 * 但旧数据与用户原文里可能混有单个 `\n` 或连续多个换行；统一按「一个及以上换行」
 * 切段，新旧数据都能正确分段（2026-11-25 后端 bdacbf7 / C 端同源口径）。
 *
 * ⚠️ 只做「拆段 + trim」，**不改写正文内容**（不压空格、不切句、不重新排版）——
 * 正文格式统一由后端在落库与读取时完成，前端二次排版会与 C 端详情出现字面差异。
 *
 * @param {string} text 正文原文（可为空）
 * @returns {string[]} 段落数组；无内容时为 `[]`
 */
export function splitParagraphs(text) {
	const raw = String(text || '');
	if (!raw) return [];
	return raw
		.split(/\n+/)
		.map((p) => p.trim())
		.filter(Boolean);
}

/**
 * 手机号脱敏：只保留前 3 后 4。
 *
 * 为什么长度不足 7 位一律全星号（而不是「留前几位」）：不足 7 位时前后两段会**重叠**，
 * 按位置切片会把中间那几位也印出来 —— 宁可少显示，不可猜格式。
 *
 * ⚠️ 使用口径（管理端）：**屏幕上不出现完整号码**，但要回电时不是让用户去背号码 ——
 * 展示用本函数脱敏，拨号用真实值（`platform.callPhone(rawPhone)`，真值不进渲染）。
 *
 * ⚠️ 本函数加在 `utils/text.js`（与 C 端共用文件）里，属**新增导出**、不改既有行为，
 * 故不会影响 C 端；C 端同样有手机号展示需求，建议**双向下发**一份（见 CHANGELOG v1.0.0 影响范围）。
 * @param {string|number} mobile 手机号原文
 * @param {string} [placeholder='—'] 空值时的占位文案
 * @returns {string}
 */
export function maskMobile(mobile, placeholder = '—') {
	const m = String(mobile || '');
	if (!m) return placeholder;
	return m.length >= 7 ? `${m.slice(0, 3)}****${m.slice(-4)}` : '****';
}

/**
 * 解码 URL 查询参数（中文名等）。
 *
 * 为什么需要它：`route.to` 用 `toQueryString` 做了 encodeURIComponent，而**微信小程序
 * onLoad 的 options 不自动解码**（H5 会解一次）。解过一次的中文不再含 `%` 转义，
 * 再解为恒等；原文真含 `%` 且解不开时回落原串（不能抛错，否则整页 onLoad 中断）。
 *
 * @param {string} value
 * @returns {string}
 */
export function safeDecodeURIComponent(value) {
	if (value === undefined || value === null || value === '') return '';
	try {
		return decodeURIComponent(value);
	} catch (e) {
		return String(value);
	}
}