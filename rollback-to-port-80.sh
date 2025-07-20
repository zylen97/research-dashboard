#!/bin/bash

# 回滚到80端口的临时脚本
# 如果3001端口有问题，可以临时回到80端口

echo "🔄 回滚到80端口..."

# 1. 启用80端口配置
sudo ln -sf /etc/nginx/sites-available/research-dashboard /etc/nginx/sites-enabled/

# 2. 移除3001端口配置
sudo rm -f /etc/nginx/sites-enabled/research-dashboard-3001

# 3. 重启Nginx
sudo nginx -t && sudo systemctl reload nginx

echo "✅ 已回滚到端口80"
echo "🌐 访问地址：http://45.149.156.216"