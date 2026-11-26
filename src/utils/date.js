// 时间戳格式化
// format: ymdhms(默认) / ymdhm / ymd / ym / hms(仅时分秒) / hm(仅时分) / md(仅月日) /
//         yStr / ymStr / ymdStr / mdStr

export function formatDate(obj, format = 'ymdhms') {
	const time = new Date(parseInt(obj) * 1000)
	const y = time.getFullYear()
	const m = String(time.getMonth() + 1).padStart(2, '0')
	const d = String(time.getDate()).padStart(2, '0')
	const h = String(time.getHours()).padStart(2, '0')
	const mm = String(time.getMinutes()).padStart(2, '0')
	const s = String(time.getSeconds()).padStart(2, '0')

	const formatMap = {
		'yStr': `${y}年`,
		'ymStr': `${y}年${m}月`,
		'ymdStr': `${y}年${m}月${d}日`,
		'ymd': `${y}-${m}-${d}`,
		'ym': `${y}-${m}`,
		'ymdhm': `${y}-${m}-${d} ${h}:${mm}`,
		'hms': `${h}:${mm}:${s}`,
		// 充电记录列表的「09-07」「23:12」两档（列表行左栏窄，不带年/秒）
		'hm': `${h}:${mm}`,
		'md': `${m}-${d}`,
		'mdStr': `${m}月${d}日`
	}
	return formatMap[format] || `${y}-${m}-${d} ${h}:${mm}:${s}`
}

/**
 * Unix 秒 → `YYYY-MM-DD HH:mm`；0 / 非法值 → 「—」。
 * 后端用 0 表示「没有这个时间」，不能拿 1970 年冒充数据 —— 故统一在这里挡住。
 */
export function unixDateTimeText(ts) {
	const time = Number(ts) || 0
	return time ? formatDate(time, 'ymdhm') : '—'
}

/**
 * 秒级时间戳 → 「今天 10:49」/「昨天 10:49」/「10-20 10:49」。
 * 与 formatDate 的 `hm` 档区别在**前面带一个相对日**：下拉刷新指示器的「最后更新」吃它——
 * 用户只关心「刚更新过没有」，跨天时给「今天/昨天」比丢一个完整日期更像人话；
 * 再往前才退化成月-日（同 `md` 档）。只比到「日」，故两边都归零到当天 0 点再比，
 * 不然「今天 00:30 对昨天 23:50」会被 24 小时整除算成同一天
 */
export function dayHmText(obj, now = Date.now()) {
	const time = new Date(parseInt(obj) * 1000)
	const hm = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`
	const dayStart = (t) => new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()
	const diffDays = Math.round((dayStart(new Date(now)) - dayStart(time)) / 86400000)
	if (diffDays === 0) return `今天 ${hm}`
	if (diffDays === 1) return `昨天 ${hm}`
	const m = String(time.getMonth() + 1).padStart(2, '0')
	const d = String(time.getDate()).padStart(2, '0')
	return `${m}-${d} ${hm}`
}

/**
 * 'YYYY-MM-DD' → 中文月日「9月8日」。与 formatDate 的 mdStr 是同款文案，
 * 区别只在入参：那个吃 Unix 秒，这个吃日期串——行程轨迹页的日期档小注吃的是后端回显的
 * `date`（yyyy-MM-dd，不是时间戳），故单出一档。识别不了回空串，调用方隐藏该位、不印半截
 */
export function isoMdText(str) {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str || '').trim())
	if (!m) return ''
	return `${Number(m[2])}月${Number(m[3])}日`
}

/**
 * 'YYYY-MM' → 当月 1 日 00:00:00 的 Unix 时间戳（秒，本地时区）。
 * 估价接口 reg_date 契约就要该秒级 ts（后端自动转 YYYY-MM），field-editor 编码值原样进、ts 出。
 * 入参非法返回 0——falsy，调用侧的必填校验可统一拦截，不必单独判格式
 */
export function monthToStartTs(month) {
	const m = /^(\d{4})-(\d{2})$/.exec(String(month || ''))
	if (!m) return 0
	return Math.floor(new Date(Number(m[1]), Number(m[2]) - 1, 1).getTime() / 1000)
}

/**
 * 日期串归一成 'YYYY-MM-DD'（补零）：OCR / 后端可能回中文版式（2021年6月18日）或非补零串，
 * 展示与 picker 回显统一要 ISO 版式（用户定 2026-09-21）。已是 ISO / 无法识别的原样返回
 */
export function toDateIso(str) {
	const t = String(str || '').trim()
	// 紧凑版式 20210618：阿里云行驶证 OCR 对端样本裸值版式，后端原样透传
	//（对端原样版式，格式化属展示层规则）——前端展示层在这收口
	const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(t)
	if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`
	// 分隔版式一次取齐：2021年6月18日 / 2021-06-18 / 2021/06/18 / 2021.06.18，
	// 并容忍尾部带时间（2021-06-18 00:00:00）——只取日期段；识别不了的原样返回
	const m = /^(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})/.exec(t)
	if (!m) return t
	return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
}

/**
 * n 个月后的年月文案（电池 tab「跌破 80% 预测」用）：`YYYY年M月`。
 * 纯整数月份进位，不引 Date 的时区/月末进位坑（只需要「哪年哪月」，不需要具体日）。
 * @param {number} months 偏移月数（可为 0；负数按往年退位处理）
 * @param {Date} [base] 基准时间，默认现在
 */
export function monthAfterText(months, base = new Date()) {
	const n = Math.trunc(Number(months) || 0);
	const total = base.getFullYear() * 12 + base.getMonth() + n; // 以「年*12+月」为线性轴做进位
	const year = Math.floor(total / 12);
	const month = (total % 12) + 1;
	return `${year}年${month}月`;
}

/**
 * 'YYYY-MM-DD HH:mm:ss' → Date（本地时区；时间部分可缺省，也容忍 T 分隔）。
 * 不用 new Date(str)：iOS JSC 不认横杠日期串、恒回 Invalid Date（多端坑），统一正则拆分构造。
 * 入参非法/空回 null，展示兜底由调用方决定（新闻 publish_date 即该版式，契约 v1.1.1）
 */
export function parseDateTimeStr(str) {
	const m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/.exec(String(str || '').trim())
	if (!m) return null
	const d = new Date(
		Number(m[1]), Number(m[2]) - 1, Number(m[3]),
		Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0)
	)
	return Number.isNaN(d.getTime()) ? null : d
}

/**
 * 相对时间文案（新闻等装饰位）：不足 1 分钟=刚刚 / 不足 1 小时=x分钟前 / 不足 24 小时=x小时前 /
 * 不足 48 小时=昨天 / 7 天内=x天前 / 更远回落 MM-DD。解析失败回 ''——消费方隐藏时间位，
 * 不显示 Invalid Date；未来时间（服务端时钟偏差）一律按「刚刚」处理
 */
export function timeAgo(str, now = Date.now()) {
	const d = parseDateTimeStr(str)
	if (!d) return ''
	const min = Math.floor((now - d.getTime()) / 60000)
	if (min < 1) return '刚刚'
	if (min < 60) return `${min}分钟前`
	const hour = Math.floor(min / 60)
	if (hour < 24) return `${hour}小时前`
	if (hour < 48) return '昨天'
	const day = Math.floor(hour / 24)
	if (day <= 7) return `${day}天前`
	const mm = String(d.getMonth() + 1).padStart(2, '0')
	const dd = String(d.getDate()).padStart(2, '0')
	return `${mm}-${dd}`
}
