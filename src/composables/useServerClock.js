// ---------------------------------------------------------------------------
// 服务端时钟（前端倒计时用）：把「服务端当下时刻」表示成一个会走的秒数
//
// 为什么需要它：报价截止倒计时必须按**服务端时间**算（契约给 `quote_deadline` +
// `server_time`）—— 手机本地时钟可能偏差几分钟，直接用 `Date.now()` 会把
// 「还没截止」显示成「已截止」（或反过来）。
//
// 做法：收到 `server_time` 时记下它与本地时钟的偏移；之后按 `tickMs` 按本地流逝时间
// 推进 `nowSec`。这样既有服务端基准、又不会因为不刷新页面而永远停在响应那一刻。
//
// ★ 默认 **30 秒**一跳：列表 / 工作台的展示粒度是「分钟」（`remainingText`），
//   更密的 tick 只会带来无谓的重绘（performance 规则：没有测量数据就不做高频更新）。
// ★ 详情 / 报价页的**秒级倒计时**显式传 `{ tickMs: 1000 }`（用户 2026-11-16 要求）：
//   那是「盯着看」的倒计时，30 秒一跳会让人以为数字卡住了。
//   代价只是每页每秒一次单节点文本更新，不是高频回调里的大对象赋值。
// ★ 组件卸载时清掉定时器；页面隐藏（onHide）不停 —— 它不发网络请求，代价仅一个定时器。
// ---------------------------------------------------------------------------

import { onUnload } from '@dcloudio/uni-app';
import { ref } from 'vue';

/** 默认 tick（毫秒）：分钟档展示够用 */
const DEFAULT_TICK_MS = 30000;

/**
 * @param {{ tickMs?: number }} [options]
 *   `tickMs` = 推进间隔（毫秒）。默认 30000；秒级倒计时传 1000。
 * @returns {{ nowSec: import('vue').Ref<number>, sync: (serverTime: number) => void }}
 *          `sync` 在每次拿到响应后调用；`nowSec` 直接绑给展示层。
 */
export function useServerClock(options = {}) {
	const tickMs = Number(options.tickMs) > 0 ? Number(options.tickMs) : DEFAULT_TICK_MS;
	const nowSec = ref(Math.floor(Date.now() / 1000));
	// 服务端时刻与本地时钟的偏移（毫秒）：server*1000 - Date.now()
	let offsetMs = 0;

	const timer = setInterval(() => {
		nowSec.value = Math.floor((Date.now() + offsetMs) / 1000);
	}, tickMs);

	onUnload(() => clearInterval(timer));

	/** 用响应里的 `server_time` 校准；缺值时保持本地时钟（服务端一定下发，这里只做防御） */
	function sync(serverTime) {
		const server = Number(serverTime) || 0;
		offsetMs = server ? server * 1000 - Date.now() : 0;
		nowSec.value = Math.floor((Date.now() + offsetMs) / 1000);
	}

	return { nowSec, sync };
}

export default useServerClock;