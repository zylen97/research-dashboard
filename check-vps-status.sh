#!/bin/bash

# 检查VPS部署状态和清理缓存的脚本

VPS_IP="45.149.156.216"
VPS_USER="root"

echo "🔍 检查VPS部署状态..."

# 使用SSH连接到VPS并执行命令
ssh -o StrictHostKeyChecking=no $VPS_USER@$VPS_IP << 'EOF'
    echo "1. 检查Git仓库状态:"
    cd /opt/research-dashboard
    git log --oneline -5
    echo ""
    
    echo "2. 检查前端build目录:"
    ls -la frontend/build/ | head -10
    echo ""
    
    echo "3. 检查Nginx缓存:"
    ls -la /var/cache/nginx/
    echo ""
    
    echo "4. 清理缓存并重新部署:"
    # 清理Nginx缓存
    sudo rm -rf /var/cache/nginx/*
    
    # 清理前端build
    cd /opt/research-dashboard/frontend
    rm -rf build
    
    # 拉取最新代码
    cd /opt/research-dashboard
    git fetch origin main
    git reset --hard origin/main
    
    # 重新构建前端
    cd frontend
    npm install
    npm run build
    
    # 重启服务
    sudo systemctl restart nginx
    sudo systemctl restart research-dashboard
    
    echo "5. 检查服务状态:"
    sudo systemctl status research-dashboard --no-pager | head -10
    sudo systemctl status nginx --no-pager | head -10
EOF

echo "✅ 操作完成"