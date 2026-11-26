// ---------------------------------------------------------------------------
// 环境配置 —— 全项目唯一的环境开关。
//
// 所有值由根目录 .env 文件驱动（Vite 标准），config 层只做读取与分流：
//   npm run dev:*       → 加载 .env.development + .env.local（若有）
//   npm run build:*     → 加载 .env.production  + .env.local（若有）
//
// 本地想切后端地址 / 密钥，在 .env.local 写一行即可，不提交 git。
// 当前运行端（mp / h5 / app）由条件编译自动判定，与 env 无关。
// ---------------------------------------------------------------------------

// ── 环境名 ──
const ENV = import.meta.env.VITE_APP_ENV || 'development';

// ── 当前运行端（条件编译） ──
let runtime = 'mp';
// #ifdef H5
runtime = 'h5';
// #endif
// #ifdef APP-PLUS
runtime = 'app';
// #endif

// ── 按端取接口地址 ──
const HOST_MAP = {
	mp: import.meta.env.VITE_HOST_MP,
	h5: import.meta.env.VITE_HOST_H5,
	app: import.meta.env.VITE_HOST_APP
};

// ── 导出 ──
export const env = ENV;
export const isProd = ENV === 'production';
// 统一补尾斜杠：request.js 在其后直接拼版本前缀（v2/），不依赖 .env 里手写斜杠；
// 留空（H5 同域部署）时保持空串，走相对路径
const host = HOST_MAP[runtime] || '';
export const rootPath = host && !host.endsWith('/') ? `${host}/` : host;
export const ossHost = import.meta.env.VITE_OSS_HOST || '';
export const apiKey = import.meta.env.VITE_API_KEY || '';

// ── 联调专用（生产必须留空） ─────────────────────────────────────────────
// source 覆盖：只在「用本模板的请求层去连后端 demo 模块」时用。
// 后端模板的 demo 模块在 web 组，校验的是 C 端 source（1010）；本模板默认 1001 会被拒。
// 故连通性自测时可临时 VITE_SOURCE=1010（仅限 local / develop 后端）。
export const sourceOverride = import.meta.env.VITE_SOURCE || '';

// 签名旁路：后端 local / develop 环境允许携带 develop 头跳过签名校验
// （生产被 conf.init 的硬护栏禁止）。填 `develop` 即启用；生产必须留空。
export const developBypass = import.meta.env.VITE_DEVELOP_BYPASS || '';

// 非微信端（H5 调试）登录用的联调 mock code：真实后端模式下，H5 拿不到微信 code。
// 留空时非微信端登录会明确报错，而不是拿假身份进入。生产必须留空。
export const mockLoginCode = import.meta.env.VITE_MOCK_LOGIN_CODE || '';