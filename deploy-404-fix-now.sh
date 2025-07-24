#!/bin/bash

# 🔧 立即部署404修复到VPS
# 确保在本地执行此脚本

echo "🚀 部署404修复到VPS"
echo "=================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# VPS配置
VPS_USER="root"
VPS_HOST="45.149.156.216"
BACKEND_DIR="/var/www/research-dashboard/backend"

echo -e "${YELLOW}📦 步骤1: 连接到VPS并拉取最新代码${NC}"
ssh $VPS_USER@$VPS_HOST << 'EOF'
cd /var/www/research-dashboard
echo "拉取最新代码..."
git pull origin main
echo "✅ 代码更新完成"
EOF

echo ""
echo -e "${YELLOW}🔧 步骤2: 重启后端服务${NC}"
ssh $VPS_USER@$VPS_HOST << 'EOF'
echo "重启后端服务..."
systemctl restart research-backend
sleep 3
systemctl status research-backend --no-pager | head -10
echo "✅ 后端服务已重启"
EOF

echo ""
echo -e "${YELLOW}🧪 步骤3: 验证修复${NC}"
echo "测试健康检查端点..."

# 测试后端直连
BACKEND_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://$VPS_HOST:8080/health 2>/dev/null)
if [ "$BACKEND_CHECK" = "200" ]; then
    echo -e "${GREEN}✅ 后端直连正常 (状态码: $BACKEND_CHECK)${NC}"
else
    echo -e "${RED}❌ 后端直连失败 (状态码: $BACKEND_CHECK)${NC}"
fi

# 测试nginx代理
NGINX_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://$VPS_HOST:3001/health 2>/dev/null)
if [ "$NGINX_CHECK" = "200" ]; then
    echo -e "${GREEN}✅ Nginx代理正常 (状态码: $NGINX_CHECK)${NC}"
else
    echo -e "${RED}❌ Nginx代理失败 (状态码: $NGINX_CHECK)${NC}"
fi

# 测试研究项目API
RESEARCH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://$VPS_HOST:3001/api/research/ 2>/dev/null)
if [ "$RESEARCH_CHECK" = "401" ]; then
    echo -e "${GREEN}✅ 研究项目API正常 (需要认证: $RESEARCH_CHECK)${NC}"
elif [ "$RESEARCH_CHECK" = "200" ]; then
    echo -e "${GREEN}✅ 研究项目API正常 (状态码: $RESEARCH_CHECK)${NC}"
else
    echo -e "${RED}❌ 研究项目API失败 (状态码: $RESEARCH_CHECK)${NC}"
fi

echo ""
echo -e "${GREEN}=================="
echo "🎉 部署完成！"
echo "=================="
echo ""
echo "📱 请访问前端验证: http://$VPS_HOST:3001"
echo "📚 API文档: http://$VPS_HOST:8080/docs"
echo ""
echo "如果仍有问题，请运行:"
echo "  ssh $VPS_USER@$VPS_HOST"
echo "  cd /var/www/research-dashboard/deploy-scripts"
echo "  ./emergency-404-diagnose.sh"