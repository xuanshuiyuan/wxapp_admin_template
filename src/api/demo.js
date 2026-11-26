// ---------------------------------------------------------------------------
// 接口层 · 演示（**连通性自测专用**，不是业务接口）
//
// 这几条打的是后端模板 go_project_template 的 demo 模块（web 组）：
//   web/demo/login   POST  user_id → 返回 token（demo 登录 stub）
//   web/demo/list    GET   page / page_size
//   web/demo/create  POST  name / remark
//   web/demo/delete  POST  id
//
// ⚠️ 三条前提（README「连通性自测」一节有完整步骤）：
//   1. web 组校验的是 **C 端 source（1010）**，本模板默认 1001 会被拒；
//      自测时在 .env.local 设 VITE_SOURCE=1010。
//   2. 后端 demo 的 token 走 web 组登录态，token 头 / userid 头由请求层自动带；
//      但本模板的会话（services/storage.js）存的是**管理端会话结构**，
//      故自测时直接把 demo/login 返回的 token 写进本地存储，或走 develop 旁路免 token。
//   3. 更省事的做法：local 后端开 DevelopBypass，设 VITE_DEVELOP_BYPASS=develop 跳过签名。
// 结论：**这组接口只用来验证「签名 → 发送 → 统一响应 → ApiError」这条链路**，
//       接通真后端后删掉本文件与 pages/demo 的「请求示例」区块即可。
// ---------------------------------------------------------------------------

import { curl } from '@/services/http';
import {
	ENDPOINT_DEMO_LOGIN,
	ENDPOINT_DEMO_LIST,
	ENDPOINT_DEMO_CREATE,
	ENDPOINT_DEMO_DELETE
} from '@/config/endpoints';

export const demoApi = {
	/** demo 登录 stub（返回 { token, user_info } —— 与 B 端会话结构不同，仅自测用） */
	login(userId = 1) {
		return curl.post(ENDPOINT_DEMO_LOGIN, { user_id: userId });
	},

	/** 分页列表：`data: { list, total, page, page_size }` */
	list(params = {}) {
		return curl.get(ENDPOINT_DEMO_LIST, params);
	},

	/** 创建：响应含 `doc_preview_url`（后端同时演示锁 + 操作日志 + 延迟任务） */
	create(data = {}) {
		return curl.post(ENDPOINT_DEMO_CREATE, data);
	},

	/** 软删 */
	remove(id) {
		return curl.post(ENDPOINT_DEMO_DELETE, { id });
	}
};

export default demoApi;