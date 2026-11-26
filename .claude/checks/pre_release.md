# checks/pre_release.md — 发布前检查清单

> **用法**：发布前逐条勾。**执行任何构建命令前必须获用户确认。**
> 完整流程见 `.claude/workflows/release.yaml`。
>
> ⚠️ **本清单的第 4 节（产物校验）是本项目最不可省的部分** ——
> 历史上把开发包发到生产就是漏了这一步（见本文件第 4 节的产物校验）。

---

## 1. 前置条件（**任一未过 → 阻断发布**）

| # | 检查 | 过? | 说明 |
|---|---|---|---|
| 1.1 | `reviewer` 已给出「无阻断项」结论 | ☐ | 未评审通过不许发布 |
| 1.2 | `security_agent` 无严重 / 高风险项 | ☐ | |
| 1.3 | 本次发布内的**真重要变更**已在 commit message 记录（CHANGELOG 已冻结，见 §11.1） | ☐ | 重要变更无记录 = 发布未完成 |
| 1.4 | `.env.production.local` 的 `VITE_API_KEY` 已就位 | ☐ | ⚠️ **换机器 / 他人 clone 必须另行向后端领取**，否则产物签不出合法请求（K-04） |
| 1.5 | 本次若改了 `config/app.js` 的 `edition` / `source` → **后端已登记新值** | ☐ | ⚠️ 未登记的值会被后端 **fail-closed** 拒（`Im Invalid Request!`），且是**全局**协商头（K-02/K-03） |
| 1.6 | **与后端确认 `VITE_MOCK_LOGIN_CODE` 联调通道在生产无效** | ☐ | ⚠️ 若生效 = 越权风险（`src/config/env.js` 已加启动硬护栏，仍要确认后端也拒绝） |
| 1.7 | 回滚方案已准备好（**不能事后补**） | ☐ | |

---

## 2. 发布前静态扫描

```bash
# 2.1 密钥不得出现在 src/
grep -rn "VITE_API_KEY\|apiKey" src/ --include=*.js --include=*.vue

# 2.2 误提交检查
git status --porcelain | grep -E "\.env\.|dist/|unpackage/|\.idea/"

# 2.3 明文 http
grep -rn "http://" src/

# 2.4 调试残留（关键路径）
grep -rn "console\.log\|debugger" src/ --include=*.js --include=*.vue | grep -v uni_modules

# 2.5 页面里不得有 #ifdef
grep -rn "#ifdef\|#ifndef" src/pages src/components
```

---

## 3. 构建（★ 三条口径，**执行前须用户确认**）

### ⚠️ 三条口径（从 C 端踩坑带来，违反任一条都可能把开发包发到生产）

1. **目录由 `dev:*`/`build:*` 决定，环境由 `--mode` 决定，两轴正交。**
   `dev:*` 写 `dist/dev/`；`verify:*` 与 `build:*` **共用** `dist/build/`
   —— **后跑者覆盖前跑者**。
2. **发布前必须最后跑一次 `build:*`。**
   只跑过 `verify:*` 就上传，会把 host 指向 `localhost:15000` 的开发包发到生产。
   **分辨只能靠 `grep localhost:15000`，别靠目录名。**
3. **真机测试包必须来自 `npm run dev:mp-weixin` 的 `dist/dev/mp-weixin`**（development 环境）。

### 命令顺序

```bash
# 目标：微信小程序生产包
npm run verify:mp-weixin      # ① 编译校验（development，产物在 dist/build/mp-weixin）
npm run build:mp-weixin       # ② ★ 发布构建 —— 必须是【最后一条】（production）

# 目标：H5 生产包
npm run verify:h5             # ①
npm run build:h5              # ② ★ 最后一条
```

| # | 检查 | 过? |
|---|---|---|
| 3.1 | 命令序列的**最后一条是 `build:*`**（不是 `verify:*`） | ☐ |
| 3.2 | 目标端正确（`mp-weixin` / `h5`，**不要搞混**） | ☐ |
| 3.3 | 每次执行命令**前**都已告知用户并获确认 | ☐ |

---

## 4. ★ 产物校验（**最不可省**）

```bash
# 4.1 ★ 最关键：产物不得指向开发环境
grep -rn "localhost:15000" dist/build/mp-weixin/
# → 期望：【无输出】

# 4.2 产物中不得有密钥明文
grep -rn "VITE_API_KEY" dist/build/mp-weixin/
# → 期望：【无输出】

# 4.3 appid 正确
cat dist/build/mp-weixin/project.config.json 2>/dev/null | grep -i appid
# → 期望：本项目自己的 appid（与 src/manifest.json 一致，且不是 REPLACE_WX_APPID）

# 4.4 产物指向生产域名
# ★ 一条命令替代手工 grep（DEMO_MODE / 联调旁路 / 占位 / 演示 token / host 一致性）
npm run check:release
# → 期望：✅ 发布产物体检通过；任何一项不满足即退出码 1

grep -rn "localhost\|127.0.0.1" dist/build/mp-weixin/ | head -3
# → 期望：为空（开发域名不能进生产）
grep -rn "REPLACE_" dist/build/mp-weixin/ | head -3
# → 期望：为空（占位已替换）
```

| # | 检查 | 期望 | 过? |
|---|---|---|---|
| 4.1 | `grep localhost:15000` | **无输出** | ☐ |
| 4.2 | 无密钥明文 | 无输出 | ☐ |
| 4.3 | appid | 与 `src/manifest.json` 一致且不是 `REPLACE_WX_APPID` | ☐ |
| 4.4 | 生产域名 | 指向生产 | ☐ |
| 4.5 | 无调试残留 | 无 `console.log` | ☐ |
| 4.6 | 产物目录来自 `build:*`（不是 `dev:*`） | `dist/build/` | ☐ |

> ⚠️ **4.1 未过 → 立即停下，转 `debugger` 查根因，不许「先发了看看」。**

---

## 5. 发布

| # | 检查 | 过? |
|---|---|---|
| 5.1 | 使用**第 4 节校验过**的那份产物 | ☐ |
| 5.2 | 多端发布时**逐端独立**出清单、独立校验（**不许合并成一条命令**） | ☐ |
| 5.3 | 上传动作**由用户手动完成**（微信开发者工具 / HBuilderX） | ☐ |
| 5.4 | 未改 `manifest.json` 的 appid | ☐ |

---

## 6. 发布后验证（★ 必做）

| # | 检查 | 过? |
|---|---|---|
| 6.1 | 冷启动静默登录成功 | ☐ |
| 6.2 | 真机下拉刷新正常 | ☐ |
| 6.3 | 关键页无白屏 | ☐ |
| 6.4 | 接口 host 指向生产（**非** localhost） | ☐ |
| 6.5 | 手机号脱敏展示正常 | ☐ |

> **6.x 任一未过 → 执行回滚方案，上报用户。**

---

## 7. 回滚方案（**发布前必须已备好**）

| 端 | 回滚方式 |
|---|---|
| 微信小程序 | 在微信公众平台将线上版本回退到上一个已发布版本（体验版 / 正式版各自回退） |
| H5 | 重新部署上一个可用产物；若无留存产物，从上一个可用 tag 重新 `build:h5` |
| App | 下架当前包 / 提交上一个可用版本 |

**回滚后验证**：冷启动静默登录成功 + 关键页可打开。

---

## 8. 收尾登记（**强制**）

| # | 动作 | 过? |
|---|---|---|
| 8.1 | 发布信息写入 commit message / 发布说明（CHANGELOG 已冻结，**不新增**） | ☐ |
| 8.2 | 更新 `.claude/context/current_sprint.md`（记录已发布版本） | ☐ |
| 8.3 | 若本次暴露新风险 → 更新 `.claude/memory/known_issues.md` | ☐ |

---

## 9. 已知未确证项（**发布前必须知道**）

| 项 | 状态 | 说明 |
|---|---|---|
| `VITE_MOCK_LOGIN_CODE` 在生产是否无效 | 前端已有启动硬护栏 | 后端仍需确认拒绝该通道 |
| K-08 `.u-popup` 修复在 MP 端是否有效 | ⚠️ **未确证** | 仅 H5 语义下验过；**上弹层页面前必须真机验** |
| K-09 真机行为整体未验证 | ⚠️ 未确证 | 管理端 appid / 域名下未做全量真机验证 |

> **这些不能当作"已解决"。** 发布前若本次改动触及相关范围，**必须真机验证**。