#!/bin/bash

# 🚀 部署前端修复到VPS
# 修复Ideas管理界面的 "q.some is not a function" 错误

echo "🚀 部署前端修复到VPS"
echo "===================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# VPS配置
VPS_USER="root"
VPS_HOST="45.149.156.216"
PROJECT_DIR="/var/www/research-dashboard"

echo -e "${YELLOW}📦 步骤1: 连接到VPS并拉取最新代码${NC}"
ssh $VPS_USER@$VPS_HOST << 'EOF'
cd /var/www/research-dashboard
echo "拉取最新代码..."
git pull origin main
echo "✅ 代码更新完成"
EOF

echo ""
echo -e "${YELLOW}🔧 步骤2: 构建前端${NC}"
ssh $VPS_USER@$VPS_HOST << 'EOF'
cd /var/www/research-dashboard/frontend
echo "安装依赖..."
npm install
echo "构建前端..."
npm run build
echo "✅ 前端构建完成"
EOF

echo ""
echo -e "${YELLOW}📂 步骤3: 部署前端文件${NC}"
ssh $VPS_USER@$VPS_HOST << 'EOF'
echo "部署前端文件..."
rm -rf /var/www/html/*
cp -r /var/www/research-dashboard/frontend/build/* /var/www/html/
echo "✅ 前端文件部署完成"
EOF

echo ""
echo -e "${YELLOW}🧪 步骤4: 验证修复${NC}"
echo "测试前端API连接..."

# 测试ideas管理API
IDEAS_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://$VPS_HOST:3001/api/ideas-management/ 2>/dev/null)
if [ "$IDEAS_CHECK" = "401" ]; then
    echo -e "${GREEN}✅ Ideas管理API正常 (需要认证: $IDEAS_CHECK)${NC}"
elif [ "$IDEAS_CHECK" = "200" ]; then
    echo -e "${GREEN}✅ Ideas管理API正常 (状态码: $IDEAS_CHECK)${NC}"
else
    echo -e "${RED}❌ Ideas管理API失败 (状态码: $IDEAS_CHECK)${NC}"
fi

echo ""
echo -e "${GREEN}=================="
echo "🎉 部署完成！"
echo "=================="
echo ""
echo "📱 请访问前端验证修复效果: http://$VPS_HOST:3001"
echo "   1. 登录系统"
echo "   2. 访问 Ideas管理 页面"
echo "   3. 验证页面是否正常显示，无错误"
echo ""
echo "✅ 修复内容："
echo "   - 前端API路径已更新，移除/api前缀"
echo "   - 修复了 'q.some is not a function' 错误"
echo "   - 前后端API路径现已完全对齐"