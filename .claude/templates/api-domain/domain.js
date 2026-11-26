// ---------------------------------------------------------------------------
// __DOMAIN__ 业务域接口层。
//
// 职责边界：本文件只做「业务域名词 → HTTP」的映射（参数整形 + 调用 + 返回）。
//   · 业务规则不写在这里 → 归 services/（backend_service）
//   · 路径不写在这里 → 全部登记在 src/config/endpoints.js
//   · 失败统一抛 ApiError（services/http/error.js），curl 默认已自动 toast
//
// 用法：
//   import { __DOMAIN__Api } from '@/api';
//   const body = await __DOMAIN__Api.__LIST__({ page: 1, page_size: 20 });
//
// ⚠️ 接入前必做：
//   1. 先在本文件对应的 URL 登记到 src/config/endpoints.js（见文件头注释的顺序）
//   2. 在 src/api/index.js 加一行 export
//   3. 确认契约（路径 / 入参 / 响应 / 错误码 / 闸口类型）—— 不确定必须问后端，禁止臆造
// ---------------------------------------------------------------------------

import { curl } from '@/services/http';
import {
	// TODO: 换成真实的 ENDPOINT 常量（先在 src/config/endpoints.js 登记）
	// ENDPOINT___DOMAIN_____LIST__,
	// ENDPOINT___DOMAIN_____DETAIL__,
} from '@/config/endpoints';

export const __DOMAIN__Api = {
	/**
	 * __DOMAIN__ 列表（分页）
	 *
	 * 分页契约：query 传 page / page_size，响应 data 为 { list, total, page, page_size }
	 * —— 与 composables/useList 的 defaultPick 零配置吻合，页面可直接 useList(this.__LIST__)。
	 *
	 * @param {object} query
	 * @param {number} query.page 页码（从 1 开始）
	 * @param {number} [query.page_size=20] 每页条数
	 * @param {string} [query.keyword] 关键词（可选）
	 * @param {object} [options] 透传给请求层
	 * @returns {Promise<{code:number, msg:string, data:{list:Array, total:number}}>}
	 */
	__LIST__(query = {}, options = {}) {
		// 默认不弹 toast：列表页失败有自己的四态编排（app-list-state），
		// 全局 toast 会与「失败重试」按钮重复提示。
		// 调用方可传 { toast: true } 覆盖。
		return curl.get(ENDPOINT___DOMAIN_____LIST__, query, { toast: false, ...options });
	},

	/**
	 * __DOMAIN__ 详情
	 *
	 * @param {object} params
	 * @param {string|number} params.id 主键
	 * @param {object} [options] 透传给请求层
	 * @returns {Promise<object>} 响应体，data 为详情对象
	 */
	__DETAIL__(params = {}, options = {}) {
		// 同样默认静默：详情页的失败由页面渲染错误态 + 重试按钮，不弹 toast
		return curl.get(ENDPOINT___DOMAIN_____DETAIL__, params, { toast: false, ...options });
	},

	/**
	 * __DOMAIN__ 提交（表单）
	 *
	 * ⚠️ 按钮点击链路必须传 { loading: true }：双保险
	 *    （请求层托管 loading + 页内 app-loading + 按钮 in-flight 三件齐）。
	 *    本方法默认就带上 loading:true，因为提交必然源于用户点击。
	 *
	 * ⚠️ 准入形态（公开 / 仅需登录态 / 需权限点）**必须问后端**，前端不许猜：
	 *    · 「需权限点」的接口**一律不加前置检查**（权限点是登录快照，会过期）——
	 *      改为要求调用方**处理 40102**（就地提示 / 置灰 / 无权限空态，不自动重试）
	 *    · 「仅需登录态」的接口由请求层自动补会话 + 40005 自动重登重放，页面零代码
	 *    ⚠️ 本模板没有「未绑手机号」这类硬闸口；账号态一律按登录响应与业务码处理。
	 *
	 * @param {object} data 表单数据
	 * @param {object} [options] 透传给请求层
	 * @returns {Promise<object>} 响应体
	 */
	__SUBMIT__(data = {}, options = {}) {
		// 后端历史接口默认 x-www-form-urlencoded；若该接口是 JSON，改用 curl.postJSON
		return curl.post(ENDPOINT___DOMAIN_____SUBMIT__, data, { loading: true, ...options });
	}
};

// ---------------------------------------------------------------------------
// 备注（模板自带的提醒，接入后删除本段）
//
// · 若某接口是 JSON 格式 → curl.postJSON(url, data, options)
// · 若某接口是文件上传 → curl.upload({ filePath, name, formData }, url, options)
//   （默认落点 ENDPOINT_ADMIN_UPLOAD，可传第二参覆盖）
// · 若该域是「守卫目标页自己的接口」→ 必须传 { guard: false }
//   否则守卫弹框会与页面自身逻辑打架
// · 若该域是「失败即隐藏的装饰位模块」→ 必须传 { guard: false }
//   它有能力弹阻断框，不该有
// · 若引入新错误码 → config/dict.js 加常量；再判断是否进 services/guards.js
// · 第三方完整 http(s) 地址不放 endpoints.js，就近写在调用处并注明原因
// ---------------------------------------------------------------------------