#!/bin/bash

# VPS数据库初始化脚本 - 在本地运行，远程执行VPS操作
# 使用方法: ./vps-init-database.sh

set -e

# 配置
VPS_HOST="45.149.156.216"
VPS_USER="root"

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}=== VPS 数据库一键初始化脚本 ===${NC}"
echo -e "${YELLOW}本脚本将自动在VPS上完成所有数据库初始化工作${NC}"
echo ""

# 检查是否能连接到VPS
echo -e "${YELLOW}检查VPS连接...${NC}"
if ! ssh -o ConnectTimeout=5 $VPS_USER@$VPS_HOST "echo '✅ VPS连接成功'" 2>/dev/null; then
    echo -e "${RED}❌ 无法连接到VPS，请检查：${NC}"
    echo "1. VPS是否在线"
    echo "2. SSH密钥是否配置正确"
    echo "3. 网络连接是否正常"
    exit 1
fi

echo -e "${GREEN}✅ VPS连接正常${NC}"
echo ""

# 在VPS上执行所有操作
ssh $VPS_USER@$VPS_HOST 'bash -s' << 'REMOTE_SCRIPT'
#!/bin/bash

# 颜色（在远程也需要定义）
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}=== 开始在VPS上执行操作 ===${NC}"

# 1. 进入项目目录
cd /var/www/research-dashboard

# 2. 拉取最新代码
echo -e "${YELLOW}1. 拉取最新代码...${NC}"
git pull || {
    echo -e "${RED}Git pull 失败，尝试强制更新${NC}"
    git fetch --all
    git reset --hard origin/main
}
echo -e "${GREEN}✅ 代码更新完成${NC}"

# 3. 进入backend目录
cd backend

# 4. 创建生产环境配置
echo -e "${YELLOW}2. 创建生产环境配置...${NC}"

# 生成安全的SECRET_KEY
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
echo -e "${BLUE}生成的SECRET_KEY: $SECRET_KEY${NC}"

# 创建 .env.production
cat > .env.production << EOF
ENVIRONMENT=production
SECRET_KEY=$SECRET_KEY
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080
DATABASE_URL=sqlite:///./data/research_dashboard_prod.db
CORS_ORIGINS=http://45.149.156.216:3001,http://45.149.156.216
HOST=0.0.0.0
PORT=3001
LOG_LEVEL=INFO
LOG_FILE=./logs/app_prod.log
UPLOAD_DIR=./uploads/prod
MAX_UPLOAD_SIZE=10485760
EOF

echo -e "${GREEN}✅ 配置文件创建完成${NC}"

# 5. 初始化数据库
echo -e "${YELLOW}3. 初始化数据库...${NC}"

# 确保scripts有执行权限
chmod +x scripts/init-db.sh

# 检查是否已有数据库
if [ -f "data/research_dashboard_prod.db" ]; then
    echo -e "${YELLOW}发现已存在的数据库，备份中...${NC}"
    mkdir -p backups/manual
    cp data/research_dashboard_prod.db backups/manual/backup_$(date +%Y%m%d_%H%M%S).db
    echo -e "${GREEN}✅ 备份完成${NC}"
fi

# 运行初始化脚本
cd scripts
ENVIRONMENT=production ./init-db.sh << 'INIT_RESPONSE'
y
INIT_RESPONSE

cd ..

# 6. 验证结果
echo -e "${YELLOW}4. 验证初始化结果...${NC}"

if [ -f "data/research_dashboard_prod.db" ]; then
    echo -e "${GREEN}✅ 数据库文件已创建${NC}"
    
    # 显示表信息
    echo -e "${BLUE}数据库表：${NC}"
    sqlite3 data/research_dashboard_prod.db ".tables" | tr ' ' '\n' | sort
    
    # 显示用户信息
    echo -e "${BLUE}已创建的用户：${NC}"
    sqlite3 data/research_dashboard_prod.db "SELECT username, display_name FROM users;"
else
    echo -e "${RED}❌ 数据库创建失败${NC}"
    exit 1
fi

# 7. 设置权限
echo -e "${YELLOW}5. 设置文件权限...${NC}"
chown -R www-data:www-data data/
chown -R www-data:www-data logs/ 2>/dev/null || mkdir -p logs && chown -R www-data:www-data logs/
chown -R www-data:www-data uploads/ 2>/dev/null || mkdir -p uploads/prod && chown -R www-data:www-data uploads/

# 8. 重启服务
echo -e "${YELLOW}6. 重启后端服务...${NC}"
systemctl restart research-backend

# 等待服务启动
sleep 3

# 9. 检查服务状态
echo -e "${YELLOW}7. 检查服务状态...${NC}"
if systemctl is-active --quiet research-backend; then
    echo -e "${GREEN}✅ 后端服务运行正常${NC}"
else
    echo -e "${RED}❌ 后端服务启动失败${NC}"
    echo "查看日志："
    journalctl -u research-backend -n 20 --no-pager
fi

# 10. 测试API
echo -e "${YELLOW}8. 测试API接口...${NC}"
RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "zl", "password": "123"}' || echo "API调用失败")

if echo "$RESPONSE" | grep -q "access_token"; then
    echo -e "${GREEN}✅ API测试成功！用户可以正常登录${NC}"
else
    echo -e "${RED}❌ API测试失败${NC}"
    echo "响应: $RESPONSE"
fi

echo ""
echo -e "${GREEN}=== VPS数据库初始化完成！===${NC}"
echo ""
echo "📋 初始化摘要："
echo "- 数据库：research_dashboard_prod.db"
echo "- 用户：zl, zz, yq, dz (密码: 123)"
echo "- 服务状态：$(systemctl is-active research-backend)"
echo "- 访问地址：http://45.149.156.216:3001"
echo ""
echo -e "${BLUE}现在可以通过浏览器访问你的应用了！${NC}"

REMOTE_SCRIPT

echo ""
echo -e "${GREEN}✅ 所有操作完成！${NC}"
echo -e "${YELLOW}提示：如果需要查看SECRET_KEY，请登录VPS后查看 /var/www/research-dashboard/backend/.env.production${NC}"