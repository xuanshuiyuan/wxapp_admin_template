// ---------------------------------------------------------------------------
// 颜色纯函数工具（2026-10-19 v1.0.12 新建）。
//
// 为什么需要它：本项目的环图一律走 `conic-gradient` + 内孔盘挖空（小程序端无 SVG、
// canvas 三端口径不一，见 rule-style-css），而 `conic-gradient` **只能内联拼色串** ——
// 于是色值必须从 JS 侧拿。`theme.scss` 的 `rgba($token, alpha)` 在 JS 里拼不出来，
// 只能拿 `config/theme.js` 镜像的 hex 再自己套 alpha。
//
// 放在 utils 层是为了让它只有一份实现（DRY）：任何需要按 alpha 拼色串的组件
// （环图、占比条、自绘进度类）都从这里取，不要在组件内私藏副本。
// ---------------------------------------------------------------------------

/**
 * `#RRGGBB` → `rgba(r, g, b, alpha)`。只认 6 位 hex（本项目所有 token 都是 6 位）——
 * 不支持的写法不猜、原样返回，免得把畸形色串悄悄拼成一个「看起来对」的颜色。
 * @param {string} hex 形如 `#12A150`（大小写均可）
 * @param {number} alpha 0~1
 * @returns {string} 形如 `rgba(18, 161, 80, 0.34)`
 */
export function hexToRgba(hex, alpha = 1) {
	if (typeof hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
	const n = parseInt(hex.slice(1), 16);
	return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}