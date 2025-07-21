#!/bin/bash

echo "=== VPS状态全面检查 ==="
echo "时间: $(date)"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=== 1. 系统基础信息 ==="
echo "内存使用:"
free -h
echo ""

echo "=== 2. 端口监听状态 ==="
echo "正在监听的端口:"
sudo netstat -tlnp | grep -E "80|3001|8080" || echo "netstat不可用"
echo ""

echo "=== 3. 后端服务状态 ==="
echo "后端服务:"
if systemctl is-active research-backend >/dev/null 2>&1; then
    echo -e "${GREEN}✓ 后端服务运行中${NC}"
    systemctl status research-backend --no-pager | head -5
else
    echo -e "${RED}✗ 后端服务未运行${NC}"
fi

echo ""
echo "8080端口进程:"
sudo lsof -i :8080 2>/dev/null || echo "8080端口无进程"
echo ""

echo "=== 4. 前端文件状态 ==="
echo "网站目录内容:"
if [ -f /var/www/html/index.html ]; then
    echo -e "${GREEN}✓ index.html 存在${NC}"
    ls -la /var/www/html/ | head -5
else
    echo -e "${RED}✗ index.html 不存在${NC}"
    echo "目录内容:"
    ls -la /var/www/html/
fi
echo ""

echo "=== 5. Nginx状态 ==="
if systemctl is-active nginx >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Nginx运行中${NC}"
    nginx -v 2>&1
else
    echo -e "${RED}✗ Nginx未运行${NC}"
fi
echo ""

echo "=== 6. 项目文件状态 ==="
echo "项目目录:"
if [ -d /var/www/research-dashboard ]; then
    echo -e "${GREEN}✓ 项目目录存在${NC}"
    echo "前端源码:"
    ls -la /var/www/research-dashboard/frontend/ 2>/dev/null | grep -E "package.json|src" || echo "前端源码不完整"
    echo ""
    echo "前端构建:"
    if [ -d /var/www/research-dashboard/frontend/build ]; then
        echo -e "${GREEN}✓ build目录存在${NC}"
        ls -la /var/www/research-dashboard/frontend/build/ | head -3
    else
        echo -e "${RED}✗ build目录不存在${NC}"
    fi
else
    echo -e "${RED}✗ 项目目录不存在${NC}"
fi
echo ""

echo "=== 7. 快速修复建议 ==="
echo -e "${YELLOW}问题总结:${NC}"

# 检查并给出建议
NEED_FIX=false

if ! systemctl is-active research-backend >/dev/null 2>&1; then
    echo -e "${RED}1. 后端服务未运行${NC}"
    echo "   修复: sudo systemctl start research-backend"
    NEED_FIX=true
fi

if [ ! -f /var/www/html/index.html ]; then
    echo -e "${RED}2. 前端文件缺失${NC}"
    if [ -d /var/www/research-dashboard/frontend/build ]; then
        echo "   修复: sudo cp -r /var/www/research-dashboard/frontend/build/* /var/www/html/"
    else
        echo "   需要: 在本地构建后上传，或在VPS上构建"
    fi
    NEED_FIX=true
fi

if [ "$NEED_FIX" = false ]; then
    echo -e "${GREEN}✓ 系统状态正常，应该可以访问 http://45.149.156.216:3001${NC}"
fi