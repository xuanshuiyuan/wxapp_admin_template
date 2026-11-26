<script>
import { env, rootPath } from '@/config/env'
import { RUNTIME } from '@/services/platform'
import { initAppUpdate } from '@/services/appUpdate'

export default {
	onLaunch() {
		// 多端调试时第一眼要看到的信息：跑在哪个端、打到哪个 host
		console.log(`[launch] runtime=${RUNTIME} env=${env} rootPath=${rootPath || '(空，走相对路径)'}`)
		if (!rootPath && RUNTIME !== 'h5') {
			console.error('[launch] 接口 host 未配置：小程序/App 必须用 http(s) 绝对地址，请填 .env.production 的 VITE_HOST_MP / VITE_HOST_APP')
		}
		if (rootPath && RUNTIME !== 'h5' && !/^https?:\/\//.test(rootPath)) {
			console.error(`[launch] 非 H5 端接口地址必须是绝对地址，当前为 ${rootPath}`)
		}

		// ⚠️ 这里**刻意不做静默登录**：登录失败分支要**跳页**（58001 未绑定 → 绑定页），
		// 而 onLaunch 阶段首个页面还没创建，此时 navigateTo/relaunch 在微信端不可靠（会静默失败）。
		// 改为由**首屏页 onShow** 的 requireAdminLogin() 触发：登录一样无感（对用户就是首屏加载），
		// 但跳页发生在页面栈就绪之后。未登录时请求层仍会自动补会话（request.js 的 authHandler），
		// 故没有"漏登录"的窗口。

		// 小程序版本更新提示（仅微信小程序生效）：只注册监听 + 往全局弹窗队列推一条，
		// **不做跳页** —— 所以与上面的登录不同，放 onLaunch 是安全的（理由见 services/appUpdate.js）。
		initAppUpdate()
	},
	onShow() {},
	onHide() {}
}
</script>

<style lang="scss">
/* 组件库基础样式 */
@import '@/uni_modules/uview-plus/index.scss';

/* ColorUI：只用它的原子类（bg / text / flex 间距那一套），组件一律走 uview-plus */
@import '@/common/css/main.css';
@import '@/common/css/base.scss';

/* 脚手架通用版式：.page-shell .card .glass .rows .entry-grid .btn .field ... */
@import '@/styles/scaffold.scss';

.uni-row {
	flex-direction: row;
}

.uni-column {
	flex-direction: column;
}
</style>
