// ---------------------------------------------------------------------------
// 本地存储唯一入口：业务代码不要直接调 uni.setStorageSync / getStorageSync，
// 这样 key 命名、序列化、清理只有一处需要维护。
// ---------------------------------------------------------------------------

import { storageKey, SESSION_FIELDS } from '@/config/app';

export function getItem(name, defaultValue = '') {
	const value = uni.getStorageSync(storageKey(name));
	return value === '' || value === undefined || value === null ? defaultValue : value;
}

export function setItem(name, value) {
	uni.setStorageSync(storageKey(name), value);
}

export function removeItem(name) {
	uni.removeStorageSync(storageKey(name));
}

// ---------------------------------------------------------------------------
// 登录态：由后端登录响应写入，字段以 SESSION_FIELDS 为准
// ---------------------------------------------------------------------------

/**
 * 写入登录响应（管理端 B 端结构：
 * `data: { token, source, admin_info: { id, user_name, nick_name, mobile }, permission }`）
 *
 * ⚠️ 与 C 端的差别（v1.0.0 换契约时改，不是笔误）：
 *   · 契约对象是 `admin_info`（不是 C 端的 `user_info`），身份主键是 `admin_info.id`
 *     （C 端是 `user_info.user_id`）——**`userid` 请求头就取它**，取错会 40102/40005
 *   · 管理端**不下发 openid**（管理端是独立小程序，微信身份只用于查绑定记录）
 *   · 本地存储键名 `userinfo` 沿用不改（内部标识，改名会让旧缓存登录态失效）；
 *     整份 `admin_info` **原样存进去**（含 `role_names` 等展示字段）；
 *     若后端另有首页接口返回更新鲜的 `admin_info`，页面以接口值为准覆盖展示（存储仍以登录响应为准）
 * @param {object} resData 登录 / 绑定接口的 data 层（两个接口结构完全相同）
 */
export function writeSession(resData) {
	const data = resData || {};
	const admin = data.admin_info || {};
	setItem('source', data.source || '');
	setItem('token', data.token || '');
	setItem('userinfo', admin);
	// id 可能是数字 1：不能写 `|| ''`（0 会被吞），但它恒 ≥1，用显式判空更清楚
	setItem('user_id', admin.id === undefined || admin.id === null ? '' : admin.id);
	setItem('user_name', admin.user_name || '');
	setItem('mobile', admin.mobile || '');
	setItem('openid', '');
	// 权限点列表：首页功能入口的**显隐判据**（入口清单在 config/access.js）。
	// 恒为数组（无权限时后端不会让登录成功，会回 58004）——这里仍按数组兜底存，
	// 免得脏数据把 `permission.includes` 打成非数组异常
	setItem('permission', Array.isArray(data.permission) ? data.permission : []);
}

export function clearSession() {
	SESSION_FIELDS.forEach(name => removeItem(name));
}

export function getToken() {
	return getItem('token', '');
}

export function getUserId() {
	return getItem('user_id', '');
}

export function getOpenid() {
	return getItem('openid', '');
}

export function getUserInfo() {
	return getItem('userinfo', '') || {};
}

/**
 * 权限点列表（登录 / 绑定响应下发的 `data.permission`）。
 * ⚠️ 它是**登录时**的快照，权限变更最长 2 小时才刷新 —— 用于**显隐**可以，
 * 但**不能**当成"一定调得通"的凭据（服务端才是防线，见 config/dict.js 的 `PERM_*` 注释）
 * @returns {string[]}
 */
export function getPermission() {
	const value = getItem('permission', []);
	return Array.isArray(value) ? value : [];
}

export function isLogin() {
	return !!getToken();
}
