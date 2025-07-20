#!/bin/bash

VPS_IP="45.149.156.216"
VPS_USER="root"

echo "🔧 手动更新VPS上的代码..."

ssh -o StrictHostKeyChecking=no $VPS_USER@$VPS_IP << 'EOF'
    cd /opt/research-dashboard
    
    echo "1. 拉取最新代码:"
    git fetch --all
    git reset --hard origin/main
    git pull origin main
    
    echo ""
    echo "2. 检查最新提交:"
    git log --oneline -3
    
    echo ""
    echo "3. 确认LoginForm.tsx内容:"
    grep -n "注册\|立即注册\|有邀请码\|加入团队" frontend/src/components/auth/LoginForm.tsx || echo "✅ 文件已更新，无注册相关内容"
    
    echo ""
    echo "4. 重新构建前端:"
    cd frontend
    rm -rf build node_modules/.cache
    npm install
    npm run build
    
    echo ""
    echo "5. 重启服务:"
    sudo systemctl restart research-dashboard
    sudo systemctl restart nginx
    
    echo ""
    echo "6. 清理Nginx缓存:"
    sudo rm -rf /var/cache/nginx/*
    
    echo ""
    echo "✅ 更新完成！"
EOF