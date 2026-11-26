// ---------------------------------------------------------------------------
// uni-app Vite 配置
// ---------------------------------------------------------------------------
import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

export default defineConfig({
	plugins: [
		uni()
	],
	css: {
		preprocessorOptions: {
			scss: {
				// 使用 Dart Sass 现代 API，消除 legacy-js-api 警告
				// 静音已知 deprecation（uview-plus 内部遗留用法 + strict-unary + legacy API）
				silenceDeprecations: ['import', 'strict-unary', 'legacy-js-api']
			}
		}
	}
})