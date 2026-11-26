// ---------------------------------------------------------------------------
// 全项目接口 URL 唯一登记表：所有请求路径集中在这一个文件，方便查看与后续修改。
//
// 约定：
// · 值一律**不带** /v2 版本前缀与前导斜杠 —— request.js 统一拼 rootPath + routeVersion；
//   完整 http(s) 地址（第三方）不放这里，就近写在调用处并注明原因。
// · 命名 ENDPOINT_<域>_<动作>；改路径只动本文件，api/ 与 services/ 的方法名/参数不受影响。
// · 放 config/ 层的原因：services/session（基础设施）与 api/（业务）都要引它，
//   config 是最底层，两边向下引用都不会形成环。
//
// 对接后端模板（go_project_template）的路径分组：
//   admin/login/*  → adminlogin 组（签名 + source 属 B 端，免 token）
//   admin/*        → admin 组（签名 + B 端 token + 角色接口权限）
// ---------------------------------------------------------------------------

// —— 管理端登录 / 绑定（需要新项目自建，接入指引见 README「后端对接指引」）——
// 免 token、免权限点：code 为 wx.login 一次性凭证（5 分钟、用过即废）
export const ENDPOINT_ADMIN_LOGIN = 'admin/login/login';
// 首次使用：手机号 + 密码把当前微信与管理员账号绑定；
// ⚠️ 必须配**新换的** code，响应结构与登录接口完全相同
export const ENDPOINT_ADMIN_BIND = 'admin/login/bind';

// —— 首页（模板在演示模式下不调；接真后端时返回 admin_info + 可见模块/单量）——
export const ENDPOINT_ADMIN_HOME = 'admin/home/index';

// —— 管理端通用上传（后端建议只建这一个上传口，业务类型由 type 声明）——
// 与后端 conf.AdminUploadTypes 注册表配套；multipart 字段名固定 file
export const ENDPOINT_ADMIN_UPLOAD = 'admin/upload';

// —— 演示：连通性自测（后端模板 demo 模块，属 web 组 / C 端 source）——
// ⚠️ 这组路径**只用于验证请求链路**（签名 / 序列化 / 响应解析），不是业务接口。
//    后端 web 组校验 C 端 source（1010），本模板默认 source=1001 会被拒：
//    自测时在 .env.local 设 VITE_SOURCE=1010 + VITE_DEVELOP_BYPASS=develop（仅 local/develop）。
export const ENDPOINT_DEMO_LOGIN = 'web/demo/login';
export const ENDPOINT_DEMO_LIST = 'web/demo/list';
export const ENDPOINT_DEMO_CREATE = 'web/demo/create';
export const ENDPOINT_DEMO_DELETE = 'web/demo/delete';