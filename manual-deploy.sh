#!/bin/bash

echo "🚀 手动部署前端到VPS..."

# 部署构建好的前端
echo "📦 上传前端文件..."
rsync -avz --delete frontend/build/ root@45.149.156.216:/var/www/html/

echo "✅ 部署完成！"
echo "🌐 请访问: http://45.149.156.216:3001"
echo "👤 用户名: zz"
echo "🔑 密码: 123"