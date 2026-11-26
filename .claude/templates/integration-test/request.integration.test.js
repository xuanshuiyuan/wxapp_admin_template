// ---------------------------------------------------------------------------
// 请求链路集成测试模板（vitest 风格）。
//
// 测什么：src/services/http/request.js 的六段策略 ——
//   补会话 → 签名注入 → HTTP 状态 → 业务码 → 40005 重登重放 → 全局守卫 → 错误归一
//
// 怎么测：mock 掉【边界】—— 即 transport.js 的 send 与 uni 全局对象。
//   ★ mock 边界，不 mock 被测模块自身（否则测的是 mock，不是代码）。
//
// ⚠️ 使用前：
//   1. 需用户授权： npm i -D vitest
//   2. 执行测试同样需用户授权（.claude/rules/testing.md 第一条）
//   3. 本项目【没有】现成的测试基建，本模板给你一个可用的起点
//
// ⚠️ 本模板【无法】覆盖的（必须走手工清单，见 README）：
//   真机签名、wx.login 链路、守卫 busy 去重时序、多端差异、MP 端弹层是否被挤压
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// ★ 必须在 import 被测模块【之前】建立 uni 全局与 mock ——
//   request.js 在模块加载期就会读 config/env、dict、storage，
//   这些模块可能触碰 uni 全局。用 vi.hoisted 保证提升顺序。
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
	sendMock: vi.fn(),
	showLoadingMock: vi.fn(),
	hideLoadingMock: vi.fn()
}));

vi.mock('@/services/http/transport', () => ({
	send: mocks.sendMock,
	TRANSPORT_REQUEST: 'request',
	TRANSPORT_UPLOAD: 'upload'
}));

vi.mock('@/services/toast', () => ({
	default: {
		showLoading: mocks.showLoadingMock,
		hideLoading: mocks.hideLoadingMock,
		toast: vi.fn()
	}
}));

// uni 全局（服务层会用到 getStorageSync 等）
globalThis.uni = {
	getStorageSync: vi.fn(() => ''),
	setStorageSync: vi.fn(),
	removeStorageSync: vi.fn(),
	stopPullDownRefresh: vi.fn()
};

// 被测模块（在 mock 建立之后导入）
import { request, registerAuthHandler, DEFAULT_TIMEOUT } from '@/services/http/request';
import { ApiError, ERROR_TYPE } from '@/services/http/error';
import { registerCodeGuard } from '@/services/http/guard';

// 一次成功响应的最小形态
const okResponse = (data = {}, code = 0) => ({
	statusCode: 200,
	data: { code, msg: 'ok', data }
});

beforeEach(() => {
	vi.clearAllMocks();
	mocks.sendMock.mockResolvedValue(okResponse());
});

afterEach(() => {
	vi.useRealTimers();
});

// ===========================================================================
// 第 1 段：成功路径与「无 code 视为成功」
// ===========================================================================
describe('request：成功路径', () => {
	it('code === 0 → 返回响应体', async () => {
		mocks.sendMock.mockResolvedValue(okResponse({ id: 1 }));
		const body = await request({ url: 'x/y' });
		expect(body.code).toBe(0);
		expect(body.data).toEqual({ id: 1 });
	});

	// ★ 兼容性行为：不返回统一包装结构的接口（如第三方地址）应视为成功，
	//   否则这类接口永远抛错。这条分支不测，改动时会静默破坏第三方对接。
	it('无 code 字段 → 视为成功，直接返回 body', async () => {
		mocks.sendMock.mockResolvedValue({ statusCode: 200, data: { anything: 1 } });
		const body = await request({ url: 'x/y' });
		expect(body).toEqual({ anything: 1 });
	});

	// 后端可能返回字符串 '0' —— request.js 用 Number() 归一后比较
	it('code 是字符串 "0" → 同样视为成功', async () => {
		mocks.sendMock.mockResolvedValue({ statusCode: 200, data: { code: '0', data: {} } });
		const body = await request({ url: 'x/y' });
		expect(body.code).toBe('0');
	});
});

// ===========================================================================
// 第 2 段：失败路径归一 —— 每种 ApiError.type 一条
// ===========================================================================
describe('request：失败归一为 ApiError', () => {
	it('transport 抛错 → ApiError(type=network)', async () => {
		mocks.sendMock.mockRejectedValue(new Error('timeout'));
		await expect(request({ url: 'x/y', toast: false })).rejects.toMatchObject({
			isApiError: true,
			type: ERROR_TYPE.network
		});
	});

	it('HTTP 500 → ApiError(type=http) 且带状态码', async () => {
		mocks.sendMock.mockResolvedValue({ statusCode: 500, data: {} });
		await expect(request({ url: 'x/y', toast: false })).rejects.toMatchObject({
			type: ERROR_TYPE.http,
			status: 500
		});
	});

	it('业务码非 0 → ApiError(type=business) 且带业务码', async () => {
		mocks.sendMock.mockResolvedValue(okResponse(null, 51001));
		await expect(request({ url: 'x/y', toast: false })).rejects.toMatchObject({
			type: ERROR_TYPE.business,
			code: 51001
		});
	});

	it('HTTP 3xx 也算失败（只接受 2xx）', async () => {
		mocks.sendMock.mockResolvedValue({ statusCode: 302, data: {} });
		await expect(request({ url: 'x/y', toast: false })).rejects.toMatchObject({
			type: ERROR_TYPE.http
		});
	});
});

// ===========================================================================
// 第 3 段：40005 重登重放（★ 本项目最关键、也最容易改坏的机制）
// ===========================================================================
describe('request：40005 登录失效 → 静默重登并重放', () => {
	it('重登成功 → 重放原请求，返回重放结果', async () => {
		const authHandler = vi.fn().mockResolvedValue(true);
		registerAuthHandler(authHandler);

		// 第一次 40005，重放后成功
		mocks.sendMock
			.mockResolvedValueOnce(okResponse(null, 40005))
			.mockResolvedValueOnce(okResponse({ id: 9 }));

		const body = await request({ url: 'x/y', toast: false });
		expect(authHandler).toHaveBeenCalled();
		expect(body.data).toEqual({ id: 9 });
		expect(mocks.sendMock).toHaveBeenCalledTimes(2);
	});

	// ★ 只重放一次 —— 若重放也回 40005，必须抛 auth 而不是无限重放。
	//   这条不测，改错会导致请求风暴（真机上表现为一直转圈 + 后端被打爆）。
	it('★ 重放后仍 40005 → 抛 ApiError(type=auth)，不再重放（防死循环）', async () => {
		const authHandler = vi.fn().mockResolvedValue(true);
		registerAuthHandler(authHandler);

		mocks.sendMock.mockResolvedValue(okResponse(null, 40005));

		await expect(request({ url: 'x/y', toast: false })).rejects.toMatchObject({
			type: ERROR_TYPE.auth
		});
		// 原请求 + 最多一次重放 = 2 次，绝不允许第 3 次
		expect(mocks.sendMock).toHaveBeenCalledTimes(2);
	});

	it('重登失败 → 抛 ApiError(type=auth)', async () => {
		registerAuthHandler(vi.fn().mockResolvedValue(false));
		mocks.sendMock.mockResolvedValue(okResponse(null, 40005));

		await expect(request({ url: 'x/y', toast: false })).rejects.toMatchObject({
			type: ERROR_TYPE.auth
		});
	});

	// ★ authRetry:false 是登录/绑定接口的自保开关。漏传 = 递归登录。
	it('★ authRetry:false → 不触发重登，直接抛 auth', async () => {
		const authHandler = vi.fn().mockResolvedValue(true);
		registerAuthHandler(authHandler);
		mocks.sendMock.mockResolvedValue(okResponse(null, 40005));

		await expect(
			request({ url: 'admin/login/login', authRetry: false, toast: false })
		).rejects.toMatchObject({ type: ERROR_TYPE.auth });

		expect(authHandler).not.toHaveBeenCalled();
		expect(mocks.sendMock).toHaveBeenCalledTimes(1);
	});
});

// ===========================================================================
// 第 4 段：全局守卫
// ===========================================================================
describe('request：全局业务码守卫', () => {
	it('命中登记的码 → 执行守卫动作 + 抛 ApiError(type=guard)', async () => {
		const action = vi.fn();
		// 用例自选一个码自行登记（不依赖 services/guards.js 的现行两枚 50008 / 58004），
		// 这样业务换码时这个模板不必跟着改
		registerCodeGuard(90001, action);
		mocks.sendMock.mockResolvedValue(okResponse(null, 90001));

		await expect(request({ url: 'x/y' })).rejects.toMatchObject({ type: ERROR_TYPE.guard });
		expect(action).toHaveBeenCalled();
	});

	// ★ guard:false 是「失败即隐藏的装饰位模块」与「守卫目标页自己的接口」的豁免开关。
	it('★ guard:false → 不触发守卫动作，按普通业务错误抛', async () => {
		const action = vi.fn();
		registerCodeGuard(90001, action);
		mocks.sendMock.mockResolvedValue(okResponse(null, 90001));

		await expect(request({ url: 'x/y', guard: false, toast: false })).rejects.toMatchObject({
			type: ERROR_TYPE.business
		});
		expect(action).not.toHaveBeenCalled();
	});
});

// ===========================================================================
// 第 5 段：loading 托管（★ 失败路径也必须 hide）
// ===========================================================================
describe('request：loading 托管', () => {
	it('loading:true → show 与 hide 成对调用', async () => {
		await request({ url: 'x/y', loading: true, toast: false });
		expect(mocks.showLoadingMock).toHaveBeenCalledTimes(1);
		expect(mocks.hideLoadingMock).toHaveBeenCalledTimes(1);
	});

	// ★ 这条是关键：loading 的关闭收敛在 finally，失败时也必须 hide。
	//   否则一次失败会让全局遮罩永远盖着页面（真机上表现为「卡死」）。
	it('★ loading:true 且请求失败 → hide 仍被调用（收敛在 finally）', async () => {
		mocks.sendMock.mockRejectedValue(new Error('down'));
		await expect(request({ url: 'x/y', loading: true, toast: false })).rejects.toBeInstanceOf(ApiError);
		expect(mocks.hideLoadingMock).toHaveBeenCalledTimes(1);
	});

	it('loading 默认 false → 不调用 show/hide', async () => {
		await request({ url: 'x/y', toast: false });
		expect(mocks.showLoadingMock).not.toHaveBeenCalled();
	});
});

// ===========================================================================
// 第 6 段：URL 与签名（可断言的部分）
// ===========================================================================
describe('request：URL 拼接与签名头', () => {
	it('相对路径自动拼 rootPath + 版本前缀（结果里含 /v2/）', async () => {
		await request({ url: 'vehicle/list', toast: false });
		const sentURL = mocks.sendMock.mock.calls[0][1].url;
		expect(sentURL).toContain('/v2/vehicle/list');
	});

	it('完整 http(s) 地址原样使用（不拼前缀）', async () => {
		await request({ url: 'https://third.party/api', toast: false });
		const sentURL = mocks.sendMock.mock.calls[0][1].url;
		expect(sentURL).toBe('https://third.party/api');
	});

	it('GET 参数被 encodeURIComponent（防参数注入）', async () => {
		await request({ url: 'x/y', params: { kw: 'a&b=c' }, toast: false });
		const sentURL = mocks.sendMock.mock.calls[0][1].url;
		expect(sentURL).toContain('kw=a%26b%3Dc');
	});

	it('★ 参数过滤 undefined/null，但保留 0 / 空串 / false', async () => {
		await request({ url: 'x/y', params: { a: 0, b: '', c: false, d: null, e: undefined }, toast: false });
		const sentURL = mocks.sendMock.mock.calls[0][1].url;
		expect(sentURL).toContain('a=0');
		expect(sentURL).toContain('b=');
		expect(sentURL).toContain('c=false');
		expect(sentURL).not.toContain('d=');
		expect(sentURL).not.toContain('e=');
	});

	it('签名头含 7 个约定字段', async () => {
		await request({ url: 'x/y', toast: false });
		const header = mocks.sendMock.mock.calls[0][1].header;
		['source', 'timestamp', 'sign', 'random', 'edition', 'token', 'userid'].forEach((k) => {
			expect(header).toHaveProperty(k);
		});
	});
});

// ===========================================================================
// ★ 未覆盖清单（必须输出给用户 —— 诚实优先于覆盖率好看）
// ===========================================================================
describe.skip('【未覆盖，需手工验证】', () => {
	it('真机签名：apiKey 参与计算的 sign 能被后端接受', () => {});
	it('守卫 busy 去重 + 1s 冷静期：并发 10 个请求同回 50008 只弹一个框', () => {});
	it('wx.login 真实链路（未绑定 → 58001 → 绑定页）', () => {});
	it('MP 端 .u-popup 是否仍被页面滚动区挤压（known_issues K-08，未确证）', () => {});
	it('多端样式隔离与 env() 兼容', () => {});
});

// ---------------------------------------------------------------------------
// 模板自带的提醒（接入后删除本段）
//
// ★ 本模板的核心价值在「第 3 段」与「第 5 段」——
//   40005 重放次数 与 loading 失败时是否 hide，
//   这两处一旦改坏，真机上的表现是「一直转圈 / 页面卡死 / 请求风暴」，
//   而在代码 review 里极难看出来。
//
// · mock 边界（transport / uni / toast），不要 mock request.js 自身。
// · 每个 ApiError.type 都要有断言。
// · 失败路径（rejects）比成功路径更重要。
// · 输出时必须附「未覆盖清单 + 手工验证步骤」。
// · ❌ 不要为让测试通过而改业务代码。
// ---------------------------------------------------------------------------