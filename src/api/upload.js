// ---------------------------------------------------------------------------
// 接口层 · 管理端通用上传
//
// ★ 后端约定「管理端只建一个上传口，业务类型由 type 声明」：
//   前端固定 POST /admin/upload，multipart 字段 file + 表单字段 type。
//   新增一种上传 = 后端 conf.AdminUploadTypes 加一行 + config/dict.js 加一个常量，
//   本文件**不用改**。
// ★ 后端只返回 url；`name/type/size` 由前端在业务接口里回传（本文件不做拼装）。
// ★ 默认 `toast:false`：40205 / 60004 要由 `services/uploader.js` 按场景给文案，
//   统一 toast 会把「稍后再试」说成一句笼统的「请求失败」。
// ---------------------------------------------------------------------------

import { curl } from '@/services/http';
import { ENDPOINT_ADMIN_UPLOAD } from '@/config/endpoints';

/**
 * 上传一个文件。
 * @param {string} filePath 本地临时路径（chooseImage / chooseMessageFile / chooseFile 拿到）
 * @param {string} type 上传类型（= 后端 AdminUploadTypes 的键，见 config/dict.js 的 UPLOAD_TYPE_*）
 * @param {object} [options] 同 request 的 toast / loading 等
 * @returns {Promise<object>} 响应体，`data.urls[0]` 即后端 URL
 */
export function uploadFile(filePath, type, options = {}) {
	return curl.upload(
		{ filePath, name: 'file', formData: { type } },
		ENDPOINT_ADMIN_UPLOAD,
		{ toast: false, ...options }
	);
}

export const uploadApi = { file: uploadFile };

export default uploadApi;