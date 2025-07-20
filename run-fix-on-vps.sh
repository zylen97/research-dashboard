#!/bin/bash

echo "🔧 在VPS上运行修复脚本..."

ssh root@45.149.156.216 << 'EOF'
cd /var/www/research-dashboard

# 1. 先更新代码
echo "📥 更新代码..."
git pull

# 2. 运行快速修复脚本
if [ -f quick-fix-vps.sh ]; then
    echo "🚀 运行quick-fix-vps.sh..."
    chmod +x quick-fix-vps.sh
    ./quick-fix-vps.sh
elif [ -f emergency-fix-vps.sh ]; then
    echo "🚀 运行emergency-fix-vps.sh..."
    chmod +x emergency-fix-vps.sh
    ./emergency-fix-vps.sh
else
    echo "❌ 未找到修复脚本"
fi

# 3. 直接检查并修复
echo -e "\n📝 检查当前状态..."
systemctl status research-backend --no-pager | head -5
netstat -tlnp | grep 8080
EOF