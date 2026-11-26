// ---------------------------------------------------------------------------
// 通用字段编辑页的跨页协作：打开编辑页 + 结果回传。
//
// 用户 2026-10-30 定：**所有 input 点击都跳新页面编辑**（参照 C 端电池回收表单的
// `packages/common/field-editor`）。为什么单独成页而不是页内 input：
// 键盘弹层在各机型的遮挡与高度表现不一，整页承载控件最稳，也不会与列表抢高度。
//
// 机制复用 `services/pickPage`（与地区选择同一座桥）：编辑页确认/放弃各回传一次，
// 调用方拿到的是 Promise，页面里 `const v = await editField(...)` 即可。
// ⚠️ 判据必须是 `v !== null`（不是 truthy）：`null` = 用户放弃（保持原值），
//    `''` = 用户确认了空值（选填字段要能真的清空）。
// ---------------------------------------------------------------------------

import { openPickPage, emitPickResult } from '@/services/pickPage';
import { PAGE_FIELD_EDITOR } from '@/services/route';

/** 编辑页回传结果的事件名（全局唯一，勿改） */
const FIELD_EDITOR_EVENT = 'field-editor:result';

/**
 * 待编辑的当前值：**走模块内存，不放进 URL**。
 * 手机号 / 密码这类敏感值进了 query 就会落进页面栈与 H5 路由；本桥一次只开一页（pickPage 在飞判重），
 * 故模块级一个变量足够。编辑页 onLoad 用 `consumeFieldValue()` 取走并清空。
 */
let pendingValue = '';

/** 编辑页 onLoad 调用：取走并清空待编辑值（取一次就清，避免下次编辑串值） */
export function consumeFieldValue() {
	const value = pendingValue;
	pendingValue = '';
	return value;
}

/**
 * @param {object} options
 * @param {string} options.title 页面标题（也是必填校验的文案：「请填写 ×××」）
 * @param {string} [options.value] 当前值（回显）
 * @param {string} [options.placeholder] 占位文案
 * @param {'text'|'textarea'|'password'|'number'|'phone'|'decimal'} [options.type='text'] 控件类型
 *   `number` = 整数数字键盘；`decimal` = **带小数点**的数字键盘（金额 / 小数输入用）
 * @param {number} [options.maxlength=64] 最大长度
 * @param {boolean} [options.optional=false] 是否允许空值（选填字段）
 * @returns {Promise<string|null>} 确认返回新值（可能为空串）；放弃 / 打开失败返回 null
 */
export function editField(options = {}) {
	const {
		title = '编辑',
		value = '',
		placeholder = '',
		type = 'text',
		maxlength = 64,
		optional = false
	} = options;
	// 当前值走内存（见 pendingValue 注释），query 只放非敏感的控件参数
	pendingValue = String(value || '');
	return openPickPage(FIELD_EDITOR_EVENT, PAGE_FIELD_EDITOR, {
		title,
		placeholder,
		type,
		maxlength,
		optional: optional ? '1' : '0'
	});
}

/**
 * 编辑页回传结果（确认 / 放弃各调一次）
 * @param {{ok: boolean, value?: string}} payload
 */
export function emitFieldResult(payload) {
	emitPickResult(FIELD_EDITOR_EVENT, payload);
}

export default editField;