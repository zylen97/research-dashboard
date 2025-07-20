#!/bin/bash

echo "🔧 修复前端API连接问题..."

# 1. 设置正确的API地址环境变量
export REACT_APP_API_URL="http://45.149.156.216:8080"

# 2. 进入前端目录
cd frontend

# 3. 清理缓存
echo "📦 清理构建缓存..."
rm -rf build
rm -rf node_modules/.cache

# 4. 重新构建
echo "🏗️ 重新构建前端..."
npm run build

# 5. 部署到服务器
echo "🚀 部署到服务器..."
rsync -avz --delete build/ root@45.149.156.216:/var/www/html/

echo "✅ 修复完成！"
echo "请访问: http://45.149.156.216:3001"