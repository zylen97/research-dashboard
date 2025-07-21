#!/bin/bash

echo "=== VPS快速修复 ==="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. 修复后端
echo -e "${YELLOW}1. 检查后端服务...${NC}"
if ! systemctl is-active research-backend >/dev/null 2>&1; then
    echo "启动后端服务..."
    sudo systemctl start research-backend
    sleep 2
    if systemctl is-active research-backend >/dev/null 2>&1; then
        echo -e "${GREEN}✓ 后端服务已启动${NC}"
    else
        echo -e "${RED}✗ 后端服务启动失败${NC}"
    fi
else
    echo -e "${GREEN}✓ 后端服务正常${NC}"
fi

# 2. 修复前端
echo ""
echo -e "${YELLOW}2. 检查前端文件...${NC}"
if [ ! -f /var/www/html/index.html ]; then
    echo "前端文件缺失，尝试部署..."
    
    # 检查本地构建
    if [ -d /var/www/research-dashboard/frontend/build ]; then
        echo "找到构建文件，部署中..."
        sudo cp -r /var/www/research-dashboard/frontend/build/* /var/www/html/
        sudo chown -R www-data:www-data /var/www/html
        echo -e "${GREEN}✓ 前端已部署${NC}"
    else
        echo -e "${RED}✗ 没有构建文件${NC}"
        echo "解决方案："
        echo "1. 在本地运行: scp -r frontend/build/* root@45.149.156.216:/var/www/html/"
        echo "2. 或在VPS上构建（需要Node.js 14+）"
    fi
else
    echo -e "${GREEN}✓ 前端文件存在${NC}"
fi

# 3. 重启Nginx
echo ""
echo -e "${YELLOW}3. 重启Nginx...${NC}"
sudo systemctl reload nginx
echo -e "${GREEN}✓ Nginx已重启${NC}"

# 4. 最终检查
echo ""
echo -e "${YELLOW}=== 最终状态 ===${NC}"
echo -n "后端(8080): "
curl -s http://localhost:8080 >/dev/null && echo -e "${GREEN}✓ 正常${NC}" || echo -e "${RED}✗ 异常${NC}"

echo -n "前端(3001): "
curl -s http://localhost:3001 >/dev/null && echo -e "${GREEN}✓ 正常${NC}" || echo -e "${RED}✗ 异常${NC}"

echo ""
echo "访问地址: http://45.149.156.216:3001"