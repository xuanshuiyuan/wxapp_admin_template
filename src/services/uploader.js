// ---------------------------------------------------------------------------
// 文件选择 + 上传（管理端通用）
//
// 为什么单独成 service：
//   · 选文件是**端差异最大**的一步（微信端相册 / 聊天文件、H5 文件选择器），
//     按分层约定，端差异必须收在 services，页面里禁止 #ifdef；
//   · 上传失败要按**业务码**给不同文案（40205 频控 / 60004 格式 / 40001 类型未注册），
//     这套判断不该在每个表单里各写一遍。
//
// ★ 交互口径：
//   · **图片**（`imagesOnly`）允许一次选多张，但**逐张串行上传**：
//     微信 `wx.uploadFile` 只有单 `filePath`，没有多文件参数（uni 的 `files` 在微信端
//     不生效，实测 network 失败）。撞到 40205 时等待后重试一次。
//   · **文件**（含 PDF）一次一个，避免多文件部分失败后的恢复状态。
// ★ 类型由 `type` 声明（= 后端 conf.AdminUploadTypes 的键），本层**不按业务类型写 if-else**；
//   校验与失败文案都在这里，调用方只关心「成了没有」。
// ---------------------------------------------------------------------------

import { curl, isApiError } from '@/services/http';
import { requirePrivacyAuthorize } from '@/services/platform';
import { toast } from '@/services/toast';
import { errorBrief } from '@/utils/error';
import { ENDPOINT_ADMIN_UPLOAD } from '@/config/endpoints';
import {
	CODE_PARAM_INVALID,
	CODE_UPLOAD_FORMAT_INVALID,
	CODE_UPLOAD_INVALID,
	CODE_UPLOAD_SIZE_INVALID,
	CODE_UPLOAD_TOO_FREQUENT,
	UPLOAD_ALLOWED_EXTS,
	UPLOAD_IMAGE_EXTS,
	UPLOAD_MAX_BYTES,
	uploadTypeDef
} from '@/config/dict';

/**
 * 取扩展名（小写；去掉 H5 临时路径可能带的 query）。
 * H5 的 chooseImage 可能回 `blob:` / `data:image/png;base64,…` 这类**没有文件名**的路径：
 * data URI 从 MIME 取扩展名；blob 取不到就交回空串（由 validate 按「图片来源」放行）。
 */
function extOf(nameOrPath) {
	const raw = String(nameOrPath || '');
	const data = raw.match(/^data:image\/([A-Za-z0-9.+-]+)[;,]/);
	if (data) {
		const mime = data[1].toLowerCase();
		return mime === 'jpeg' ? 'jpg' : mime;
	}
	const clean = raw.split('?')[0];
	const hit = clean.match(/\.([A-Za-z0-9]+)$/);
	return hit ? hit[1].toLowerCase() : '';
}

/** 从临时路径兜底一个文件名（部分端 chooseImage 不给 name） */
function nameOf(file) {
	if (file && file.name) return file.name;
	const clean = String((file && file.path) || '').split('?')[0];
	return clean.split('/').pop() || '';
}

/** 字节 → 「NMB」文案（只用于提示，不参与校验） */
function mbText(bytes) {
	const mb = Number(bytes) / (1024 * 1024);
	return `${Number.isInteger(mb) ? mb : mb.toFixed(1)}MB`;
}

/**
 * 校验扩展名与大小；不合法返回原因字符串，合法返回空串。
 * @param {{path?:string,name?:string,size?:number}} file
 * @param {{imagesOnly?:boolean,maxBytes?:number}} options
 */
function validate(file, options = {}) {
	const def = uploadTypeDef(options.type);
	const exts = options.imagesOnly ? UPLOAD_IMAGE_EXTS : (options.exts || def.exts);
	const maxBytes = Number(options.maxBytes) > 0 ? Number(options.maxBytes) : def.maxBytes;
	const ext = extOf(nameOf(file));
	// H5 的 chooseImage 返回 blob: 临时路径时拿不到扩展名，但**来源只可能是图片**：
	// 不能因此把一张合法照片拦成「格式不支持」（真格式由后端 60004 兜底）。
	if (!(ext === '' && options.imagesOnly) && !exts.includes(ext)) {
		return options.imagesOnly ? '只支持 jpg / jpeg / png 图片' : `只支持 ${exts.join(' / ')} 格式`;
	}
	const size = Number(file && file.size) || 0;
	// size 为 0 时不拦：个别端不返回大小，交给后端 60004 兜底
	if (size > maxBytes) return `单个文件不能超过 ${mbText(maxBytes)}`;
	return '';
}

/** 取错误文案：uni 的 fail 参数可能是对象（errMsg）也可能是字符串 */
function failMsgOf(error) {
	if (!error) return '';
	if (typeof error === 'string') return error;
	return String(error.errMsg || error.message || '');
}

/** 统一把失败转成一句能照着做的话（默认用 ApiError.message） */
function uploadErrorText(e) {
	if (isApiError(e)) {
		const code = Number(e.code);
		if (code === CODE_UPLOAD_TOO_FREQUENT) return '上传过于频繁，请稍后重试';
		if (code === CODE_UPLOAD_FORMAT_INVALID) return '文件格式不支持，请重新选择';
		if (code === CODE_UPLOAD_SIZE_INVALID) return '文件大小超出限制，请重新选择';
		if (code === CODE_UPLOAD_INVALID) return '上传失败，请重试';
		if (code === CODE_PARAM_INVALID) return '上传类型未注册，请联系技术处理';
		if (e.type === 'network') return '网络异常，文件未上传，请重试';
	}
	return (e && e.message) || '上传失败，请重试';
}

/** 微信端：相册/拍照走 chooseImage，文件（含 PDF）走 chooseMessageFile */
function pickOnMP(options = {}) {
	if (options.imagesOnly) {
		return pickImages({ ...options, count: 1 }).then((list) => list[0] || null);
	}
	return new Promise((resolve) => {
		uni.showActionSheet({
			itemList: ['从相册选择', '选择文件（含 PDF）'],
			success: (res) => {
				if (res.tapIndex === 0) {
					uni.chooseImage({
						count: 1,
						sizeType: ['compressed'],
						sourceType: ['album', 'camera'],
						success: (r) => resolve((r.tempFiles && r.tempFiles[0]) || null),
						fail: () => resolve(null)
					});
					return;
				}
				uni.chooseMessageFile({
					count: 1,
					type: 'file',
					extension: options.exts || UPLOAD_ALLOWED_EXTS,
					success: (r) => resolve((r.tempFiles && r.tempFiles[0]) || null),
					fail: () => resolve(null)
				});
			},
			// 取消 action sheet 也是正常路径
			fail: () => resolve(null)
		});
	});
}

/**
 * 隐私协议**未声明**「相册 / 摄像头」时的指引。
 * 错误原文是 `api scope is not declared in the privacy agreement`（errno 112）——
 * 只能由运营去公众平台补声明并提交审核；代码侧仅负责把话说清楚。
 */
function showPrivacyGuide() {
	const content =
		'微信提示「隐私协议未声明相册 / 摄像头」。\n请到 微信公众平台 → 设置 → 服务内容声明 → 用户隐私保护指引，' +
		'增加「相册（选择图片）」与「摄像头」用途并提交审核。\n审核生效后重新进入小程序即可，无需更新代码。';
	if (typeof uni.showModal === 'function') {
		uni.showModal({ title: '需要先配置隐私协议', content, showCancel: false, confirmText: '知道了' });
		return;
	}
	toast('请先在微信公众平台配置隐私协议（相册 / 摄像头）');
}

/** 选图数量上限：微信 chooseImage 一次最多 9 张 */
const IMAGE_PICK_MAX = 9;

function normalizeCount(count) {
	const n = Math.floor(Number(count) || 1);
	return Math.min(IMAGE_PICK_MAX, Math.max(1, n));
}

/** 调一次 chooseImage（多选由 `count` 决定），返回数组 */
function chooseImagesOnce(count) {
	return new Promise((resolve) => {
		try {
			uni.chooseImage({
				count: normalizeCount(count),
				sizeType: ['compressed'],
				sourceType: ['album', 'camera'],
				success: (r) => {
					// 有的端取消也给 success + 空数组：按取消处理（不提示）
					resolve({ files: (r.tempFiles || []).slice(), error: null });
				},
				fail: (err) => resolve({ files: [], error: err || {} })
			});
		} catch (err) {
			resolve({ files: [], error: err || {} });
		}
	});
}

/**
 * 只选图片（可能 0 张 = 取消）。
 * 不强制 cameraOnly —— 需要现场拍照时由用户在选择面板里点「拍摄」。
 */
async function pickImages(options = {}) {
	// 不在每次点击前预检隐私：已同意后预检仍可能反复弹。
	// 先直接调 chooseImage；只有真报 privacy 时，才触发一次授权并重试一次。
	let { files, error } = await chooseImagesOnce(options.count);
	let msg = failMsgOf(error);

	if (!files.length && /privacy|112/i.test(msg)) {
		const privacyErr = await requirePrivacyAuthorize();
		if (!privacyErr) {
			({ files, error } = await chooseImagesOnce(options.count));
			msg = failMsgOf(error);
		} else {
			const pmsg = failMsgOf(privacyErr);
			console.error('[uploader] 隐私授权未通过：', privacyErr);
			if (/privacy|112/i.test(pmsg)) showPrivacyGuide();
			else toast(`无法选择图片：${pmsg || '请检查相册 / 相机权限'}`);
			return [];
		}
	}

	if (files.length) return files;
	// 用户主动取消 / 空选择：正常路径，不提示
	if (!error || /cancel/i.test(msg)) return [];
	console.error('[uploader] 图片选择失败：', error);
	if (/privacy|112/i.test(msg)) {
		showPrivacyGuide();
	} else if (/auth|deny|permission/i.test(msg)) {
		toast('请在设置中开启相册 / 相机权限');
	} else {
		toast(`无法选择图片：${msg || '请重试'}`);
	}
	return [];
}

/** H5 / App：优先文件选择器（可同时选图片与 PDF）；没有该能力时退回相册 */
function pickByFileChooser(options = {}) {
	if (options.imagesOnly) {
		return pickImages({ ...options, count: 1 }).then((list) => list[0] || null);
	}
	return new Promise((resolve) => {
		if (typeof uni.chooseFile === 'function') {
			uni.chooseFile({
				count: 1,
				type: 'all',
				extension: options.exts || UPLOAD_ALLOWED_EXTS,
				success: (r) => resolve((r.tempFiles && r.tempFiles[0]) || null),
				fail: () => resolve(null)
			});
			return;
		}
		pickImages({ ...options, count: 1 }).then((list) => resolve(list[0] || null));
	});
}

/** 选一个文件（取消返回 null） */
function pickOneFile(options = {}) {
	// 用能力探测而不是判端：微信端有 chooseMessageFile，H5/App 走 chooseFile
	return typeof uni.chooseMessageFile === 'function' ? pickOnMP(options) : pickByFileChooser(options);
}

/**
 * 文件元数据（单文件 / 批量共用同一套字段口径）。
 * 合同：文件校验以 **url 真实扩展名**为准（压缩 / 改名后的本地 name 可能不准）。
 */
function fileMeta(file, url) {
	const name = nameOf(file);
	return {
		url,
		name,
		type: extOf(url) || extOf(name),
		size: Number(file.size) || 0
	};
}

/** 单文件上传并返回元数据；无 url 视为失败 */
async function uploadOne(file, type, options = {}) {
	const { loading = true, ...rest } = options;
	// 上传属于基础设施能力，直接走请求层（services 不 import api —— 见分层红线）。
	// 响应契约：`data.url`（单个）；兼容 `data.urls[]`（多图接口的写法）。
	const body = await curl.upload(
		{ filePath: file.path, name: 'file', formData: { type } },
		ENDPOINT_ADMIN_UPLOAD,
		// 批量上传传 { loading:false }：逐张弹全屏遮罩会盖住「上传中 x/y」进度
		{ toast: false, loading, ...rest }
	);
	const data = (body && body.data) || {};
	const url = data.url || (Array.isArray(data.urls) ? data.urls[0] : '');
	if (!url) throw new Error('上传成功但没有返回文件地址');
	return fileMeta(file, url);
}

/**
 * 选一个文件并上传。
 * ★ 本函数**自己 toast 失败原因**并返回 null —— 调用方只关心「成了没有」。
 *
 * @param {string} type 上传类型（`config/dict.js` 的 UPLOAD_TYPE_* = 后端 AdminUploadTypes 的键）
 * @param {object} [options]
 *   · `imagesOnly` 只收 png/jpg/jpeg（选择面板不再提供「文件」分支）
 *   · `maxBytes` 单文件上限（默认 20MB）
 * @returns {Promise<{url:string,name:string,type:string,size:number}|null>}
 */
export async function pickAndUpload(type, options = {}) {
	const def = uploadTypeDef(type);
	const opts = { ...def, ...options, type };
	const file = await pickOneFile(opts);
	if (!file) return null;

	const invalid = validate(file, opts);
	if (invalid) {
		toast(invalid);
		return null;
	}

	try {
		return await uploadOne(file, type);
	} catch (e) {
		toast(uploadErrorText(e));
		if (!(isApiError(e) && e.type === 'guard')) console.error('[uploader] 上传失败：', errorBrief(e));
		return null;
	}
}

/** 40205 重试前的等待：后端按「每分钟 30 次/管理员」限流，过渡期可能撞到旧锁 */
const RATE_LIMIT_RETRY_MS = 3200;

function wait(ms) {
	return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

/**
 * 逐张串行上传（**微信 `wx.uploadFile` 只支持单文件**）。
 * · 正常背靠背逐张传；撞到 40205 时等待 3.2s 重试一次；
 * · 某张失败：toast 原因并**保留已传成功的**；
 * · `onProgress(done,total)` 给页面显示「上传中 2/5」。
 */
async function uploadSequential(files, type, options = {}) {
	const results = [];
	const { onProgress } = options;
	for (const file of files) {
		try {
			let meta;
			try {
				meta = await uploadOne(file, type, { loading: false });
			} catch (e) {
				if (!(isApiError(e) && Number(e.code) === CODE_UPLOAD_TOO_FREQUENT)) throw e;
				await wait(RATE_LIMIT_RETRY_MS);
				meta = await uploadOne(file, type, { loading: false });
			}
			results.push(meta);
			if (typeof onProgress === 'function') onProgress(results.length, files.length);
		} catch (e) {
			toast(uploadErrorText(e));
			if (!(isApiError(e) && e.type === 'guard')) {
				console.error('[uploader] 批量上传失败：', errorBrief(e));
			}
			break;
		}
	}
	return results;
}

/**
 * 选**多张**图片并逐张串行上传（图片专用；文件类仍走 `pickAndUpload`）。
 *
 * @param {string} type `config/dict.js` 的 UPLOAD_TYPE_*
 * @param {object} [options]
 *   · `count` 本次最多选几张（剩余可传张数）
 *   · `maxBytes` 单张上限
 *   · `onProgress(done,total)` 进度回调
 * @returns {Promise<Array<{url:string,name:string,type:string,size:number}>>} 取消 / 全失败返回 []
 */
export async function pickAndUploadImages(type, options = {}) {
	const def = uploadTypeDef(type);
	const opts = { ...def, ...options, type, imagesOnly: true };
	const picked = await pickImages(opts);
	if (!picked.length) return [];

	// 逐张校验：一张不合规不连累其它张
	const valid = [];
	let firstInvalid = '';
	for (const file of picked) {
		const invalid = validate(file, opts);
		if (invalid) {
			if (!firstInvalid) firstInvalid = invalid;
			continue;
		}
		valid.push(file);
	}
	if (firstInvalid) toast(firstInvalid);
	if (!valid.length) return [];

	// 只选一张：走原单文件通路（带全局 loading）
	if (valid.length === 1) {
		try {
			return [await uploadOne(valid[0], type)];
		} catch (e) {
			toast(uploadErrorText(e));
			if (!(isApiError(e) && e.type === 'guard')) console.error('[uploader] 上传失败：', errorBrief(e));
			return [];
		}
	}
	return uploadSequential(valid, type, options);
}

export default pickAndUpload;