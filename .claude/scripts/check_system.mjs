#!/usr/bin/env node
// ---------------------------------------------------------------------------
// check_system.mjs —— .claude/ 系统自检
//
// 检查七件事 + 结构存在性（都不需要第三方依赖）：
//   1. 空文件        —— 系统规定「不允许空文件」
//   2. Agent 完整性  —— 每个 agent 必须含 7 个必备段落（见 .claude/CLAUDE.md §5.2）
//   3. YAML 合法性   —— workflows 的缩进/结构/关键字段（轻量校验，不引 yaml 库）
//   4. 流程铁律      —— reviewer 必须是每条 workflow 的最后一步
//   5. 交叉引用      —— CLAUDE.md 里列的 agents/workflows 与实际文件是否一致
//   6. ★ 符号存在性  —— `.claude/` 提到的 `ENDPOINT_*` 等常量族与 `$scss` 变量
//                       必须在 `src/` 真实存在（错误级）；类名与 `name()` 调用形为警告级
//                       （为什么必须有这条：见 K-25）
//   7. ★ 路由一致性  —— `src/config/access.js` 的 `PAGE_*` ⟷ `src/pages.json` 的
//                       注册页面必须一一对应（2026-10-27 加：页面清单的真相源在配置里，
//                       两处不同步会让页面**跳不过去**）
//   8. ★ 脏标记一致性 —— 分页列表进子页必须参与「返回刷新」脏标记（v1.2.2 加）
//
// ⚠️ 原先的「rules/ ↔ rule-skill 按日期比对」已于 2026-11-16 **删除**：
//    `.claude/rules/` 整个目录已迁入 rule-skill 并删除（删前逐条审计过缺口），
//    没有第二份来源可比日期。
//
// 用法：
//   node .claude/scripts/check_system.mjs           # 人类可读
//   node .claude/scripts/check_system.mjs --json    # 机器可读
//
// 退出码：0 = 全部通过（可能有警告）；1 = 有错误（系统损坏）
// ---------------------------------------------------------------------------

import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = resolve(fileURLToPath(new URL('.', import.meta.url)));
const CLAUDE_DIR = resolve(HERE, '..'); // .claude/
const ROOT = resolve(CLAUDE_DIR, '..');
const AS_JSON = process.argv.includes('--json');

const errors = [];
const warnings = [];
const info = [];

const err = (scope, msg) => errors.push({ scope, msg });
const warn = (scope, msg) => warnings.push({ scope, msg });

// ── 工具 ─────────────────────────────────────────────────────────────────
async function walk(dir, out = []) {
	let entries;
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return out;
	}
	for (const e of entries) {
		const full = join(dir, e.name);
		if (e.isDirectory()) await walk(full, out);
		else if (e.isFile()) out.push(full);
	}
	return out;
}

async function read(p) {
	try {
		return await readFile(p, 'utf8');
	} catch {
		return '';
	}
}

const rel = (p) => relative(ROOT, p);

// ── 1. 空文件检查 ────────────────────────────────────────────────────────
async function checkEmptyFiles() {
	const files = await walk(CLAUDE_DIR);
	let empty = 0;
	for (const f of files) {
		const s = await stat(f);
		if (s.size === 0) {
			err('空文件', `${rel(f)} 是空文件（系统规定不允许空文件）`);
			empty++;
		}
	}
	info.push(`扫描 ${files.length} 个文件，空文件 ${empty} 个`);
	return files;
}

// ── 2. Agent 完整性 ──────────────────────────────────────────────────────
// 必备段落（.claude/CLAUDE.md §5.2）
const REQUIRED_SECTIONS = [
	{ key: '职责', re: /^##+\s*职责/m },
	{ key: '输入', re: /^##+\s*输入/m },
	{ key: '输出', re: /^##+\s*输出/m },
	{ key: '工作步骤', re: /^##+\s*工作步骤/m },
	{ key: '禁止事项', re: /^##+\s*禁止事项/m },
	{ key: '输出规范', re: /^##+\s*输出规范/m },
	{ key: '升级条件', re: /^##+\s*升级条件/m }
];

async function checkAgents() {
	const dir = join(CLAUDE_DIR, 'agents');
	const files = (await readdir(dir).catch(() => [])).filter((f) => f.endsWith('.md')).sort();
	const names = [];

	if (files.length === 0) err('agents', 'agents/ 目录下没有任何 .md 文件');

	for (const f of files) {
		const p = join(dir, f);
		const src = await read(p);
		const name = basename(f, '.md');
		names.push(name);

		// frontmatter 必须存在且含 name / description（Claude Code 子代理格式）
		const fm = src.match(/^---\n([\s\S]*?)\n---/);
		if (!fm) {
			err('agents', `${f} 缺少 frontmatter（应为 --- name/description/tools ---）`);
		} else {
			if (!/^name:\s*\S+/m.test(fm[1])) err('agents', `${f} frontmatter 缺少 name`);
			if (!/^description:\s*\S+/m.test(fm[1])) err('agents', `${f} frontmatter 缺少 description`);
			const fmName = (fm[1].match(/^name:\s*(\S+)/m) || [])[1];
			if (fmName && fmName !== name) {
				warn('agents', `${f} 的 frontmatter name="${fmName}" 与文件名不一致`);
			}
		}

		// 必备段落
		const missing = REQUIRED_SECTIONS.filter((s) => !s.re.test(src)).map((s) => s.key);
		if (missing.length) {
			err('agents', `${f} 缺少必备段落：${missing.join(' / ')}（见 CLAUDE.md §5.2）`);
		}
	}
	info.push(`agents：${files.length} 个（${names.join(', ')}）`);
	return names;
}

// ── 3. Workflow YAML 校验（轻量：不引 yaml 库） ──────────────────────────
async function checkWorkflows() {
	const dir = join(CLAUDE_DIR, 'workflows');
	const files = (await readdir(dir).catch(() => [])).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml')).sort();
	const names = [];

	if (files.length === 0) err('workflows', 'workflows/ 目录下没有任何 .yaml 文件');

	for (const f of files) {
		const p = join(dir, f);
		const src = await read(p);
		names.push(basename(f, '.yaml'));

		// 3.1 不得用 Tab 缩进（YAML 禁止）
		if (/^\t/m.test(src)) err('workflows', `${f} 含 Tab 缩进（YAML 禁止 Tab）`);

		// 3.2 必须含顶层关键字段
		for (const key of ['name', 'description', 'stages', 'quality_gates']) {
			if (!new RegExp(`^${key}:`, 'm').test(src)) {
				err('workflows', `${f} 缺少顶层字段 ${key}:`);
			}
		}

		// 3.3 stages 必须是非空列表，且每项有 agent
		const stagesBlock = src.split(/^stages:\s*$/m)[1];
		if (!stagesBlock) {
			err('workflows', `${f} 找不到 stages: 段`);
		} else {
			const stopIdx = stagesBlock.search(/^[a-z_]+:\s*$/m);
			const body = stopIdx === -1 ? stagesBlock : stagesBlock.slice(0, stopIdx);
			const agentCount = (body.match(/^\s*-\s*id:/gm) || []).length;
			if (agentCount === 0) err('workflows', `${f} 的 stages 为空（至少要有一步）`);

			// 3.4 ★ reviewer 必须是最后一步（流程铁律，见 CLAUDE.md §6.1-1）
			const agentRefs = [...body.matchAll(/^\s*agent:\s*"?([^"\n]+)"?\s*$/gm)].map((m) => m[1].trim());
			if (agentRefs.length === 0) {
				err('workflows', `${f} 的 stages 里没有任何 agent: 字段`);
			} else {
				const last = agentRefs[agentRefs.length - 1];
				if (!/\breviewer\b/.test(last)) {
					err(
						'workflows',
						`${f} 的最后一步 agent 是 "${last}"，不是 reviewer（违反流程铁律 CLAUDE.md §6.1-1）`
					);
				}
				if (!agentRefs.some((a) => /\breviewer\b/.test(a))) {
					err('workflows', `${f} 全程没有 reviewer 步骤`);
				}
			}
		}

		// 3.5 不许跳过 service / test（CLAUDE.md §6.1-2）——
		//     允许通过 not_applicable: 显式声明豁免（显式声明 ≠ 静默省略）
		//     ★ 正则用 (service|test)(_agent)? 而非 \bservice\b —— 因为下划线是单词字符，
		//       \bservice\b 匹配不到 "service" 后紧跟 "_agent" 的写法（踩过）
		const exempt = new Set(
			[...src.matchAll(/^\s*-\s*step:\s*(\w+)\s*$/gm)].map((m) => m[1].toLowerCase())
		);
		if (!/(service|backend_service|repository_agent)/.test(src) && !exempt.has('service')) {
			warn('workflows', `${f} 未提及 service 层，且未用 not_applicable 声明豁免（CLAUDE.md §6.1-2）`);
		}
		if (!/test(_agent)?/.test(src) && !exempt.has('test')) {
			warn('workflows', `${f} 未提及 test 步骤，且未用 not_applicable 声明豁免（CLAUDE.md §6.1-2）`);
		}
	}
	info.push(`workflows：${files.length} 个（${names.join(', ')}）`);
	return names;
}

// ── 3.6 符号存在性（.claude/ 提到的项目符号必须在 src/ 真实存在） ──────────
//
// 为什么要有这条：原来的 rules↔rule-skill 检查只比**日期**，比不出「内容指向已删除的符号」。
// 那类问题会让 AI 照着一份「看着很有依据」的错误文档
// 写代码 —— 2026-10-26 的 K-25（.claude 里 50 个文件写着 C 端已删符号）就是靠人工
// 三轮 grep 才挖净的，而每次 grep 的关键词表都漏（第一轮漏 `品牌黄`/`list-item`/`实名`，
// 第二轮漏「同一节的另一半」）。故把判据固化成脚本。
//
// ★ 与「有意保留的警示行」配套的约定：
//   **任何声明某符号已删除 / 不存在的行都不参与检查**（HISTORICAL_MARKERS）。
//   所以文档里可以放心写「`pages/login` 已删除，别照着写」—— 那正是防复发要留的话。
//
// 四类判据（前两类是错误级，后两类是警告级 —— 见各自的 FP 风险说明）：
//   ① 常量家族：ENDPOINT_* / CODE_* / PERM_* / FORM_TYPE_* / FIELD_GROUP_* / MODULE_TYPE_*
//      —— 这些名字只可能来自 config/，零假阳性
//   ② SCSS 变量：`$xxx` 必须在 src/ 里**有定义**（theme.scss 或任一组件的局部变量都算）
//   ③ 类名：`.xxx` 必须在 src/ 的样式里有定义（uview 的 u-*/up-* 走白名单）
//      —— 两种写法都查：反引号包的 `` `.foo` `` 与不带前导点的 `` `foo__bar` ``（BEM 私有类）
//      ⚠️ 只认**小写**类名（本工程类名一律小写 — 含大写字母的写成 `.Foo` 时抓不到，是会漏的方向）；
//         代码围栏/表格里**不带反引号**的 `.foo` 也不查（会把 `.claude` 这类路径当类名，误报面大）
//   ④ 调用形 camelCase：`name()` 必须在 src/ 里有**声明**（export 或局部 function / const）
//      —— ③④ 是警告级：模板与示例里会出现通用占位名；④ 另有见其循环体内的「弱判据」说明
//   ⚠️ **不覆盖**（有意，别误以为它管得比实际宽）：非常量族的常量（`SESSION_FIELDS` /
//      `HOME_ENTRIES` / `config/theme.js` 的键 / `entries.js` 的字段）。要覆盖得另加判据。
const HISTORICAL_MARKERS = [
	'已删', '不存在', '别照着', '旧文档', '历史', '更正', '作废',
	'已从', '取代原', '迁移过来', '迁移批', 'C 端', '曾',
	// 下面几个是实测补的：文档声明"本工程没有 X" / "已收口"最常这么写
	'没有', '别再', '未定义', '不存', '收口', '删掉', '删除'
];

// ★ 标记词只在**与符号同一个分句**里才豁免（2026-10-26 尾轮由 reviewer 打回后收紧）。
// **为什么不整行豁免**：上面那张表里有 `没有` / `曾` / `删除` 这类中文里极常见的词，
// 整行豁免等于「一行里随便哪里沾上就整行免检」。reviewer 实测证据：
// `project-meta/modules/ledger/business-logic.md:274` 的 `$sp-4` 就是被**同一行另一分句**
// 里一个无关的「没有」豁免掉的 —— 真缺陷可以就此躲过。按标点切句后**就近判定**即可堵住，
// 同时「X 已删除，别照着写」这类正当警示行仍然豁免（标记词与符号同句）。
//
//   ⚠️ **哪些标点算命中的「分句边界」**（2026-10-26 尾轮三次试错后的最终口径）：
//   算：`，。；` + 逗号/分号/问叹的 ASCII 形 + 表格单元格的 `|`
//   不算：**括号（`（）` `()`）** —— 函数调用的括号就在符号**内部**，一切就把
//        `` `isKnownFormType()` 导出一并删除 `` 切成「…isKnownFormType」+「) 导出一并删除」，
//        同句的「删除」掉到另一分句 → 正当警示行被误报（实测踩过）；
//        括号是限制语，本来就属于宿主分句。
//   不算：**顿号 `、` 与引号 `【】「」`** —— `、` 是**同一分句内**的并列项分隔符
//        （「A、B、C 均已删除」的删除覆盖整个并列），引号是行内强调。
//        把 `、` 当边界会让「枚举里第一个符号被查、后面的被豁免」这类随机行为。
//   不算：**冒号 `：`/`:`** —— 它是「标签：取值」的**呈现**分隔符，不是分句边界。
//        算它会让 `本工程没有这个：\`CODE_X\`` 这类正当警示行被误报（`reviewer` 给的可复现构造）。
//        ⚠️ 但 `！？`/`!?` **算**边界 —— 那是**句末**标点，跨过它确实是另一句。
//   ★ **换行**：默认**不算**边界（本工程 `.md` 是硬换行的，一句话常被折成多行），
//      只有**块级起点**才算 —— 空行（段落断开）、行首是列表/引用/表格/标题标记（`- * + > | #`、`1.`）。
//      ⚠️ 已知盲区（`reviewer` 2026-10-26 指出，可复现）：**两行连续散文**且前一行结尾没有
//      句末标点时，两行仍算同一分句 —— 于是「前一行写符号、后一行带标记词」会漏报。
//      对策是**写法**而非脚本：警示行请把标记词写在**符号所在的那一行**（见 CLAUDE.md §11）。
const CLAUSE_SPLIT = /[，。；,;!?！？|]/;
// 块级起点正则：行首是列表/引用/表格/标题标记 → 该行起点是分句边界
const BLOCK_LINE_START = /^\s*(?:[-*+>|#]|\d+\.)/;

// ② 的白名单：Vue / uni 运行时的 `$` 前缀 API（`uni.$on` / `$once` / `$emit` …），不是 SCSS 变量
const DOLLAR_API_ALLOW = new Set([
	'on', 'once', 'off', 'emit', 'refs', 'ref', 'nextTick', 'set', 'delete',
	'el', 'parent', 'root', 'slots', 'attrs', 'props', 'data', 'watch', 'forceUpdate'
]);

// ② 的白名单：**元变量**（讲「这个机制怎么运作」时用的占位名，不指任何真实 token）。
// 由来：`known_issues.md` K-25 行要描述「真源从 src/ 抽（声明 / `$var` 定义 / …）」，
// 那个 `$var` 是「一个 SCSS 变量」的概念占位，不是声称本工程有名为 var 的 token。
const SCSS_META_ALLOW = new Set(['var', 'name', 'value', 'xxx', 'yyy']);

// ③ 的白名单：**示例页面前缀**（`rule-add-page` 的骨架里用它们当占位，不是本工程真有的类）
// + 通用元变量类名（`foo` / `bar`，与 ④ 的 CALL_ALLOWLIST 同一族 —— 讲"类名怎么写"时的占位）
// + `design-preview` 的设计稿类名（只存在于 docs/design 的 HTML mockup，不在 src/）：
//   它们是稿子里的版式块名，不是对 Vue 实现的断言；不登记会被误报成「C 端遗留块名」。
const PLACEHOLDER_CLASSES = new Set([
	'vlist-page', 'fform', 'foo', 'bar',
	'urole', 'actionbar', 'chk', 'selall'
]);

// ③ 的「合成文件」：examples / templates **本身就是骨架与示例**，其 `class="…"` 是占位前缀，
//    不是对本工程的断言（反过来说：散文里反引号包的 `.foo` 仍然会被查 —— 那才是"声称本工程有它"）
const SYNTHETIC_PATHS = ['.claude/examples/', '.claude/templates/'];

// ② 的 JSON Schema 关键字（response.schema.json 里的 `$ref` / `$schema` 不是 SCSS 变量）
const JSON_SCHEMA_KEYS = new Set(['ref', 'schema', 'id', 'defs', 'comment', 'anchor', 'dynamicRef']);

// ① 的已知**虚构示例**（`examples/README.md` 与 CLAUDE.md §10.3 规定的教学用假契约，不是编造）
const FICTIONAL_CONSTANTS = new Set(['ENDPOINT_VEHICLE_LIST']);

// ③ 的文件名排除表：`\\`.gitignore\\`` / `\\`.wxml\\`` 这类**文件**会被类名正则误抓
const NOT_A_CLASS = new Set([
	'gitignore', 'last-sync', 'wxml', 'wxss', 'ts', 'js', 'mjs', 'json', 'md', 'scss',
	'css', 'html', 'yml', 'yaml', 'sh', 'vue', 'env', 'npmrc', 'nvmrc', 'editorconfig',
	'prettierrc', 'eslintrc', 'browserslistrc', 'husky', 'codegraph', 'claude', 'git'
]);

// 明确不参与检查的路径：**审计记录**（必然保留旧符号）+ 脚本自身（注释里谈旧符号）
const SYMBOL_SKIP_PATHS = [
	'.claude/CHANGELOG.md',
	'.claude/changelog/',          // 归档的历史条目（2026-11-02 从 CHANGELOG.md 拆出）
	'.claude/project-meta/versions/',
	'.claude/scripts/',
	'changelog.md',
	'bug_history.md'   // 与 CHANGELOG 同类：记录**过去**的 bug，必然提到当时的符号名
];

// ③ 的白名单前缀：第三方（uview / uni-app 运行时）的类名不在本仓有定义
const CLASS_ALLOW_PREFIX = /^\.(u-|up-|uni-|color-|cu-|bg-|text-|flex|margin|padding)/;

// ④ 的白名单：文档里的**通用示例名**（不是项目符号，也不必在 src 里有声明）
const CALL_ALLOWLIST = new Set([
	'doThing', 'fetchList', 'doLogin', 'doBind', 'someFn', 'myFn', 'foo', 'bar'
]);

async function checkSymbolExistence() {
	const srcFiles = (await walk(join(ROOT, 'src')))
		.filter((f) => /\.(js|vue|scss|css)$/.test(f) && !f.includes('uni_modules'));

	// ── 真源集合 ──
	const configNames = new Map();   // 'config/dict' → Set(names)
	const declared = new Set();      // src/ 里所有 export 或局部声明的标识符
	const scssVars = new Set();      // src/ 里所有 $var 定义（含组件局部）
	const classNames = new Set();    // src/ 里所有 .class 定义

	for (const f of srcFiles) {
		const src = await read(f);
		const r = rel(f);

		// ⚠️ 这份文件名清单是**硬编码**的：新增/改名 config 文件时**必须同步改这里**，
		// 否则它的导出不进 configNames，第 ⑦ 条会把文档里所有引用该文件的族常量报成
		// 「config/ 里没有它（已删？还是编造？）」。2026-10-27：`entries` → `access`
		//（入口清单与页面路径合并进 `config/access.js`）。
		if (/config\/(dict|endpoints|app|env|access|theme)\.js$/.test(r)) {
			const key = r.replace(/^src\//, '');
			const set = configNames.get(key) || new Set();
			for (const m of src.matchAll(/export\s+(?:const|function|class)\s+([A-Za-z_$][\w$]*)/g)) set.add(m[1]);
			configNames.set(key, set);
		}
		if (/\.(js|vue)$/.test(f)) {
			for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function|const|class|let)\s+([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
			for (const m of src.matchAll(/(?:^|\n)\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
			for (const m of src.matchAll(/(?:^|\n)\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)) declared.add(m[1]);
			// 命名再导出（`export { sessionReady }` / `export { a as b }`）—— 只抽 `export {…}` 一种形式。
			// 为什么必须补：`src/services/route.js`、`services/http/index.js`、`store/index.js` 用的就是它，
			// 不认这种写法，那些**现役**名字将来会被 ④ 误报成「已删」。
			for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
				for (const part of m[1].split(',')) {
					const name = part.trim().split(/\s+as\s+/).pop().trim();
					if (/^[A-Za-z_$][\w$]*$/.test(name)) declared.add(name);
				}
			}
		}
		for (const m of src.matchAll(/\$([a-z][a-z0-9-]*)\s*:/g)) scssVars.add(m[1]);
		for (const m of src.matchAll(/\.([a-z][a-z0-9_-]*)/g)) classNames.add(m[1]);
		// ★ 嵌套修饰符：SCSS 里写成 `&--brand` / `&__elem`，**没有前导点** ——
		// 不认它就会把 `.tag--brand`（真实存在于 scaffold.scss 的 `.tag { &--brand }`）误报成不存在
		const stack = [];
		for (const line of src.split('\n')) {
			const top = line.match(/^\s*(\.[a-z][a-z0-9_-]*)\s*[,{]?/);
			if (top) { stack.push(top[1].slice(1)); continue; }
			const amp = line.match(/&(--|__)([a-z0-9-]+)/);
			if (amp && stack.length) classNames.add(`${stack[stack.length - 1]}${amp[1]}${amp[2]}`);
		}
	}

	// 文档会引用检查脚本自己的函数名，故把它们也算「有声明」
	for (const f of (await walk(join(CLAUDE_DIR, 'scripts'))).filter((x) => /\.mjs$/.test(x))) {
		const src = await read(f);
		for (const m of src.matchAll(/(?:function|const)\s+([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
	}

	// 所有 config/ 导出名并集（判断 ① 时用它 —— 家族名只可能来自这些文件）
	const allConfigNames = new Set();
	for (const set of configNames.values()) for (const n of set) allConfigNames.add(n);

	// ── 扫 .claude/ ──
	const claudeFiles = (await walk(CLAUDE_DIR)).filter((f) => /\.(md|json|vue|js|yaml)$/.test(f));
	const FAMILY = /^(ENDPOINT|CODE|PERM|FORM_TYPE|FIELD_GROUP|MODULE_TYPE)_[A-Z0-9_]+$/;
	const seen = new Set(); // 同一 (文件, 符号) 只报一次

	let scanned = 0;
	for (const f of claudeFiles) {
		const r = rel(f);
		if (SYMBOL_SKIP_PATHS.some((p) => r.includes(p))) continue;
		scanned++;
		const text = await read(f);
		const lines = text.split('\n');

		// ★ 分句区间在**整个文件**上算，不在单行上算 —— 本工程的 .md 是**硬换行**的
		// （一句话被折成多行），按行切会把「…`onFeedTap()` 函数与 / （换行）它的注释 **均已删除**」
		// 判成两个分句，于是正当警示行被误报。跨行连续才是中文文档的「句」。
		// 但**块级起点**（空行 / 列表项 / 引用 / 表格行 / 标题）要当边界，否则相邻两条
		// 列表项的文本会并成一个分句（`reviewer` 给的可复现构造）。
		const clauses = [];
		{
			const hardStarts = new Set();   // 这些绝对下标处必定断开
			let acc = 0;
			for (const L of lines) {
				// ⚠️ 记的是**上一行末尾的 `\n`**（acc - 1）而不是本行首 —— 切点在分隔符上，
				// 记错位置会把本行首字符吞进上一个分句
				if (acc > 0 && (L.trim() === '' || BLOCK_LINE_START.test(L))) hardStarts.add(acc - 1);
				acc += L.length + 1;
			}
			let s = 0;
			for (let p = 0; p <= text.length; p++) {
				if (p === text.length || CLAUSE_SPLIT.test(text[p]) || hardStarts.has(p)) { clauses.push([s, p]); s = p + 1; }
			}
		}
		// 命中位置的**绝对**下标 → 所在分句 → 该分句里有没有标记词
		const lineStart = [];
		{ let acc = 0; for (const L of lines) { lineStart.push(acc); acc += L.length + 1; } }
		const isHistorical = (abs) => {
			const c = clauses.find(([s, e]) => abs >= s && abs < e);
			return c ? HISTORICAL_MARKERS.some((mk) => text.slice(c[0], c[1]).includes(mk)) : false;
		};

		lines.forEach((line, i) => {
			const at = `${r}:${i + 1}`;
			const mark = (idx) => isHistorical(lineStart[i] + idx);   // 把行内下标换算成绝对下标

			// ① 常量家族（错误级）
			for (const m of line.matchAll(/`?\b((?:ENDPOINT|CODE|PERM|FORM_TYPE|FIELD_GROUP|MODULE_TYPE)_[A-Z0-9_]+)\b`?/g)) {
				const name = m[1];
				if (mark(m.index)) continue;         // 同句声明「已删/不存在」→ 是警示行，不是现况
				if (/X{2,}/.test(name)) continue;            // CODE_XXX 之类占位
				if (name.includes('__') || name.endsWith('_')) continue;   // ENDPOINT_<域>_<动作> / 前缀 glob
				if (line[m.index + m[0].length] === '*') continue;
				if (FICTIONAL_CONSTANTS.has(name)) continue;  // 规定的虚构示例
				if (allConfigNames.has(name)) continue;
				const k = `${at}|${name}`;
				if (seen.has(k)) continue;
				seen.add(k);
				err('symbol', `${at} 提到常量 ${name}，但 config/ 里没有它（已删？还是编造？）`);
			}

			// ② SCSS 变量（错误级）
			for (const m of line.matchAll(/(?<![.\w$])\$([a-z][a-z0-9-]*)/g)) {
				const name = m[1];
				if (mark(m.index)) continue;         // 同句声明「已删/不存在」
				if (name.startsWith('u-') || /x{2,}/.test(name)) continue;  // uview 变量 / 占位
				if (SCSS_META_ALLOW.has(name)) continue;                  // 元变量（`$var` 定义 这类说法）
				if (JSON_SCHEMA_KEYS.has(name) || DOLLAR_API_ALLOW.has(name)) continue;  // JSON Schema 关键字 / Vue·uni 的 $ API
				if (name.endsWith('-') || line[m.index + m[0].length] === '*') continue;  // `$sp-*` 前缀 glob
				if (scssVars.has(name)) continue;
				const k = `${at}|$${name}`;
				if (seen.has(k)) continue;
				seen.add(k);
				err('symbol', `${at} 提到 SCSS 变量 $${name}，但 src/ 里没有定义它`);
			}

			// ③ 类名（警告级）
			const synthetic = SYNTHETIC_PATHS.some((x) => r.includes(x));
			const classRe = synthetic ? /`\.([a-z][a-z0-9_-]*)`/g : /`\.([a-z][a-z0-9_-]*)`|class="([a-z][a-z0-9_ -]*)"/g;
			for (const m of line.matchAll(classRe)) {
				if (mark(m.index)) continue;         // 同句声明「已删/不存在」
				const raw = m[1] || m[2] || '';
				for (const cls of raw.split(/\s+/).filter(Boolean)) {
					if (CLASS_ALLOW_PREFIX.test('.' + cls) || /x{2,}/.test(cls)) continue;
					if (NOT_A_CLASS.has(cls)) continue;          // 是文件名，不是类名
					if (PLACEHOLDER_CLASSES.has(cls.split('__')[0])) continue;  // 骨架里的示例页面前缀
					// ⚠️ 2026-10-26 尾轮删掉了「`__` 类一律跳过」那条 —— 它让**所有 BEM 页面私有类
					// 从未被检查**（`.crow__call` / `.ahome__scroll` 全在此列），而真源里
					// `src/**/*.vue` 的 scoped 样式**本来就抽得到**这些类名，没有理由跳。
					// 顺带纠正一处记录失真：此前把 `.crow__call` 列为「现役符号零误报」的证据，其实它没被查过。
					if (classNames.has(cls)) continue;
					const k = `${at}|.${cls}`;
					if (seen.has(k)) continue;
					seen.add(k);
					warn('symbol', `${at} 提到类 .${cls}，但 src/ 的样式里没有它（C 端遗留块名？）`);
				}
			}

			// ③-b **不带前导点的** `__` 类名 —— 文档里常写成「`ahome__scroll`」而非「`.ahome__scroll`」。
			// 为什么必须补：③ 的正则要求前导点，于是「引用了不存在的页面私有类」整类漏掉 ——
			// 实测漏过 `ahome__scroll` / `ahome__cab`（`src/pages/admin-home` 里真实的是
			// `ahome__hdr` / `ahome__body` …）：本网共抓出 **7 处（5 个文件）**，
			// 另 **1 处**在代码围栏里（`.ahome__scroll`，本网有意不查该形式）由人工 grep 发现
			// —— 合 **8 处 / 6 个文件**（`reviewer` 2026-10-26 复核时指出「6 vs 7」口径不一，此处以实测为准）。
			// 只查**含 `__`** 的名字：那是本工程的页面私有 BEM 约定，误报面小；
			// 不带 `__` 的裸名（如 `easycom`）不查。
			for (const m of line.matchAll(/`([a-z][a-z0-9]*(?:__[a-z0-9-]+)+)`/g)) {
				const cls = m[1];
				if (mark(m.index)) continue;             // 同句声明「已删/不存在」
				if (/x{2,}/.test(cls)) continue;         // `xx__yy` 之类元变量占位（与 ③ 同规则）
				if (PLACEHOLDER_CLASSES.has(cls.split('__')[0])) continue;  // 骨架里的示例页面前缀
				if (classNames.has(cls)) continue;
				const k = `${at}|.${cls}`;               // 与带点写法共用 key，同一符号不报两次
				if (seen.has(k)) continue;
				seen.add(k);
				warn('symbol', `${at} 提到类 ${cls}（无前导点），但 src/ 的样式里没有它（C 端遗留块名？）`);
			}

			// ④ 调用形 camelCase（警告级，≥2 个词才查 —— 单词名太通用）
			// ⚠️ **这是弱判据**（2026-10-26 尾轮明确写下）：判定是「`src/` 里**有同名标识符**」，
			// 而 `declared` 收了任意文件的**局部** `const/let/var`。故一个已删的服务函数
			// 若与某组件里的局部变量重名，会被误判为「存在」（假阴性）—— 反向则不会误报。
			// 它只负责把「一眼假的调用」喊出来，**不构成「这函数还在」的证明**。
			for (const m of line.matchAll(/`([a-z][a-zA-Z0-9]*)\(\)`/g)) {
				const name = m[1];
				if (mark(m.index)) continue;         // 同句声明「已删/不存在」
				const twoWords = /[a-z][A-Z]/.test(name) || name.includes('_');
				if (!twoWords) continue;
				if (CALL_ALLOWLIST.has(name) || declared.has(name)) continue;
				const k = `${at}|${name}()`;
				if (seen.has(k)) continue;
				seen.add(k);
				warn('symbol', `${at} 提到 ${name}()，但 src/ 里没有这个函数（已删？）`);
			}
		});
	}

	info.push(`符号存在性：扫 ${scanned} 个文件，真源 ${declared.size} 个声明 / ${scssVars.size} 个 SCSS 变量 / ${classNames.size} 个类名 / ${allConfigNames.size} 个 config 常量`);
}

// ── 4. Rules / Memory / Templates / 其它目录存在性 ───────────────────────
const EXPECTED_DIRS = [
	'agents', 'workflows', 'memory', 'templates',
	'prompts', 'checks', 'scripts', 'tools', 'context', 'docs', 'examples'
];

async function checkStructure() {
	for (const d of EXPECTED_DIRS) {
		const p = join(CLAUDE_DIR, d);
		if (!existsSync(p)) {
			err('结构', `缺少目录 .claude/${d}/`);
			continue;
		}
		const files = await walk(p);
		if (files.length === 0) warn('结构', `.claude/${d}/ 是空目录`);
	}

	// 核心两件套（模板不带 CHANGELOG：变更只写 commit message，见 CLAUDE.md §11.1）
	for (const f of ['CLAUDE.md', 'QUICK_START.md']) {
		if (!existsSync(join(CLAUDE_DIR, f))) err('结构', `缺少 .claude/${f}`);
	}

	// memory 三项（模板只保留与机制相关的长期知识；业务记忆随业务剥离）
	for (const m of ['architecture', 'known_issues', 'bug_history']) {
		if (!existsSync(join(CLAUDE_DIR, 'memory', `${m}.md`))) {
			err('结构', `缺少 .claude/memory/${m}.md`);
		}
	}

	// templates 八类
	for (const t of [
		'page', 'component', 'api-domain', 'service',
		'composable', 'response-schema', 'unit-test', 'integration-test'
	]) {
		if (!existsSync(join(CLAUDE_DIR, 'templates', t))) {
			err('结构', `缺少 .claude/templates/${t}/`);
		}
	}
}

// ── 8. ★ 路由一致性：`config/access.js` 的 PAGE_* ⟷ `src/pages.json` ─────
// 为什么有这条：2026-10-27 起「页面清单」的唯一真相源是 `config/access.js`
//（页内配置与准入也都在那里），而**路由注册**在 `src/pages.json` —— 两处不同步时，
// 页面会**跳不过去**（navigateTo 报 page not found），而那是运行到那一步才发现的问题。
// 放在这里当静态检查拦住：声明了没注册 / 注册了没声明，都报错。
//
// ⚠️ `src/pages.json` **带 `//` 注释**（uni-app 允许），直接 JSON.parse 会抛 —— 先剥注释。
function stripJsonComments(text) {
	let out = '';
	let inStr = false;
	let quote = '';
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		const next = text[i + 1];
		if (inStr) {
			out += c;
			if (c === '\\') { out += next === undefined ? '' : next; i++; continue; }
			if (c === quote) inStr = false;
			continue;
		}
		if (c === '"' || c === "'") { inStr = true; quote = c; out += c; continue; }
		if (c === '/' && next === '/') { while (i < text.length && text[i] !== '\n') i++; out += '\n'; continue; }
		if (c === '/' && next === '*') {
			i += 2;
			while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
			i++;
			continue;
		}
		out += c;
	}
	return out;
}

async function checkPageRegistry() {
	// ⚠️ 两边的写法**故意不同**，比对前必须归一：`config/access.js` 的常量带前导斜杠
	//（`services/route.js` 的 `normalize()` 就是按"可带可不带"设计的，也便于与 query 拼接），
	// 而 `src/pages.json` 的 `path` **不带**前导斜杠（uni-app 的规定）。
	// 不归一就会"5 页全部对不上" —— 这条检查第一次跑就踩到了。
	const norm = (p) => String(p).replace(/^\/+/, '').replace(/\/+$/, '');

	const accessSrc = await read(join(ROOT, 'src/config/access.js'));
	if (!accessSrc) {
		err('路由', '读不到 src/config/access.js（页面清单的唯一真相源）');
		return;
	}
	// 声明的页面：`export const PAGE_XXX = '/pages/...'`
	const declared = new Map(); // 归一后路径 → 常量名
	for (const m of accessSrc.matchAll(/export\s+const\s+(PAGE_[A-Z0-9_]+)\s*=\s*'([^']+)'/g)) {
		declared.set(norm(m[2]), m[1]);
	}
	if (declared.size === 0) {
		err('路由', 'src/config/access.js 里一个 PAGE_* 路径常量都没有（改名了？正则没跟上？）');
		return;
	}

	const raw = await read(join(ROOT, 'src/pages.json'));
	if (!raw) {
		err('路由', '读不到 src/pages.json');
		return;
	}
	let manifest;
	try {
		manifest = JSON.parse(stripJsonComments(raw));
	} catch (e) {
		err('路由', `src/pages.json 剥注释后仍不是合法 JSON：${e.message}`);
		return;
	}

	const registered = new Set();
	for (const p of manifest.pages || []) if (p && p.path) registered.add(norm(p.path));
	// 分包也一并比对（本工程当前未启用，但将来加分包时这条检查必须继续有效）
	for (const sp of manifest.subPackages || []) {
		const root = sp && sp.root ? `${norm(sp.root)}/` : '';
		for (const p of (sp && sp.pages) || []) if (p && p.path) registered.add(`${root}${norm(p.path)}`);
	}

	for (const [path, name] of declared) {
		if (!registered.has(path)) {
			err('路由', `config/access.js 声明了 ${name} = '/${path}'，但 src/pages.json 没注册这个页面（跳转会失败）`);
		}
	}
	for (const path of registered) {
		if (!declared.has(path)) {
			err('路由', `src/pages.json 注册了 '${path}'，但 config/access.js 没有对应的 PAGE_* 常量`);
		}
	}

	info.push(`路由一致性：config/access.js 声明 ${declared.size} 页 ⟷ src/pages.json 注册 ${registered.size} 页`);
}

// ── 9. ★ 列表「返回刷新」脏标记一致性（v1.2.2 口径） ─────────────────────
// 为什么要有这条：这两条约定**没有任何运行时反馈** ——
//   ① 列表能进子页却没接脏标记 → 子页写成功返回后列表吃旧快照（看到旧数据）；
//   ② `refreshOnReturn: true` 漏 `dirtyKey` → 退化成「每次返回都 reload」，
//      什么都没改的返回也整体替换列表（v1.2.2 前的老毛病）；
//   两种都不会报错，只能静态拦。
//
// 判定：
//   ① 文件里出现 `useList(` / `useAccountLogs(`（分页列表）且出现 `route.to(`（能进子页），
//      就必须参与脏标记机制（有 `dirtyKey` 或直接 `consumeListDirty(` / `clearListDirty(`）；
//   ② 出现 `refreshOnReturn: true` 的文件必须有 `dirtyKey`。
//
// ⚠️ **白名单**：列表能进的子页**只读**（不改数据）时本来就不该标脏 —— 必须登记在下面并写明原因。
//    以后新增「列表 → 只读子页」的页面，自检会报错，把文件加进白名单即可（别改成 warning：
//    这条一旦静音就等于没有）。
const LIST_READONLY_CHILD_ALLOW = new Map([
	// 模板内当前没有「列表 → 只读子页」的页面。
	// 新项目新增这类页面时在此登记并写明原因；不要改成 warning（静音等于没有检查）。
]);

const LIST_CALL = /\b(?:useList|useAccountLogs)\s*\(/;
const CHILD_NAV = /\broute\.to\s*\(/;
const DIRTY_PARTICIPATE = /\bdirtyKey\b|\bconsumeListDirty\s*\(|\bclearListDirty\s*\(/;

async function checkListRefresh() {
	const files = [...(await walk(join(ROOT, 'src/pages'))), ...(await walk(join(ROOT, 'src/composables')))];
	let scanned = 0;
	for (const file of files) {
		if (!/\.(vue|js)$/.test(file)) continue;
		const src = await read(file);
		if (!src || !LIST_CALL.test(src)) continue;
		scanned += 1;
		const r = rel(file);

		const usesChildNav = CHILD_NAV.test(src) && !LIST_READONLY_CHILD_ALLOW.has(r);
		if (usesChildNav && !DIRTY_PARTICIPATE.test(src)) {
			err(
				'列表刷新',
				`${r} 用了分页列表且会跳子页，但没接脏标记（dirtyKey / consumeListDirty）。` +
					'能改数据的子页要在写成功后 markListDirty；子页只读请登记 check_system.mjs 的白名单并写明原因'
			);
		}

		if (/refreshOnReturn\s*:\s*true/.test(src) && !/\bdirtyKey\b/.test(src)) {
			err(
				'列表刷新',
				`${r} 传了 refreshOnReturn: true 却没给 dirtyKey —— 会退化成「每次返回都 reload」（v1.2.2 前的口径）`
			);
		}
	}
	info.push(`列表刷新一致性：扫描 ${scanned} 个列表文件（脏标记白名单 ${LIST_READONLY_CHILD_ALLOW.size} 条）`);
}

// ── 5. 交叉引用：CLAUDE.md 声明的 agents/workflows 与实际文件一致性 ──────
async function checkCrossReference(agentNames, workflowNames) {
	const claudeMd = await read(join(CLAUDE_DIR, 'CLAUDE.md'));
	if (!claudeMd) {
		err('交叉引用', '无法读取 .claude/CLAUDE.md');
		return;
	}

	// Agent 名单（§5 的表格里用反引号包裹）
	for (const a of agentNames) {
		if (!claudeMd.includes(`\`${a}\``)) {
			warn('交叉引用', `agent "${a}" 未出现在 CLAUDE.md §5（应执行 sync_claude_md.mjs）`);
		}
	}
	// Workflow 名单（§6 的表格里写成 xxx.yaml）
	for (const w of workflowNames) {
		if (!claudeMd.includes(`${w}.yaml`)) {
			warn('交叉引用', `workflow "${w}.yaml" 未出现在 CLAUDE.md §6（应执行 sync_claude_md.mjs）`);
		}
	}

	// 版本与同步日期
	if (!/最后同步/.test(claudeMd)) warn('交叉引用', 'CLAUDE.md 缺少「最后同步」标记');
	if (!/系统版本/.test(claudeMd)) warn('交叉引用', 'CLAUDE.md 缺少「系统版本」标记');
}

// ── 执行 ─────────────────────────────────────────────────────────────────
const allFiles = await checkEmptyFiles();
const agentNames = await checkAgents();
const workflowNames = await checkWorkflows();
await checkSymbolExistence();
await checkPageRegistry();
await checkListRefresh();
await checkStructure();
await checkCrossReference(agentNames, workflowNames);

const report = {
	ok: errors.length === 0,
	errors,
	warnings,
	info,
	summary: {
		agents: agentNames.length,
		workflows: workflowNames.length,
		files: allFiles.length,
		errors: errors.length,
		warnings: warnings.length
	}
};

if (AS_JSON) {
	console.log(JSON.stringify(report, null, 2));
} else {
	console.log('');
	console.log('═══ .claude/ 系统自检 ═══════════════════════════════════');
	for (const i of info) console.log(`  ℹ️  ${i}`);
	console.log('');

	if (errors.length) {
		console.log(`  ❌ 错误 ${errors.length} 条：`);
		for (const e of errors) console.log(`     [${e.scope}] ${e.msg}`);
		console.log('');
	}
	if (warnings.length) {
		console.log(`  ⚠️  警告 ${warnings.length} 条：`);
		for (const w of warnings) console.log(`     [${w.scope}] ${w.msg}`);
		console.log('');
	}

	if (errors.length === 0) {
		console.log(warnings.length ? '  ✅ 通过（有警告，非阻断）' : '  ✅ 全部通过');
	} else {
		console.log('  ❌ 系统自检未通过 —— 按上方错误逐条修复');
	}
	console.log('══════════════════════════════════════════════════════════');
	console.log('');
}

process.exit(errors.length === 0 ? 0 : 1);