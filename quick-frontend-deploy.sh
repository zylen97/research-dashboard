#!/bin/bash

# 快速部署前端构建文件

echo "📦 部署前端文件到VPS..."
echo ""

# 复制构建文件到VPS
scp -r frontend/build/* root@45.149.156.216:/var/www/html/

echo ""
echo "✅ 前端部署完成！"
echo ""
echo "请访问 http://45.149.156.216:3001"
echo "1. 登录系统"
echo "2. 测试Ideas管理页面是否正常工作"