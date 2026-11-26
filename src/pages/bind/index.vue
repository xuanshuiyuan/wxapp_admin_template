<!--
  绑定管理员账号页（2026-10-26 v1.0.0 新建；视觉沿用原登录页的「流光玻璃」整屏极光 + 玻璃卡）。

  为什么是「绑定」而不是「登录」：管理端的登录是**微信静默**的（wx.login 换 token，用户无感），
  后端**不会**为新微信自动建账号 —— 没绑过的微信会回 58001，那是**流程分支不是错误**。
  本页就是那条分支的落地页：用「手机号 + 密码」证明「我是这个管理员」，把当前微信与账号绑上。
  绑定成功后**以后免密**（走微信静默登录），密码只在这一次用到。

  ★ 模板的两种模式（config/app.js 的 DEMO_MODE）：
    · 演示模式（默认 true）：本页提交**不请求后端**，直接把 config/demo.js 的演示会话写进本地存储
      （任意手机号 + 6 位以上密码都通过）——用来在没有后端时跑通登录后的整套权限菜单。
    · 真实模式：调 admin/login/bind（多轮契约见 services/session.js 的注释）。
      后端自建 RBAC 的接入点见 README「后端对接指引」。

  到达本页的路径只有一条：services/session.js 的 requireAdminLogin() 拿到 58001 →
  route.relaunch(PAGE_BIND)（**清栈**：未绑定时页面栈里没有有意义的历史）。
  故本页**没有返回入口** —— 退回去也只会再次被弹回来。

  ⚠️ 页面只做「格式校验 + 渲染 + 事件响应」：频控倒计时是契约给页面的**交互要求**，
  真正的绑定规则（取新 code、重试一次、写会话）在 services/session.js 的 bindAdmin() 里。
-->
<template>
	<!-- 页根 = 极光渐变整屏底（含状态栏区域），内容竖向排列 -->
	<view class="bind aurora-bg">
		<!-- 状态栏占位：本页 pages.json 是 navigationStyle:custom，真机状态栏由系统绘制，
		     页面自己让出高度即可 —— 高度只问 getLayout()（H5 恒 0），页面零条件编译 -->
		<view class="bind__sbar" :style="{ height: bar.statusBarHeight + 'px' }"></view>

		<!-- 主区：玻璃卡垂直居中 -->
		<view class="bind__main">
			<view class="glass bind__card">
				<!-- 品牌区走**公共件**：首页冷启动的「启动判定态」用的是同一个组件 ——
				     两屏之间只隔一次 reLaunch 整屏瞬切，品牌区是唯一"不动"的锚点，
				     各写一份必然漂移（见 app-brand 的文件头与 .claude/CLAUDE.md §3.3 的冷启动说明） -->
				<app-brand title="绑定管理员账号" sub="首次使用需绑定，之后免密进入" />

				<!-- 表单：手机号 + 密码。输入行是**按钮**：点一下跳通用字段编辑页输入
				     （用户 2026-10-30 定「所有 input 都跳新页面编辑」，绑定页也已统一）。
				     视觉仍沿用原来的玻璃输入条（图标 + 值/占位 + 箭头），只是值不再页内可编。 -->
				<view class="bind__form">
					<view class="field">
						<view class="field__box bind__row" hover-class="bind__row--hover" @click="onEditMobile">
							<view class="bind__ico">
								<u-icon name="account" size="20" :color="theme.textMuted" />
							</view>
							<text class="bind__val" :class="{ 'bind__val--ph': !form.mobile }">
								{{ form.mobile || '请输入管理员账号' }}
							</text>
							<u-icon name="arrow-right" size="16" :color="theme.textMuted" class="bind__arrow" />
						</view>
					</view>

					<view class="field">
						<view class="field__box bind__row" hover-class="bind__row--hover" @click="onEditPassword">
							<view class="bind__ico">
								<u-icon name="lock" size="20" :color="theme.textMuted" />
							</view>
							<!-- 密码默认只显示固定圆点（连长度也不泄露）；眼睛是用户主动点开的「看一眼」，
							     与改版前输入框的可见切换同一语义。点眼睛不要触发整行跳页编辑（stop） -->
							<text class="bind__val" :class="{ 'bind__val--ph': !form.password }">
								{{ form.password ? (pwdVisible ? form.password : '••••••') : '请输入密码' }}
							</text>
							<view v-if="form.password" class="bind__eye" @click.stop="pwdVisible = !pwdVisible">
								<u-icon :name="pwdVisible ? 'eye-off' : 'eye'" size="18" :color="theme.textMuted" />
							</view>
							<u-icon name="arrow-right" size="16" :color="theme.textMuted" class="bind__arrow" />
						</view>
					</view>
				</view>

				<!-- 说明：把「为什么现在要输密码、以后还会不会要」讲清楚，免得用户以为这是日常密码 -->
				<text class="bind__hint">
					{{ demoMode ? '演示模式：任意账号 + 6 位以上密码即可进入（不请求后端）' : '账号与密码由管理员提供；绑定成功后本机免密进入，密码不再用于日常使用。' }}
				</text>

				<button
					class="btn btn--aurora btn--lg bind__cta"
					:class="{ 'bind__cta--disabled': !canSubmit }"
					:hover-class="'btn--hover'"
					:disabled="!canSubmit"
					@click="onSubmit"
				>
					{{ ctaText }}
				</button>
			</view>
		</view>

		<!-- 卡外页脚：压在极光上，故走白字（scaffold 的 .version 是浅底用的弱墨色）。
		     ⚠️ 文案取 config/app 的 APP_VERSION_TEXT（成品串）而不是页面自己拼 ——
		     首页的启动态要用**逐字相同**的页脚（两屏的行高/位置必须一致），拼两遍必漂移 -->
		<text class="version bind__version">{{ APP_VERSION_TEXT }}</text>

		<!-- 全局单例渲染方：少了它们 toast / 守卫弹框（账号禁用 / 未配角色）会静默降级成原生样式 -->
		<app-modal />
		<app-loading :mask="true" />
	</view>
</template>

<script setup>
// ⚠️ 两个卸载钩子来自**不同的包**，别合并写：`onUnload` 是小程序页面生命周期
//    （@dcloudio/uni-app），`onBeforeUnmount` 是 Vue 组件生命周期（vue）。
//    写错包的后果不是"多注册一次"而是**编译期报错**（那个包没有这个导出）。
import { computed, onBeforeUnmount, reactive, ref } from 'vue';
import { onUnload } from '@dcloudio/uni-app';
import { getLayout } from '@/services/platform';
import { toast, withLoading, resetLoading } from '@/services/toast';
import { bindAdmin } from '@/services/session';
import { editField } from '@/services/fieldEditor';
import { isApiError } from '@/services/http';
import { route, PAGE_ADMIN_HOME } from '@/services/route';
import { theme } from '@/config/theme';
import { APP_VERSION_TEXT, DEMO_MODE } from '@/config/app';
import { BIND_COOLDOWN_SECONDS, CODE_BIND_RATE_LIMITED } from '@/config/dict';

// 字段长度上限：**与后端契约一致**（文档：手机号最长 16 字符、密码 6~32 位），
// 故 maxlength 用契约值而不是随手取一个"够长"的数 —— 长度校验放在入口层是允许的（格式校验）
const MOBILE_MAX_LEN = 16;
const PASSWORD_MIN_LEN = 6;
const PASSWORD_MAX_LEN = 32;

// 布局尺寸只问 getLayout()（进程内缓存，H5 的状态栏高恒为 0）
const bar = getLayout();

const demoMode = DEMO_MODE;
const form = reactive({ mobile: '', password: '' });

// 提交在飞态：防重入（授权回调与点击可能双触发这类问题，一次提交只允许有一个）
const submitting = ref(false);
// 密码眼睛：默认密文；只影响本页展示，编辑页有自己的眼睛
const pwdVisible = ref(false);
// 频控剩余秒数（0 = 可提交）。页内状态**不落存储**：离页即失，而服务端窗口锁仍在
const cooldown = ref(0);
let timer = null;

const canSubmit = computed(() => !submitting.value && cooldown.value <= 0);
const ctaText = computed(() => {
	if (cooldown.value > 0) return `${cooldown.value}s 后可重试`;
	return submitting.value ? '绑定中…' : '绑定并进入';
});

// ---------------- 点行 → 跳通用字段编辑页（用户 2026-10-30 定） ----------------

async function onEditMobile() {
	const value = await editField({
		title: '管理员账号',
		type: 'phone',
		maxlength: MOBILE_MAX_LEN,
		value: form.mobile,
		placeholder: '请输入管理员账号'
	});
	if (value !== null) form.mobile = value;
}

async function onEditPassword() {
	// ⚠️ 不把当前密码交给编辑页（即便走内存，也没必要多一处持有）：始终从空开始；
	// 取消 = 保持原密码，确认空 = 必填校验会拦住（编辑页 optional:false）
	const value = await editField({
		title: '登录密码',
		type: 'password',
		maxlength: PASSWORD_MAX_LEN,
		value: '',
		placeholder: '请输入密码'
	});
	if (value !== null) form.password = value;
}

/** 停掉倒计时（幂等：清理与开始都可调） */
function stopCooldown() {
	if (timer) {
		clearInterval(timer);
		timer = null;
	}
	cooldown.value = 0;
}

/**
 * 频控倒计时：后端 58003 = 同一手机号 60 秒内失败满 5 次。
 * 为什么是倒计时而不是重试：重试只会继续吃窗口（后端文档明确「不要自动重试」）。
 */
function startCooldown() {
	stopCooldown();
	cooldown.value = BIND_COOLDOWN_SECONDS;
	timer = setInterval(() => {
		cooldown.value -= 1;
		if (cooldown.value <= 0) stopCooldown();
	}, 1000);
}

// 双清理：MP 端页面卸载 + H5 端组件销毁兜底（漏了会让定时器在离页后继续跑）
onUnload(() => {
	stopCooldown();
	resetLoading();
});
onBeforeUnmount(() => {
	stopCooldown();
	resetLoading();
});

/**
 * 提交绑定。
 * 校验只做**格式级**（必填 / 长度，入口层允许）；语义校验（账号密码是否正确、
 * 是否已绑过别的微信）一律以后端为准 —— 前端不猜、也不提前判。
 */
async function onSubmit() {
	if (!canSubmit.value) return;

	// 手机号 trim 掉首尾空白：从别处粘贴常带空格，不裁会让用户对着看不出的空格反复失败；
	// 密码**不 trim** —— 首尾空格可能是密码的一部分，裁掉会让人永远绑不上
	const mobile = form.mobile.trim();
	const password = form.password;

	if (!mobile) {
		toast('请输入管理员账号');
		return;
	}
	if (!password) {
		toast('请输入密码');
		return;
	}
	if (password.length < PASSWORD_MIN_LEN || password.length > PASSWORD_MAX_LEN) {
		toast(`密码长度需为 ${PASSWORD_MIN_LEN}~${PASSWORD_MAX_LEN} 位`);
		return;
	}

	submitting.value = true;
	try {
		// 用 withLoading 包住整段（而不是给请求传 { loading: true }）：
		// 绑定内部可能因 60003 换新 code 重试一次，托管 loading 会在两次请求之间闪断
		await withLoading(() => bindAdmin({ mobile, password }));
		// 绑定成功 = 已是登录态（接口返回与登录完全相同，session 内已 writeSession），
		// 故**不再调登录接口**；清栈进首页（本页是被 relaunch 进来的，栈里只有自己）
		toast('绑定成功');
		route.relaunch(PAGE_ADMIN_HOME);
	} catch (e) {
		// guard 型（50008 账号禁用 / 58004 未配角色）：全局守卫已弹框说明，本页不重复提示
		if (isApiError(e) && e.type === 'guard') return;
		// 58003 走倒计时（按钮文案承担提示）；其余照后端 msg 提示 ——
		// ⚠️ 58002「账号或密码错误」后端**故意不区分**是手机号还是密码错（防账号枚举），
		//    前端不得拆成两种提示，也不得引导用户去"找回密码"
		if (Number(e && e.code) === CODE_BIND_RATE_LIMITED) startCooldown();
		toast((e && e.message) || '绑定失败，请重试');
	} finally {
		submitting.value = false;
	}
}
</script>

<style lang="scss" scoped>
/* 页根只负责「整屏 + 竖向排列」，极光底由 .aurora-bg 提供（不套 .page：它的内距与灰底
   是内容页口径，本页的极光是整屏铺满、无页边距的） */
.bind {
	display: flex;
	flex-direction: column;
	min-height: 100vh;
}

/* 状态栏占位：高度由 JS 给（inline style），这里只锁住不参与伸缩 ——
   否则内容一长它会被 flex 压缩，顶部内容钻到系统状态栏底下 */
.bind__sbar {
	flex: none;
}

/* 主区吃掉剩余高度并把卡片居中 */
.bind__main {
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 0 $sp-8; // 稿内页边距 32pt（=64rpx），比内容页的 $page-padding 大一档
}

/* 登录卡：稿内 24pt 圆角 + 28pt 内距，比 .glass 默认的卡片档大一档 */
.bind__card {
	border-radius: $rd-panel;
	padding: $sp-7;
}

/* 品牌区（徽标 + 标题 + 副标）的样式随组件走：src/components/app-brand/app-brand.vue */

.bind__form {
	margin-top: $sp-6; // 稿内 24pt
}

/* 左侧图标位：版式库只给了右位（.field__eye），左位在本页补一个（间距按稿内 10pt 取 $sp-2） */
.bind__ico {
	flex: none;
	display: flex;
	align-items: center;
	margin-right: $sp-2;
}

/* 输入框两处偏离版式库默认：底色与常态描边。
   稿内输入框是「近白半透 + 主色淡描边」（压在玻璃卡上），版式库的 $bg-fill 灰底在玻璃卡上会显脏；
   色值仍从 token 推导（rgba($token, α)），不写死色值 */
.field__box {
	background-color: rgba($bg-card, 0.9);
	border-color: rgba($color-primary, 0.18);
}

/* 点行跳页编辑后的行：值区占满、右箭头贴右；hover 只做轻微反馈 */
.bind__row {
	justify-content: flex-start;
}

.bind__row--hover {
	opacity: 0.86;
}

.bind__val {
	flex: 1;
	min-width: 0;
	font-size: $fs-lead;
	color: $text-title;
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}

.bind__val--ph {
	color: $text-muted;
}

.bind__eye {
	flex: none;
	width: 44rpx;
	height: 44rpx;
	margin-left: $sp-1;
	display: flex;
	align-items: center;
	justify-content: center;
}

.bind__arrow {
	flex: none;
	margin-left: $sp-2;
}

/* 说明文字：卡内弱墨、左对齐（居中会让两行长短不齐时读起来散） */
.bind__hint {
	display: block;
	margin-top: $sp-2;
	font-size: $fs-micro;
	color: $text-muted;
	line-height: $lh-base;
}

/* CTA 上距按稿内辅助行间距取；字距 .06em ≈ 2rpx（token 无字距档，按稿值收这一处） */
.bind__cta {
	margin-top: $sp-5;
	letter-spacing: 2rpx;
}

/* 不可提交（在飞 / 倒计时中）：只降透明度，不换配色 —— 按钮仍是那支渐变，
   避免用户以为"按钮坏了"（与 btn--hover 同一手法，尺度更弱） */
.bind__cta--disabled {
	opacity: 0.5;
}

/* 页脚压在极光上 → 走白字；底距两行缺一不可（纯 rpx 回退 + 叠安全区），见 theme.scss $safe-bottom */
.bind__version {
	color: $text-on-aurora-2;
	padding-bottom: $sp-7;
	padding-bottom: calc(#{$sp-7} + #{$safe-bottom});
}
</style>