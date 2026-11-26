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

r3 追加：N-1（登录 await 期间 onShow 重入会重复 onReady）已加 `if (ready) return;` 复查；
R-6 第三处（`rule-add-page`）补「到 `services/route.js` export 块加一行」；
残留编号（K-02/K-03、BUG-003/007）已清；CHANGELOG 拦截项计数改为按实际项描述。

同批清理：`uploader` 的隐私预检移到 `platform.requirePrivacyAuthorize()`（`#ifdef` 归位）；
CLAUDE/QUICK_START/current_sprint 的 `DEMO_MODE` 描述改为环境变量口径；`rule-performance` 的「只有 2 个页面」纠正为 7 个模板页。

## 二-c、HTTP 请求结构统一（用户 2026-11-26 要求）

只允许三种请求形态，且响应结构唯一：

| 形态 | 入口 | 结构 |
|---|---|---|
| 读接口 | `curl.get(url, params)` | GET + query；数组**逗号串** |
| 业务写 / 查询 | `curl.post(url, data)` | POST + `application/x-www-form-urlencoded`；数组逗号串 |
| 文件上传 | `curl.upload(payload, url)` | POST + multipart（一次一个文件） |

- **移除 `curl.postJSON`**：后端统一表单解码，JSON 请求体不再作为第二种结构；
  第三方 JSON 接口只能在 api 层显式 `request({ contentType:'application/json', rawResponse:true })`。
- **响应强校验**：默认必须是对象且带数字 `code`；缺 `code` / 非对象一律抛
  `ApiError(type='unknown', '响应格式异常')`，只有显式 `rawResponse:true` 才原样返回。
- **GET 数组序列化与 POST 对齐**（逗号串），不再出现 `key=v1&key=v2` 与 `key[0]=` 两种写法。
- **自动闸门**：`check_system.mjs` 第 10 项扫描 `src/`，除 `services/http/transport.js` 外
  出现 `uni.request(` / `uni.uploadFile(` 即报错（防止绕过请求层）。

## 三、验证

| 项 | 命令 | 结果 |
|---|---|---|
| 系统自检 | `node .claude/scripts/check_system.mjs` | ✅ 全部通过（含文档漂移 + 请求结构统一两项新检查） |
| 模板审计 | `node .claude/scripts/check_templates.mjs` | ✅ 22 个 .vue |
| 微信小程序构建 | `npm run verify:mp-weixin` | ✅ |
| H5 构建 | `npm run verify:h5` | ✅ |
| 生产构建 | `npm run build:mp-weixin` | ✅ |
| 发布闸门 | `npm run check:release` | ❌ 预期失败，拦截项正确（生产 host 占位 / REPLACE_ 残留 / demo 页未剥离） |
| 权限菜单逻辑 | esbuild 打包 access+demo 后 Node 断言 | ✅ |
| 生产演示旁路 | `VITE_DEMO_MODE=true npm run build:mp-weixin` | ✅ 产物首行即 `throw`（启动阻断） |
| 开发者工具 / 真机 | — | 未执行 |

## 四、用户拍板后的落地（2026-11-26）

1. **`5800x` 定为公司标准 RBAC 码**：CLAUDE.md / dict.js / README 已按「标准」表述（后端模板未内置，新项目沿用同一组）。
2. **`.claude` 全套保留**。
3. **`region-code.js` 移入分包**：`pages/common/region-picker.vue` + 区划表 → `pages-sub/common/`；
   `pages.json` 加 `subPackages` + demo/page-b 预下载；主包 1.4M / 分包 152K（构建实测）；K-100 关闭。
4. tabBar：暂缓（无导航设计）。
5. vitest：暂缓（接真实业务前再装）。
6. **后端 `POST /admin/upload` 已派单**给后端窗口（契约 `data.url` + 40203/40204/40205/40001/60004），待回。
7. **文档漂移自动检查已实现**：`check_system.mjs` 新增第 9 项（内部路径存在性 + 陈旧值黑名单，排除 versions/ 历史报告）。

## 五、评审

- r1：有条件通过（3.4/5，5 个阻断）→ 已修。
- r2：有条件通过（1 个剩余阻断 R-1 + 5 项高优先回归）→ 已全部修复（见 §二-b）。
- r3：**通过**（新增 N-1 / R-6 残留已一并修掉）；剩余非阻断建议与待拍板项见 r2 §3/§4 与本文件 §四。