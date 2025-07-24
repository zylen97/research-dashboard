#!/bin/bash

# 快速重启后端服务脚本

set -e

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== 快速重启后端服务 ===${NC}"
echo -e "时间: $(date)"
echo ""

# 进入后端目录
cd /var/www/research-dashboard/backend

# 1. 确保环境配置存在
echo -e "${YELLOW}1. 检查环境配置...${NC}"
if [ ! -f .env.production ]; then
    echo -e "${RED}创建默认环境配置...${NC}"
    cat > .env.production << EOF
ENVIRONMENT=production
SECRET_KEY=$(openssl rand -hex 32)
DATABASE_URL=sqlite:///./data/research_dashboard_prod.db
CORS_ORIGINS=http://45.149.156.216:3001,http://45.149.156.216
HOST=0.0.0.0
PORT=8080
LOG_LEVEL=INFO
EOF
fi

# 2. 确保数据库存在且有正确权限
echo -e "${YELLOW}2. 修复数据库权限...${NC}"
mkdir -p data
sudo chown -R www-data:www-data data/
sudo chmod 755 data/
if [ -f data/research_dashboard_prod.db ]; then
    sudo chmod 644 data/research_dashboard_prod.db
fi

# 3. 重启服务
echo -e "${YELLOW}3. 重启后端服务...${NC}"
sudo systemctl restart research-backend

# 4. 等待服务启动
echo -e "${YELLOW}4. 等待服务启动...${NC}"
for i in {1..10}; do
    if systemctl is-active --quiet research-backend; then
        echo -e "${GREEN}✅ 服务已启动${NC}"
        break
    fi
    echo -n "."
    sleep 1
done

# 5. 验证服务状态
echo -e "\n${YELLOW}5. 验证服务状态...${NC}"
sleep 2

# 测试本地访问
echo -n "后端API (8080): "
if curl -s http://localhost:8080/ | grep -q "Research Dashboard API"; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${RED}❌${NC}"
fi

# 测试健康检查
echo -n "健康检查: "
if curl -s http://localhost:8080/health | grep -q '"status":"healthy"'; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${RED}❌${NC}"
fi

# 测试通过nginx访问
echo -n "通过nginx (3001): "
if curl -s http://localhost:3001/health | grep -q '"status":"healthy"'; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${RED}❌${NC}"
fi

# 6. 如果失败，显示错误日志
if ! systemctl is-active --quiet research-backend; then
    echo -e "\n${RED}服务启动失败，查看日志:${NC}"
    journalctl -u research-backend -n 30 --no-pager
fi

echo -e "\n${GREEN}重启脚本执行完成！${NC}"
echo -e "${BLUE}提示: 如果问题持续，运行 ./emergency-404-diagnose.sh 进行详细诊断${NC}"