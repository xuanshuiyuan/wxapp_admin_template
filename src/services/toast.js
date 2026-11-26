// ---------------------------------------------------------------------------
// UI 反馈统一出口：toast / loading。
// loading 用引用计数，多个并发请求各自 hide 不会互相把对方的 loading 关掉，
// 也不需要业务代码到处补 hideLoading。
// 渲染走自定义组件 <app-loading />（品牌转圈图，状态在 store/loading）；
// 当前页面没挂组件时自动降级 uni.showLoading，保证 loading 永远有人收尾。
//
// ★ 上屏/收屏带节奏（2026-11-12 用户定）：延迟 200ms 再上屏、上屏后至少停留 300ms。
//   为什么要延迟：接口一快（<200ms）转圈只闪一帧，观感像页面在抖；快请求干脆不渲染。
//   为什么要有最短停留：已经转出来了就让它转完，否则一闪而过的圈比不转更让人困惑。
//   两个值都在 config/app.js，别在这里写死数字。
// ---------------------------------------------------------------------------

import { loadingState, hasLoadingInstance } from '@/store/loading';
import { LOADING_MIN_VISIBLE_MS, LOADING_SHOW_DELAY_MS } from '@/config/app';

let loadingCount = 0;
// 本次显示走的是不是原生降级：hide 必须对称关同一个出口，否则会卡蒙层
let usingNative = false;
// 延迟上屏计时器：触发前 hideLoading（快请求）就取消，整段不渲染
let showTimer = null;
// 最短停留计时器：上屏不足 300ms 时先挂着，到期再关
let hideTimer = null;
// 上屏时刻（毫秒时间戳）：算最短停留还差多少
let shownAt = 0;
let pendingTitle = '';

export function toast(message, icon = 'none', duration = 2000) {
	if (!message) return Promise.resolve();
	return new Promise(resolve => {
		uni.showToast({ title: String(message), icon, duration, complete: () => setTimeout(resolve, duration) });
	});
}

export const errorToast = message => toast(message, 'error');
export const successToast = message => toast(message, 'success');

function flushShow() {
	showTimer = null;
	// 计时器触发时请求可能已经结束（正常情况下 hideLoading 已取消计时器，这里再兜一次）
	if (loadingCount <= 0) return;
	if (hasLoadingInstance()) {
		usingNative = false;
		loadingState.title = pendingTitle;
		loadingState.visible = true;
	} else {
		// 页面没放 <app-loading />：退回原生，宁可样式旧也不能没有反馈
		usingNative = true;
		uni.showLoading({ title: pendingTitle, mask: true });
	}
	shownAt = Date.now();
}

function flushHide() {
	hideTimer = null;
	// 停留期间又来了一笔请求：算同一次显示，不关
	if (loadingCount > 0) return;
	if (usingNative) {
		usingNative = false;
		uni.hideLoading();
	}
	loadingState.visible = false;
}

export function showLoading(title = '') {
	loadingCount += 1;
	if (loadingCount > 1) {
		// 已有一笔在途：沿用先到那次的延迟/停留状态。
		// ⚠️ 不重排计时器 —— 并发请求持续进来会把上屏时刻一直往后推，转圈反而永远出不来
		if (showTimer) pendingTitle = title;
		return;
	}
	// 上一笔刚结束、还处在最短停留窗口：已经上屏了，取消关闭继续显示
	if (hideTimer) {
		clearTimeout(hideTimer);
		hideTimer = null;
		return;
	}
	pendingTitle = title;
	showTimer = setTimeout(flushShow, LOADING_SHOW_DELAY_MS);
}

export function hideLoading() {
	loadingCount = Math.max(0, loadingCount - 1);
	if (loadingCount > 0) return;
	// 还没上屏（还在延迟窗口里）：取消计时器，整段不渲染 —— 快请求不该看到转圈
	if (showTimer) {
		clearTimeout(showTimer);
		showTimer = null;
		return;
	}
	// 没在显示（典型是 resetLoading 已经兜底关掉了，finally 又调了一次）
	if (!loadingState.visible && !usingNative) return;
	const remain = LOADING_MIN_VISIBLE_MS - (Date.now() - shownAt);
	if (remain > 0) {
		// 只排一次：并发收起时多个 hide 都会走到这里，重复 setTimeout 会把关闭越推越晚
		if (!hideTimer) hideTimer = setTimeout(flushHide, remain);
		return;
	}
	flushHide();
}

/** 强制关闭 loading（页面卸载等异常路径兜底） */
export function resetLoading() {
	// 两个计时器都要清：否则页面卸载后计时器还会把 loading 拉起来 / 关掉
	if (showTimer) {
		clearTimeout(showTimer);
		showTimer = null;
	}
	if (hideTimer) {
		clearTimeout(hideTimer);
		hideTimer = null;
	}
	loadingCount = 0;
	if (usingNative) {
		usingNative = false;
		uni.hideLoading();
	}
	loadingState.visible = false;
}

/**
 * 包一层 loading，自动计数、异常也保证关闭
 * @param {Function} task 返回 Promise 的任务
 * @param {string} [title]
 */
export async function withLoading(task, title) {
	showLoading(title);
	try {
		return await task();
	} finally {
		hideLoading();
	}
}

export default { toast, errorToast, successToast, showLoading, hideLoading, resetLoading, withLoading };