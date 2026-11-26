# 设计系统摘要 · C 流光玻璃（Aurora Glass）

> **这是摘要，不是真相源。**
> - 稿子内部冲突时：以 `docs/design/00-LATEST.md` 指向的**锚点模板**为准。
> - 落地成 Vue 时：以 `src/common/css/theme.scss`（token 唯一值源）+
>   `src/styles/scaffold.scss`（版式块）为准。
> - 本文件只负责“别每次都翻十张稿”—— 不替代看图。

## 1. 两种页面口径

| 口径 | 适用 | 关键特征 |
|---|---|---|
| **首屏 / 品牌页** | 首页、绑定页、登录类 | 极光渐变底、玻璃卡、白字、状态栏白字 |
| **二级页** | 列表 / 详情 / 表单 / 搜索 / 设置 | 白色自绘顶栏、`#FAFAFE` 浅底、白卡、紫为唯一强调色 |

★ 二级页**不上极光、不上玻璃**：浅底上没有东西可给 blur 模糊，玻璃会退化成灰白块。
识别度改由三件承担：**紫主色 + 20px 圆角浅影白卡 + `#F1F0F7` 发丝线分栏**。

## 2. Token（稿内单位 pt；落地 ×1.923 = rpx）

### 颜色

| 用途 | 值 |
|---|---|
| 主色 / 链接 / 选中 | `#6D5BFF` |
| 主色按下 | `#5A48E8` |
| 主色浅底 | `#EFEDFF` |
| 主色透明底 | `rgba(109,91,255,.12)` |
| 数据强调（数字 / 折线） | `#22C3E6` |
| 成功 / 警告 / 危险 | `#12B76A` / `#F79009` / `#F04438` |
| 墨-1 标题/正文 | `#1A1730` |
| 墨-2 字段标签/次行 | `#5A5578` |
| 墨-3 占位/时间/页脚 | `#8B86A8` |
| 禁用 | `#C6C2D6` |
| 页面底 | `#FAFAFE` |
| 白卡 | `#FFFFFF` |
| 填充控件底 | `#F4F3FA` |
| 按下底 | `#F6F5FC` |
| 发丝线 | `#F1F0F7` |
| 卡片描边 | `#EFEDF7` |
| 遮罩 | `rgba(26,23,48,.45)`（墨色，不要纯黑） |

**极光底**（品牌页唯一配方，坐标盒锁 390×844）：

```css
background:
  radial-gradient(circle at 88% 6%, rgba(34,195,230,.45), transparent 46%),
  radial-gradient(circle at 8% 94%, rgba(255,110,199,.35), transparent 50%),
  linear-gradient(160deg, #6D5BFF 0%, #8B5CF6 38%, #C86DD7 68%, #6D5BFF 100%);
background-size: 100% 844px;
```

**CTA 渐变**：`linear-gradient(135deg, #7C5CFF 0%, #B45CFF 100%)`
+ 柔影 `0 10px 24px rgba(124,92,255,.35)`。

**玻璃卡**（两行顺序不能反，先退化后玻璃）：

```css
background: rgba(255,255,255,.92);
background: rgba(255,255,255,.72);
-webkit-backdrop-filter: blur(20px) saturate(1.4);
backdrop-filter: blur(20px) saturate(1.4);
border: 1px solid rgba(255,255,255,.55);
box-shadow: 0 16px 40px rgba(76,54,160,.20);
```

### 字号（pt）

11（微）· 12（辅助）· 13（正文/键值）· 14（列表主文/控件）· 15（区块标题）·
17（顶栏标题）· 18（窄栏金额）· 20（页面主标题/问候）· 24（大数字，预留）

### 圆角 / 阴影 / 间距

- 圆角：**24** 内容区顶部 / 弹层顶 · **20** 卡片 · **14** 控件与按钮 · **6** chip
- 卡片影：`0 4px 18px rgba(26,23,48,.06)`
- 入口小卡：`0 6px 18px rgba(76,54,160,.10)`
- 底栏影：`0 -4px 16px rgba(26,23,48,.06)`
- 间距基数 4；页面左右边距 **16**；卡片内距 **16**；卡间距 **12**

## 3. 页面骨架（类名照抄锚点）

### 通用外壳

```
stage-title
phone (390×844, radius 44, overflow hidden)
└── screen (overflow-y:auto, 隐藏滚动条)
    └── page
```

### 二级页

```
.page (bg #FAFAFE; padding-bottom:104px 给底栏让位)
├── header.nav (sticky top:0, 白底 + 发丝线)
│   ├── .sbar (44px, 伪状态栏, 深墨字)
│   └── .nav__row (44px)
│       ├── .nav__back (44px 热区, margin-left:-8px 对齐)
│       ├── .nav__title (左对齐, flex:1)
│       └── .nav__capsule (87×32 占位, 不放动作)
├── .pagebody (padding:12px 16px 0)
│   └── .card ×N
└── .actionbar (absolute bottom; 8+48+8+20)
```

### 首屏 / 品牌页

```
.home (极光底)
├── .hdr (约 168px: 状态栏 44 + 顶行 + 问候行 + 余量)
└── .body (bg #FAFAFE, 顶部 24px 圆角; display:flex 以关住骑缝负外边距)
    ├── .glass.me (margin-top:-16px 骑缝)
    ├── 功能入口 .entry-grid (2 列)
    └── .page-foot (margin-top:auto 贴底)
```

## 4. 常用块

| 块 | 用途 | 要点 |
|---|---|---|
| `.card` | 白卡 | 20px 圆角 / 16 内距 / 浅影 |
| `.card__hd` + `.card__title` | 卡头 | 15px/600 + 右侧弱墨说明 |
| `.kv` / `.kv__k` / `.kv__v` | 键值行 | 左栏 88px，右栏可换行 |
| `.tag` | 类型/等级 chip | 18px 高 / 6px 圆角 / 11px-600 |
| `.urole` | 角色 chip | 紫浅底 + 紫字 |
| `.code` | 权限码 | 9.5px 等宽、弱化、右侧 |
| `.actionbar` + `.btn--ghost/--cta` | 底部动作 | 48px 高 / 14px 圆角 / CTA 渐变 |
| `.chk` / `--on` / `--part` | 三态勾选 | 18px；半选是白横杠，不能省 |
| `.switch` | 开关 | 44×26，紫底 |
| `.selall` | 每组全选快捷 | 22px 浅紫胶囊；满选时文案换「清空」 |

## 5. 快速开工顺序

1. 读 `docs/design/00-LATEST.md`，选锚点（列表 / 表单 / 详情 / 权限树 / 弹层 / 首页）。
2. 复制锚点文件的 `<style>` 顶部 `:root` 与基础块（手机框、sbar、nav、card）。
3. 换内容：区块顺序 → 字段/列 → 操作 → 状态。
4. 渲染截图自检，再更新索引。

## 6. 自检清单

- [ ] 390×844，一页一模板，stage-title 只有一行
- [ ] 无外网字体/图标/图片；图标为内联 SVG
- [ ] 二级页没有极光/玻璃；品牌页没有白顶栏
- [ ] 胶囊占位 87×32，顶栏右侧没有动作按钮
- [ ] 底部栏不遮内容（page padding-bottom ≈ 104）
- [ ] `<a>` 无下划线；无默认蓝色链接
- [ ] 手机号脱敏；数字/单号标注为示意
- [ ] 长文本（角色名/权限码/单号）不溢出
- [ ] 中文注释解释 why，不是复述代码
- [ ] `00-LATEST.md` / `latest.html`（**只放本次最新一批，不堆旧版**）/ `README.md` 已更新