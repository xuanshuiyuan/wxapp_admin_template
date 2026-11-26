// ---------------------------------------------------------------------------
// 金额换算（纯函数，零副作用）
//
// ★ 后端所有金额都是**整数分**（`balance_fen` / `amount_fen` / `voucher_files` 同域）。
//   前端只在**展示层**转元；提交前再转回整数分。
//   ⚠️ 禁止把浮点金额直接进请求体：`0.1 + 0.2` 这类误差会让后端按分取整后少 1 分。
//   ⚠️ 也不要 `Math.round(yuan * 100)` 做输入转换：`19.99 * 100 = 1998.9999999999998`，
//     四舍五入看着对、边界值（如 1.005）会错。本文件用**字符串拆分**做整数运算。
// ---------------------------------------------------------------------------

/** 千分位分组（只用于展示） */
function groupThousands(intText) {
	const s = String(intText);
	return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * 分 → 元文本（固定两位小数 + 千分位）。
 * @param {number|string} fen 整数分；非法值按 0 处理（展示层不该出现 NaN）
 * @returns {string} 如 `1,000.00`、`-0.05`
 */
export function fenToYuanText(fen) {
	const n = Number(fen);
	if (!Number.isFinite(n)) return '0.00';
	const negative = n < 0;
	const abs = Math.round(Math.abs(n));
	const yuan = Math.floor(abs / 100);
	const cents = abs % 100;
	return `${negative ? '-' : ''}${groupThousands(yuan)}.${String(cents).padStart(2, '0')}`;
}

/**
 * 分 → 带货币符号的元文本。
 * @param {number|string} fen
 * @param {boolean} [withSymbol=true] 是否带 `¥`
 */
export function formatFen(fen, withSymbol = true) {
	return `${withSymbol ? '¥' : ''}${fenToYuanText(fen)}`;
}

/**
 * 分 → 展示文本；字段缺失给「—」。
 *
 * 为什么缺失不兜成 0：账户摘要里「0 元」与「还没取到」是两种事实，
 * 兜 0 会让运营以为这个账户真的没钱（见 .claude/skills/rule-coding-basics 的「缺值 vs 0」口径）。
 *
 * @param {number|string|null|undefined} fen 整数分
 * @returns {string}
 */
export function fenText(fen) {
	return fen === null || fen === undefined ? '—' : formatFen(fen);
}

/**
 * 元文本 → 整数分（用户输入解析）。
 *
 * 接受：`12`、`12.3`、`12.34`、`1,234.56`（允许千分位逗号）；
 * 拒绝：空串、负数、超过两位小数、非数字、0（本业务「金额必须 > 0」）。
 *
 * @param {string|number} text
 * @returns {number|null} 整数分；不合法返回 null（调用方据此提示，不要兜成 0）
 */
export function yuanTextToFen(text) {
	const s = String(text === undefined || text === null ? '' : text)
		.trim()
		.replace(/,/g, '');
	if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
	const [intPart, decPart = ''] = s.split('.');
	const fen = Number(intPart) * 100 + Number(decPart.padEnd(2, '0'));
	// 0 与 NaN / 超安全整数都算不合法 —— 后端 58034 会拒，前端先拦省一次往返
	if (!Number.isSafeInteger(fen) || fen <= 0) return null;
	return fen;
}