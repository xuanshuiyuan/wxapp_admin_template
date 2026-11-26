// ---------------------------------------------------------------------------
// 多端差异适配层。页面里禁止出现 #ifdef —— 需要区分端时调这里。
// 端**判定**在 config/runtime.js（唯一条件编译点），本文件只做能力分档与实现。
// 当前保证 微信小程序 / H5 / App 三端，其余小程序端按 mp 分支处理。
//
// 只保留通用能力（布局 / 滚动锁 / 拨号 / 复制 / 文档预览 / 相机 / 扫码 / 版本更新 /
// 画布导出）。业务性的端能力（地图、客服会话、横屏签名等）按需在新项目里另加函数。
// ---------------------------------------------------------------------------

import { withLoading, toast } from '@/services/toast';
import { rootPath, mockLoginCode } from '@/config/env';
// 端判定只有一处（config/runtime.js）；本文件只做「端能力分档」
import { RUNTIME, isMP, isH5, isApp } from '@/config/runtime';

export { RUNTIME, isMP, isH5, isApp };

/**
 * 取一次登录凭证 code —— 端差异的**唯一**收口处。
 *   微信小程序：`uni.login` 换一次性 code（重复消费后端回 60003，调用方需换新 code 重试）；
 *   其余端    ：用 `.env` 的联调 mock code（生产留空，env.js 有启动硬护栏）。
 * 失败（未配置 mock code / uni.login 失败）直接 reject，由调用方决定提示。
 * @returns {Promise<string>}
 */
export function getLoginCode() {
	return new Promise((resolve, reject) => {
		// #ifdef MP-WEIXIN
		uni.login({
			provider: 'weixin',
			success: (res) => resolve(res.code),
			fail: reject
		});
		return;
		// #endif
		// #ifndef MP-WEIXIN
		// 非微信端拿不到真 code，只能走联调通道；未配置时**明确报错**而不是拿假身份进入
		if (!mockLoginCode) {
			reject(new Error('非微信端未配置 VITE_MOCK_LOGIN_CODE（见 .env.development 注释）'));
			return;
		}
		resolve(mockLoginCode);
		// #endif
	});
}

let layout = null;

/**
 * 布局尺寸（进程内算一次就缓存）
 * @returns {{
 *   statusBarHeight: number, // 状态栏高度，H5 恒为 0
 *   navBarHeight: number,    // 自定义导航栏内容区高度
 *   customBarHeight: number, // 状态栏 + 导航栏总高，页面内容顶部要让出这个值
 *   capsuleReserve: number,  // 自绘顶栏右侧要给微信胶囊让出的宽度（px），非微信端恒为 0
 *   tabBarOverlay: number,   // tabBar 页内覆盖高度（px）
 *   safeBottom: number,      // 底部安全区，H5 恒为 0
 *   isNotch: boolean,
 *   windowWidth: number,
 *   windowHeight: number
 * }}
 */
export function getLayout() {
	if (layout) return layout;

	// uni.getSystemInfoSync 已废弃，改用拆分的新 API 合并
	let info = {};
	try {
		info = { ...uni.getDeviceInfo(), ...uni.getWindowInfo(), ...uni.getAppBaseInfo() };
		// isIphoneX 不在新 API 中，从 safeAreaInsets 推导
		if (info.isIphoneX === undefined) {
			info.isIphoneX = (info.safeAreaInsets?.bottom || 0) > 0 && info.platform === 'ios';
		}
	} catch (e) {
		info = uni.getSystemInfoSync() || {};
	}
	const statusBarHeight = isH5 ? 0 : info.statusBarHeight || 0;
	const insets = info.safeAreaInsets || {};

	let navBarHeight = 44;
	let capsuleReserve = 0;
	// #ifdef MP-WEIXIN
	// 小程序按胶囊按钮上下留白对称来算导航栏高度，才能与其他小程序原生页视觉一致
	const capsule = typeof uni.getMenuButtonBoundingClientRect === 'function' ? uni.getMenuButtonBoundingClientRect() : null;
	if (capsule && capsule.top) {
		navBarHeight = (capsule.top - statusBarHeight) * 2 + (capsule.height || 32);
		// 自绘顶栏右侧内容不能钻到原生胶囊底下
		capsuleReserve = (info.windowWidth || 375) - capsule.left + 8;
	}
	// #endif

	const safeBottom = isH5 ? 0 : insets.bottom || 0;

	layout = {
		statusBarHeight,
		navBarHeight,
		customBarHeight: statusBarHeight + navBarHeight,
		capsuleReserve,
		// H5/App 的 tabBar 是 webview 内 fixed 浮层（约 50px），盖在页面底部；MP 为原生栏不占 webview
		tabBarOverlay: isH5 || isApp ? 50 : 0,
		safeBottom,
		isNotch: (insets.bottom || 0) > 0 || info.isIphoneX || false,
		windowWidth: info.windowWidth || 375,
		windowHeight: info.windowHeight || 0,
		platform: info.platform || ''
	};
	return layout;
}

// ---------------------------------------------------------------------------
// 全屏浮层锁滚（app-modal / app-loading 打开时调）：
// 小程序 / App 端浮层根节点 @touchmove.stop.prevent 已挡住触摸滚动，这里空转；
// H5 桌面端鼠标滚轮 / 方向键直接滚 body，touchmove 拦不住 → 锁 body 溢出。
// 引用计数：弹窗 + loading 同时打开时各占一票，最后一票释放才真正解锁。
// ---------------------------------------------------------------------------
let scrollLockCount = 0;

export function lockPageScroll() {
	// #ifdef H5
	scrollLockCount += 1;
	document.body.style.overflow = 'hidden';
	const pageBody = document.querySelector('uni-page-body');
	if (pageBody) pageBody.style.overflow = 'hidden';
	// #endif
}

export function unlockPageScroll() {
	// #ifdef H5
	scrollLockCount = Math.max(0, scrollLockCount - 1);
	if (scrollLockCount === 0) {
		document.body.style.overflow = '';
		const pageBody = document.querySelector('uni-page-body');
		if (pageBody) pageBody.style.overflow = '';
	}
	// #endif
}

/**
 * 拨打电话：uni.makePhoneCall 三端行为一致（H5 走 tel: 协议）。
 * 用户取消拨号也走 fail，属正常路径只留日志。
 * @param {string} phoneNumber 号码字符串，拨打前剔除连字符等非拨号字符
 */
export function callPhone(phoneNumber) {
	const tel = String(phoneNumber || '').replace(/[^\d+\-*#]/g, '');
	if (!tel) return;
	uni.makePhoneCall({
		phoneNumber: tel,
		fail: err => console.warn('[callPhone] 取消或拨号失败：', err)
	});
}

/**
 * 短促轻震（微信 type:'light' 需基础库 ≥2.2.3；H5 静默跳过）。
 * 失败不打日志：震动属可选反馈，拿不到不算异常。
 */
export function vibrateLight() {
	if (isH5) return;
	uni.vibrateShort({ type: 'light', fail: () => {} });
}

/**
 * 复制文本到剪贴板。失败必须说出来：静默失败会让用户以为已经复制了。
 * ⚠️ 微信端 setClipboardData 自带「内容已复制」系统弹层，文案取「已复制」避免重复表述。
 * @param {string} text 要复制的内容；空值直接忽略
 */
export function copyText(text) {
	const data = String(text || '');
	if (!data) return;
	uni.setClipboardData({
		data,
		success: () => toast('已复制'),
		fail: (err) => {
			// 微信端最常见的是「隐私协议未声明 / 未授权剪切板」（errno=112）
			console.error('[copyText] 剪贴板写入失败：', err && (err.errMsg || err.errno || err));
			toast('复制失败，请长按手动选择');
		}
	});
}

// ---------------------------------------------------------------------------
// 打开在线文档（PDF / Office）：三端打开方式不同，收在本层。
// 小程序 / App：downloadFile 落地 + openDocument；H5：新窗口直开。
// ---------------------------------------------------------------------------
const DOC_FILE_TYPES = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];

/** 日志只留路径，不带签名 query（签名 URL 等价临时凭证） */
function safeDocUrl(url) {
	return String(url || '').split('?')[0];
}

/**
 * 补全 API 域名：后端常返回 `/v2/webview/...` 相对路径，下载 / 预览需要绝对地址；
 * 已是 http(s) 的 OSS / 资源域 URL 原样返回。
 */
function absoluteUrl(url) {
	const s = String(url || '');
	if (!s) return '';
	if (/^https?:\/\//i.test(s)) return s;
	const base = String(rootPath || '').replace(/\/+$/, '');
	return base ? `${base}${s.startsWith('/') ? '' : '/'}${s}` : s;
}

/**
 * 打开在线文档。
 * @param {string} url 文档地址（绝对地址，或 `/v2/...` 相对路径）
 * @param {string} [fileTypeHint] 无扩展名时显式指定文档类型（如 webview 流式 PDF 传 'pdf'）
 * @returns {Promise<void>} 失败 reject，由调用方 toast 兜底
 */
export function openDocument(url, fileTypeHint = '') {
	const target = absoluteUrl(url);
	if (!target) return Promise.reject(new Error('文档地址为空'));
	const ext = String(target).split('?')[0].split('.').pop().toLowerCase();
	const fileType = fileTypeHint || (DOC_FILE_TYPES.includes(ext) ? ext : '');

	// #ifdef H5
	const win = window.open(target);
	if (!win) return Promise.reject(new Error('新窗口被浏览器拦截'));
	return Promise.resolve();
	// #endif

	// #ifndef H5
	return withLoading(
		() =>
			new Promise((resolve, reject) => {
				uni.downloadFile({
					url: target,
					success: (res) => {
						if (res.statusCode !== 200) {
							console.error('[openDocument] 下载失败：', safeDocUrl(target), res.statusCode);
							reject(new Error(`下载失败（${res.statusCode}）`));
							return;
						}
						uni.openDocument({
							filePath: res.tempFilePath,
							// 临时文件名没有扩展名时微信靠 fileType 识别文档类型
							fileType: fileType || undefined,
							showMenu: true,
							success: () => resolve(),
							fail: (err) => {
								console.error('[openDocument] 预览失败：', safeDocUrl(target), err);
								reject(err);
							}
						});
					},
					fail: (err) => {
						// 最常见：downloadFile 合法域名未配（errMsg 含 "url not in domain list"）
						console.error('[openDocument] 下载失败：', safeDocUrl(target), err);
						reject(err);
					}
				});
			}),
		'正在打开文档'
	);
	// #endif
}

/**
 * 打开一个「可能是图片、也可能是文档」的附件。
 * 判据只看 URL 路径扩展名（签名 query 会被去掉）：
 *   · png/jpg/jpeg/gif/webp → uni.previewImage（可双指放大左右滑）
 *   · 其它 → openDocument
 * @param {string} url 相对路径或绝对 URL
 * @returns {Promise<void>} 失败 reject
 */
export function openAttachment(url) {
	if (!url) return Promise.reject(new Error('附件地址为空'));
	const target = absoluteUrl(url);
	const ext = String(target).split('?')[0].split('.').pop().toLowerCase();
	if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
		return new Promise((resolve, reject) => {
			uni.previewImage({ urls: [target], current: target, success: () => resolve(), fail: reject });
		});
	}
	return openDocument(target);
}

// ---------------------------------------------------------------------------
// 点分版本号比较：按 target 的段数逐段比，缺段补 0，全等视为满足
// ---------------------------------------------------------------------------
function versionGte(current, target) {
	const cur = String(current || '0').split('.').map(Number);
	const need = String(target || '0').split('.').map(Number);
	for (let i = 0; i < need.length; i++) {
		const a = cur[i] || 0;
		const b = need[i] || 0;
		if (a > b) return true;
		if (a < b) return false;
	}
	return true;
}

/**
 * 系统/微信版本号比较，用于「低版本走降级方案」
 * @param {string} target 如 '14.05'
 */
export function systemVersionGte(target) {
	let info = {};
	try {
		info = { ...uni.getDeviceInfo(), ...uni.getWindowInfo(), ...uni.getAppBaseInfo() };
	} catch (e) {
		info = uni.getSystemInfoSync() || {};
	}
	return versionGte(info.version, target);
}

/**
 * 相机授权（scope.camera）：先显式要权限再挂相机，
 * 免得 camera 组件自己弹框、被拒后页面没有引导位。
 * @returns {Promise<boolean>} true = 已授权；false = 被拒
 */
export function authorizeCamera() {
	return new Promise((resolve) => {
		uni.authorize({
			scope: 'scope.camera',
			success: () => resolve(true),
			fail: () => resolve(false)
		});
	});
}

/**
 * 系统全屏扫一扫。用户取消属正常操作，回空串 —— 调用方只在非空时改状态。
 * @returns {Promise<string>} 码文，取消/失败为 ''
 */
export function scanCodeSystem() {
	return new Promise((resolve) => {
		uni.scanCode({
			scanType: ['barCode', 'qrCode'],
			success: (res) => resolve(String((res && res.result) || '')),
			fail: () => resolve('')
		});
	});
}

/**
 * 画布 → **裸 base64**（无 `data:image/...;base64,` 前缀）。
 * 三端导出路径完全不同；页面与组件里写 #ifdef 会把端差异散出去。
 * ⚠️ 画布必须是**旧版 `canvas-id`**（uni.createCanvasContext 那套）。
 * @param {string} canvasId 画布 id / canvas-id
 * @param {object} [instance] 组件实例（组件内调用时传 getCurrentInstance().proxy）
 * @returns {Promise<string>} 裸 base64；失败 reject
 */
export function canvasToBase64(canvasId, instance) {
	return new Promise((resolve, reject) => {
		uni.canvasToTempFilePath(
			{
				canvasId,
				fileType: 'png',
				quality: 1,
				success: (res) => {
					const path = String((res && res.tempFilePath) || '');
					if (!path) {
						reject(new Error('导出内容为空'));
						return;
					}
					// #ifdef H5
					if (path.indexOf('data:') === 0) {
						resolve(path.slice(path.indexOf(',') + 1));
						return;
					}
					fetch(path)
						.then((r) => r.blob())
						.then((blob) => {
							const reader = new FileReader();
							reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
							reader.onerror = reject;
							reader.readAsDataURL(blob);
						})
						.catch(reject);
					return;
					// #endif

					// #ifdef MP-WEIXIN
					uni.getFileSystemManager().readFile({
						filePath: path,
						encoding: 'base64',
						success: (r) => resolve(r.data),
						fail: reject
					});
					return;
					// #endif

					// #ifdef APP-PLUS
					plus.io.resolveLocalFileSystemURL(
						path,
						(entry) => {
							entry.file((file) => {
								const reader = new plus.io.FileReader();
								reader.onloadend = (e) => {
									const s = String((e && e.target && e.target.result) || '');
									resolve(s.slice(s.indexOf(',') + 1));
								};
								reader.onerror = reject;
								reader.readAsDataURL(file);
							}, reject);
						},
						reject
					);
					return;
					// #endif
				},
				fail: reject
			},
			instance
		);
	});
}

// ---------------------------------------------------------------------------
// 小程序版本更新（启动时监听一次）。
// H5 刷新页面即是最新、App 走商店/热更新，两者连这个 API 都没有 —— 端差异收在本层。
// ⚠️ 必须在**启动早期**注册：微信冷启动后异步检查并下载新版，晚注册可能错过回调。
// ---------------------------------------------------------------------------
let updateManager = null;
let updateWatchStarted = false;

/**
 * 监听小程序新版本（仅微信小程序生效；其余端直接返回，调用方无需判端）。
 * @param {{ onReady?: Function, onFailed?: Function }} handlers
 */
export function watchMiniProgramUpdate({ onReady, onFailed } = {}) {
	// #ifdef MP-WEIXIN
	if (updateWatchStarted) return;
	if (typeof uni.getUpdateManager !== 'function') return;
	updateWatchStarted = true;
	updateManager = uni.getUpdateManager();
	updateManager.onUpdateReady(() => {
		if (typeof onReady === 'function') onReady();
	});
	updateManager.onUpdateFailed(() => {
		console.warn('[update] 小程序新版本下载失败，将在下次启动重试');
		if (typeof onFailed === 'function') onFailed();
	});
	// #endif
}

/**
 * 应用已下载的新版本并重启小程序。只在用户确认重启后调用；非微信端静默空转。
 */
export function applyMiniProgramUpdate() {
	// #ifdef MP-WEIXIN
	if (updateManager) updateManager.applyUpdate();
	// #endif
}