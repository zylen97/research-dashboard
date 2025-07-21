#!/bin/bash

echo "=== 诊断403 Forbidden错误 ==="
echo ""

echo "1. 检查Nginx配置状态"
nginx -t
echo ""

echo "2. 检查网站根目录权限"
ls -la /var/www/html/
echo ""

echo "3. 检查index.html是否存在"
if [ -f /var/www/html/index.html ]; then
    echo "index.html 存在"
    ls -la /var/www/html/index.html
else
    echo "❌ index.html 不存在！"
fi
echo ""

echo "4. 检查Nginx错误日志"
tail -20 /var/log/nginx/error.log
echo ""

echo "5. 检查Nginx访问日志"
tail -20 /var/log/nginx/access.log | grep -E "403|GET / "
echo ""

echo "6. 检查部署状态"
if [ -d /var/www/research-dashboard/frontend/build ]; then
    echo "前端构建目录存在："
    ls -la /var/www/research-dashboard/frontend/build/
else
    echo "❌ 前端构建目录不存在"
fi
echo ""

echo "7. 尝试修复权限"
sudo chown -R www-data:www-data /var/www/html
sudo chmod -R 755 /var/www/html
echo "权限已更新"
echo ""

echo "8. 如果build目录存在但没有部署，执行部署"
if [ -d /var/www/research-dashboard/frontend/build ] && [ ! -f /var/www/html/index.html ]; then
    echo "正在部署前端文件..."
    sudo cp -r /var/www/research-dashboard/frontend/build/* /var/www/html/
    sudo chown -R www-data:www-data /var/www/html
    echo "部署完成"
fi
echo ""

echo "9. 重启Nginx"
sudo systemctl reload nginx
echo ""

echo "诊断完成！请刷新页面查看是否解决。"