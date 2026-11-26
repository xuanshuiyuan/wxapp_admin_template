// ---------------------------------------------------------------------------
// 启动时的「小程序版本更新」提示（App.vue 的 onLaunch 调一次）。
//
// 分工：
//   · 能力（getUpdateManager / applyUpdate，微信小程序专有）在 services/platform.js；
//   · 提示文案与「稍后」的处置在本文件 —— 它是**行为规则**而非渲染，
//     按红线第 1 条不能落在 pages/ 或 components/ 里。
//
// ⚠️ 为什么能在 onLaunch 里做（而同一处明确不做登录）：登录失败要**跳页**，
//    onLaunch 阶段页面栈未就绪、跳页不可靠；这里只往全局弹窗队列推一条，
//    首个页面挂载后 <app-modal> 自然渲染，不涉及任何跳转。
// ---------------------------------------------------------------------------

import { applyMiniProgramUpdate, watchMiniProgramUpdate } from '@/services/platform';
import { pushModal } from '@/store/modal';

// 一次启动只提示一次：onUpdateReady 是平台回调，若重复注册/重复回调，
// 弹窗队列会把同一条提示排两次（用户点完一个又冒一个）。
let prompted = false;

/**
 * 开始监听小程序新版本（仅微信小程序生效；H5 / App 及其他端空转）。
 * 新版本下载完成后弹确认框，用户点「立即重启」才 applyUpdate；
 * 「稍后」不做事 —— 新版已落在本地，下次冷启动会自动生效。
 */
export function initAppUpdate() {
	watchMiniProgramUpdate({
		onReady: () => {
			if (prompted) return;
			prompted = true;
			// 走 pushModal 而不是 composables/useModal：本层是 services（基础层），
			// 不能反向依赖复用层；全局守卫 services/guards.js 用的是同一条路径。
			pushModal(
				{
					title: '发现新版本',
					content: '新版本已准备好，重启小程序后即可使用。是否立即重启？',
					showCancel: true,
					confirmText: '立即重启',
					cancelText: '稍后',
					// 点蒙层 / ✕ 等同「稍后」：不强制重启，避免误触导致正在填的表单丢失
					close: true
				},
				(result) => result === 'confirm'
			).then((restart) => {
				if (restart) applyMiniProgramUpdate();
			});
		}
	});
}