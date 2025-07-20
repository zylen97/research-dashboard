#!/bin/bash

echo "🔧 一次性修复VPS上的所有问题"
echo "============================"
echo ""
echo "请在VPS上执行这个命令（整个复制）："
echo ""
cat << 'SCRIPT'
cd /var/www/research-dashboard && \
echo "1. 备份本地更改..." && \
git stash save "backup-$(date +%Y%m%d-%H%M%S)" && \
echo "2. 强制更新到最新版本..." && \
git fetch --all && \
git reset --hard origin/main && \
git clean -fd && \
echo "3. 显示当前版本..." && \
git log --oneline -3 && \
echo "4. 更新Nginx配置..." && \
sudo cp deployment/nginx.conf /etc/nginx/sites-available/research-dashboard && \
sudo nginx -t && sudo systemctl reload nginx && \
echo "5. 重建前端..." && \
cd frontend && \
rm -rf build node_modules/.cache && \
npm install && \
npm run build && \
sudo rm -rf /var/www/html/* && \
sudo cp -r build/* /var/www/html/ && \
sudo chown -R www-data:www-data /var/www/html/ && \
cd .. && \
echo "6. 重启服务..." && \
sudo systemctl restart research-backend && \
sudo systemctl restart nginx && \
echo "" && \
echo "✅ 修复完成！从现在开始，每次 git push 都会自动部署！" && \
echo "🌐 访问: http://45.149.156.216"
SCRIPT