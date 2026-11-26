// ---------------------------------------------------------------------------
// 访问配置（★ 全项目唯一一份）：页面路由 + 功能模块展示 + 操作按钮 + 权限码归属
//
// 核心口径（模板保留的 B 端管理小程序核心资产）：
//   **页面、路由、功能模块的展示都配置在本文件**；登录拿到的 `permission` 决定显示什么 ——
//   配置里有、且登录下发了对应 code，才出现。
//
// 三方分工：
//   · 本文件（本地配置）：有哪些页面、页面里有哪些模块/子入口/按钮、各自属于哪个权限码
//   · 登录 / 绑定响应的 `data.permission`：**现在能用哪几个**（`permission.includes(code)`）
//   · 首页接口的 `modules[]`：各模块的**数量**（可选；本模板演示模式下不取）
//
// 层级：
//   首页「功能入口」= 大模块一张卡 → 点进去是模块页面；
//   模块页面里的子模块是页内 tab；再下一层是页内操作按钮（每个操作一个码）。
//
// 后端加东西时小程序要动的地方：
//   · 加操作按钮 → 对应入口的 `actions` 加一条（+ 后端在登录响应下发该码）
//   · 加新模块 → 本文件加一条 + 建页面 + pages.json 登记
//
// ⚠️ 页面路径只允许在本文件写**字面量**：`services/route.js` 把它们转出，页面从 route 引。
//    原因：config/ 是最底层，不能反向 import services（依赖方向红线）；
//    而「页面清单」必须与「谁需要什么权限」写在一处才有意义。
// ---------------------------------------------------------------------------

import {
	MODULE_TYPE_DEMO,
	MODULE_TYPE_DEMO_SUBMENU,
	PERM_DEMO_MANAGE,
	PERM_DEMO_REQUEST,
	PERM_DEMO_SUBMENU,
	PERM_DEMO_PAGE_A,
	PERM_DEMO_PAGE_B,
	PERM_DEMO_HIDDEN
} from '@/config/dict';

// ---------------------------------------------------------------------------
// ① 页面路径 —— 全工程唯一的字面量处（路由注册在 src/pages.json）
// ---------------------------------------------------------------------------

/** 首页（工作台）。⚠️ 它同时是微信端的**启动页**，由 pages.json 的 pages[] 第一项决定 */
export const PAGE_ADMIN_HOME = '/pages/admin-home/index';

/** 绑定管理员账号页：登录返回 58001（该微信未绑管理员）时的落地页 */
export const PAGE_BIND = '/pages/bind/index';

/** 演示页：请求链路 / 上传 / 骨架示例（entry 码 DEMO_MANAGE 进页，页内区块按 DEMO_REQUEST 裁剪） */
export const PAGE_DEMO = '/pages/demo/list';

/** 示例子菜单两页（验证首页「0 / 1 / ≥2 个子项」规则） */
export const PAGE_DEMO_A = '/pages/demo/page-a';
export const PAGE_DEMO_B = '/pages/demo/page-b';

/**
 * 通用字段编辑页：表单行 / 搜索框点一下跳到这里输入，确认后回传。
 * 机制在 `services/pickPage` + `services/fieldEditor`，页面只是渲染控件。
 */
export const PAGE_FIELD_EDITOR = '/pages/common/field-editor';

/**
 * 省 / 市 / 区选择页：回传「名称 + 6 位 code」，机制同 fieldEditor。
 * 与字段编辑页同属「跳页取值」工具页，准入完全跟随来源页，故 PAGES 里不配权限门。
 * ⚠️ 本页在**分包** `pages-sub`（连同 160KB 的区划表）：不用地区选择的项目删掉整个分包即可。
 */
export const PAGE_REGION_PICKER = '/pages-sub/common/region-picker';

// ---------------------------------------------------------------------------
// ② 子入口 / 页内操作按钮
//
// @typedef {object} EntryAction
// @property {string} key  动作标识（页内用；同一子入口内唯一）
// @property {string} name 按钮文案
// @property {string} code 权限码（登录/绑定响应的 `permission` 里要能查到）
// ---------------------------------------------------------------------------

/**
 * 示例子菜单（首页点「示例子菜单」→ 底部弹层）。
 *
 * 过滤规则（services/pageAccess + composables/useAdminHome 实现）：
 *   · 子项 = 本清单 ∩ 权限点，没权限的**根本不渲染**；
 *   · 过滤后只剩 1 项 → **不弹层，直接跳那一页**；
 *   · 过滤后 ≥2 项 → 底部弹层；
 *   · 过滤后 0 项 → 「示例子菜单」入口本身不渲染（点开是空菜单的入口不该存在）。
 *
 * 自己验证：在 config/demo.js 的 permission 里删掉 PERM_DEMO_PAGE_B 并重进首页，
 * 点入口会直跳 A；两个都删，入口卡消失。
 */
export const DEMO_SUBMENU_ENTRIES = [
	{
		key: 'page-a',
		name: '示例页 A',
		shortName: 'A',
		desc: '列表 + 空态 + 重试',
		icon: 'file-text',
		code: PERM_DEMO_PAGE_A,
		page: PAGE_DEMO_A
	},
	{
		key: 'page-b',
		name: '示例页 B',
		shortName: 'B',
		desc: '表单行 + 跳页取值',
		icon: 'edit-pen',
		code: PERM_DEMO_PAGE_B,
		page: PAGE_DEMO_B
	}
];

/**
 * 演示页页内的两个区块（v-model 示例：入口码进页，操作码管区块）：
 * 缺 `DEMO_REQUEST` 时整块不渲染，而不是被权限门退页。
 */
export const DEMO_PAGE_ACTIONS = [
	{ key: 'request', name: '请求链路示例', code: PERM_DEMO_REQUEST },
	{ key: 'upload', name: '通用上传示例', code: PERM_DEMO_REQUEST }
];

// ---------------------------------------------------------------------------
// ③ 首页宫格
// ---------------------------------------------------------------------------

export const HOME_ENTRIES = [
	{
		type: MODULE_TYPE_DEMO,
		name: '演示功能',
		code: PERM_DEMO_MANAGE,
		icon: 'grid',
		page: PAGE_DEMO,
		// 数量块不存在时的副说明（本模板没有数量接口，不编假数字）
		desc: '请求链路 / 上传 / 页面骨架'
	},
	{
		type: MODULE_TYPE_DEMO_SUBMENU,
		name: '示例子菜单',
		code: PERM_DEMO_SUBMENU,
		icon: 'setting',
		page: null,
		sheetSub: '选择要进入的示例页',
		children: DEMO_SUBMENU_ENTRIES
	},
	{
		// ★ 权限隐藏示例：配置里有，但演示会话不下发 PERM_DEMO_HIDDEN → 永远不渲染。
		//   在 config/demo.js 的 permission 里加上它，首页立刻多出这张卡。
		//   ⚠️ 本卡落点 PAGE_DEMO_A 还需要 `PERM_DEMO_PAGE_A` 才进得去；验证显隐时
		//      请在原有权限基础上**追加** HIDDEN（不要只留 HIDDEN，否则点进去会被权限门退回）。
		type: MODULE_TYPE_DEMO,
		name: '权限隐藏示例',
		code: PERM_DEMO_HIDDEN,
		icon: 'lock',
		page: PAGE_DEMO_A,
		desc: '默认不下发该权限码 → 本卡不显示'
	}
];

/** 认不出图标时的兜底（不给空白底盘） */
export const DEFAULT_ENTRY_ICON = 'grid';

// ---------------------------------------------------------------------------
// ④ ★ 页面准入表 —— 「每个页面进来时先取本页有权限加载的数据配置」的真相源
//
// 每个页面一条，字段只有三个语义：
//   · `login`   进页要不要**先有登录态**（登录门在页面 onShow，见 services/session.js）
//   · `entries` 本页的准入 = 这些子入口的权限码**任一命中**（hasAnyPermission）
//   · `byParam` 本页的准入码**随 URL 参数变**：取 `query[byParam]` 对应那条子入口的码
//   都没有 = **无权限门**（不是遗漏，理由逐条写在下面）
//
// ⚠️ 页面**进入时的行为**不在这里：本表只回答「他能不能进」。
//    页内的 tab / 按钮清单由调用方拿 `entries` 再 ∩ 权限点（走 services/pageAccess.js）。
// ---------------------------------------------------------------------------

export const PAGES = {
	// 工作台：**无权限门** —— 它是启动页，任何登录成功的管理员都该看得到
	//（哪怕一个模块权限都没有：首页要负责把「你没有功能可用」这句话说清楚）
	[PAGE_ADMIN_HOME]: { name: '工作台', login: true },

	// 绑定管理员账号页：**无门，连登录门都没有** —— 到达本页的唯一路径是登录回 58001，
	// 那一刻还没有 token、也没有权限点
	[PAGE_BIND]: { name: '绑定管理员账号', login: false },

	// 演示页：入口码进页；页内区块再按 DEMO_PAGE_ACTIONS 裁（缺码给「无权限」空态，不退页）
	[PAGE_DEMO]: { name: '演示', login: true, entries: [{ key: 'demo', code: PERM_DEMO_MANAGE }] },

	// 示例子菜单两页：各用各的页面码（与首页子入口同判据）
	[PAGE_DEMO_A]: { name: '示例页 A', login: true, entries: [DEMO_SUBMENU_ENTRIES[0]] },
	[PAGE_DEMO_B]: { name: '示例页 B', login: true, entries: [DEMO_SUBMENU_ENTRIES[1]] },

	// 工具页：**无门** —— 只回传一个值、不取任何业务数据，语境完全跟随来源页
	[PAGE_FIELD_EDITOR]: { name: '编辑', login: false },
	[PAGE_REGION_PICKER]: { name: '选择地区', login: false }
};