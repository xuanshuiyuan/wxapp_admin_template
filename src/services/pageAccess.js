// ---------------------------------------------------------------------------
// 页面准入与「本页有权限加载的数据配置」（★ 统一入口）
//
// 用户 2026-10-27 定稿口径：
//   **每个页面进来的时候，都要先获取「当前页面有权限加载的数据配置」**。
//   于是页面里不再各自拼权限码数组、也不再各写一遍 `配置 ∩ 权限点` 的过滤 ——
//   判据只有本文件一处，配置只有 `config/access.js` 一处。
//
// 两类调用：
//   · `requirePageAccess(path, query)` —— 页面 `onLoad` 里的**权限门 + 取本页配置**（一步到位）
//   · `byPermission(list, codes)`      —— 页内 tab / 按钮的**显隐过滤**（同一口径的唯一实现）
//   · `pageNeedsLogin(path)`           —— 页面 `onShow` 里的**登录门**是否要跑（配置驱动）
//
// ⚠️ 本文件**不接管页面生命周期**：登录门仍由页面在 `onShow` 调（它要在页面栈就绪后才跳页，
//    见 memory/known_issues.md 的 K-21），权限门仍由页面在 `onLoad` 同步调。这里只提供判据。
// ⚠️ 权限点是**登录快照**（最长 2h 才刷新）——本文件解决的是**显示与准入体验**，
//    真正的防线在服务端：按权限调的接口无权时仍会回 `40102`，调用方**必须**自己处置。
// ---------------------------------------------------------------------------

import { PAGES } from '@/config/access';
import { getPermission } from '@/services/storage';
import { requirePermissions } from '@/services/session';

/**
 * 取某页的配置（未登记返回 null）。
 * @param {string} path 页面路径常量（`config/access.js` 的 `PAGE_*`）
 * @returns {object|null}
 */
export function pageConfig(path) {
	return PAGES[path] || null;
}

/**
 * 本页的**准入码**（把三种形态归一成一个数组；无门返回空数组）：
 *   · `entries` 无 → 无权限门
 *   · `entries` 有、无 `byParam` → 这些子入口的码全部（语义 = **任一命中**即放行）
 *   · `entries` 有 + 有 `byParam` → **只取 URL 参数指向的那一条**的码（详情页属于某一个表单类型）
 *
 * @param {string} path
 * @param {object} [query] 页面 `onLoad` 拿到的查询参数
 * @returns {string[]}
 */
export function pageCodes(path, query) {
	const config = pageConfig(path);
	if (!config || !Array.isArray(config.entries) || !config.entries.length) return [];
	if (config.byParam) {
		const key = (query && query[config.byParam]) || '';
		const hit = config.entries.find((entry) => entry.key === key);
		// 解析不出目标 = **参数问题不是权限问题**（URL 被手改 / 后端加了新类型而这版还不认识）——
		// 返回空数组，由 requirePageAccess 归到 'unresolved'，页面自己给"参数不完整"的空态
		return hit ? [hit.code] : [];
	}
	return config.entries.map((entry) => entry.code);
}

/**
 * 本页要不要先有登录态（页面 `onShow` 的登录门用）。
 * ⚠️ 未登记的页面按「要」处理（安全侧默认）—— 漏配一个页面不该变成"谁都能进"。
 * @param {string} path
 * @returns {boolean}
 */
export function pageNeedsLogin(path) {
	const config = pageConfig(path);
	return config ? config.login !== false : true;
}

/**
 * ★ 页面准入（页面 `onLoad` 一行搞定）。
 *
 * 四种结果（`reason`）：
 * | reason | 含义 | 处置 |
 * |---|---|---|
 * | `open` | 本页**无权限门**（配置里没配 `entries`） | 放行 |
 * | `granted` | 持有本页要的码（任一命中） | 放行 |
 * | `denied` | **确实没权限** | 已 toast + `route.back()`（复用 `requirePermissions`） |
 * | `unresolved` | `byParam` 解析不出目标 | **不提示不跳页** —— 那是参数问题，页面自己给空态 |
 *
 * @param {string} path 页面路径常量
 * @param {object} [query] 页面 `onLoad` 的查询参数
 * @returns {{allowed: boolean, reason: string, codes: string[], config: object|null, entries: Array}}
 *          `entries` = ★ 本页**有权限加载的数据配置**（`config.entries ∩ permission`）
 *
 * ⚠️ `entries` 是**进页那一刻**的快照（本函数是同步的、在 `onLoad` 调一次）。
 *    列表页的 tab 必须跟着「重新登录 / 权限变化」刷新时，仍应自己算
 *    `byPermission(ENTRIES, permission.value)`（响应式）；
 *    `entries` 留给**不需要响应式**的消费者，「每个页面进来先取本页有权限的配置」这条口径
 *    由返回值承载 —— 页面直接用它即可，不必再算一遍。
 */
export function requirePageAccess(path, query) {
	const config = pageConfig(path);
	const codes = pageCodes(path, query);
	const entries = byPermission((config && config.entries) || []);

	// 无门：放行（不是遗漏 —— 首页/绑定页/搜索页各有各的理由，逐条写在 config/access.js）
	if (!config || !Array.isArray(config.entries) || !config.entries.length) {
		return { allowed: true, reason: 'open', codes, config, entries };
	}

	// byParam 解析不出目标：参数问题，交给页面处置（详情页给「参数不完整」空态）
	if (config.byParam && !codes.length) {
		return { allowed: false, reason: 'unresolved', codes, config, entries };
	}

	// 真权限门：复用 session 的处置（toast + route.back 空栈回落首页），不在这里重写一套
	if (!requirePermissions(codes)) {
		return { allowed: false, reason: 'denied', codes, config, entries };
	}
	return { allowed: true, reason: 'granted', codes, config, entries };
}

/**
 * 配置清单 ∩ 权限点 —— **入口 / tab / 按钮同一条口径的唯一实现**。
 *
 * 抽出来的理由（rules/architecture.md §3.4）：这条写法原本在首页宫格
 *（`composables/useAdminHome.js`）与页内 tab 各写一遍，
 * 按钮权限是第三遍 —— 到 3 次就必须抽。
 *
 * @param {Array<{code: string}>} list 配置清单（任意带 `code` 的项：入口 / 子入口 / 动作）
 * @param {string[]} [codes] 权限码；**省略时现读会话**（非响应式场景，如页面 onLoad）
 *                           —— 响应式场景（computed）**必须显式传** `ref` 的值，否则不会重算
 * @returns {Array} 有权限的那些项（顺序取配置顺序）
 */
export function byPermission(list, codes) {
	if (!Array.isArray(list)) return [];
	const granted = Array.isArray(codes) ? codes : getPermission();
	return list.filter((item) => item && granted.includes(item.code));
}

/**
 * 首页入口的**落点解析**（v1.2.4 / 后端 v1.3.3）：「有哪个权限码就进哪一页」。
 *
 * 配置里用 `pageBy: [{ code, page }]` 声明候选落点，按声明顺序取第一个命中的；
 * 都不命中回落到 `page`（没有静态 `page` 的入口返回 null，交给子菜单逻辑）。
 *
 * 为什么抽到这里：入口点击目标是「配置 ∩ 权限点」的又一种表现，
 * 判据必须与 `byPermission` 同处 —— 散在页面里会出现两份过滤口径。
 *
 * @param {object} entry 首页入口配置（`config/access.js` 的 `HOME_ENTRIES` 项）
 * @param {string[]} [codes] 权限码；省略时现读会话（非响应式场景）
 * @returns {string|null}
 */
export function resolveEntryPage(entry, codes) {
	if (!entry) return null;
	const granted = Array.isArray(codes) ? codes : getPermission();
	const pageBy = Array.isArray(entry.pageBy) ? entry.pageBy : [];
	const hit = pageBy.find((item) => item && item.page && granted.includes(item.code));
	return (hit && hit.page) || entry.page || null;
}
