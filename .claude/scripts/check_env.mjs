#!/usr/bin/env node
// ---------------------------------------------------------------------------
// 构建前环境检查（package.json 的 build:* 会先跑它）
//
// 为什么要在构建前：运行期的 `throw` 是最后一道 fail-closed 兜底，但那时包已经产出了；
// 构建前直接失败，能避免「带演示/联调旁路的包被打出来」。
// 只读 .env.production + .env.production.local（build 的加载顺序），不要求 key/host 非空
// （模板本身没有线上凭据，占位/缺省由 check:release 与部署流程负责）。
// ---------------------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

function readEnv(file) {
	const map = {};
	if (!existsSync(file)) return map;
	for (const line of readFileSync(file, 'utf8').split('\n')) {
		const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
		if (m) map[m[1]] = m[2].replace(/^['"]|['"]$/g, '').trim();
	}
	return map;
}

const env = { ...readEnv(join(ROOT, '.env.production')), ...readEnv(join(ROOT, '.env.production.local')) };
const errors = [];

if (env.VITE_DEMO_MODE === 'true') errors.push('VITE_DEMO_MODE=true（生产包会启用任意密码登录）');
if (env.VITE_MOCK_LOGIN_CODE) errors.push('VITE_MOCK_LOGIN_CODE 非空（非微信端联调通道会进生产）');
if (env.VITE_DEVELOP_BYPASS) errors.push('VITE_DEVELOP_BYPASS 非空（签名旁路只允许 local/develop）');

if (errors.length) {
	console.error('\n❌ 构建前环境检查未通过：');
	for (const e of errors) console.error(`   - ${e}`);
	console.error('\n   修改 .env.production（或 .env.production.local）后重试。\n');
	process.exit(1);
}
console.log('✅ 构建前环境检查通过（无演示/联调旁路）');
