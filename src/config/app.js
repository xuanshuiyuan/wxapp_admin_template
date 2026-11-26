// ---------------------------------------------------------------------------
// 应用级常量（与环境无关）。环境相关的 host / 密钥在 config/env.js
//
// ⚠️ 本文件是通用模板，业务常量已全部剔除；新项目只改带注释「新项目」字样的几项。
//    带 REPLACE_ 前缀的值由 init.sh / 手工替换，清单见 README.md。
// ---------------------------------------------------------------------------

// edition 头：接口版本协商值（后端 route/verification.go 按白名单校验）。
// ⚠️ 这是**全局**协商头，动一次全项目所有接口一起变；传**未登记**的值会被后端
// fail-closed 整体拒绝（HTTP 200 + 业务码 40107 / `Im Invalid Request!`）。
// 后端模板 EditionList 的起点是 v1.0.0（=100），新项目按自己后端的登记值填。
export const edition = 'v1.0.0';

// 接口路径版本前缀（后端 conf.RouteVersion 单点定义）：request.js 拼 URL 时统一加，
// 业务路径（api/ 与 endpoints.js）一律不带 /v2，升版只改这一行
export const routeVersion = 'v2';

// 后端约定的来源标识：B 端微信小程序 = 1001（网页 B 端 = 0101，C 端 = 1010）。
// ⚠️ 每个 source 在后端有**自己的签名密钥**（Verification.KeyList），
//    换 source 必须同时换 .env.*.local 的 VITE_API_KEY，否则全部请求回 40003。
// ⚠️ 联调自测需要打后端 demo 模块时，可用 .env 的 VITE_SOURCE 临时覆盖（见 env.js）。
export const source = '1001';

// 品牌名（JS 侧的唯一来源）：页面出现品牌名一律引它。
// ⚠️ pages.json / manifest.json 是 JSON，读不到 JS 常量，那几处各留一份字面量，改名时一起改。
// 新项目把这里换成自己的产品名（不是安全项，不需要 REPLACE_ 占位）。
export const APP_NAME = '管理端模板';

// 微信转发卡片标题（首页 onShareAppMessage 用）
export const SHARE_TITLE = `${APP_NAME} · 工作台`;

// 页面页脚展示的版本号（与 manifest.json 的 versionName 必须同步）
export const APP_VERSION = 'v1.0.0';
export const APP_VERSION_TEXT = `${APP_VERSION} · 管理端模板`;

// 全局转圈图：LOADING_IMAGE 存 OSS 相对路径（拼接走 utils/oss.js），
// 留空则组件走纯 CSS 主色转圈；配置了 OSS 图后失败自动回退 FALLBACK 本地占位图
export const LOADING_IMAGE = '';
export const LOADING_IMAGE_FALLBACK = '/static/loading.png';

// 全局 loading 的上屏节奏（services/toast.js 消费）：
// 延迟 200ms 再上屏（快请求干脆不渲染转圈）；上屏后至少停留 300ms（已经转出来了就转完）
export const LOADING_SHOW_DELAY_MS = 200;
export const LOADING_MIN_VISIBLE_MS = 300;

// 本地存储 key 前缀，避免同域下多项目互相污染。
// 换前缀会使旧缓存登录态失效，下次启动静默重登即恢复。
const PREFIX = 'wxapp_admin_template_';

// 登录态字段：读写只允许经过 services/storage.js
export const SESSION_FIELDS = ['source', 'userinfo', 'token', 'openid', 'user_id', 'mobile', 'user_name', 'permission'];

export function storageKey(name) {
	return `${PREFIX}${name}`;
}

// ---------------------------------------------------------------------------
// ★ 演示模式（模板自带，接真后端前保持 true）
//
// true  —— 登录 / 绑定**不请求网络**：services/session.js 直接把 config/demo.js 的
//          演示会话写进本地存储（含 permission），于是：
//            · 权限菜单（config/access.js ∩ permission）可以完整跑通；
//            · 页面准入 / 40102 处置 / 登录门都能在开发者工具里验证；
//            · 首页不发 admin/home/index（没有后端也能看到工作台）。
// false —— 走真实契约：wx.login → admin/login/login，失败 58001 → 绑定页。
// ⚠️ 切到 false 之前必须先完成 README 的「后端对接指引」（登录接口 + 权限下发）。
// ---------------------------------------------------------------------------
export const DEMO_MODE = true;