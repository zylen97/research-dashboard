#!/bin/bash

# 综合修复脚本 - 包含所有认证和API修复

set -e

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Research Dashboard 综合修复脚本 ===${NC}"
echo -e "时间: $(date)"
echo ""

# 进入项目目录
cd /var/www/research-dashboard

echo -e "${YELLOW}1. 拉取最新代码...${NC}"
git pull origin main

echo -e "${YELLOW}2. 更新后端依赖...${NC}"
cd backend
pip install -r requirements.txt --upgrade

echo -e "${YELLOW}3. 检查环境配置...${NC}"
if [ ! -f .env.production ]; then
    echo -e "${RED}警告: .env.production 文件不存在${NC}"
    echo "创建默认配置..."
    cat > .env.production << EOF
ENVIRONMENT=production
SECRET_KEY=$(openssl rand -hex 32)
DATABASE_URL=sqlite:///./data/research_dashboard_prod.db
CORS_ORIGINS=http://45.149.156.216:3001,http://45.149.156.216
HOST=0.0.0.0
PORT=8080
LOG_LEVEL=INFO
EOF
    echo -e "${GREEN}✅ 创建了默认配置文件${NC}"
fi

echo -e "${YELLOW}4. 确保数据库目录存在并有正确权限...${NC}"
mkdir -p data
sudo chown -R www-data:www-data data/
sudo chmod 755 data/
if [ -f data/research_dashboard_prod.db ]; then
    sudo chmod 644 data/research_dashboard_prod.db
    echo -e "${GREEN}✅ 数据库权限已修复${NC}"
fi

echo -e "${YELLOW}5. 测试数据库连接...${NC}"
cd ..
python3 -c "
import sys
sys.path.insert(0, 'backend')
from app.models.database import SessionLocal
from sqlalchemy import text

try:
    db = SessionLocal()
    db.execute(text('SELECT 1'))
    db.execute(text('SELECT COUNT(*) FROM users'))
    print('✅ 数据库连接正常')
    db.close()
except Exception as e:
    print(f'❌ 数据库连接失败: {e}')
    exit(1)
"

echo -e "${YELLOW}6. 检查并运行数据库迁移...${NC}"
if [ -f backend/migrations/migration.py ]; then
    cd backend
    python migrations/migration.py
    cd ..
fi

echo -e "${YELLOW}7. 重启后端服务...${NC}"
sudo systemctl restart research-backend

echo -e "${YELLOW}8. 等待服务启动...${NC}"
for i in {1..10}; do
    if systemctl is-active --quiet research-backend; then
        echo -e "${GREEN}✅ 服务已启动${NC}"
        break
    fi
    echo -n "."
    sleep 1
done

echo -e "${YELLOW}9. 运行验证测试...${NC}"
sleep 3

# 9.1 测试健康检查
echo -e "\n${BLUE}测试公开端点...${NC}"
echo -n "根路径: "
if curl -s http://localhost:8080/ | grep -q "Research Dashboard API"; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${RED}❌${NC}"
fi

echo -n "全局健康检查: "
HEALTH=$(curl -s http://localhost:8080/health)
if echo "$HEALTH" | grep -q '"status":"healthy"'; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${RED}❌${NC}"
    echo "响应: $HEALTH"
fi

echo -n "Ideas健康检查: "
IDEAS_HEALTH=$(curl -s http://localhost:8080/api/ideas-management/health)
if echo "$IDEAS_HEALTH" | grep -q '"status":"healthy"'; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${RED}❌${NC}"
    echo "响应: $IDEAS_HEALTH"
fi

# 9.2 测试认证
echo -e "\n${BLUE}测试认证流程...${NC}"
echo "尝试登录..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8080/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"zl","password":"12345"}')

if echo "$LOGIN_RESPONSE" | grep -q '"access_token"'; then
    echo -e "${GREEN}✅ 登录成功${NC}"
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
    
    # 测试认证API
    echo -e "\n${BLUE}测试需要认证的API...${NC}"
    
    echo -n "合作者列表: "
    COLLAB=$(curl -s http://localhost:8080/api/collaborators/ \
        -H "Authorization: Bearer $TOKEN")
    if echo "$COLLAB" | grep -q '\[' || echo "$COLLAB" | grep -q '"id"'; then
        echo -e "${GREEN}✅${NC}"
    else
        echo -e "${RED}❌${NC}"
        echo "响应: $COLLAB"
    fi
    
    echo -n "研究项目列表: "
    RESEARCH=$(curl -s http://localhost:8080/api/research/ \
        -H "Authorization: Bearer $TOKEN")
    if echo "$RESEARCH" | grep -q '\[' || echo "$RESEARCH" | grep -q '"id"'; then
        echo -e "${GREEN}✅${NC}"
    else
        echo -e "${RED}❌${NC}"
        echo "响应: $RESEARCH"
    fi
else
    echo -e "${RED}❌ 登录失败${NC}"
    echo "响应: $LOGIN_RESPONSE"
fi

echo -e "\n${YELLOW}10. 检查服务日志...${NC}"
echo "最近的错误日志:"
journalctl -u research-backend -p err -n 5 --no-pager || echo "无错误日志"

echo -e "\n${YELLOW}11. 系统状态摘要...${NC}"
echo "服务状态: $(systemctl is-active research-backend)"
echo "端口监听: $(netstat -tlnp 2>/dev/null | grep :8080 | wc -l) 个进程"
echo "数据库文件: $(ls -lh backend/data/research_dashboard_prod.db 2>/dev/null | awk '{print $5}' || echo '不存在')"

echo -e "\n${BLUE}=== 修复脚本执行完成 ===${NC}"
echo -e "时间: $(date)"
echo ""
echo -e "${GREEN}提示：${NC}"
echo "1. 如果所有测试都是✅，说明系统正常"
echo "2. 如果有❌，请检查上面的错误信息"
echo "3. 查看实时日志: sudo journalctl -u research-backend -f"
echo "4. 前端访问: http://45.149.156.216:3001"