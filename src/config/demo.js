// ---------------------------------------------------------------------------
// 演示会话（DEMO_MODE=true 时 services/session.js 直接写入本结构，不走网络）。
//
// 目的：让「权限菜单 / 页面准入 / 登录门」这套核心机制在没有后端的情况下完整跑通。
// 结构与真实后端 admin/login/login 的响应 data 完全一致：
//   { token, source, admin_info: { id, user_name, nick_name, mobile, role_names }, permission }
//
// ⚠️ 接真后端后（config/app.js 的 DEMO_MODE=false）本文件不再被使用，
//    可以整体删除 —— 但建议先留着当「登录响应长什么样」的参照。
// ⚠️ 这里的手机号是保留测试号段 13800000000，不是任何真实号码。
// ---------------------------------------------------------------------------

import {
	PERM_DEMO_MANAGE,
	PERM_DEMO_REQUEST,
	PERM_DEMO_SUBMENU,
	PERM_DEMO_PAGE_A,
	PERM_DEMO_PAGE_B
} from '@/config/dict';

/**
 * 演示登录响应。改 permission 数组即可验证「权限即显隐」：
 *   · 删掉 PERM_DEMO_SUBMENU → 首页「示例子菜单」卡消失；
 *   · 删到只剩一个子项码 → 点入口**直跳**，不弹层；
 *   · 加上 PERM_DEMO_HIDDEN → 「权限隐藏示例」卡出现；
 *   · 清空 → 首页显示「暂无可用功能，请联系管理员分配权限」。
 */
export const DEMO_SESSION = {
	token: 'demo-token-not-a-real-one',
	source: '1001',
	admin_info: {
		id: 1,
		user_name: '演示管理员',
		nick_name: '演示',
		mobile: '13800000000',
		role_names: ['演示角色']
	},
	permission: [
		PERM_DEMO_MANAGE,
		PERM_DEMO_REQUEST,
		PERM_DEMO_SUBMENU,
		PERM_DEMO_PAGE_A,
		PERM_DEMO_PAGE_B
	]
};

/** 演示模式下的「绑定」也直接成功：把同一个会话再写一次 */
export default DEMO_SESSION;