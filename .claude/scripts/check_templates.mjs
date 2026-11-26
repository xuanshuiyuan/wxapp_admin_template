#!/usr/bin/env node
// ---------------------------------------------------------------------------
// check_templates.mjs —— 模板完整性审计（BUG-011 的防复发措施）
//
// 缘起（源工程）：一个页面的 HTML 注释被 JS 注释的收尾符误收尾，编译器找不到收尾符，
// 就把注释之后的节点**整体吞掉** —— 那个 `<app-list-state>` 连同紧随的一段注释一起消失，
// 编译产物里连它的 props 都不生成。**不报错、不警告**，
// 现象只是「— 没有更多了 —」再也不显示（详见 .claude/memory/bug_history.md BUG-011）。
// 同一段注释修好后又踩了反面：注释**提前闭合**，后面的说明文字变成了页面上的**正文**。
//
// 故本脚本查四件事（前两件是这两种事故的直接签名）：
//   ① template 区里，HTML 注释中混进 JS 注释的收尾符  → 后面的节点会被整段吞掉
//   ② 「孤儿」注释收尾符 / 注释里再开注释             → 注释提前闭合，文字会渲染成正文
//   ③ HTML 注释没有闭合
//   ④ 用真正的 Vue 编译器比对「AST 元素数」与「源码开标签数」→ 有节点被吞就不相等
//
// 用法：node .claude/scripts/check_templates.mjs   （退出码 0 = 通过，1 = 有问题）
//
// ⚠️ AST 那条需要 @vue/compiler-sfc / @vue/compiler-dom（本工程 node_modules 里有，
//    随 uni-app 构建链安装）。取不到时**降级**为只做文本级扫描，并明确打印"已降级"。
// ⚠️ 本文件自己的注释也**不能**写出那两个"字面组合"（写它时踩过同一个坑：JS 块注释里
//    混进它自己的收尾符 → 注释提前结束，后面的中文变成代码，直接语法错误）。故用文字描述。
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SKIP_DIRS = new Set(['node_modules', 'uni_modules', 'dist', 'unpackage', '.git']);
const OPEN = '<!--';
const CLOSE = '-->';
const JS_CLOSE = '*' + '/';

const problems = [];

/** 收集要审计的 .vue：工程 src/ 下全部 + .claude/templates/ 下的骨架 */
function collect() {
	const out = [];
	const walk = (dir) => {
		if (!fs.existsSync(dir)) return;
		for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
			if (SKIP_DIRS.has(e.name)) continue;
			const p = path.join(dir, e.name);
			if (e.isDirectory()) walk(p);
			else if (e.name.endsWith('.vue')) out.push(p);
		}
	};
	walk(path.join(ROOT, 'src'));
	walk(path.join(ROOT, '.claude/templates'));
	return out;
}

/**
 * 文本级扫描（在一个 HTML 注释「开 / 合」状态机里走一遍）。
 * ⚠️ 传入的必须是**模板正文**：JS/SCSS 里那两个符号是合法的，扫全文会误报。
 */
function scanText(text, rel) {
	const lineOf = (idx) => text.slice(0, idx).split('\n').length;
	let i = 0;
	let inComment = false;
	while (i < text.length) {
		if (text.startsWith(OPEN, i)) {
			if (inComment) {
				problems.push({ file: rel, line: lineOf(i), msg: '注释里又开了一个注释（HTML 注释不能嵌套）' });
			}
			inComment = true;
			i += OPEN.length;
			continue;
		}
		if (text.startsWith(CLOSE, i)) {
			if (!inComment) {
				problems.push({
					file: rel,
					line: lineOf(i),
					msg: '孤儿注释收尾符：前面有注释被提前闭合，之后的源码文字会渲染成页面正文'
				});
			}
			inComment = false;
			i += CLOSE.length;
			continue;
		}
		if (inComment && text.startsWith(JS_CLOSE, i)) {
			problems.push({
				file: rel,
				line: lineOf(i),
				msg: 'HTML 注释里混进了 JS 注释的收尾符 —— 会把注释后面的节点整段吞掉'
			});
			i += JS_CLOSE.length;
			continue;
		}
		i += 1;
	}
	if (inComment) {
		problems.push({ file: rel, line: lineOf(text.length), msg: 'HTML 注释没有闭合' });
	}
}

/** AST 比对：元素数 vs 源码开标签数（注释里的标签不算，故先把注释抠掉再数） */
function scanAst(text, rel, dom) {
	let ast;
	try {
		ast = dom.parse(text, { comments: true });
	} catch (e) {
		// 元素没闭合这类结构性错误，编译器是**抛**而不是返回 errors —— 收成一条问题，别让脚本崩
		problems.push({ file: rel, line: 1, msg: `模板解析失败：${e.message}` });
		return;
	}
	const count = (node, acc = []) => {
		if (!node || typeof node !== 'object') return acc;
		if (node.type === 1) acc.push(node.tag);
		if (Array.isArray(node.children)) node.children.forEach((c) => count(c, acc));
		return acc;
	};
	const tags = count(ast);
	const naive = (text.replace(/<!--[\s\S]*?-->/g, '').match(/<([a-z][a-z0-9-]*)(?=[\s/>])/g) || []).length;
	if (tags.length !== naive) {
		problems.push({
			file: rel,
			line: 1,
			msg: `AST 元素数(${tags.length}) ≠ 源码开标签数(${naive}) —— 有节点被注释/条件吞掉`
		});
	}
}

/**
 * 降级用的模板区粗切（只在取不到编译器时用）。
 * ⚠️ 它取**第一个** `</template>`，遇到 `<template v-if>` 这类嵌套模板会切早 ——
 *    所以它只够做文本级扫描，不能用来数节点。编译器在时不用它。
 */
function roughTemplateRegion(src) {
	const open = src.search(/^[ \t]*<template[ >]/m);
	if (open < 0) return null;
	const bodyStart = src.indexOf('>', open) + 1;
	const close = src.indexOf('</template>', bodyStart);
	return close < 0 ? null : src.slice(bodyStart, close);
}

const require = createRequire(import.meta.url);
let sfc = null;
let dom = null;
try {
	sfc = require('@vue/compiler-sfc');
	dom = require('@vue/compiler-dom');
} catch (e) {
	console.warn('[check_templates] 取不到 @vue/compiler-sfc，降级为纯文本扫描（不做 AST 节点比对）\n');
}

const files = collect();
for (const f of files) {
	const rel = path.relative(ROOT, f);
	const src = fs.readFileSync(f, 'utf8');
	let text = null;
	if (sfc) {
		// 用 SFC 解析器取模板正文：它认得嵌套模板（`<template v-if>` / `<template #slot>`），
		// 手写区域切割会切早（本脚本第一版就栽在这里）
		const { descriptor, errors } = sfc.parse(src, { filename: rel });
		if (errors && errors.length) {
			// ⚠️ 不 continue：注释被吞掉时 SFC 解析也会报"元素没闭合"，
			//    但那条消息说不清是哪一类错误 —— 让下面的文本级扫描再补一条**具体**的
			problems.push({ file: rel, line: 1, msg: `SFC 解析失败：${errors[0].message}` });
		}
		if (descriptor.template) text = descriptor.template.content;
	}
	if (!text) text = roughTemplateRegion(src);
	if (!text) continue;
	scanText(text, rel);
	if (dom) scanAst(text, rel, dom);
}

if (problems.length) {
	console.error(`✗ 模板审计不通过（${problems.length} 处）：`);
	for (const p of problems) console.error(`  ${p.file}:${p.line}  ${p.msg}`);
	console.error('\n提示：HTML 注释只能用 HTML 的收尾符；JS/SCSS 的收尾符只属于 JS/SCSS。');
	process.exit(1);
}
console.log(`✓ 模板审计通过：${files.length} 个 .vue 的注释闭合与节点数均正常${sfc ? '' : '（AST 比对已降级）'}`);