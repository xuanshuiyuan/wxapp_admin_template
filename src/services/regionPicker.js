// ---------------------------------------------------------------------------
// 省 / 市 / 区选择页的跨页协作：打开选择页 + 结果回传。
//
// ★ 2026-11-10（v1.2.0）从 C 端移植：与 `services/fieldEditor.js` 同一座桥
//   （`services/pickPage` 的全局事件 + Promise）。页面在 `pages/common/region-picker`，
//   区划表在 `config/region-code.js`。
// ★ 为什么是**跳页**而不是弹层：与字段编辑页同一条用户口径（2026-10-30）——
//   输入类交互整页承载，键盘 / 滚动列不与页面抢高度。三级联动在弹层里只露半屏。
// ★ 区码口径：若你的后端要求 `district_code` 为 6 位，注意区划表里东莞 / 中山 / 儋州 /
//   嘉峪关的区级是 9 位镇街码 —— 选择页会把这类区码**收起第三列、区级回城市本身**
//   （归一化在页面里做，见其文件头）。后端只用名称、不限位数时可以忽略。
// ---------------------------------------------------------------------------

import { openPickPage, emitPickResult } from '@/services/pickPage';
import { PAGE_REGION_PICKER } from '@/services/route';

/** 选择页回传结果的事件名（全局唯一，勿改） */
const REGION_PICKER_RESULT = 'region-picker:result';

/**
 * 打开省 / 市 / 区选择页，等用户确认或放弃。
 * @param {object} [current] 已选值
 *   `{ province, city, district, province_code, city_code, district_code }`
 *   （名称用全称；code 优先用于回显定位）
 * @param {'province'|'city'|'district'} [level='district'] 选到哪一级
 *   —— 所在地传 `district`；业务城市传 `city`（契约「只到市」）
 * @returns {Promise<object|null>} 确认时回传
 *   `{ level, actual_level, province, province_code, city, city_code, district, district_code }`；
 *   放弃 / 跳转失败返回 null
 */
export function pickRegion(current = {}, level = 'district') {
	return openPickPage(REGION_PICKER_RESULT, PAGE_REGION_PICKER, {
		level,
		province: current.province || '',
		city: current.city || '',
		district: current.district || '',
		province_code: current.province_code || '',
		city_code: current.city_code || '',
		district_code: current.district_code || ''
	});
}

/** 选择页 onConfirm / onUnload 调用：回传结果（`{ ok:false }` = 放弃） */
export function emitRegionResult(payload) {
	emitPickResult(REGION_PICKER_RESULT, payload);
}

export default pickRegion;