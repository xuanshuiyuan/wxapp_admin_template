#!/bin/bash
# ---------------------------------------------------------------------------
# 模板初始化脚本：项目名全局替换 + 小程序 appid / 接口域名占位值填写。
# 用法：bash init.sh（在项目根目录执行一次；重复执行前请先确认 git 状态可回滚）
#
# 设计口径（与后端 go_project_template 的 init.sh 同一套思路）：
#   · 只替换**版本库跟踪的文本文件**（已 git init 时走 git ls-files），
#     避免把 node_modules / dist 里的二进制或产物也 sed 一遍；
#   · 排除 init.sh 自身：否则脚本里写死的旧项目名会被一起改掉，重跑即失效；
#   · 所有占位值都可以「直接回车跳过」，跳过时保留 REPLACE_* 字面量，便于事后 grep。
# ---------------------------------------------------------------------------

set -e

old_project_name="wxapp_admin_template"

read -p "请输入项目名称（小写字母/数字/下划线/连字符，将全局替换 $old_project_name）: " project_name
if [ -z "$project_name" ]; then
  echo "错误: 项目名称不能为空" >&2
  exit 1
fi
if ! echo "$project_name" | grep -qE '^[a-z0-9_-]+$'; then
  echo "错误: 项目名称只允许小写字母、数字、下划线、连字符（会用于 package.json / manifest / 存储前缀）" >&2
  exit 1
fi

read -p "请输入微信小程序 appid（可留空，之后手工改 src/manifest.json 的 REPLACE_WX_APPID）: " wx_appid
if [ -n "$wx_appid" ] && ! echo "$wx_appid" | grep -qE '^wx[0-9a-zA-Z]{16}$'; then
  echo "错误: appid 形如 wx + 16 位字母数字，当前值不合法" >&2
  exit 1
fi

read -p "请输入接口域名（如 https://api.example.com/，可留空）: " api_base
if [ -n "$api_base" ] && ! echo "$api_base" | grep -qE '^https?://'; then
  echo "错误: 接口域名必须以 http:// 或 https:// 开头" >&2
  exit 1
fi

read -p "请输入 OSS/CDN 域名（如 https://static.example.com/，可留空）: " oss_host
if [ -n "$oss_host" ] && ! echo "$oss_host" | grep -qE '^https?://'; then
  echo "错误: OSS 域名必须以 http:// 或 https:// 开头" >&2
  exit 1
fi

# sed -i 兼容 Linux 和 macOS
sedi() {
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "$@"
  else
    sed -i "$@"
  fi
}

# 1. 项目名全局替换
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  file_list=$(git ls-files | grep -v '^init\.sh$')
else
  file_list=$(find . -type f \
    -not -path "./.git/*" \
    -not -path "./node_modules/*" \
    -not -path "./dist/*" \
    -not -path "./unpackage/*" \
    -not -name "init.sh")
fi

echo "$file_list" | while read -r file; do
  [ -f "$file" ] || continue
  if grep -q "$old_project_name" "$file" 2>/dev/null; then
    sedi "s|$old_project_name|$project_name|g" "$file"
  fi
done

# 2. appid / 域名占位（只在用户填写时替换；留空则保留 REPLACE_* 便于事后补）
if [ -n "$wx_appid" ]; then
  sedi "s|REPLACE_WX_APPID|$wx_appid|g" src/manifest.json
  echo "已写入 appid: $wx_appid"
fi

if [ -n "$api_base" ]; then
  # 统一补尾斜杠：request.js 在其后拼版本前缀，缺斜杠会拼出 //v2
  case "$api_base" in
    */) ;;
    *) api_base="$api_base/" ;;
  esac
  sedi "s|REPLACE_API_BASE_URL|$api_base|g" .env.production
  echo "已写入接口域名: $api_base"
fi

if [ -n "$oss_host" ]; then
  case "$oss_host" in
    */) ;;
    *) oss_host="$oss_host/" ;;
  esac
  sedi "s|REPLACE_OSS_HOST|$oss_host|g" .env.production
  echo "已写入 OSS 域名: $oss_host"
fi

# 3. 校验（依赖已安装时）
if [ -d node_modules ] && command -v npm >/dev/null 2>&1; then
  echo "正在校验编译（npm run verify:mp-weixin）…"
  npm run verify:mp-weixin >/dev/null 2>&1 && echo "编译通过" || echo "⚠️ 编译未通过，请手工跑 npm run verify:mp-weixin 查看原因"
else
  echo "（未安装依赖，跳过编译校验；先 npm install）"
fi

echo ""
echo "============================================================"
echo "初始化完成：$project_name"
echo ""
echo "⚠️ 接下来必须做的几件事（详见 README）："
echo "  1. npm install"
echo "  2. 填 .env.*.local 的 VITE_API_KEY（向后端线下领取，按 source 区分）"
echo "  3. grep -rn 'REPLACE_' .  --exclude-dir=node_modules"
echo "  4. src/config/app.js：APP_NAME / APP_VERSION / edition（后端 EditionList 已登记的值）"
echo "  5. src/config/demo.js + config/access.js：删掉演示权限点，换成你的真实权限码"
echo "  6. 接真后端后把 config/app.js 的 DEMO_MODE 改为 false"
echo "============================================================"