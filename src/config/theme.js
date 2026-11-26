// ---------------------------------------------------------------------------
// JS 侧的主题 token —— 「流光玻璃」Aurora Glass 体系（管理端）。
//
// 存在的原因：u-icon / u-loading-icon 这类组件的 color 是 prop，只能传字符串，
// 读不到 SCSS 变量（common/css/theme.scss）。没有这个文件的话，色值就会散落在
// 各页面的模板里，改主色时必然漏几处。
//
// ⚠️ 这里的值必须与 common/css/theme.scss 保持一致，改颜色时两处一起改
//    （theme.scss 是唯一真源）。
// ⚠️ 除了颜色，**尺寸也有 JS 侧消费者**：页面做布局算术时要把某个固定件的真实高度算进去
//    （例：app-refresher 的 :top 必须加上 tab 条高，见 theme.scss 的 $size-tabbar-h），
//    那种值只能在这里镜像一份 —— 不许在页面里直接写 rpx 数字。单位一律 **rpx**。
// 样式表里请优先用 SCSS 变量或 base.scss 的原子类，不要 import 这个文件拼字符串。
// ---------------------------------------------------------------------------

export const theme = {
	// 品牌色
	primary: '#6D5BFF',
	primaryDark: '#5A48E8',
	primaryLight: '#EFEDFF',
	// 数据强调（数字/图表）—— 语义独立于主色
	data: '#22C3E6',

	// 状态色
	success: '#12B76A',
	warning: '#F79009',
	danger: '#F04438',
	info: '#8B86A8',

	// 文字（title 与 main 同值：稿里正文与标题同一个墨色，靠字重分层）
	textTitle: '#1A1730',
	textMain: '#1A1730',
	textSub: '#5A5578',
	textMuted: '#8B86A8',
	textDisabled: '#C6C2D6',
	textInverse: '#FFFFFF',
	textOnPrimary: '#FFFFFF', // 主色底上的字（CTA / 主色 chip 的 color prop 用）
	textOnAurora: '#FFFFFF', // 极光渐变上的字

	// 背景与填充
	bgPage: '#FAFAFE',
	bgCard: '#FFFFFF',
	bgFill: '#F4F3FA',
	bgHover: '#F6F5FC',

	// 描边
	border: '#EFEDF7',
	divider: '#F1F0F7',

	// 占位（图标缺省色等）
	iconPlaceholder: '#C6C2D6',

	// 组件尺寸（rpx）—— 只镜像「页面算术要用到」的那些，见文件头说明
	sizeTabbarH: 92
};

export default theme;