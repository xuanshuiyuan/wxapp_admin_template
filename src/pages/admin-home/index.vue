<!--
  首页 · 管理端工作台（模板版）

  这是 B 端管理小程序**最值得带走的一块**：按登录返回的权限点渲染功能入口。
  数据来源只有一处 —— 本地会话（token + admin_info + permission）。
  「有哪些入口」在 config/access.js 的 HOME_ENTRIES 配；「显示哪几个」由 permission 决定。

  ★ 首屏有**两套骨架**，按 `booted` 二选一：
    ① 启动判定态（booted === false）：整屏极光 + 只含 <app-brand> 的玻璃卡 + 页脚。
       微信把 pages[0] 钉死成首页，冷启动必然先渲染本页，而「这人是谁」要等
       onShow 的一次登录判定。这段空窗期若渲染工作台，未绑定用户会看到工作台
       再被整屏切到绑定页，读作"被登出"。启动态与绑定页同一视觉基线，切过去像「启动 → 绑定」。
       已登录用户看不到它（booted 初值走同步判据 sessionReady()）。
    ② 正常首屏（booted === true）：下面这套滚动结构。

  ★ 滚动结构：根 .page-shell + .aurora-bg → scroll-view .page-shell__scroll
    → 极光头部 .ahome__hdr → 内容区 .page-shell__body（浅底 + 顶圆角）。
-->
<template>
	<!-- 根节点接 touch：下拉距离的兜底来源（原生不给 dy 时用，见 usePullRefresh） -->
	<view class="page-shell aurora-bg" @touchstart="onTouchStart" @touchmove="onTouchMove">
		<!-- ============ ⓪ 启动判定态 ============ -->
		<template v-if="!booted">
			<view class="ahome__boot-sbar" :style="{ height: layout.statusBarHeight + 'px' }"></view>
			<view class="ahome__boot">
				<view class="glass ahome__boot-card">
					<app-brand :title="APP_NAME" sub="正在进入…" />
				</view>
			</view>
			<text class="version ahome__boot-version">{{ APP_VERSION_TEXT }}</text>
		</template>

		<!-- ============ 身份已判定：正常首屏 ============ -->
		<template v-else>
			<!-- 状态栏让位块：下拉空档不能开在灵动岛/状态栏上 -->
			<view class="ahome__status-space" :style="{ height: layout.statusBarHeight + 'px' }"></view>

			<!-- :top 必须 = 上面让位块高度（同源），tone="aurora" 让指示器转白 -->
			<app-refresher
				:show="visible"
				:state="pullState"
				:last-at="lastRefreshAt"
				:offset="offset"
				:top="layout.statusBarHeight"
				tone="aurora"
			/>

			<!-- enable-flex 必开：小程序端 scroll-view 子节点默认不吃 flex 布局 -->
			<scroll-view
				class="page-shell__scroll"
				:scroll-y="true"
				enable-flex
				refresher-enabled
				refresher-default-style="none"
				refresher-background="transparent"
				:refresher-triggered="refreshing"
				:refresher-threshold="threshold"
				@refresherpulling="onPulling"
				@refresherrefresh="onRefresh"
				@refresherrestore="onPullEnd"
				@refresherabort="onPullEnd"
			>
				<template #refresher>
					<view class="ahome__refresher-slot"></view>
				</template>

				<!-- ============ ① 极光头部 ============ -->
				<view class="ahome__hdr">
					<view class="ahome__top" :style="topStyle">
						<text class="ahome__top-title on-aurora">工作台</text>
						<!-- 演示模式提示：接真后端后（DEMO_MODE=false）自动消失 -->
						<text v-if="demoMode" class="ahome__demo-tag on-aurora">演示模式</text>
					</view>

					<view class="ahome__greet">
						<text class="ahome__hello on-aurora">{{ greeting }}</text>
						<text class="ahome__date on-aurora-2">{{ todayText }}</text>
					</view>
				</view>

				<!-- ============ ② 内容区 ============ -->
				<view class="page-shell__body ahome__body">
					<view v-if="state === 'loading'" class="ahome__state">
						<app-list-state :first-loading="true" :skeleton-count="3" />
					</view>
					<view v-else-if="state === 'fail'" class="ahome__state">
						<app-list-state :error="error" @retry="refreshAll" />
					</view>

					<template v-else>
						<!-- 管理员信息（骑缝玻璃卡） -->
						<view class="glass glass--railed ahome__me">
							<view class="avatar ahome__me-avatar">{{ avatarChar }}</view>
							<view class="ahome__me-main">
								<text class="ahome__me-name">{{ adminName }}</text>
								<!-- role_names 为空时给「—」而不是空白，免得看起来像漏渲染 -->
								<text class="ahome__me-role">{{ identityText }}</text>
							</view>
							<text class="ahome__me-mobile">{{ mobileText }}</text>
						</view>

						<!-- 无可见入口：给一句明确说明（而不是空白），指向"找管理员分配权限" -->
						<view v-if="!entries.length" class="ahome__state">
							<app-list-state :empty="true" :empty-text="emptyText" @retry="refreshAll" />
						</view>

						<template v-else>
							<view class="sect__hd ahome__entries-hd">
								<text class="sect__title">功能入口</text>
							</view>

							<!-- 宫格：一项 = 一个大模块，点进去是该模块的页面。
							     显隐判据 = 本地配置 ∩ 登录权限点（见 composables/useAdminHome）。 -->
							<view class="entry-grid">
								<view v-for="entry in entries" :key="entry.code" class="entry">
									<view class="entry__inner" hover-class="entry__inner--hover" @click="onEntryTap(entry)">
										<view class="entry__disc">
											<u-icon :name="entry.icon" size="20" :color="theme.primary" />
										</view>
										<view class="ahome__entry-title-row">
											<text class="entry__name">{{ entry.name }}</text>
											<!-- 多子项入口挂徽标：告诉用户点开是「选一个」而不是直接进去 -->
											<text v-if="!entry.page && entry.childCount > 1" class="ahome__entry-badge">
												{{ entry.childCount }} 项
											</text>
										</view>
										<!-- 没有数量就不显示 0 —— 那会把"没数据"说成"没有单" -->
										<text v-if="entry.hasCount" class="entry__desc">{{ entry.countText }}</text>
										<text v-else-if="!entry.page && entry.childNames" class="entry__desc">{{ entry.childNames }}</text>
										<text v-else-if="entry.desc" class="entry__desc">{{ entry.desc }}</text>
									</view>
								</view>
							</view>
						</template>

						<text class="version ahome__version">{{ APP_VERSION_TEXT }}</text>
					</template>
				</view>
			</scroll-view>

			<!-- ============ ③ 子菜单弹层（过滤后 ≥2 个子项才打开） ============ -->
			<u-popup
				:show="sheet.open"
				mode="bottom"
				round
				:close-on-click-overlay="true"
				@close="closeSheet"
				class="ahome__popup"
			>
				<view class="ahome__sheet">
					<view class="ahome__sheet-grab"></view>
					<view class="ahome__sheet-hd">
						<text class="ahome__sheet-title">{{ sheet.title }}</text>
						<text class="ahome__sheet-sub">{{ sheet.sub }}</text>
					</view>

					<view
						v-for="(child, index) in sheet.children"
						:key="child.key"
						class="ahome__sheet-row-wrap"
						:class="{ 'ahome__sheet-row-wrap--divider': index > 0 }"
					>
						<view class="ahome__sheet-row" hover-class="ahome__sheet-row--hover" @click="onSheetSelect(child)">
							<view class="ahome__sheet-disc">
								<u-icon :name="child.icon || DEFAULT_ENTRY_ICON" size="20" :color="theme.primary" />
							</view>
							<view class="ahome__sheet-main">
								<text class="ahome__sheet-name">{{ child.name }}</text>
								<text v-if="child.desc" class="ahome__sheet-desc">{{ child.desc }}</text>
							</view>
							<u-icon name="arrow-right" size="16" :color="theme.textDisabled" />
						</view>
					</view>

					<view class="ahome__sheet-cancel" hover-class="ahome__sheet-cancel--hover" @click="closeSheet">
						取消
					</view>
				</view>
			</u-popup>
		</template>

		<!-- 全局实例：每页必须挂一次，请求层 { loading: true } 才有渲染方；
		     守卫弹框（账号禁用 / 未配角色）也需要它出现在 v-if 之外 -->
		<app-loading :mask="true" />
		<app-modal />
	</view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { onShareAppMessage, onShow } from '@dcloudio/uni-app';
import { getLayout } from '@/services/platform';
import { APP_NAME, APP_VERSION_TEXT, SHARE_TITLE, DEMO_MODE } from '@/config/app';
import { requireAdminLogin, sessionReady } from '@/services/session';
import { pageNeedsLogin, requirePageAccess } from '@/services/pageAccess';
import { userState, syncUser } from '@/store/user';
import { PAGE_ADMIN_HOME, route } from '@/services/route';
import { useAdminHome } from '@/composables/useAdminHome';
import { DEFAULT_ENTRY_ICON } from '@/config/access';
import { usePullRefresh } from '@/composables/usePullRefresh';
import { theme } from '@/config/theme';
import { maskMobile } from '@/utils/text';

// 布局尺寸（状态栏高 / 胶囊让位宽）由 getLayout() 给，H5 状态栏恒 0 —— 端差异已收在 services/platform
const layout = getLayout();
// 微信胶囊占着顶栏右端：自绘顶栏必须让出它的宽度（非微信端 capsuleReserve 恒 0）
const topStyle = layout.capsuleReserve ? { paddingRight: `${layout.capsuleReserve}px` } : {};
const demoMode = DEMO_MODE;

// 问候语与日期：纯展示格式化，故留在页面
const now = new Date();
const hour = now.getHours();
const greetWord = hour < 6 ? '凌晨好' : hour < 12 ? '上午好' : hour < 18 ? '下午好' : '晚上好';
const WEEK_CN = ['日', '一', '二', '三', '四', '五', '六'];
const todayText = `${now.getMonth() + 1} 月 ${now.getDate()} 日 星期${WEEK_CN[now.getDay()]}`;

// 首屏数据（可见功能入口）走 composable：入口显隐判据只有一处实现
const { state, error, adminInfo, entries, permission, load, fail } = useAdminHome();

/**
 * 空态文案**区分两种原因**（别把两种情况说成一句"暂无功能"）：
 *   · 会话里**没有权限点** → 是"没取到权限信息"（网络/会话问题），该下拉重试；
 *   · 有权限点但入口为空 → 才是真的"这个账号暂时没有可用功能"，该找管理员。
 * ⚠️ 判据用 composable 的**响应式** permission，不要直接读 storage（那不是响应式的）。
 */
const emptyText = computed(() =>
	permission.value.length ? '暂无可用功能，请联系管理员分配权限' : '未能获取权限信息，请下拉刷新重试'
);

const adminName = computed(() => adminInfo.value.user_name || userState.user_name || '管理员');
const mobileText = computed(() => maskMobile(adminInfo.value.mobile));
const identityText = computed(() => {
	const roles = adminInfo.value.role_names;
	return Array.isArray(roles) && roles.length ? roles.join(' · ') : '—';
});
const avatarChar = computed(() => (adminName.value || '管').slice(0, 1));
const greeting = computed(() => `${greetWord}，${adminName.value}`);

/**
 * 「身份是否已判定」——**初值走同步判据**，这是启动态对老用户零打扰的关键。
 * 若一律 false 开头，requireAdminLogin 即使同步就能返回，await 之后也已是下一个微任务，
 * 已登录用户冷启动会平白闪一帧启动画面。
 */
const booted = ref(sessionReady());

/**
 * 进页(onShow) 与 下拉刷新 共用的完整动作：先保证登录态可用，再取首屏。
 * 被调方都自己吞错，不会抛（usePullRefresh 的 onRefresh 是 try/finally，无 catch）。
 */
async function refreshAll() {
	const ok = !pageNeedsLogin(PAGE_ADMIN_HOME) || (await requireAdminLogin());
	// ⚠️ 必须**无条件**置 true，且必须在 !ok 分支**之前**：跳页可能失败，
	//    页面要能落到失败态让用户重试，不能永远卡在启动画面
	booted.value = true;
	syncUser();
	if (!ok) {
		fail('登录未成功，请检查网络后重试');
		return;
	}
	await load();
}

/**
 * ★ 返回本页**不重取**（避免"从子页返回时闪一下"）：
 * 首屏数据只由**用户动作**驱动 —— 首次进入 / 下拉刷新 / 失败重试。
 * 唯一的例外：还没有可用数据（首屏失败 / 被中断）→ 给它一次机会。
 */
let entered = false;
onShow(() => {
	// ★ 页面准入走统一入口（services/pageAccess + config/access 的 PAGES）。
	//   首页没有配权限门，故这里一定放行；仍走一次是为了让「每个页面进来先取本页配置」
	//   这条口径在全工程统一 —— 将来给首页加权限，只改配置、本页一行不动。
	if (!requirePageAccess(PAGE_ADMIN_HOME).allowed) return;
	if (entered && state.value === 'ok') return;
	entered = true;
	refreshAll();
});

/**
 * 微信转发（小程序胶囊菜单里的「转发」）。
 * ⚠️ **不注册本钩子，微信端的「转发」菜单项是灰的**（点不动）—— 它不只是配文案。
 * `path` 恒落首页、不带任何状态参：接收方进页自己走登录/绑定判定。
 */
onShareAppMessage(() => ({ title: SHARE_TITLE, path: PAGE_ADMIN_HOME }));

// 下拉三段态 + 「最后更新」时刻，全在公共件里（页面只给取数函数）
const { pullState, refreshing, lastRefreshAt, offset, visible, threshold, onPulling, onRefresh, onPullEnd, onTouchStart, onTouchMove } =
	usePullRefresh({ onRefresh: refreshAll });

/**
 * 入口（模块级）点击，三种形态：
 *   ① `page` 有值 → 直接跳；
 *   ② `page` 为空 + 子项过滤后 **1 个** → 直跳那一页；
 *   ③ 子项 **≥2 个** → 弹底部子菜单。
 * 过滤后 0 个子项的入口在 useAdminHome 里已被整个剔除，这里不会遇到。
 */
function onEntryTap(entry) {
	if (entry.page) {
		route.to(entry.page, entry.query || undefined);
		return;
	}
	if (entry.childCount === 1) {
		route.to(entry.children[0].page, entry.children[0].query || undefined);
		return;
	}
	if (entry.childCount > 1) openSheet(entry);
}

// ---------------- 子菜单弹层 ----------------

const sheet = ref({ open: false, title: '', sub: '', children: [] });

function openSheet(entry) {
	sheet.value = { open: true, title: entry.name, sub: entry.sheetSub, children: entry.children };
}

function closeSheet() {
	sheet.value = { ...sheet.value, open: false };
}

function onSheetSelect(child) {
	// 先关弹层再跳：从子页返回时弹层不能还开着
	closeSheet();
	if (child.page) route.to(child.page, child.query || undefined);
}
</script>

<style lang="scss" scoped>
/* 本页 scoped 样式只写「版式库没有的块」与「默认值不同的微调」，
   其余（玻璃卡 / 宫格 / 版本号）一律用 scaffold.scss 的现成块。 */

/* ---------------- ⓪ 启动判定态（与绑定页同一视觉基线，勿单独调值） ---------------- */

.ahome__boot-sbar {
	flex: none;
	width: 100%;
}

/* 主区：吃掉剩余高度并把卡居中 —— 与绑定页的 .bind__main 同写法、同页边距 */
.ahome__boot {
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 0 $sp-8;
}

/* ⚠️ 圆角与内距必须与绑定页的 .bind__card 同值：这张卡是两屏之间自身不变的锚点 */
.ahome__boot-card {
	border-radius: $rd-panel;
	padding: $sp-7;
}

/* 页脚压在极光上 → 白字；底距与绑定页 .bind__version 同值 */
.ahome__boot-version {
	color: $text-on-aurora-2;
	padding-bottom: $sp-7;
	padding-bottom: calc(#{$sp-7} + #{$safe-bottom});
}

/* ⚠️ flex:none 不能省：页壳是定高的列向 flex 容器，滚动区是 flex:1 ——
   让位块若被压缩，滚动区上沿会回到屏幕顶端，下拉空档又落回灵动岛上 */
.ahome__status-space {
	flex: none;
	width: 100%;
}

.ahome__refresher-slot {
	height: 0;
}

/* ---------------- ① 极光头部 ---------------- */

.ahome__hdr {
	/* 状态栏让位已收口到 .ahome__status-space，这里不再留状态栏内距 */
	padding-bottom: $sp-10 + $sp-5;
}

.ahome__top {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-top: $sp-1;
	padding-left: $page-padding;
	height: $size-avatar;
}

.ahome__top-title {
	font-size: $fs-cta;
	font-weight: $fw-semibold;
	line-height: 1;
}

.ahome__demo-tag {
	font-size: $fs-caption;
	line-height: 1;
	border: 1rpx solid rgba($text-inverse, 0.4);
	border-radius: $rd-chip;
	padding: 6rpx $sp-2;
	margin-right: $page-padding;
}

.ahome__greet {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	margin-top: $sp-1;
	padding: 0 $page-padding;
}

.ahome__hello {
	font-size: $fs-display;
	font-weight: $fw-semibold;
	line-height: $lh-display;
}

.ahome__date {
	font-size: $fs-caption;
	line-height: $lh-caption;
}

/* ---------------- ② 内容区 ---------------- */

.ahome__body {
	/* 内容区至少铺满一屏，页脚才有地方「贴底」；量不到头部高度时仍留 100vh 兜底 */
	min-height: 100vh;
}

/* 首屏状态块：内容区 padding-top 被压成 0（骑缝卡需要），骨架直接顶在交界线上会挤 */
.ahome__state {
	padding-top: $sp-6;
}

/* 管理员信息（骑缝玻璃卡） */
.ahome__me {
	display: flex;
	align-items: center;
}

.ahome__me-avatar {
	flex: none;
}

.ahome__me-main {
	flex: 1;
	min-width: 0;
	margin-left: $sp-3;
}

.ahome__me-name {
	display: block;
	font-size: $fs-label;
	font-weight: $fw-semibold;
	color: $text-title;
	line-height: $lh-label;
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}

.ahome__me-role {
	display: block;
	margin-top: $sp-0-5;
	font-size: $fs-caption;
	color: $text-sub;
	line-height: $lh-caption;
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}

.ahome__me-mobile {
	flex: none;
	margin-left: $sp-2;
	font-size: $fs-caption;
	color: $text-muted;
}

/* 功能入口区块头：管理员卡没有下外边距，块上距不能省 */
.ahome__entries-hd {
	margin-top: $sp-6;
}

.ahome__entry-title-row {
	display: flex;
	align-items: center;
	width: 100%;
}

.ahome__entry-badge {
	flex: none;
	margin-left: $sp-1;
	padding: 0 $sp-1;
	font-size: $fs-micro;
	line-height: $lh-caption;
	color: $color-primary;
	background-color: $color-primary-light;
	border-radius: $rd-chip;
}

.ahome__version {
	margin-top: auto;
}

/* ---------------- ③ 子菜单弹层 ---------------- */

/* u-popup 根节点自带 flex:1，直接做页壳子项会与滚动区瓜分高度 —— 两道都留 */
.ahome__popup {
	flex: none;
}

.ahome__sheet {
	padding: $sp-2 $page-padding $sp-4;
}

.ahome__sheet-grab {
	width: 64rpx;
	height: 8rpx;
	border-radius: $rd-pill;
	background-color: $divider-color;
	margin: 0 auto $sp-3;
}

.ahome__sheet-hd {
	margin-bottom: $sp-2;
}

.ahome__sheet-title {
	display: block;
	font-size: $fs-label;
	font-weight: $fw-semibold;
	color: $text-title;
	line-height: $lh-label;
}

.ahome__sheet-sub {
	display: block;
	margin-top: $sp-0-5;
	font-size: $fs-caption;
	color: $text-muted;
	line-height: $lh-caption;
}

.ahome__sheet-row-wrap--divider {
	border-top: 1rpx solid $divider-color;
}

.ahome__sheet-row {
	display: flex;
	align-items: center;
	padding: $sp-3 0;
}

.ahome__sheet-row--hover {
	opacity: 0.75;
}

.ahome__sheet-disc {
	width: $size-icon-disc;
	height: $size-icon-disc;
	border-radius: $rd-pill;
	background-color: $color-primary-soft;
	display: flex;
	align-items: center;
	justify-content: center;
}

.ahome__sheet-main {
	flex: 1;
	min-width: 0;
	margin-left: $sp-3;
}

.ahome__sheet-name {
	display: block;
	font-size: $fs-lead;
	font-weight: $fw-semibold;
	color: $text-title;
	line-height: $lh-lead;
}

.ahome__sheet-desc {
	display: block;
	margin-top: $sp-0-5;
	font-size: $fs-caption;
	color: $text-muted;
	line-height: $lh-caption;
}

.ahome__sheet-cancel {
	margin-top: $sp-3;
	height: 88rpx;
	border-radius: $rd-chip;
	background-color: $bg-fill;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: $fs-cta;
	font-weight: $fw-semibold;
	color: $text-title;
}

.ahome__sheet-cancel--hover {
	opacity: 0.8;
}
</style>