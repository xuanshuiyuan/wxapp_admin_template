// ---------------------------------------------------------------------------
// 单元测试模板（vitest 风格）。
//
// ⚠️ 本项目的测试框架【尚未安装】。使用前：
//   1. 需用户明确授权： npm i -D vitest
//   2. package.json scripts 加： "test": "vitest run"
//   3. 执行测试同样需用户授权（.claude/rules/testing.md 第一条）
//
// ⚠️ 优先测纯函数（src/utils/*）与错误归一（services/http/error.js）——
//    零 mock、最高性价比。页面组件不做单测（依赖 uni 运行时，走手工清单）。
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';

// 被测对象（按需替换）
import { toApiError, errorTip, ApiError, ERROR_TYPE } from '@/services/http/error';

// ===========================================================================
// 范式 A：纯函数测试 —— 正常值 + 边界 + 异常输入
// ===========================================================================
// 边界是这个项目最容易出错的地方：maskMobile 的分界点是「长度 7」，
// 少测一个值就可能漏掉「长度 6 会崩」这类问题。
describe('maskMobile：手机号脱敏', () => {
	// 动态 import 便于本模板在你尚未确定落点时不至于直接报错
	// 真实使用时改为顶部静态 import
	const maskMobile = (mobile) => {
		const m = String(mobile || '');
		if (!m) return '—';
		return m.length >= 7 ? `${m.slice(0, 3)}****${m.slice(-4)}` : '****';
	};

	it('正常手机号：保留前 3 后 4', () => {
		expect(maskMobile('13812348388')).toBe('138****8388');
	});

	// ★ 边界：长度 7 是分界点（>=7 才保留前后段）
	it('边界：长度 7 时保留前后段', () => {
		expect(maskMobile('1381234')).toBe('138****1234');
	});

	it('边界：长度 6 时全星号（不猜格式）', () => {
		expect(maskMobile('138123')).toBe('****');
	});

	// ★ 空值：三种空必须都测，因为它们的处理路径可能不同（String(null) === 'null'）
	it('空值：null / undefined / 空串 一律返回占位符', () => {
		expect(maskMobile(null)).toBe('—');
		expect(maskMobile(undefined)).toBe('—');
		expect(maskMobile('')).toBe('—');
	});

	it('非法类型：数字入参不崩（不因类型假设抛错）', () => {
		expect(() => maskMobile(13812348388)).not.toThrow();
	});
});

// ===========================================================================
// 范式 B：错误归一测试 —— ★ 每个 ApiError.type 分支一条
// ===========================================================================
// 失败路径比 happy path 更重要：本项目所有失败都收敛到 ApiError，
// 若某个 type 的分支没测到，用户可能看到一个「未定义」的提示。
describe('toApiError：异常归一', () => {
	it('已是 ApiError → 原样返回（不重复包装）', () => {
		const original = new ApiError(ERROR_TYPE.business, '业务失败', { code: 1 });
		expect(toApiError(original)).toBe(original);
	});

	it('字符串 → 包装成 unknown 类型', () => {
		const err = toApiError('出错了');
		expect(err).toBeInstanceOf(ApiError);
		expect(err.type).toBe(ERROR_TYPE.unknown);
		expect(err.message).toBe('出错了');
	});

	// uni 的 fail 对象用 errMsg；普通 Error 用 message；后端用 msg —— 三条都要覆盖
	it('uni fail 对象（errMsg）→ 取其 errMsg 作为 message', () => {
		const err = toApiError({ errMsg: 'request:fail timeout' });
		expect(err.message).toBe('request:fail timeout');
	});

	it('普通 Error（message）→ 取其 message', () => {
		const err = toApiError(new Error('boom'));
		expect(err.message).toBe('boom');
	});

	it('后端错误体（msg）→ 取其 msg', () => {
		const err = toApiError({ msg: '参数错误' });
		expect(err.message).toBe('参数错误');
	});

	it('完全无法识别的输入 → 兜底文案，不返回空 message', () => {
		expect(toApiError(null).message).toBe('请求失败');
		expect(toApiError({}).message).toBe('请求失败');
	});
});

describe('errorTip：面向用户的提示文案', () => {
	// network 类型有专门文案（不看 message）—— 这是有意的：断网时 message 可能是
	// 平台差异很大的原始错误，直接展示反而困惑
	it('network 类型 → 固定文案「连接超时，请重试」', () => {
		const err = new ApiError(ERROR_TYPE.network, 'request:fail something weird');
		expect(errorTip(err)).toBe('连接超时，请重试');
	});

	it('business 类型 → 展示 message 原文', () => {
		const err = new ApiError(ERROR_TYPE.business, '该手机号已被绑定');
		expect(errorTip(err)).toBe('该手机号已被绑定');
	});

	it('message 为空 → 兜底文案，不留空白', () => {
		const err = new ApiError(ERROR_TYPE.business, '');
		expect(errorTip(err)).toBe('请求失败');
	});

	it('非 ApiError 输入 → 自动归一后再取文案', () => {
		expect(errorTip('出错了')).toBe('出错了');
	});
});

// ===========================================================================
// 范式 C：分页容错测试 —— 「容错不是契约」但仍需测，因为它是现网行为
// ===========================================================================
// defaultPick 对后端字段做了容错（list/data/rows、total/count），
// 这些容错分支是真实依赖的行为，改动会静默影响所有列表页。
describe('defaultPick：后端分页结构容错', () => {
	// 真实使用时改为： import { defaultPick } from '@/composables/useList'
	const defaultPick = (body) => {
		const d = (body && body.data) || {};
		if (Array.isArray(d)) return { list: d, total: d.length };
		const list = d.list || d.data || d.rows || [];
		const total = Number(d.total || d.count || 0);
		return { list, total };
	};

	it('标准契约：data.list + data.total（本项目推荐形态）', () => {
		const r = defaultPick({ data: { list: [{ id: 1 }], total: 99 } });
		expect(r.list).toHaveLength(1);
		expect(r.total).toBe(99);
	});

	it('容错：data 本身是数组 → list 即它，total 取长度', () => {
		const r = defaultPick({ data: [{ id: 1 }, { id: 2 }] });
		expect(r.list).toHaveLength(2);
		expect(r.total).toBe(2);
	});

	it('容错：rows / count 形态也能取到', () => {
		const r = defaultPick({ data: { rows: [{ id: 1 }], count: 5 } });
		expect(r.list).toHaveLength(1);
		expect(r.total).toBe(5);
	});

	it('缺失字段 → list 为空数组（不返回 undefined，避免调用方 .length 崩）', () => {
		const r = defaultPick({});
		expect(r.list).toEqual([]);
		expect(r.total).toBe(0);
	});

	it('空值输入不崩', () => {
		expect(() => defaultPick(null)).not.toThrow();
		expect(() => defaultPick(undefined)).not.toThrow();
	});
});

// ===========================================================================
// 模板自带的提醒（接入后删除本段）
//
// · 本模板用了「就地定义被测函数」的写法，是为了让模板在你尚未确定落点时也能跑。
//   真实使用时改为顶部 import 真实实现 —— 否则测的是副本，不是你的代码。
// · 优先测 src/utils/*（纯函数，零 mock）。
// · 每个 ApiError.type 都要有用例（network/http/business/auth/guard/unknown）。
// · 边界必测：maskMobile 的分界点是 7；useList 的 finished 在无 total 时靠「不足一页」。
// · ❌ 不要为让测试通过而改业务代码。
// · ❌ 不要写 expect(true).toBe(true) 这类填充用例。
// · 输出时【必须】附「未覆盖清单 + 原因」，并标注「未执行，待验证」。
// ---------------------------------------------------------------------------