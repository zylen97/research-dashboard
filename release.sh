#!/bin/bash

# 发布脚本 - 创建GitHub Release并上传构建文件

set -e

# 检查是否安装了 gh CLI
if ! command -v gh &> /dev/null; then
    echo "请先安装 GitHub CLI: brew install gh"
    exit 1
fi

# 1. 构建
echo "构建前端..."
cd frontend
npm run build
tar -czf ../build.tar.gz build/
cd ..

# 2. 获取版本号
VERSION=$(grep -o "v[0-9]\.[0-9]" frontend/src/components/MainLayout.tsx | head -1)
if [ -z "$VERSION" ]; then
    VERSION="v1.0"
fi

# 3. 创建 Release
echo "创建 GitHub Release $VERSION..."
gh release create $VERSION build.tar.gz \
    --title "Release $VERSION" \
    --notes "自动构建版本 $VERSION - $(date +%Y-%m-%d)"

# 4. 清理
rm -f build.tar.gz

echo "✅ 发布完成！"
echo "VPS可以通过以下命令下载："
echo "wget https://github.com/zylen97/research-dashboard/releases/latest/download/build.tar.gz"