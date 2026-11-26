// ---------------------------------------------------------------------------
// 当前运行端判定 —— **全工程唯一的条件编译点**（端判定）
//
// 为什么放在 config/：env.js（配置）与 services/platform.js（能力适配）都要知道运行端，
// 而 config 不能反向 import services。把「端判定」下沉到 config 层后：
//   · env.js / platform.js 都只 import 本文件，不再各写一份 #ifdef；
//   · 其余条件编译（H5 锁滚、App 画布导出等）仍只允许出现在 services/platform.js。
//
// ⚠️ 新增运行端时只改这里 + platform.js 的能力分档。
// ---------------------------------------------------------------------------

let runtime = 'mp';
// #ifdef H5
runtime = 'h5';
// #endif
// #ifdef APP-PLUS
runtime = 'app';
// #endif

/** 当前运行端：'mp' | 'h5' | 'app' */
export const RUNTIME = runtime;
export const isMP = runtime === 'mp';
export const isH5 = runtime === 'h5';
export const isApp = runtime === 'app';