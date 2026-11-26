// ---------------------------------------------------------------------------
// 「跳页取值」的通用桥：跳一张选择/输入页，页面回传结果时 resolve 一个 Promise。
//
// 为什么要它：这类页通常住在分包里（如通用字段编辑页 / 省市区选择页 / 车牌手输页），
// 而**分包之间禁止互引** → 调用方只能靠「跳页 + 全局事件回传」拿值。
// 这套「uni.$once + Promise + route.to 的 fail 释放监听」原先在若干处各写了一份，
// 收成这一份实现后，每个消费方只需写一个几行的薄包装（事件名 + 页面路径 + openPickPage/emitPickResult）。
//
// ★ 消费方：`services/fieldEditor.js`（通用字段编辑页）、`services/regionPicker.js`
//    （省市区选择页）。每个消费方只写「事件名 + 页面路径」，
//    机制（监听、释放、在飞去重）一份。
//    将来建「选车 / 选门店 / 选日期」这类选择页时照它抄，不要各页再手写一套 $once 监听。
//
// 约定（每个消费方都必须遵守，否则 Promise 会永挂）：
//   · 页面侧在 onUnload 补发一次「放弃」（防用户按返回键/手势退出）
//   · 确认路径必须先 emit 再 navigateBack，并用 emitted 标志避免 onUnload 覆盖结果
// ---------------------------------------------------------------------------

import { route } from '@/services/route';

/**
 * 跳到取值页并等结果
 * @param {string} event 该域的结果事件名（全局唯一）
 * @param {string} path 取值页路径（services/route.js 的常量）
 * @param {object} [query] 入场参数（值会自动 encodeURIComponent）
 * @returns {Promise<any|null>} 确认返回值；放弃 / 跳转失败返回 null
 */
const inflight = new Set();

export function openPickPage(event, path, query = {}) {
	// 同一取值页在飞时不再开第二张：连着点两下会压两层同款页，确认后只返回一层、
	// 用户落回那张**还是旧回显**的页上（弹层时代没这个问题，2026-10-23 改跳页后审查发现）
	if (inflight.has(event)) return Promise.resolve(null);
	inflight.add(event);
	return new Promise((resolve) => {
		const handler = (payload) => {
			uni.$off(event, handler);
			inflight.delete(event);
			resolve(payload && payload.ok ? payload.value : null);
		};
		// 用 $on + 自摘，而不是 $once：下面 fail 分支要**只摘自己这一个监听**
		uni.$on(event, handler);
		route.to(path, query, {
			// 跳转失败（路径未注册 / 栈满）要释放，否则 Promise 永挂、监听泄漏
			fail: () => {
				uni.$off(event, handler);
				inflight.delete(event);
				resolve(null);
			}
		});
	});
}

/**
 * 取值页回传结果（确认 / 放弃各调一次）
 * @param {string} event 该域的结果事件名
 * @param {{ok: boolean, value?: any}} payload
 */
export function emitPickResult(event, payload) {
	uni.$emit(event, payload);
}
