// ---------------------------------------------------------------------------
// 请求签名：每个请求 header 携带
//   source / timestamp / sign / random / edition / token / userid
// sign = MD5("Source=..&TimeStamp=..&Key=<apiKey>&Weight=<random>").toUpperCase()
//
// 契约真源：后端模板 internal/route/verification.go + conf.SignTemplate。
// token / userid 直接读 services/storage，不依赖 session，避免 http ↔ session 循环依赖。
//
// 联调开关（只允许在 local / develop 用，生产必须留空）：
//   · VITE_SOURCE          覆盖 source（如打后端 demo 模块时临时用 1010）
//   · VITE_DEVELOP_BYPASS  值为 `develop` 时附 develop 头，后端跳过签名校验
// ---------------------------------------------------------------------------

import md5 from 'blueimp-md5';
import { edition, source as DEFAULT_SOURCE } from '@/config/app';
import { apiKey, sourceOverride, developBypass } from '@/config/env';
import { getToken, getUserId } from '@/services/storage';

const source = sourceOverride || DEFAULT_SOURCE;

const RANDOM_CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

function randomString() {
	const length = Math.round(Math.random() * 10 + 10);
	let result = '';
	for (let i = length; i > 0; --i) {
		result += RANDOM_CHARS[Math.floor(Math.random() * RANDOM_CHARS.length)];
	}
	return result;
}

/**
 * @param {object} [options]
 * @param {string|null} [options.contentType] 覆盖 Content-Type；传 null 时不设
 *   （multipart 上传要交给小程序/浏览器自行生成 boundary）
 * @returns {Record<string, string>}
 */
export function buildSignHeader(options = {}) {
	// 秒级时间戳（与服务器时差超 300s 双向拒绝）：传毫秒会被当成时钟异常直接 40003
	const timestamp = Math.floor(Date.now() / 1000);
	const random = randomString();
	const header = {
		source,
		timestamp,
		sign: md5(`Source=${source}&TimeStamp=${timestamp}&Key=${apiKey}&Weight=${random}`).toUpperCase(),
		random,
		edition,
		// 未登录时后端会忽略这两个头；带占位值而不是空串，与原工程契约保持一致
		token: getToken() || 'token',
		userid: getUserId() || 'userid'
	};

	// 开发模式旁路：后端只在 local / develop 接受（生产被 conf.init 硬护栏禁止）
	if (developBypass) header.develop = developBypass;

	if (options.contentType === null) {
		// 交给小程序/浏览器自行生成 multipart 边界
	} else {
		header['Content-Type'] = options.contentType || 'application/x-www-form-urlencoded; charset=UTF-8';
	}
	return header;
}