<!--
  省 / 市 / 区选择页（「跳页取值」工具页）。

  ★ 为什么是**跳页**而不是弹层：与通用字段编辑页同一口径（用户 2026-10-30 定）——
    输入类交互整页承载，三级联动在底部弹层里只露半屏、滚列时上下都被压着。
  ★ 协作机制与 field-editor 完全一致（`services/regionPicker.js` 的全局事件 + Promise）：
    确认先回传再返回；返回键 / 手势 = 放弃（`ok:false`），调用方 Promise 不能永挂。

  ★ 一处可选口径（随你的后端契约）：
    若后端要求 `district_code` 必须 6 位且前 4 位与市一致，注意区划表里东莞 / 中山 /
    儋州 / 嘉峪关的区级是 9 位镇街码 → 本页对**非 6 位区码**收起第三列、区级回城市本身。
    后端只认名称、不限位数时这段归一化不影响任何结果。

  入场参数（query）：
    level=province|city|district  选到哪一级（默认 district；业务城市传 city）
    province / city / district    已选名称（全称）          ┐ 用于回显定位；
    province_code / city_code / district_code  已选 code     ┘ code 优先、名称兜底
  回传值：{ level, actual_level, province, province_code, city, city_code, district, district_code }
    —— 名称一律**全称**，code 为 GB/T 2260；该市没有区县时 district 回城市本身。
-->
<template>
	<view class="rgp">
		<app-navbar :title="navTitle" :show-back="true" />

		<view class="rgp__body">
			<view class="card">
				<text class="rgp__display" :class="{ 'rgp__display--ph': !displayText }">
					{{ displayText || placeholder }}
				</text>

				<!-- ⚠️ picker-view 的初值只认**挂载时那一次** → 用 pickerReady 等 onReady 之后再挂，
				     否则回显会落在默认首项而不是已选值（同 field-editor 口径） -->
				<picker-view
					v-if="pickerReady"
					class="rgp__pv"
					:value="pickerValue"
					:indicator-style="indicatorStyle"
					@change="onChange"
				>
					<picker-view-column>
						<view v-for="p in PROVINCES" :key="p.code" class="rgp__pv-item">
							<text>{{ p.name }}</text>
						</view>
					</picker-view-column>
					<picker-view-column v-if="level !== 'province'">
						<view v-for="c in cities" :key="c.code" class="rgp__pv-item">
							<text>{{ c.name }}</text>
						</view>
					</picker-view-column>
					<picker-view-column v-if="hasDistrict">
						<view v-for="d in districts" :key="d.code" class="rgp__pv-item">
							<text>{{ d.name }}</text>
						</view>
					</picker-view-column>
				</picker-view>
			</view>

			<view class="btn btn--primary btn--lg btn--block rgp__cta" hover-class="btn--hover" @click="onConfirm">
				确认
			</view>

			<text class="version">{{ APP_VERSION_TEXT }}</text>
		</view>

		<!-- 全局渲染方（工具页同样要挂：守卫弹窗/loading 都可能由跳转前的页面触发后滞留到本页） -->
		<app-loading :mask="true" />
		<app-modal />
	</view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { onLoad, onReady, onUnload } from '@dcloudio/uni-app';
import { emitRegionResult } from '@/services/regionPicker';
import { usePageGuard } from '@/composables/usePageGuard';
import { PAGE_REGION_PICKER } from '@/config/access';
import { APP_VERSION_TEXT } from '@/config/app';
import { PROVINCE_CITY_DISTRICTS_CODE } from './region-code';
import { safeDecodeURIComponent } from '@/utils/text';

const PROVINCES = PROVINCE_CITY_DISTRICTS_CODE;
const LEVELS = ['province', 'city', 'district'];

// 指示条高度与 .rgp__pv-item 行高联动，改一处必须同步另一处（同 field-editor 口径：
// 该串在 H5 端原样绑到指示条节点，浏览器丢弃 rpx 后会回落默认高度，故换算成 px 再绑）
const PV_ITEM_HEIGHT_RPX = 88;
const indicatorStyle = `height: ${uni.upx2px(PV_ITEM_HEIGHT_RPX)}px;`;

const pickerReady = ref(false);
const idx = ref([0, 0, 0]);
const level = ref('district');
/** 外部是否带了已选值（决定回显要不要出占位符） */
const hasInitial = ref(false);
/** 用户是否动过列（动过之后回显跟着列走） */
const dirty = ref(false);
/** 是否已回传结果：确认走后 onUnload 不再补发放弃事件，避免覆盖结果 */
let emitted = false;

const province = computed(() => PROVINCES[idx.value[0]] || PROVINCES[0]);
const cities = computed(() => province.value.cities || []);

/**
 * 第三列区县：**只保留 6 位 code**。
 * 区划表里东莞 / 中山 / 儋州 / 嘉峪关是 9 位镇街码（国标真实码，C 端在用），
 * 但管理端后端要求 `district_code` 6 位、前 4 位与市一致 → 这类市按「无区县」处理，
 * 区级回城市本身（见文件头「有意差异」）。
 */
const districts = computed(() =>
	(cities.value[idx.value[1]]?.districts || []).filter((d) => String(d.code || '').length === 6)
);
/** 第三列是否出现：只有 district 档且该市有（6 位）区县 */
const hasDistrict = computed(() => level.value === 'district' && districts.value.length > 0);
/** picker-view 的 value 长度必须与实际渲染列数一致 */
const pickerValue = computed(() => {
	if (level.value === 'province') return [idx.value[0]];
	if (hasDistrict.value) return [idx.value[0], idx.value[1], idx.value[2]];
	return [idx.value[0], idx.value[1]];
});

const navTitle = computed(() => {
	if (level.value === 'province') return '选择省份';
	if (level.value === 'district') return '选择地区';
	return '选择城市';
});

const displayText = computed(() => {
	if (!hasInitial.value && !dirty.value) return '';
	return joinParts([
		province.value.name,
		level.value === 'province' ? '' : cities.value[idx.value[1]]?.name,
		hasDistrict.value ? districts.value[idx.value[2]]?.name : ''
	]);
});

const placeholder = computed(() => {
	if (level.value === 'province') return '请选择省份';
	if (level.value === 'district' && hasDistrict.value) return '请选择省 / 市 / 区';
	return '请选择省 / 市';
});

/**
 * 拼展示串，**相邻两级同名时只留一个**。
 * 直辖市是 `北京市 → 北京市 → 东城区`，无区县的市 district 回城市本身，
 * 不去重会显示成「北京市 北京市 东城区」/「仙桃市 仙桃市」。
 */
function joinParts(parts) {
	const out = [];
	for (const p of parts) {
		if (p && p !== out[out.length - 1]) out.push(p);
	}
	return out.join(' ');
}

/** 下标钳位（省切换后旧下标可能越界：21 市的省切到 3 市的省） */
function clampIndex(v, len) {
	const n = Math.floor(Number(v) || 0);
	return Math.min(Math.max(n, 0), Math.max(len - 1, 0));
}

/**
 * 名称匹配：先精确、再前缀（两个方向）。
 * 调用方可能存的是简称，本表是全称「广州市」—— 只做精确匹配会让这类值定位不到。
 */
function matchByName(list, name) {
	if (!name) return -1;
	const exact = list.findIndex((x) => x.name === name);
	if (exact >= 0) return exact;
	return list.findIndex((x) => x.name.startsWith(name) || name.startsWith(x.name));
}

/** 按入场参数定位三列（code 优先、名称兜底；没有省时按市跨省反查） */
function locate(query) {
	let pi = query.province_code ? PROVINCES.findIndex((p) => p.code === query.province_code) : -1;
	if (pi < 0) pi = matchByName(PROVINCES, query.province);
	if (pi < 0 && (query.city_code || query.city)) {
		pi = PROVINCES.findIndex((p) =>
			(p.cities || []).some((c) =>
				query.city_code ? c.code === query.city_code : matchByName(p.cities, query.city) >= 0
			)
		);
	}
	if (pi < 0) pi = 0;

	const cityList = PROVINCES[pi]?.cities || [];
	let ci = query.city_code ? cityList.findIndex((c) => c.code === query.city_code) : -1;
	if (ci < 0) ci = matchByName(cityList, query.city);
	if (ci < 0) ci = 0;

	const distList = (cityList[ci]?.districts || []).filter((d) => String(d.code || '').length === 6);
	let di = query.district_code ? distList.findIndex((d) => d.code === query.district_code) : -1;
	if (di < 0) di = matchByName(distList, query.district);
	if (di < 0) di = 0;

	idx.value = [pi, ci, di];
}

// 工具页也走统一入口：PAGES 里 login:false 且无 entries → 两道门都是空操作
usePageGuard({ path: PAGE_REGION_PICKER });

onLoad((options) => {
	const o = options || {};
	// query 值解码：pickPage 侧 encodeURIComponent 过，MP 端 onLoad options 不自动解码（H5 已解一次）
	const lv = safeDecodeURIComponent(o.level);
	level.value = LEVELS.includes(lv) ? lv : 'district';

	const query = {
		province: safeDecodeURIComponent(o.province),
		city: safeDecodeURIComponent(o.city),
		district: safeDecodeURIComponent(o.district),
		province_code: safeDecodeURIComponent(o.province_code),
		city_code: safeDecodeURIComponent(o.city_code),
		district_code: safeDecodeURIComponent(o.district_code)
	};
	hasInitial.value = Boolean(
		query.province || query.city || query.district ||
		query.province_code || query.city_code || query.district_code
	);
	locate(query);
});

onReady(() => {
	pickerReady.value = true;
});

// 放弃选择（返回键 / 手势退出）也要回传，调用方的 Promise 不能永挂
onUnload(() => {
	if (!emitted) emitRegionResult({ ok: false });
});

/** 滚列时把越界下标钳到有效范围（第三列是否出现要按**新**省市算） */
function onChange(event) {
	const vals = event.detail.value || [];
	const pi = clampIndex(vals[0], PROVINCES.length);
	const cityList = PROVINCES[pi]?.cities || [];
	const ci = level.value === 'province' ? 0 : clampIndex(vals[1], cityList.length);
	const distList = (cityList[ci]?.districts || []).filter((d) => String(d.code || '').length === 6);
	const showDist = level.value === 'district' && distList.length > 0;
	const di = showDist ? clampIndex(vals[2], distList.length) : 0;

	idx.value = [pi, ci, di];
	dirty.value = true;
}

function onConfirm() {
	const p = province.value;
	const city = level.value === 'province' ? null : cities.value[idx.value[1]] || null;
	const realDistrict = hasDistrict.value ? districts.value[idx.value[2]] || null : null;
	// 无 6 位区县的市：区级回城市本身，表单「区县必填」能过（后端也要求 6 位 code）
	const district = realDistrict || (level.value === 'district' ? city : null);

	emitted = true;
	emitRegionResult({
		ok: true,
		value: {
			level: level.value,
			actual_level: realDistrict ? 'district' : city ? 'city' : 'province',
			province: p.name,
			province_code: p.code,
			city: city?.name || '',
			city_code: city?.code || '',
			district: district?.name || '',
			district_code: district?.code || ''
		}
	});
	uni.navigateBack({ delta: 1 });
}
</script>

<style lang="scss" scoped>
/* C 档：页面级滚动（不套 scroll-view，见文件头） */
.rgp {
	min-height: 100vh;
	background-color: $bg-page;
}

.rgp__body {
	padding: $sp-3 $page-padding 0;
	padding-bottom: $sp-6;
}

.rgp__display {
	display: block;
	padding-top: $sp-2;
	font-size: $fs-price;
	font-weight: $fw-bold;
	color: $text-title;
	line-height: $lh-price;
	text-align: center;
}

/* 没选过值时退回占位符档：字号与颜色降一档，别看着像已经选好了 */
.rgp__display--ph {
	font-size: $fs-body;
	font-weight: $fw-regular;
	color: $text-sub;
}

.rgp__pv {
	width: 100%;
	height: 440rpx;
	margin-top: $sp-4;
}

/* 行高与 script 里 PV_ITEM_HEIGHT_RPX 联动，改一处必须同步另一处 */
.rgp__pv-item {
	height: 88rpx;
	line-height: 88rpx;
	text-align: center;
	font-size: $fs-label;
	color: $text-main;
}

.rgp__cta {
	margin-top: $sp-5;
}
</style>