#!/bin/bash

# VPS更新脚本 - 支持多环境
# 前端：解压已构建的 tar.gz
# 后端：拉取代码后重启服务

set -e

# 环境配置
ENVIRONMENT="production"  # 在VPS上默认使用生产环境

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}=== Research Dashboard 更新 ===${NC}"

# 1. 拉取最新代码
# 注：虽然 GitHub Actions 可能已执行，但保留此步骤以支持手动运行
cd /var/www/research-dashboard
echo "拉取最新代码..."
git pull

# 2. 部署前端（如果有 build.tar.gz）
if [ -f "frontend/build.tar.gz" ]; then
    echo -e "${YELLOW}部署前端...${NC}"
    cd frontend
    tar -xzf build.tar.gz
    rm -rf /var/www/html/*
    cp -r build/* /var/www/html/
    chown -R www-data:www-data /var/www/html
    cd ..
    echo -e "${GREEN}✅ 前端部署完成${NC}"
fi

# 3. 设置后端环境配置
echo -e "${YELLOW}设置后端环境配置...${NC}"
cd backend
if [ ! -f ".env" ]; then
    if [ -f ".env.production" ]; then
        cp .env.production .env
        echo -e "${GREEN}✅ 已使用生产环境配置${NC}"
    else
        echo -e "${RED}警告: 未找到 .env.production 文件${NC}"
    fi
fi
cd ..

# 4. 执行数据库迁移
echo -e "${YELLOW}执行数据库迁移...${NC}"
cd backend
if [ -f "migrations/migration.py" ]; then
    python3 migrations/migration.py
    echo -e "${GREEN}✅ 数据库迁移完成${NC}"
else
    echo "未找到迁移脚本，跳过迁移"
fi
cd ..

# 5. 检查后端是否需要重启
BACKEND_CHANGED=$(git diff HEAD~1 --name-only | grep -c "backend/" || echo "0")
if [ "$BACKEND_CHANGED" -gt 0 ]; then
    echo -e "${YELLOW}重启后端服务...${NC}"
    # 设置环境变量后重启
    export ENVIRONMENT=production
    systemctl restart research-backend
    sleep 2
    echo -e "${GREEN}✅ 后端服务已重启${NC}"
fi

# 5. 显示状态
echo ""
echo -e "${GREEN}=== 更新完成 ===${NC}"
echo "环境: $ENVIRONMENT"
systemctl is-active --quiet research-backend && echo "后端: ✓ 运行中" || echo "后端: ✗ 未运行"
systemctl is-active --quiet nginx && echo "Nginx: ✓ 运行中" || echo "Nginx: ✗ 未运行"
echo "访问: http://45.149.156.216:3001"