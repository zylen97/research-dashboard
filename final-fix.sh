#!/bin/bash

echo "🔧 最终修复方案..."

# 1. 强制设置环境变量构建前端
echo "📦 使用环境变量重新构建前端..."
cd frontend
export REACT_APP_API_URL="http://45.149.156.216:3001"
rm -rf build node_modules/.cache
npm run build

# 2. 部署到VPS
echo "🚀 部署到VPS..."
rsync -avz --delete build/ root@45.149.156.216:/var/www/html/

echo "✅ 完成！清除浏览器缓存后访问 http://45.149.156.216:3001"