// ---------------------------------------------------------------------------
// http 层唯一出口：api/ 里只 import 这个文件。
//
// ★ 请求结构统一约定（全工程只允许这三条形态；2026-11-26 定版 = **表单，不是 JSON**）：
//   · 读接口        curl.get(url, params)      → GET + query（数组一律逗号串）
//   · 业务写 / 查询 curl.post(url, data)       → POST + application/x-www-form-urlencoded
//   · 文件上传      curl.upload(payload, url)  → POST + multipart/form-data（一次一个文件）
//   · 响应统一      { code, msg, data }，code=0 成功；非该结构一律抛 ApiError
//                   （第三方接口在 api 层显式传 `{ rawResponse: true }`，不进入统一校验）
//   ❌ 不提供 postJSON：后端表单解码器是统一口径，JSON 请求体只会制造第二种结构。
// ---------------------------------------------------------------------------

import { request, registerAuthHandler, DEFAULT_TIMEOUT, TRANSPORT_UPLOAD } from './request';
import { toQueryString } from '@/utils/qs';
import { ENDPOINT_ADMIN_UPLOAD } from '@/config/endpoints';

export { request, registerAuthHandler, DEFAULT_TIMEOUT, TRANSPORT_UPLOAD };
export { registerCodeGuard } from './guard';
export { ApiError, ERROR_TYPE, isApiError, toApiError, errorTip } from './error';

/**
 * 成功返回响应体 { code, msg, data }；失败抛 ApiError（默认自动 toast 提示）
 * 常用 options：{ toast:false } 静默、{ loading:true } 托管加载态
 */
export const curl = {
	/** GET：data 作为 query 参数 */
	get(url, params, options = {}) {
		return request({ url, method: 'GET', params, ...options });
	},

	/** POST：表单格式 */
	post(url, data, options = {}) {
		return request({
			url,
			method: 'POST',
			data: toQueryString(data || {}),
			contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
			...options
		});
	},

	/**
	 * 文件上传（multipart）
	 *
	 * ⚠️ **一次只能传一个文件**：微信 `wx.uploadFile` 只有单 `filePath`，
	 * 没有多文件参数（uni 文档里的 `files` 在微信端不生效，实测报 network 失败）。
	 * 多张图片由 `services/uploader.js` 逐张串行上传。
	 *
	 * @param {object} payload
	 * @param {string} payload.filePath 本地临时路径（uni.chooseImage 等拿到）
	 * @param {string} [payload.name='file'] 文件字段名
	 * @param {object} [payload.formData] 随文件提交的普通字段
	 * @param {string} [url] 上传地址，默认后端通用上传口
	 * @param {object} [options] 同 request 的 toast / loading 等
	 */
	upload({ filePath, name = 'file', formData = {} }, url = ENDPOINT_ADMIN_UPLOAD, options = {}) {
		return request({ transport: TRANSPORT_UPLOAD, url, method: 'POST', filePath, name, formData, ...options });
	}
};

export default curl;
