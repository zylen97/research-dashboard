#!/bin/bash

# 更新服务器上的nginx配置脚本
# 用于修复405错误问题

set -e

echo "=== 更新Nginx配置 ==="
echo "此脚本将更新服务器上的nginx配置文件"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否在项目根目录
if [ ! -f "deployment/nginx-3001.conf" ]; then
    echo -e "${RED}错误: 请在项目根目录运行此脚本${NC}"
    exit 1
fi

# 配置变量
VPS_HOST="45.149.156.216"
VPS_USER="root"

echo -e "${YELLOW}即将更新 $VPS_HOST 上的nginx配置${NC}"
echo "将更新以下文件："
echo "  - /etc/nginx/sites-available/research-dashboard-3001"
echo ""
read -p "确认继续? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "操作已取消"
    exit 0
fi

# 上传nginx配置文件
echo -e "\n${GREEN}1. 上传nginx配置文件...${NC}"
scp deployment/nginx-3001.conf $VPS_USER@$VPS_HOST:/tmp/nginx-3001.conf

# SSH到服务器执行更新
echo -e "\n${GREEN}2. 在服务器上执行更新...${NC}"
ssh $VPS_USER@$VPS_HOST << 'EOF'
set -e

# 备份当前配置
echo "备份当前nginx配置..."
if [ -f "/etc/nginx/sites-available/research-dashboard-3001" ]; then
    cp /etc/nginx/sites-available/research-dashboard-3001 /etc/nginx/sites-available/research-dashboard-3001.backup.$(date +%Y%m%d_%H%M%S)
fi

# 复制新配置
echo "安装新的nginx配置..."
cp /tmp/nginx-3001.conf /etc/nginx/sites-available/research-dashboard-3001

# 测试nginx配置
echo "测试nginx配置..."
nginx -t

# 如果测试通过，重新加载nginx
if [ $? -eq 0 ]; then
    echo "重新加载nginx..."
    systemctl reload nginx
    echo "✅ Nginx配置已成功更新并重新加载"
else
    echo "❌ Nginx配置测试失败，请检查配置文件"
    exit 1
fi

# 清理临时文件
rm -f /tmp/nginx-3001.conf

echo "显示当前nginx状态："
systemctl status nginx --no-pager | head -10
EOF

echo -e "\n${GREEN}✅ Nginx配置更新完成！${NC}"
echo -e "${YELLOW}请测试 http://$VPS_HOST:3001 的功能是否正常${NC}"