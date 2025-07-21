#!/bin/bash

echo "=== 部署前端到VPS ==="
echo ""

# VPS信息
VPS_USER="root"
VPS_HOST="45.149.156.216"
VPS_WEB_DIR="/var/www/html"

# 检查本地构建文件
if [ ! -d "frontend/build" ]; then
    echo "错误：本地没有构建文件！"
    echo "请先运行: cd frontend && npm run build"
    exit 1
fi

echo "找到本地构建文件："
ls -la frontend/build/

# 上传构建文件到VPS
echo ""
echo "上传文件到VPS..."
ssh $VPS_USER@$VPS_HOST "rm -rf $VPS_WEB_DIR/*"
scp -r frontend/build/* $VPS_USER@$VPS_HOST:$VPS_WEB_DIR/

# 设置权限
echo ""
echo "设置文件权限..."
ssh $VPS_USER@$VPS_HOST "chown -R www-data:www-data $VPS_WEB_DIR && chmod -R 755 $VPS_WEB_DIR"

# 重启Nginx
echo ""
echo "重启Nginx..."
ssh $VPS_USER@$VPS_HOST "systemctl reload nginx"

echo ""
echo "✅ 部署完成！"
echo "请访问: http://45.149.156.216:3001"