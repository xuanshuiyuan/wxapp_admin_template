#!/usr/bin/env node
// ---------------------------------------------------------------------------
// 发布产物体检（可执行闸门，替代「grep 一个写死的端口」）
//
// 检查四件事：
//   ① 生产环境变量不允许出现演示/联调旁路（VITE_DEMO_MODE / MOCK_LOGIN_CODE / DEVELOP_BYPASS）；
//   ② 当前平台的域名已填（不是 REPLACE_*；h5 允许留空走同域相对路径）；
//   ③ 构建产物里没有 localhost / REPLACE_ / 演示 token，且确实包含生产域名；
//   ④ pages.json（含 subPackages）里没有残留演示页。
//
// 用法：npm run build:<端> && npm run check:release [-- mp-weixin|h5|app]
// 退出码 1 = 不可发布。
// ---------------------------------------------------------------------------

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = process.cwd();
const platform = process.argv[2] || process.env.npm_config_platform || 'mp-weixin';
const DIST = join(ROOT, 'dist/build', platform);
// 每个端读自己的 host 键（H5 同域部署允许留空 → 走相对路径）
const HOST_KEY = { 'mp-weixin': 'VITE_HOST_MP', h5: 'VITE_HOST_H5', app: 'VITE_HOST_APP' };
const hostKey = HOST_KEY[platform];
if (!hostKey) {
	console.error(`❌ 未知平台 ${platform}（只支持 mp-weixin / h5 / app）`);
	process.exit(1);
}

const errors = [];
const infos = [];

/** 读 .env 文件（存在才读），返回 key → value（去引号 / 去空白） */
function readEnv(file) {
	const map = {};
	if (!existsSync(file)) return map;
	for (const line of readFileSync(file, 'utf8').split('\n')) {
		const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
		if (!m) continue;
		map[m[1]] = m[2].replace(/^['"]|['"]$/g, '').trim();
	}
	return map;
}

// .env.production.local 优先级更高（Vite 的加载顺序），后读覆盖先读
const prod = { ...readEnv(join(ROOT, '.env.production')), ...readEnv(join(ROOT, '.env.production.local')) };

if (prod.VITE_DEMO_MODE === 'true') {
	errors.push('VITE_DEMO_MODE=true：生产包会出现「任意账号 + 任意密码可进入」的演示登录（鉴权旁路）');
}
if (prod.VITE_MOCK_LOGIN_CODE) {
	errors.push('VITE_MOCK_LOGIN_CODE 非空：非微信端联调通道会带进生产');
}
if (prod.VITE_DEVELOP_BYPASS) {
	errors.push('VITE_DEVELOP_BYPASS 非空：签名旁路只允许 local / develop');
}

const host = prod[hostKey] || '';
if (platform === 'h5' && !host) {
	// H5 同域部署：留空 = 相对路径，合法
	infos.push('H5 未配置 host（按同域相对路径部署）');
} else if (!host) {
	errors.push(`.env.production 的 ${hostKey} 为空：小程序/App 必须使用绝对地址`);
} else if (/REPLACE_/.test(host)) {
	errors.push(`${hostKey} 仍是占位值：${host}`);
} else if (!/^https?:\/\//.test(host)) {
	errors.push(`${hostKey} 必须是 http(s) 绝对地址：${host}`);
}

if (!existsSync(DIST)) {
	errors.push(`产物目录不存在：dist/build/${platform}（先 npm run build:${platform}）`);
} else {
	const TEXT_EXT = new Set(['.js', '.json', '.wxml', '.wxss', '.html', '.css', '.map']);
	const files = [];
	(function walk(dir) {
		for (const name of readdirSync(dir)) {
			const p = join(dir, name);
			const st = statSync(p);
			if (st.isDirectory()) walk(p);
			else if (TEXT_EXT.has(extname(p))) files.push(p);
		}
	})(DIST);

	// ⚠️ 用「带端口的正则」而不是裸 localhost：uview 依赖的 async-validator 里有
	//    URL 校验正则，裸字符串会永久误报（复评 R-2）
	const needles = [
		[/localhost:\d+/, '产物里出现 localhost:<端口>（开发域名发到生产）'],
		[/127\.0\.0\.1:\d+/, '产物里出现 127.0.0.1:<端口>'],
		[/REPLACE_/, '产物里出现未替换的 REPLACE_ 占位'],
		[/demo-token-not-a-real-one/, '产物里出现演示会话 token（演示代码未剥离）']
	];
	for (const [re, msg] of needles) {
		const hit = files.find((f) => re.test(readFileSync(f, 'utf8')));
		if (hit) errors.push(`${msg}：${hit.replace(ROOT + '/', '')}`);
	}

	if (host && !/REPLACE_/.test(host)) {
		const normalized = host.replace(/\/+$/, '');
		const found = files.some((f) => readFileSync(f, 'utf8').includes(normalized));
		if (!found) errors.push(`产物里找不到生产域名 ${normalized}（host 配置没进包？）`);
	}

	infos.push(`扫描 ${files.length} 个文本产物文件`);
}

// 演示页仍在 pages.json = 生产包保留演示入口（不阻断，但必须知情）
try {
	const pages = JSON.parse(
		readFileSync(join(ROOT, 'src/pages.json'), 'utf8')
			.replace(/\/\/.*$/gm, '')
			.replace(/\/\*[\s\S]*?\*\//g, '')
	);
	// 主包 + 分包一起扫（演示页将来可能被移入分包）
	const allPages = [...(pages.pages || [])];
	for (const sp of pages.subPackages || []) {
		for (const p of (sp && sp.pages) || []) allPages.push({ path: `${sp.root}/${p.path}` });
	}
	const demo = allPages.filter((p) => String(p.path || '').includes('demo'));
	if (demo.length) {
		errors.push(
			`pages.json（含 subPackages）仍注册了 ${demo.length} 个演示页：` +
				demo.map((p) => p.path).join(', ') +
				' —— 发布前去演示化见 README §4.1'
		);
	}
} catch (e) {
	errors.push(`pages.json 解析失败：${e.message}`);
}

for (const line of infos) console.log(`  ℹ️  ${line}`);

if (errors.length) {
	console.error('\n❌ 发布产物体检未通过：');
	for (const e of errors) console.error(`   - ${e}`);
	process.exit(1);
}

console.log('\n✅ 发布产物体检通过');