# v1.0.0 变更记录（评审修复轮）

> 对应评审：`versions/v1.0.0/review.md`（有条件通过，5 个阻断 + 若干建议）。
> 本轮只改模板仓；业务页面 / 后端均未涉及。

## 一、阻断项修复

| ID | 问题 | 处置 | 文件 |
|---|---|---|---|
| BLK-1 | services 反向依赖 api | `uploader` 改为直接 `curl.upload(...)`，删除 `api/upload.js`（避免两份实现），`api/index.js` 去掉导出 | `src/services/uploader.js` · 删除 `src/api/upload.js` · `src/api/index.js` |
| BLK-2 | 页面模板 / 次级页缺两道门，模板示范路径字面量 | 新增 `composables/usePageGuard.js`（onLoad 权限门 + onShow 登录门 + 首次取数）；`page-list` / `page-detail` / `page-form` 模板与 3 个 demo 页、`region-picker`、`field-editor` 全部接入；模板改引 `PAGE_*` 常量 | `src/composables/usePageGuard.js` · `src/pages/**` · `.claude/templates/page/*` |
| BLK-3 | `DEMO_MODE` 硬编码 true，生产可任意密码进入 | 改为 `VITE_DEMO_MODE` 环境变量；`.env.development=true` / `.env.production=false`；生产误开**启动即抛错**；新增 `npm run check:release` 闸门；README 增加「去演示化清单」 | `src/config/app.js` · `.env.*` · `.claude/scripts/check_release.mjs` · `README.md` |
| BLK-4 | 发布清单 grep `localhost:15200`，本仓实际 15000 → 闸门永不命中 | 全仓文档 `15200 → 15000`；产物校验改为 `npm run check:release`（扫 localhost/127.0.0.1/REPLACE_/demo token + host 一致性） | `.claude/checks/pre_release.md` · `workflows/release.yaml` · 其余 12 处文档 |
| BLK-5 | 上传响应 / 错误码自创且与 README 矛盾 | 契约定为 `data.url`（兼容 `data.urls[0]`）；新增 `40203/40204` 错误码与文案；`UPLOAD_TYPE_DEFS` 镜像 `AdminUploadTypes`（格式/限额按 type）；README 写明「后端模板尚未实现该控制器」 | `src/services/uploader.js` · `src/config/dict.js` · `README.md` §5.3 |

## 二、建议项修复（本轮采纳）

- `useList` 在飞时 `reload` 不再静默丢弃（pendingReload 补拉一次）。
- `request`：非对象响应（HTML/纯文本）不再当成功；`rootPath=''` 时补前导斜杠。
- `qs.toQueryString` 数组改为逗号串（不再产出被禁止的 `key[0]=`）。
- demo 页 / region-picker 挂 `<app-loading>` / `<app-modal>`（守卫弹窗有渲染方）。
- `edition` 失败码文档由 `40107` 更正为 `40003`（`40107` 标注为预留）。
- `5800x` 在 CLAUDE.md 标注为「模板建议的新项目 RBAC 码，非后端既有契约」。
- 端判定收口到 `config/runtime.js`；`wx.login` 收口到 `platform.getLoginCode()`（`#ifdef` 只剩 platform/runtime）。
- `VITE_MOCK_LOGIN_CODE` 生产启动硬护栏。
- `init.sh`：不再自动 build（避免留下开发产物）；`grep -Iq` 跳过二进制；提示 `check:release`。
- 主题色同步点补登记（`pages.json` / `index.html`）；`rule-performance` 纠正「去重三件套已实现」的过度声明。
- 清理 `.claude` 悬空引用（`modules/login`、`memory/api_conventions`、`BUG-00x`、`K-0x`、`PAGE_LEDGER_*`、`rule-style-css`）。
- 新增 `.claude/templates/page/page-form.vue`（表单页模板：跳页取值 + 底栏提交 + 两道门）。

## 二-b、复评（r2）回归修复

| ID | 问题 | 处置 |
|---|---|---|
| R-1 | `usePageGuard` 先权限门后登录门：冷启动/深链时 permission 为空 → 有权限用户也被拒 | 顺序改为 onShow 里**先登录、再判权限**；onLoad 只记 query；`demo/list` 的权限快照改为 onReady 后重读 |
| R-2 | `check:release` 裸 `localhost` 被 uview `async-validator` 永久误报 | 改为 `localhost:\d+` / `127\.0\.0\.1:\d+` 正则 |
| R-3 | README 去演示化自检用 `verify:*`（development 含 localhost）→ 闸门必失败 | 改为 `build:mp-weixin && check:release` |
| R-4 | 删除 `UPLOAD_TYPE_DEMO_FILE` 后 `uploadTypeDef` 抛 ReferenceError | 兜底改为字面默认值 + `console.warn`，不再引用可删常量 |
| R-5 | 批量上传的 `{loading:false}` 被 `uploadOne` 丢弃 → 每张全屏遮罩 | 正确透传 `loading`（单张默认 true） |
| R-6 | 新 `PAGE_*` 忘了在 `services/route.js` 转出（模板文档未写） | 在 route.js 注释、`templates/page/README.md`、`rule-add-page` 明写这一步 |

同批清理：`uploader` 的隐私预检移到 `platform.requirePrivacyAuthorize()`（`#ifdef` 归位）；
CLAUDE/QUICK_START/current_sprint 的 `DEMO_MODE` 描述改为环境变量口径；`rule-performance` 的「只有 2 个页面」纠正为 7 个模板页。

## 三、验证

| 项 | 命令 | 结果 |
|---|---|---|
| 系统自检 | `node .claude/scripts/check_system.mjs` | ✅ 全部通过 |
| 模板审计 | `node .claude/scripts/check_templates.mjs` | ✅ 22 个 .vue |
| 微信小程序构建 | `npm run verify:mp-weixin` | ✅ |
| H5 构建 | `npm run verify:h5` | ✅ |
| 生产构建 | `npm run build:mp-weixin` | ✅ |
| 发布闸门 | `npm run check:release` | ❌ 预期失败（模板占位 + demo 页未剥离），清单正确列出三项 |
| 权限菜单逻辑 | esbuild 打包 access+demo 后 Node 断言 | ✅ |
| 生产演示旁路 | `VITE_DEMO_MODE=true npm run build:mp-weixin` | ✅ 产物首行即 `throw`（启动阻断） |
| 开发者工具 / 真机 | — | 未执行 |

## 四、未处置 / 需用户拍板

1. **`5800x` 是否固化为公司 RBAC 标准码**（当前只在模板内建议，后端模板没有）。
2. **`.claude` 全套是否保留**（13 rule + 10 agent + 4 workflow；评审认为对新人偏重）。
3. **`region-code.js` 160KB** 是否移入分包 / 改成按需加载。
4. **是否内置 tabBar 骨架**（当前无导航设计，按「不编造」留空）。
5. **是否引入 vitest**（纯函数与请求策略可测；本轮未装依赖）。
6. **后端 `POST /admin/upload` 控制器** 需要后端窗口实现（前端契约已固定为 `data.url`）。
7. 评审建议的「`.claude` 链接 / 陈旧值自动检查」尚未实现（本轮人工清理；可作为 v1.1 项）。

## 五、评审

- r1：有条件通过（3.4/5，5 个阻断）→ 已修。
- r2：有条件通过（1 个剩余阻断 R-1 + 5 项高优先回归）→ 已全部修复（见 §二-b），**待 r3 确认关闭**。