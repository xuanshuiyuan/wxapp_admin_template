// ---------------------------------------------------------------------------
// 定位基础设施：跨端「取当前经纬度」统一入口。
//
// why 单独一层：wx.getLocation / uni.getLocation 在小程序/H5 端**只回经纬度不带城市名**
// （geocode 逆地理仅 App 端支持），城市名解析一律交后端（传 lon+lat 由后端逆地理）；
// 本层只负责「拿坐标 + 吞失败」——拒权/失败/不支持端统一回落 null 由调用方兜底，
// 不向上抛：定位通常是「城市级展示」这类装饰位的前置，不能把异常扩散进页面主流程。
//
// ⚠️ 当前**尚无消费方**（新项目还没有用定位的页面）——这是预留的通用能力，不是死代码。
// ⚠️ 真正用起来时**必须同步补 manifest.json 的权限声明**：
//    mp-weixin.permission.scope.userLocation（用途说明）+ requiredPrivateInfos: ["getLocation"]，
//    并在微信公众平台完成接口权限申请与隐私指引（属外部前提，不补则真机上取不到坐标）。
//
// 坐标系统一 gcj02：国内逆地理/地图服务口径，与后端对接的图商一致；
// 城市级天气对 gcj02/wgs84 的百米级偏差不敏感，但坐标口径单一便于后端排查。
// ---------------------------------------------------------------------------

// 系统定位回调超时（ms）：真机上授权弹窗挂着不确认时 success/fail/complete 一个都不会回。
// 调用方多半是「单飞」语义（并发只真发一次）——死 Promise 会把后续每次 onShow 甚至下拉刷新
// 全部复用成悬挂请求，那一块内容再也出不来。3s 覆盖正常冷启动定位耗时，超即按失败
// 放行调用方走兜底（坐标缺失只影响城市名，不影响天气内容本身）
const LOCATE_TIMEOUT = 3000;

// 定位失败退避窗（ms）：拒权是持续状态，原实现只缓存成功值，导致每次取数都重打一遍
// 注定失败的 getLocation（白加一整个往返）。窗内直接回 null；窗满再给一次机会，
// 好过会话内锁死——用户中途去设置里放开授权，下次进首页即恢复真实坐标
const FAIL_COOLDOWN = 60000;

// 会话级坐标缓存 + 单飞：城市不随 tab 切换变化，一次冷启动定位一次就够（省电、
// 避免频繁唤起定位）；onShow 与下拉刷新并发触发时也只发一次系统定位调用
// 回包字段名沿用 getLocation 原口径（longitude/latitude），契约参数名（lon/lat）由消费方组装
let cached = null; // { longitude, latitude } 字符串化坐标
let pending = null; // 进行中的定位 Promise（单飞去重，无渲染语义不进响应式）
let failAt = 0; // 上次定位失败/超时时间戳（FAIL_COOLDOWN 判定）

/**
 * 获取当前经纬度
 * @param {object} [opts]
 * @param {boolean} [opts.force=false] 绕过会话缓存与失败退避重新定位（预留口：当前调用方城市级精度够用，无人需要）
 * @returns {Promise<{longitude: string, latitude: string}|null>} 拒权/失败/超时/不支持端返回 null
 */
export function getCurrentCoord(opts = {}) {
	const { force = false } = opts;
	if (cached && !force) return Promise.resolve(cached);
	if (!force && failAt && Date.now() - failAt < FAIL_COOLDOWN) return Promise.resolve(null);
	if (pending) return pending;

	pending = new Promise((resolve) => {
		let timer = null;
		let settled = false; // 超时后才回来的回调：结果照常入库供下次用，但不再二次 resolve

		const finish = (value) => {
			if (value) cached = value;
			else failAt = Date.now();
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			pending = null; // 单飞口在每个出口释放（原 complete-only 写法漏了超时这条）
			resolve(value);
		};

		timer = setTimeout(() => finish(null), LOCATE_TIMEOUT);
		uni.getLocation({
			type: 'gcj02',
			success: (res) => finish({ longitude: String(res.longitude), latitude: String(res.latitude) }),
			// 拒权 / 平台不支持（H5 非安全上下文、App 未配定位模块）/ manifest 未声明
			// requiredPrivateInfos 等全部降级为 null：调用方回落配置城市，天气位不空窗
			fail: () => finish(null),
		});
	});
	return pending;
}
