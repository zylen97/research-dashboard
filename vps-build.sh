#!/bin/bash

# VPS构建脚本 - 在VPS上直接构建（优化内存使用）

set -e

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}=== VPS 构建部署 ===${NC}"

# 1. 拉取最新代码
cd /var/www/research-dashboard
echo "拉取最新代码..."
git pull

# 2. 检查是否需要构建前端
FRONTEND_CHANGED=$(git diff HEAD~1 --name-only | grep -c "frontend/" || echo "0")
if [ "$FRONTEND_CHANGED" -gt 0 ] || [ "$1" = "--force" ]; then
    echo -e "${YELLOW}构建前端...${NC}"
    cd frontend
    
    # 优化内存使用
    export NODE_OPTIONS="--max-old-space-size=512"
    
    # 清理缓存
    rm -rf node_modules/.cache
    rm -rf build
    
    # 安装依赖（如果需要）
    if [ ! -d "node_modules" ]; then
        echo "安装依赖..."
        npm ci --production=false
    fi
    
    # 构建
    echo "开始构建..."
    npm run build
    
    # 部署
    if [ -d "build" ]; then
        echo "部署新版本..."
        rm -rf /var/www/html/*
        cp -r build/* /var/www/html/
        chown -R www-data:www-data /var/www/html
        echo -e "${GREEN}✅ 前端部署完成${NC}"
    else
        echo -e "${RED}构建失败${NC}"
        exit 1
    fi
    cd ..
fi

# 3. 检查后端
BACKEND_CHANGED=$(git diff HEAD~1 --name-only | grep -c "backend/" || echo "0")
if [ "$BACKEND_CHANGED" -gt 0 ]; then
    echo -e "${YELLOW}重启后端...${NC}"
    systemctl restart research-backend
    echo -e "${GREEN}✅ 后端已重启${NC}"
fi

# 4. 显示状态
echo ""
VERSION=$(grep -o "v[0-9]\.[0-9]" /var/www/html/static/js/main.*.js 2>/dev/null | head -1 || echo "未知")
echo -e "${GREEN}部署完成！当前版本: $VERSION${NC}"