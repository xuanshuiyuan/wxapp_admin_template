#!/usr/bin/env bash
# 把设计稿渲染成 PNG，供 AI 用 Read 看图自检。
#
# 为什么固定 540×1060：稿子本身是 390×844 手机框 + 舞台内边距与标题，
# 540×1060 正好装下整张舞台，不会被裁边。
#
# 用法：bash .claude/skills/design-preview/scripts/render.sh <file.html> [out.png]
set -euo pipefail

html="${1:-}"
if [ -z "$html" ] || [ ! -f "$html" ]; then
	echo "usage: bash scripts/render.sh <file.html> [out.png]" >&2
	exit 1
fi

out="${2:-/tmp/design-preview-$(basename "$html" .html).png}"

# 依次找常见的 Chrome/Chromium 可执行名；找不到就明确报错，别静默失败
chrome="$(command -v google-chrome-stable || command -v google-chrome || command -v chromium || command -v chromium-browser || true)"
if [ -z "$chrome" ]; then
	echo "未找到 Chrome/Chromium；请手动打开 $html 检查。" >&2
	exit 1
fi

abs="$(realpath "$html")"
"$chrome" --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
	--window-size=540,1060 --screenshot="$out" "file://$abs" >/dev/null 2>&1

echo "$out"