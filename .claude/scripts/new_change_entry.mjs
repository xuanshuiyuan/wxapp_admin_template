#!/usr/bin/env node
// ---------------------------------------------------------------------------
// new_change_entry.mjs —— （已冻结）历史参考：生成一条符合规范的 CHANGELOG 条目
//
// ⚠️ 2026-11-02 起：CHANGELOG 已冻结，**不再新增条目**（`CLAUDE.md` §11.1）。
//    只记真重要变更，写进 git commit message 一行；本脚本仅保留给历史归档参考。
//
// 为什么需要它：CHANGELOG 规定每条记录必须含 8 个字段，且「修改原因(why)」
// 是最重要、也最容易被敷衍的字段。手工写容易漏字段，
// 本脚本强制你把每一项想清楚，并把条目插入 CHANGELOG.md 的正确位置。
//
// 用法：
//   node .claude/scripts/new_change_entry.mjs                 # 交互式
//   node .claude/scripts/new_change_entry.mjs --dry-run       # 只打印，不写入
//   node .claude/scripts/new_change_entry.mjs --from-file e.json   # 从 JSON 读取（CI/批处理）
//
// JSON 输入格式（--from-file）：
//   {
//     "type": "业务逻辑变更",
//     "title": "一句话标题",
//     "content": "具体改了什么",
//     "why": "为什么必须改",
//     "scope": "影响范围",
//     "files": ["src/x.js:12"],
//     "risk": "中",
//     "migration": "否",
//     "verify": "怎么确认改对了"
//   }
// ---------------------------------------------------------------------------

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';

const HERE = resolve(fileURLToPath(new URL('.', import.meta.url)));
const CHANGELOG = resolve(HERE, '..', 'CHANGELOG.md');
const CLAUDE_MD = resolve(HERE, '..', 'CLAUDE.md');

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const fromIdx = argv.indexOf('--from-file');
const FROM_FILE = fromIdx !== -1 ? argv[fromIdx + 1] : null;

// 类型枚举（与 CHANGELOG.md 的判定口径一致）
const TYPES = ['结构变更', '业务逻辑变更', 'API变更', '修复', '样式变更'];
const RISKS = ['低', '中', '高'];

// 业务版本号锚的合法值：vX.Y.Z（走了 project-dev）或 —（未走）。
// 见 .claude/CHANGELOG.md 的「业务版本号锚」小节 —— 它让两套记录（本文件 vs
// project-meta/versions/）有共同锚点可互相引用。
const VERSION_RE = /^(v\d+\.\d+\.\d+|—|-)$/;

/** 生成条目 markdown —— 8 个字段一个不少 */
function buildEntry(e) {
	const today = new Date().toISOString().slice(0, 10);
	const version = (e.version || '—').trim() || '—';
	const files = Array.isArray(e.files) ? e.files : String(e.files || '').split(/[,\n]/).map((s) => s.trim()).filter(Boolean);

	const L = [];
	L.push(`### [${today}] [${version}] ${e.title}`);
	L.push('');
	L.push(`- **类型**：${e.type}`);
	L.push(`- **修改内容**：${e.content}`);
	L.push(`- **修改原因（why）**：${e.why}`);
	L.push(`- **影响范围**：${e.scope}`);
	L.push('- **涉及文件**：');
	for (const f of files) L.push(`  - \`${f}\``);
	if (files.length === 0) L.push('  - （未填写）');
	L.push(`- **风险等级**：${e.risk}`);
	L.push(`- **是否需要数据迁移**：${e.migration}`);
	L.push(`- **验证方式**：${e.verify}`);
	L.push('');
	L.push('---');
	L.push('');
	return L.join('\n');
}

/** 校验：8 个字段都要有实质内容。why 尤其不能敷衍 */
function validate(e) {
	const problems = [];

	if (!e.title || e.title.length < 4) problems.push('标题太短（需 ≥4 字，要说清做了什么）');
	if (!TYPES.includes(e.type)) problems.push(`类型必须是：${TYPES.join(' / ')}`);
	if (!e.content || e.content.length < 8) problems.push('修改内容太短（要可验证的事实，不写"优化了一下"）');

	// ★ why 是本文件最重要的字段，单独加严
	if (!e.why || e.why.length < 15) {
		problems.push('修改原因(why) 太短 —— 这是最重要的字段，必须说明「为什么必须改」，不能只写"优化"');
	} else if (/^(优化|完善|调整|修改|修复|更新)[。.]?$/.test(e.why.trim())) {
		problems.push('修改原因(why) 是空话（如"优化一下"）—— 请写清驱动这次改动的问题或需求');
	}

	if (!e.scope || e.scope.length < 4) problems.push('影响范围太短（要说清模块 + 端 + 环境）');
	if (!RISKS.includes(e.risk)) problems.push(`风险等级必须是：${RISKS.join(' / ')}`);
	if (!/^(是|否)/.test(String(e.migration || ''))) problems.push('是否需要数据迁移必须以「是」或「否」开头（是的话附迁移方案）');
	if (!e.verify || e.verify.length < 4) problems.push('验证方式太短（怎么确认改对了；没跑就写"未执行，待验证"）');

	// 业务版本号锚：要么 vX.Y.Z（走了 project-dev），要么 —（未走）
	const v = String(e.version || '—').trim() || '—';
	if (!VERSION_RE.test(v)) {
		problems.push(`业务版本号锚必须是 "vX.Y.Z"（走了 project-dev）或 "—"（未走），当前是 "${v}"`);
	}

	return problems;
}

/** 把条目插入 CHANGELOG.md 的「## 条目（倒序，最新在上）」区块的顶部 */
function insertEntry(src, entry) {
	const marker = /^##\s*条目（倒序，最新在上）\s*$/m;
	const m = src.match(marker);
	if (!m) {
		// 找不到标记 → 追加到文件中（并给个提示）
		return { src: src.trimEnd() + '\n\n' + entry, inserted: false };
	}
	const idx = m.index + m[0].length;
	// 跳过标记行后的第一个换行
	let pos = idx;
	while (pos < src.length && src[pos] === '\n') pos++;
	return { src: src.slice(0, pos) + entry + src.slice(pos), inserted: true };
}

/** 交互式收集 */
async function collectInteractive() {
	const rl = createInterface({ input, output });
	const ask = async (q, def = '') => {
		const a = (await rl.question(def ? `${q} [${def}]: ` : `${q}: `)).trim();
		return a || def;
	};

	console.log('');
	console.log('═══ 新建 CHANGELOG 条目 ════════════════════════════════');
	console.log('  （8 个字段缺一不合格；why 是最重要的字段）');
	console.log('');

	const e = {};
	e.title = await ask('① 一句话标题');
	e.type = await ask(`② 类型（${TYPES.join(' / ')}）`, '业务逻辑变更');
	e.version = await ask('②b 业务版本号锚（走了 project-dev 就填 vX.Y.Z，否则直接回车）', '—');
	e.content = await ask('③ 修改内容（具体改了什么，可验证的事实）');
	e.why = await ask('④ 修改原因 why（★ 为什么必须改）');
	e.scope = await ask('⑤ 影响范围（模块 / 端 mp-h5-app / 环境 dev-prod）');
	e.files = await ask('⑥ 涉及文件（逗号分隔，建议带 :行号）');
	e.risk = await ask(`⑦ 风险等级（${RISKS.join(' / ')}）`, '中');
	e.migration = await ask('⑧ 是否需要数据迁移（是 / 否）', '否');
	e.verify = await ask('⑨ 验证方式（怎么确认改对了；没跑写"未执行，待验证"）');

	rl.close();
	return e;
}

/** 从 JSON 文件收集 */
async function collectFromFile(p) {
	try {
		return JSON.parse(await readFile(p, 'utf8'));
	} catch (err) {
		console.error(`❌ 无法读取或解析 ${p}：${err.message}`);
		process.exit(1);
	}
}

// ── 主流程 ───────────────────────────────────────────────────────────────
const entryData = FROM_FILE ? await collectFromFile(FROM_FILE) : await collectInteractive();

const problems = validate(entryData);

if (problems.length) {
	console.log('');
	console.log('  ❌ 条目不合格，未写入：');
	for (const p of problems) console.log(`     · ${p}`);
	console.log('');
	console.log('  提示：CHANGELOG 的价值全在 why —— 一个没有 why 的记录等于没写。');
	console.log('');
	process.exit(1);
}

const entry = buildEntry(entryData);

console.log('');
console.log('── 生成的条目 ───────────────────────────────────────────');
console.log(entry);
console.log('─────────────────────────────────────────────────────────');

if (DRY) {
	console.log('  （--dry-run：未写入文件）');
	console.log('');
	process.exit(0);
}

if (!existsSync(CHANGELOG)) {
	console.error(`❌ 找不到 ${CHANGELOG}`);
	process.exit(1);
}

const src = await readFile(CHANGELOG, 'utf8');
const { src: next, inserted } = insertEntry(src, entry);
await writeFile(CHANGELOG, next, 'utf8');

console.log(`  ✅ 已写入 .claude/CHANGELOG.md${inserted ? '（插入到「条目」区块顶部）' : '（未找到标记，已追加到文件末尾）'}`);

// ★ 结构变更 → 提醒同步 CLAUDE.md（这是最常被漏的一步）
const type = entryData.type;
if (type === '结构变更') {
	console.log('');
	console.log('  ⚠️  这是【结构变更】—— 按 CLAUDE.md §11 的维护契约，');
	console.log('      你还必须同步 .claude/CLAUDE.md 的对应章节，否则改动视为未完成：');
	console.log('        · 新增/改 Agent      → §5');
	console.log('        · 新增/改 Workflow   → §6');
	console.log('        · 新增/改 Rule       → §7');
	console.log('        · 技术栈变化         → §2（跑 detect_stack.mjs）');
	console.log('        · 目录结构调整       → §4');
	console.log('        · 迭代重点变化       → §8');
	console.log('        · 红线增删           → §9');
	console.log('      跑一次： node .claude/scripts/sync_claude_md.mjs --fix');
}

if (type === '业务逻辑变更' || type === 'API变更') {
	const v = String(entryData.version || '—').trim() || '—';
	console.log('');
	console.log('  ⚠️  这是【' + type + '】—— 按 .claude/project-meta/README.md 的「真相源分工」：');
	console.log('        · 业务规则真相源 = .claude/project-meta/modules/<模块>/business-logic.md');
	console.log('          → 走 project-dev skill 更新（它会同步 block id 与 last-updated）');
	console.log('        · 若走了 project-dev：还需产出 .claude/project-meta/versions/vN/');
	console.log('          （一次改动的全貌：需求原文 + 否掉的方案 + 改了哪些 block）');
	console.log('        · 接口契约真源 = src/config/endpoints.js + src/config/dict.js（代码即真源）');
	console.log('        · 业务规则正文只写 project-meta/modules/<模块>/business-logic.md');

	// ★ CLAUDE.md §6.2 的两条强制覆盖（project-dev 模板的缺口）
	if (v === '—') {
		console.log('');
		console.log('  ⚠️  版本锚是「—」（未走 project-dev）—— 若本次改动确实产生了业务规则变化，');
		console.log('      应改走 project-dev 流程并重登（详见 CLAUDE.md §6.2）。');
	}
	console.log('');
	console.log('  ★ 强制（CLAUDE.md §6.2）：无论是否走 project-dev，本次改动【必须】经 reviewer 评审。');
	console.log('    project-dev 模板的 13 步里没有评审环节，那是模板缺口，不是可选项。');
}
console.log('');