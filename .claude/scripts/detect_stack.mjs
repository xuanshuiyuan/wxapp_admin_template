#!/usr/bin/env node
// ---------------------------------------------------------------------------
// detect_stack.mjs —— 技术栈指纹识别
//
// 为什么需要它：本 AI 工程系统的规则与模板都是「语言无关」的，
// 落地时必须先知道当前是什么栈，否则会生成与实际不符的代码
// （在 Vue 项目里给 Java 风格的 Controller 模板，是最典型的串栈事故）。
//
// 用法：
//   node .claude/scripts/detect_stack.mjs            # 人类可读输出
//   node .claude/scripts/detect_stack.mjs --json     # 机器可读（喂给 AI）
//   node .claude/scripts/detect_stack.mjs --json --path ../other-project
//
// 退出码：0 = 识别成功；1 = 无法识别（需人工确认）
// ---------------------------------------------------------------------------

import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';

const argv = process.argv.slice(2);
const AS_JSON = argv.includes('--json');
const pathIdx = argv.indexOf('--path');
const ROOT = resolve(pathIdx !== -1 && argv[pathIdx + 1] ? argv[pathIdx + 1] : process.cwd());

/** 安全读 JSON：文件不存在或解析失败都返回 null（识别脚本不该因为一个坏文件而崩） */
async function readJSON(p) {
	try {
		return JSON.parse(await readFile(p, 'utf8'));
	} catch {
		return null;
	}
}

/** 文件是否存在（同步版，用于密集判断） */
const has = (rel) => existsSync(join(ROOT, rel));

/** package.json 的依赖里是否含任一关键词 */
function depHas(pkg, names) {
	if (!pkg) return false;
	const all = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
	return names.some((n) => Object.prototype.hasOwnProperty.call(all, n));
}

async function detect() {
	const pkg = await readJSON(join(ROOT, 'package.json'));
	const result = {
		root: ROOT,
		name: (pkg && pkg.name) || basename(ROOT),
		description: (pkg && pkg.description) || '',
		form: 'unknown', // frontend | backend | fullstack | library
		language: 'unknown',
		framework: 'unknown',
		runtime: [],
		build: 'unknown',
		ui: 'unknown',
		packageManager: 'unknown',
		testFramework: 'none',
		backendContract: 'unknown',
		evidence: [], // ★ 每条判定都留下证据，便于人工复核
		notes: []
	};

	const addEvidence = (path, note) => result.evidence.push({ anchor: path, note });

	// ── 1. 形态与语言：多栈共存时取「最内层可编译单元」 ──────────────────
	if (pkg) {
		result.language = has('tsconfig.json') ? 'TypeScript' : 'JavaScript';
		result.packageManager = has('pnpm-lock.yaml')
			? 'pnpm'
			: has('yarn.lock')
				? 'yarn'
				: has('package-lock.json')
					? 'npm'
					: 'npm (未锁定)';
		addEvidence('package.json', `name=${result.name}`);
		if (has('tsconfig.json')) addEvidence('tsconfig.json', '语言判定为 TypeScript');
	}

	// 前端框架
	if (depHas(pkg, ['@dcloudio/uni-app'])) {
		result.form = 'frontend';
		result.framework = 'uni-app';
		addEvidence('package.json', '@dcloudio/uni-app → uni-app 跨端');
	}
	if (depHas(pkg, ['@dcloudio/vite-plugin-uni']) || has('vite.config.js') || has('vite.config.ts')) {
		result.build = 'Vite';
		addEvidence('vite.config.*', '构建工具为 Vite');
	}
	if (depHas(pkg, ['vue'])) {
		result.framework = result.framework === 'uni-app' ? 'uni-app (Vue 3)' : 'Vue';
		addEvidence('package.json', `vue@${(pkg.dependencies || {}).vue || (pkg.devDependencies || {}).vue}`);
	}
	if (depHas(pkg, ['react'])) {
		result.form = result.form === 'frontend' ? result.form : 'frontend';
		result.framework = 'React';
		addEvidence('package.json', 'react → React 前端');
	}
	if (depHas(pkg, ['uview-plus'])) {
		result.ui = 'uview-plus';
		addEvidence('package.json', 'uview-plus → UI 库');
	}
	if (has('src/uni_modules')) {
		result.ui = result.ui === 'unknown' ? 'uni_modules（未知组件库）' : result.ui;
		addEvidence('src/uni_modules/', 'uni-app 插件目录（整包第三方，勿手改）');
	}
	if (depHas(pkg, ['sass', 'sass-loader'])) {
		addEvidence('package.json', 'sass → SCSS 样式');
	}

	// 后端形态（Node）
	if (depHas(pkg, ['express'])) {
		result.form = result.form === 'frontend' ? 'fullstack' : 'backend';
		result.framework = 'Express';
		addEvidence('package.json', 'express → Node 后端');
	}
	if (depHas(pkg, ['koa'])) {
		result.form = result.form === 'frontend' ? 'fullstack' : 'backend';
		result.framework = 'Koa';
		addEvidence('package.json', 'koa → Node 后端');
	}
	if (depHas(pkg, ['@nestjs/core'])) {
		result.form = result.form === 'frontend' ? 'fullstack' : 'backend';
		result.framework = 'NestJS';
		addEvidence('package.json', '@nestjs/core → NestJS 后端');
	}

	// 其它语言
	if (has('go.mod')) {
		result.language = result.language === 'unknown' ? 'Go' : `${result.language} + Go`;
		result.form = result.form === 'unknown' ? 'backend' : 'fullstack';
		addEvidence('go.mod', 'Go 模块');
	}
	if (has('pom.xml') || has('build.gradle') || has('build.gradle.kts')) {
		result.language = result.language === 'unknown' ? 'Java' : `${result.language} + Java`;
		result.form = result.form === 'unknown' ? 'backend' : 'fullstack';
		addEvidence(has('pom.xml') ? 'pom.xml' : 'build.gradle', 'Java 构建');
	}
	if (has('composer.json')) {
		result.language = result.language === 'unknown' ? 'PHP' : `${result.language} + PHP`;
		result.form = result.form === 'unknown' ? 'backend' : 'fullstack';
		addEvidence('composer.json', 'PHP 依赖');
	}
	if (has('requirements.txt') || has('pyproject.toml') || has('Pipfile')) {
		result.language = result.language === 'unknown' ? 'Python' : `${result.language} + Python`;
		result.form = result.form === 'unknown' ? 'backend' : 'fullstack';
		addEvidence(has('pyproject.toml') ? 'pyproject.toml' : 'requirements.txt', 'Python 依赖');
	}
	if (has('Cargo.toml')) {
		result.language = result.language === 'unknown' ? 'Rust' : `${result.language} + Rust`;
		addEvidence('Cargo.toml', 'Rust 工程');
	}

	// ── 2. 多端运行时（uni-app 特有：从 .env 与 manifest 推断） ──────────
	const envText = (await safeRead(join(ROOT, '.env.development'))) + (await safeRead(join(ROOT, '.env.production')));
	if (/VITE_HOST_MP/.test(envText)) result.runtime.push('mp-weixin');
	if (/VITE_HOST_H5/.test(envText)) result.runtime.push('h5');
	if (/VITE_HOST_APP/.test(envText)) result.runtime.push('app');
	if (/VITE_APP_ENV/.test(envText)) addEvidence('.env.*', 'Vite 环境变量（VITE_ 前缀）');
	if (result.runtime.length) addEvidence('.env.*', `多端：${result.runtime.join(' / ')}`);

	// ── 3. 测试框架 ─────────────────────────────────────────────────────
	if (depHas(pkg, ['vitest'])) result.testFramework = 'vitest';
	else if (depHas(pkg, ['jest'])) result.testFramework = 'jest';
	else if (depHas(pkg, ['mocha'])) result.testFramework = 'mocha';
	if (result.testFramework !== 'none') addEvidence('package.json', `测试框架：${result.testFramework}`);
	else if (pkg) addEvidence('package.json', '未发现测试框架依赖 → 测试默认只生成不执行');

	// ── 4. 后端契约（从 HTTP 层推断统一响应格式） ────────────────────────
	const reqPath = join(ROOT, 'src/services/http/request.js');
	if (existsSync(reqPath)) {
		const reqSrc = await safeRead(reqPath);
		if (/body\.code|numericCode/.test(reqSrc) && /CODE_SUCCESS/.test(reqSrc)) {
			result.backendContract = '{ code, msg, data }（code=0 成功）';
			addEvidence('src/services/http/request.js', '统一响应格式为 {code,msg,data}');
		}
	}

	// ── 5. 补充观察（给 AI 的上下文提示） ───────────────────────────────
	const srcDirs = await listDirs(join(ROOT, 'src'));
	for (const d of ['pages', 'components', 'composables', 'services', 'store', 'config', 'utils', 'api']) {
		if (srcDirs.includes(d)) result.notes.push(`src/${d}/`);
	}

	return result;
}

async function safeRead(p) {
	try {
		return await readFile(p, 'utf8');
	} catch {
		return '';
	}
}

async function listDirs(p) {
	try {
		const entries = await readdir(p, { withFileTypes: true });
		return entries.filter((e) => e.isDirectory()).map((e) => e.name);
	} catch {
		return [];
	}
}

function render(r) {
	const L = [];
	L.push('');
	L.push('═══ 技术栈指纹 ═══════════════════════════════════════════');
	L.push(`  项目      ${r.name}`);
	if (r.description) L.push(`  描述      ${r.description}`);
	L.push(`  根目录    ${r.root}`);
	L.push('  ─────────────────────────────────────────────────────');
	L.push(`  形态      ${r.form}`);
	L.push(`  语言      ${r.language}`);
	L.push(`  框架      ${r.framework}`);
	if (r.runtime.length) L.push(`  运行端    ${r.runtime.join(' / ')}`);
	L.push(`  构建      ${r.build}`);
	L.push(`  UI        ${r.ui}`);
	L.push(`  包管理    ${r.packageManager}`);
	L.push(`  测试框架  ${r.testFramework === 'none' ? '无（默认只生成测试，不执行）' : r.testFramework}`);
	L.push(`  后端契约  ${r.backendContract}`);
	if (r.notes.length) L.push(`  src 分层  ${r.notes.join('  ')}`);
	L.push('  ── 识别证据 ──────────────────────────────────────────');
	for (const e of r.evidence) L.push(`  · ${e.anchor.padEnd(28)} ${e.note}`);
	L.push('══════════════════════════════════════════════════════════');
	L.push('');
	L.push('提示：本节结果应与 .claude/CLAUDE.md §2 一致；');
	L.push('      不一致时以 CLAUDE.md §2 为准，并手动同步该章节。');
	L.push('');
	return L.join('\n');
}

const result = await detect();

if (AS_JSON) {
	console.log(JSON.stringify(result, null, 2));
} else {
	console.log(render(result));
}

// 识别失败（既不是已知前端也不是已知后端）→ 非零退出，提示人工确认
process.exit(result.framework === 'unknown' && result.language === 'unknown' ? 1 : 0);