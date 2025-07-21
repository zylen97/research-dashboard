#!/bin/bash

echo "=== VPS本地部署脚本 ==="
echo ""

# 检查前端构建目录
if [ -d "/var/www/research-dashboard/frontend/build" ]; then
    echo "✅ 找到前端构建文件"
    ls -la /var/www/research-dashboard/frontend/build/
    
    echo ""
    echo "部署到网站目录..."
    sudo cp -r /var/www/research-dashboard/frontend/build/* /var/www/html/
    sudo chown -R www-data:www-data /var/www/html
    
    echo ""
    echo "重启Nginx..."
    sudo systemctl reload nginx
    
    echo ""
    echo "✅ 部署完成！"
else
    echo "❌ 没有找到构建文件"
    echo "当前目录内容："
    ls -la /var/www/research-dashboard/frontend/
fi