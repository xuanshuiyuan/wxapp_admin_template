// ---------------------------------------------------------------------------
// 业务字典与枚举：页面里不写字面量数字/字符串，一律从这里取。
//
// 契约来源：后端模板 go_project_template（README / internal/conf/err_code.go /
// internal/route/verification.go）。带 ★ 的是模板机制会用到的码，其余为常见预留。
//
// 业务变多后可按域拆成 config/dict/<domain>.js，再在本文件汇总导出。
// ---------------------------------------------------------------------------

// —— 通用响应码 ——
export const CODE_SUCCESS = 0;
// 参数错误（后端严格解码：未知字段 / 嵌套数组用了表单编码 / 必填缺失都回它）
export const CODE_PARAM_INVALID = 40001;
/** 校验失败（业务规则层）—— 按提示补全后重试 */
export const CODE_VALIDATE_FAILED = 40003;
// ★ 登录失效：http 层命中后自动静默重登并重放原请求（机制见 services/http/request.js）；
//   重登失败才会把 ApiError(type='auth') 抛给页面
export const CODE_LOGIN_EXPIRED = 40005;
// ★ 无权限操作：后端按「登录缓存里的角色授权路径列表」逐路径比对。
// **刻意不进全局守卫** —— 由页面就地处置（置灰 / 无权限空态 / 隐藏入口），
// 全局弹框会遮住用户正在看的页面（判据见 .claude/CLAUDE.md §3.4）
export const CODE_NO_PERMISSION = 40102;
// 频控（上传 / 短信等）
export const CODE_TOO_FREQUENT = 40205;

// —— 账号体系（新项目自建 RBAC 时可直接沿用这组码，也可改成自己的） ——
// ★ 该微信尚未绑定管理员账号。**不是错误，是流程分支** → 去绑定页（services/session.js）
export const CODE_ADMIN_NOT_BOUND = 58001;
// 账号或密码错误：后端**故意不区分**「手机号不存在」与「密码错」（防账号枚举），
// 前端不得拆成两种提示
export const CODE_BIND_CREDENTIAL_ERROR = 58002;
// 绑定频控：同一手机号 60s 内失败满 5 次。页面置灰按钮 + 倒计时，**不要自动重试**
export const CODE_BIND_RATE_LIMITED = 58003;
// ★ 该账号未配置角色权限（无角色 / 角色被禁用 / 角色名下无权限点）→ 全局守卫弹框
export const CODE_ADMIN_NO_ROLE = 58004;
// 该管理员账号已绑定其他微信（或并发撞唯一索引）→ 提示联系管理员解绑，**不要引导重试**
export const CODE_ACCOUNT_BOUND_OTHER_WX = 58005;
// 当前微信已绑定其他管理员账号
export const CODE_WX_BOUND_OTHER_ACCOUNT = 58006;
// ★ 账号已被禁用（登录**与绑定**都会回它）→ 全局守卫弹框
export const CODE_ACCOUNT_DISABLED = 50008;
// 微信 code2session 调用失败（code 过期/已用过/网络）。⚠️ 必须**换新 code** 再试
export const CODE_WX_UNAVAILABLE = 60003;
// 验签 / 版本 / 来源被拒（后端 verification.go fail-closed）
export const CODE_SIGN_INVALID = 40003;
// ⚠️ 预留号段：后端当前对 edition 未登记返回 CodeValidationFailed(40003)+通用文案，
//    40107 只在后端 `err_code.go` 预留、尚未接线；不要把它当已生效的契约。
export const CODE_EDITION_INVALID = 40107;

// 绑定频控倒计时秒数：与后端窗口必须一致
export const BIND_COOLDOWN_SECONDS = 60;

// ---------------------------------------------------------------------------
// ★ 权限点（登录 / 绑定响应 `data.permission` 的取值）
//
// 用途：**页面准入 + 功能模块 / 子入口 / 操作按钮的显隐判据**。
//   清单与码的对应关系全在 `config/access.js`，本文件只管**码本身**。
//   前端只做显示与准入体验，真正的防线在服务端（40102）。
//
// ⚠️ 演示模式（config/app.js 的 DEMO_MODE）下，demo 会话固定下发前 5 个码；
//    接真实后端后，改这里 + config/access.js 即可，机制不动。
// ---------------------------------------------------------------------------
export const PERM_DEMO_MANAGE = 'DEMO_MANAGE'; // 首页「演示功能」入口（直达页）
export const PERM_DEMO_REQUEST = 'DEMO_REQUEST'; // 演示页里的「请求层示例」与「上传示例」
export const PERM_DEMO_SUBMENU = 'DEMO_SUBMENU'; // 首页「示例子菜单」入口（0/1/≥2 规则）
export const PERM_DEMO_PAGE_A = 'DEMO_PAGE_A'; // 子菜单项 A
export const PERM_DEMO_PAGE_B = 'DEMO_PAGE_B'; // 子菜单项 B
// 配置里有、但演示会话**不下发** → 该入口永远不渲染。
// 用它验证「权限即显隐」：在 config/demo.js 的 permission 里加上它，入口立刻出现。
export const PERM_DEMO_HIDDEN = 'DEMO_HIDDEN';

// —— 首页模块类型（响应 modules[].type；本模板没有数量接口，仅作标识/排查） ——
export const MODULE_TYPE_DEMO = 'demo';
export const MODULE_TYPE_DEMO_SUBMENU = 'demo_submenu';

// —— 上传（后端 admin/upload 的 type 参数 = conf.AdminUploadTypes 的键） ——
// 新增一种上传：后端 AdminUploadTypes 加一行 + 这里加一个常量 + 页面传 type，不用改上传链路。
export const UPLOAD_TYPE_DEMO_FILE = 'demo_file';
// 前端预校验（后端仍会按 AdminUploadTypes 复核，前端先拦只为省一次往返）
export const UPLOAD_ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'pdf'];
export const UPLOAD_IMAGE_EXTS = ['jpg', 'jpeg', 'png'];
export const UPLOAD_MAX_BYTES = 20 * 1024 * 1024; // 20MB

// 上传失败码（services/uploader.js 按场景给文案）
// 契约真源：后端 internal/conf/err_code.go —— 40203 格式错误 / 40204 大小超限 /
// 40205 频控 / 60004 上传通用失败。类型未注册在后端由未来控制器映射（本模板按 40001 处理）。
export const CODE_UPLOAD_FORMAT_INVALID = 40203;
export const CODE_UPLOAD_SIZE_INVALID = 40204;
export const CODE_UPLOAD_INVALID = 60004;
export const CODE_UPLOAD_TOO_FREQUENT = CODE_TOO_FREQUENT;

/**
 * 按类型收敛的上传定义（镜像后端 conf.AdminUploadTypes 的 FormatList / MaxSize）。
 * 新增一种上传：后端注册表加一行 + 这里加一行（键必须与后端 type 完全一致）。
 * 调用方可用 options 覆盖单项（如履约附件临时严格要求 imagesOnly）。
 * @type {Record<string, {exts: string[], maxBytes: number, imagesOnly: boolean}>}
 */
export const UPLOAD_TYPE_DEFS = {
	[UPLOAD_TYPE_DEMO_FILE]: { exts: UPLOAD_ALLOWED_EXTS, maxBytes: UPLOAD_MAX_BYTES, imagesOnly: false }
};

/** 取某类型的上传定义（未注册的 type 回落到全局默认，便于联调时先跑通） */
export function uploadTypeDef(type) {
	const def = UPLOAD_TYPE_DEFS[type];
	if (def) return def;
	// ⚠️ 不引用 UPLOAD_TYPE_DEMO_FILE：去演示化时会删掉该常量，
	//    这里再引用就会在启动时 ReferenceError（用字面兜底 + warn）
	console.warn(`[uploader] 上传类型 ${type} 未在 UPLOAD_TYPE_DEFS 注册，按全局默认白名单/限额处理`);
	return { exts: UPLOAD_ALLOWED_EXTS, maxBytes: UPLOAD_MAX_BYTES, imagesOnly: false };
}

// —— 身份域（如你的后端有平台 / 商家两类管理员，可沿用；模板默认不启用） ——
export const ADMIN_SCOPE_PLATFORM = 1;
export const ADMIN_SCOPE_MERCHANT = 2;