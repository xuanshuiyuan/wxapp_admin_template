// ---------------------------------------------------------------------------
// 列表「返回即刷新」的**一次性脏标记**。
//
// 用法：详情 / 表单 / 账户等子页在写操作**成功后** markListDirty(列表页路径)；
// 列表页 onShow 时 consumeListDirty —— 有标记才重取，取完即清。
//
// 为什么不再无条件重拉（2026-11-12 用户定）：从子页返回时列表整体替换
// （setData 重绘 + 底部「没有更多了」翻转），什么都没改也闪一下。
//
// ⚠️ 标记只活在**进程内存**：小程序被系统杀掉后重进列表页会从头取数，
//    本来就不需要这份标记；不要把它写进本地存储（会跨会话残留）。
// ⚠️ 只在写成功之后标：失败路径标了，返回列表会白刷一次。
// ---------------------------------------------------------------------------

const dirtyKeys = new Set();

/** 标记某个列表页需要刷新（在写操作成功之后调用） */
export function markListDirty(key) {
	if (!key) return;
	dirtyKeys.add(key);
}

/** 消费标记：true = 确实被标记过（调用方应重新取数），并就地清掉 —— 只生效一次 */
export function consumeListDirty(key) {
	if (!key || !dirtyKeys.has(key)) return false;
	dirtyKeys.delete(key);
	return true;
}

/** 作废标记：列表页**首次取数**时调用 —— 拿到的一定是最新数据，旧标记没有意义 */
export function clearListDirty(key) {
	if (key) dirtyKeys.delete(key);
}

export default { markListDirty, consumeListDirty, clearListDirty };