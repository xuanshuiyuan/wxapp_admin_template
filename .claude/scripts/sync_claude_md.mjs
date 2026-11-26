#!/usr/bin/env node
// ---------------------------------------------------------------------------
// sync_claude_md.mjs —— 让 .claude/CLAUDE.md 保持「唯一真相源」的地位
//
// 为什么需要它：CLAUDE.md 声明自己是 Single Source of Truth，
// 但它在 agents / workflows 变化时会「静默过期」—— 而过期的真相源比没有真相源更糟
// （AI 会照着过期的清单去调度不存在的 agent）。
//
// 本脚本做两件事：
//   1. 【报告】默认模式：比对 agents/ workflows/ 实际文件 vs CLAUDE.md 的记载，列出漂移
//   2. 【修复】--fix 模式：更新 CLAUDE.md 末尾的「自动索引」区块（带 BEGIN/END 标记）
//                        并刷新「最后同步」日期
//
// ★ 设计取舍：手写的 §5/§6 表格（含职责、产物、工具权限等人工提炼的信息）
//   【不会被自动覆盖】—— 自动生成的信息质量低于人工提炼的，覆盖会降低文档价值。
//   脚本只维护末尾的「自动索引」区块 + 负责把漂移「喊出来」。
//
// 用法：
//   node .claude/scripts/sync_claude_md.mjs              # 只报告漂移
//   node .claude/scripts/sync_claude_md.mjs --agents     # 只管 agents
//   node .claude/scripts/sync_claude_md.mjs --workflows  # 只管 workflows
//   node .claude/scripts/sync_claude_md.mjs --fix        # 报告 + 更新自动索引区块
//
// 退出码：0 = 无漂移或已修复；1 = 有漂移且未修复（CI 可据此拦截）
// ---------------------------------------------------------------------------

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = resolve(fileURLToPath(new URL('.', import.meta.url)));
const CLAUDE_DIR = resolve(HERE, '..');
const CLAUDE_MD = join(CLAUDE_DIR, 'CLAUDE.md');

const argv = process.argv.slice(2);
const ONLY_AGENTS = argv.includes('--agents');
const ONLY_WORKFLOWS = argv.includes('--workflows');
const FIX = argv.includes('--fix');
const doAgents = ONLY_AGENTS || !ONLY_WORKFLOWS;
const doWorkflows = ONLY_WORKFLOWS || !ONLY_AGENTS;

const BEGIN = '<!-- AUTO-INDEX:BEGIN —— 本区块由 sync_claude_md.mjs 生成，请勿手改 -->';
const END = '<!-- AUTO-INDEX:END -->';

const read = async (p) => {
	try {
		return await readFile(p, 'utf8');
	} catch {
		return '';
	}
};

/** 从 markdown 的 frontmatter 里取一个字段 */
function frontmatter(src) {
	const m = src.match(/^---\n([\s\S]*?)\n---/);
	if (!m) return {};
	const out = {};
	for (const line of m[1].split('\n')) {
		const kv = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
		if (kv) out[kv[1]] = kv[2].trim();
	}
	return out;
}

/** 从 workflow yaml 里取一个顶层字段（轻量解析，够用） */
function yamlTop(src, key) {
	const m = src.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
	if (!m) return '';
	return m[1].trim().replace(/^["']|["']$/g, '');
}

/** 提取 workflow 的 stages 顺序（agent 序列） */
function yamlStageAgents(src) {
	const block = src.split(/^stages:\s*$/m)[1];
	if (!block) return [];
	const stop = block.search(/^[a-z_]+:\s*$/m);
	const body = stop === -1 ? block : block.slice(0, stop);
	return [...body.matchAll(/^\s*agent:\s*"?([^"\n]+)"?\s*$/gm)].map((m) => m[1].trim());
}

// ── 采集实际文件 ─────────────────────────────────────────────────────────
async function collectAgents() {
	const dir = join(CLAUDE_DIR, 'agents');
	if (!existsSync(dir)) return [];
	const files = (await readdir(dir)).filter((f) => f.endsWith('.md')).sort();
	const out = [];
	for (const f of files) {
		const src = await read(join(dir, f));
		const fm = frontmatter(src);
		out.push({
			name: basename(f, '.md'),
			file: `agents/${f}`,
			description: (fm.description || '').split(/[。；]/)[0].slice(0, 60) || '（无 description）',
			tools: fm.tools || '（未限制）'
		});
	}
	return out;
}

async function collectWorkflows() {
	const dir = join(CLAUDE_DIR, 'workflows');
	if (!existsSync(dir)) return [];
	const files = (await readdir(dir)).filter((f) => /\.ya?ml$/.test(f)).sort();
	const out = [];
	for (const f of files) {
		const src = await read(join(dir, f));
		out.push({
			name: basename(f, '.yaml').replace(/\.yml$/, ''),
			file: `workflows/${f}`,
			description: yamlTop(src, 'description'),
			stages: yamlStageAgents(src)
		});
	}
	return out;
}

// ── 生成自动索引区块 ─────────────────────────────────────────────────────
function buildIndex(agents, workflows) {
	const today = new Date().toISOString().slice(0, 10);
	const L = [BEGIN, ''];
	L.push(`> 自动生成于 ${today} · 由 \`node .claude/scripts/sync_claude_md.mjs --fix\` 维护`);
	L.push('> 人工提炼的 Agent 职责表见上方 §5，Workflow 表见 §6 —— 本区块只是清单校验用。');
	L.push('');

	L.push('### 自动索引 · Agents');
	L.push('');
	L.push('| # | Agent | 工具权限 | description（摘自 frontmatter） |');
	L.push('|---|---|---|---|');
	agents.forEach((a, i) => {
		L.push(`| ${i + 1} | \`${a.name}\` | ${a.tools} | ${a.description} |`);
	});
	L.push('');

	L.push('### 自动索引 · Workflows');
	L.push('');
	L.push('| # | Workflow | 阶段链（★ 末位必须是 reviewer） |');
	L.push('|---|---|---|');
	workflows.forEach((w, i) => {
		const chain = w.stages.length ? w.stages.join(' → ') : '（未能解析出 stages）';
		L.push(`| ${i + 1} | \`${w.name}.yaml\` | ${chain} |`);
	});
	L.push('');
	L.push(END);
	return L.join('\n');
}

// ── 漂移检测 ─────────────────────────────────────────────────────────────
function detectDrift(claudeMd, agents, workflows, knownAgentNames) {
	const drift = [];

	for (const a of agents) {
		if (!claudeMd.includes(`\`${a.name}\``)) {
			drift.push(`agent "${a.name}" 存在于 agents/ 但未在 CLAUDE.md 中提及（§5 表格待补）`);
		}
	}
	for (const w of workflows) {
		if (!claudeMd.includes(`${w.name}.yaml`)) {
			drift.push(`workflow "${w.name}.yaml" 存在于 workflows/ 但未在 CLAUDE.md 中提及（§6 表格待补）`);
		}
	}

	// 反向：CLAUDE.md 提到了但文件不存在
	// ⚠️ 这里要用**磁盘上的真实 agent 名单**（knownAgentNames），不能用本次「要报哪一侧」的
	//    `agents` 数组：`--workflows` 模式下 agents 恒为空数组 → 会把 CLAUDE.md 里提到的
	//    每个 agent 都误报成「文件不存在」（2026-10-26 发现并修）
	const mentionedAgents = [...claudeMd.matchAll(/`([a-z_]+_agent|[a-z_]+)`/g)]
		.map((m) => m[1])
		.filter((n) => /^(architect|api_designer|backend_service|frontend_engineer|repository_agent|test_agent|security_agent|reviewer|debugger|deploy_agent)$/.test(n));
	const agentNames = knownAgentNames;
	for (const n of new Set(mentionedAgents)) {
		if (!agentNames.has(n)) drift.push(`CLAUDE.md 提到了 agent "${n}" 但 agents/${n}.md 不存在`);
	}

	// workflow 铁律：reviewer 必须在最后
	for (const w of workflows) {
		if (w.stages.length && !/\breviewer\b/.test(w.stages[w.stages.length - 1])) {
			drift.push(`workflow "${w.name}.yaml" 的最后一步是 "${w.stages[w.stages.length - 1]}"，不是 reviewer（违反 CLAUDE.md §6.1-1）`);
		}
	}
	return drift;
}

// ── 主流程 ───────────────────────────────────────────────────────────────
const agents = doAgents ? await collectAgents() : [];
const workflows = doWorkflows ? await collectWorkflows() : [];
// 反向检查要的真实名单：与「本次只报哪一侧」无关（见 detectDrift 的注释）
const knownAgentNames = new Set((doAgents ? agents : await collectAgents()).map((a) => a.name));

let claudeMd = await read(CLAUDE_MD);
if (!claudeMd) {
	console.error(`❌ 找不到 .claude/CLAUDE.md（期望路径：${CLAUDE_MD}）`);
	process.exit(1);
}

const drift = detectDrift(claudeMd, agents, workflows, knownAgentNames);

console.log('');
console.log('═══ CLAUDE.md 同步检查 ══════════════════════════════════');
console.log(`  实测：agents ${agents.length} 个 · workflows ${workflows.length} 个`);
console.log('');

if (drift.length === 0) {
	console.log('  ✅ 无漂移 —— CLAUDE.md 与实际文件一致');
} else {
	console.log(`  ⚠️  发现 ${drift.length} 处漂移：`);
	for (const d of drift) console.log(`     · ${d}`);
	const hard = drift.filter((d) => d.includes('违反 CLAUDE.md §6.1-1'));
	if (hard.length) {
		console.log('');
		console.log('  ❌ 其中含流程铁律违反（reviewer 必须最后一步），属阻断项');
	}
}

// ── --fix ────────────────────────────────────────────────────────────────
if (FIX) {
	// ⚠️ 重建索引时必须拿**两半都完整**的清单：`--fix --agents` 若只传 agents，
	//    会把自动索引里的 workflows 表整段抹掉（反之亦然）—— 这是静默的数据丢失，
	//    2026-10-26 发现并修。故无论本次只检查哪一侧，另一侧也读出来再重建。
	const indexAgents = doAgents ? agents : await collectAgents();
	const indexWorkflows = doWorkflows ? workflows : await collectWorkflows();
	const index = buildIndex(indexAgents, indexWorkflows);
	const hasBlock = claudeMd.includes(BEGIN) && claudeMd.includes(END);

	if (hasBlock) {
		claudeMd = claudeMd.replace(new RegExp(`${BEGIN}[\\s\\S]*?${END}`), index);
	} else {
		claudeMd = claudeMd.trimEnd() + '\n\n---\n\n## 附录 · 自动索引\n\n' + index + '\n';
	}

	// 刷新「最后同步」日期（只改日期，不动其它内容）
	const today = new Date().toISOString().slice(0, 10);
	claudeMd = claudeMd.replace(/(\|\s*最后同步\s*\|\s*)([0-9]{4}-[0-9]{2}-[0-9]{2})/, `$1${today}`);

	await writeFile(CLAUDE_MD, claudeMd, 'utf8');

	console.log('');
	console.log(`  ✅ 已更新 .claude/CLAUDE.md 的自动索引区块（最后同步 → ${today}）`);
	console.log('     ⚠️ 手写的 §5 / §6 表格不会被自动覆盖 —— 若有漂移请手动补那一行。');
}

if (!FIX && drift.length) {
	console.log('');
	console.log('  提示：`node .claude/scripts/sync_claude_md.mjs --fix` 可更新自动索引区块；');
	console.log('        但手写的 §5 / §6 表格需手动补 —— 自动生成的信息质量低于人工提炼的。');
}

console.log('══════════════════════════════════════════════════════════');
console.log('');

process.exit(drift.length && !FIX ? 1 : 0);