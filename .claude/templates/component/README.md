# templates/component — 通用组件模板

**适用栈**：uni-app 3.x + Vue 3.4 + uview-plus。

## 文件

| 文件 | 用途 |
|---|---|
| `app-example.vue` | **`app-*` 跨页通用组件模板**（easycom 免 import） |

## 使用步骤

1. 建目录 `src/components/app-<name>/`，把模板复制为 `src/components/app-<name>/app-<name>.vue`
   （**目录名与文件名必须同名** —— easycom 的约定）。
2. 全局替换 `__NAME__` 为组件名（kebab-case，如 `app-plate-chip`）。
3. 全局替换 `PREFIX` 为组件根类名前缀（**≥3 字母**，如 `plateChip`）。
4. **无需在页面 import** —— `pages.json` 的 `easycom` 会自动注册，
   页面写 `<app-<name> />` 即可。
5. 若组件需要跨页复用，**先问 `architect`** 该不该上提到 `components/`
   （只有 1 处使用就不该上提 —— 过度抽象同样违规）。

## `app-*` 组件与页面私有组件的区别

| | `components/app-*` | 页面内私有组件 |
|---|---|---|
| 注册 | easycom **自动**（免 import） | 需页面显式 import |
| 用途 | 跨页通用（≥2 个页面） | 单页专用 |
| 位置 | `src/components/` | 页面目录下 |
| 与 C 端关系 | ⚠️ **属共用目录，改动需双向下发** | 不涉及 |

## 组件设计规则

1. **props 用对象形式**（`{ type, default }`），不用数组形式。
2. **`defineEmits` 显式声明**所有事件。
3. **状态优先级在 `computed` 里统一定义**（参考 `app-list-state` 的 `status`）——
   不要把 `v-if` 的先后顺序散落在模板里，那会导致各页行为不一致。
4. **渲染委托给 uview 现成组件**，不造轮子（参考 `app-list-state` 委托 `u-empty` / `u-loadmore`）。
5. **给 uview 传色值**用 `@/config/theme` 的 JS 镜像（uview 的 `color` 类 prop 只收字符串）。
6. **全屏浮层（loading / modal）放在滚动容器之外**，且**由页面挂载**，
   组件本身不做全局单例。

## 类名规则（★ 真机踩过）

- 根类名 **≥3 字母 + 语义前缀**。
- **写类名前先 grep**：
  ```bash
  grep -n "^\." src/common/css/main.css | head -50
  ```
- ⚠️ **真实事故**：`main.css`（ColorUI）有全局 `.fr { float: right }`。
  某表单行组件用 `.fr` 当根类名 → 被浮动到右边 → 行内 flex 全废（BUG-001）。
- 组件内部类名建议 `<根前缀>__<块>` 形式。

## 跨栈对照

| 栈 | 等价物 |
|---|---|
| React | 函数组件 + `props` / 回调 props |
| Vue 2 | Options API 组件 |
| Web Component | 自定义元素 + attributes |
| 原生小程序 | 自定义组件（`component: true`） |

**不变的部分**：props 显式、事件显式、状态优先级集中定义、类名不撞全局。