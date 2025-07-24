#!/bin/bash

# 🔍 VPS登录问题深度调查脚本
# 用于诊断为什么密码重置后仍然无法登录

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}=== VPS登录问题调查 ===${NC}"
echo -e "${CYAN}调查时间: $(date)${NC}"
echo ""

# 1. 检查目录和文件
echo -e "${YELLOW}1. 检查项目结构${NC}"
echo "当前目录: $(pwd)"
echo "项目文件："
ls -la /var/www/research-dashboard/backend/data/ || echo "数据目录不存在"
echo ""

# 2. 检查数据库文件
echo -e "${YELLOW}2. 检查数据库文件${NC}"
cd /var/www/research-dashboard/backend

# 查找所有数据库文件
echo "查找所有.db文件："
find . -name "*.db" -type f | grep -v node_modules | grep -v venv || echo "未找到数据库文件"
echo ""

# 3. 检查正在使用的数据库
echo -e "${YELLOW}3. 检查API使用的数据库${NC}"
echo "检查配置文件："
if [ -f ".env.production" ]; then
    echo "生产环境配置(.env.production)："
    grep -E "DATABASE_URL|ENVIRONMENT" .env.production || echo "未找到数据库配置"
fi

if [ -f ".env" ]; then
    echo "默认环境配置(.env)："
    grep -E "DATABASE_URL|ENVIRONMENT" .env || echo "未找到数据库配置"
fi
echo ""

# 4. 检查实际数据库内容
echo -e "${YELLOW}4. 检查数据库内容${NC}"

# 检查prod数据库
if [ -f "data/research_dashboard_prod.db" ]; then
    echo -e "${GREEN}生产数据库 (research_dashboard_prod.db):${NC}"
    echo "用户表："
    sqlite3 data/research_dashboard_prod.db "SELECT username, password_hash FROM users;" || echo "查询失败"
    echo "迁移历史："
    sqlite3 data/research_dashboard_prod.db "SELECT version, executed_at FROM migration_history ORDER BY executed_at DESC LIMIT 5;" 2>/dev/null || echo "无迁移历史"
else
    echo -e "${RED}生产数据库不存在！${NC}"
fi
echo ""

# 检查dev数据库
if [ -f "data/research_dashboard_dev.db" ]; then
    echo -e "${YELLOW}开发数据库 (research_dashboard_dev.db):${NC}"
    echo "用户表："
    sqlite3 data/research_dashboard_dev.db "SELECT username, password_hash FROM users;" || echo "查询失败"
    echo "迁移历史："
    sqlite3 data/research_dashboard_dev.db "SELECT version, executed_at FROM migration_history ORDER BY executed_at DESC LIMIT 5;" 2>/dev/null || echo "无迁移历史"
fi
echo ""

# 检查根目录数据库
if [ -f "research_dashboard.db" ]; then
    echo -e "${YELLOW}根目录数据库 (research_dashboard.db):${NC}"
    echo "用户表："
    sqlite3 research_dashboard.db "SELECT username, password_hash FROM users;" || echo "查询失败"
fi
echo ""

# 5. 测试密码验证
echo -e "${YELLOW}5. 测试密码验证${NC}"
cat > test_password.py << 'EOF'
import sys
sys.path.append('.')
from app.utils.auth import verify_password, get_password_hash

# 生成新密码
new_hash = get_password_hash('123')
print(f"密码'123'的新hash: {new_hash}")

# 测试一些常见的hash
test_hashes = [
    "$2b$12$K5hqy7J4c.1lFjmVQcTvJO7MfGxPktYXxgcB9ScZ0Y6VYNkSprJhm",  # 可能的旧hash
    new_hash
]

for h in test_hashes:
    try:
        result = verify_password('123', h)
        print(f"验证结果 - {h[:20]}...: {result}")
    except Exception as e:
        print(f"验证失败 - {h[:20]}...: {e}")
EOF

python3 test_password.py 2>&1 || echo "密码测试失败"
rm -f test_password.py
echo ""

# 6. 检查后端服务
echo -e "${YELLOW}6. 检查后端服务状态${NC}"
systemctl status research-backend --no-pager | head -20 || echo "服务状态检查失败"
echo ""

# 7. 检查后端日志
echo -e "${YELLOW}7. 最近的后端日志${NC}"
journalctl -u research-backend -n 50 --no-pager | grep -E "(auth|login|password|user)" | tail -20 || echo "无相关日志"
echo ""

# 8. 手动执行迁移
echo -e "${YELLOW}8. 手动执行迁移测试${NC}"
echo "当前环境变量："
echo "ENVIRONMENT=$ENVIRONMENT"

echo -e "\n${CYAN}尝试以生产环境执行迁移...${NC}"
cd /var/www/research-dashboard/backend
ENVIRONMENT=production python3 migrations/migration.py 2>&1 || echo "迁移执行失败"
echo ""

# 9. 再次检查数据库
echo -e "${YELLOW}9. 迁移后再次检查数据库${NC}"
if [ -f "data/research_dashboard_prod.db" ]; then
    echo "生产数据库用户（前20个字符）："
    sqlite3 data/research_dashboard_prod.db "SELECT username, substr(password_hash, 1, 20) || '...' as hash_prefix FROM users WHERE username='zl';" || echo "查询失败"
fi
echo ""

# 10. API测试
echo -e "${YELLOW}10. 直接API测试${NC}"
echo "测试登录API："
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "zl", "password": "123"}' \
  -s -w "\nHTTP Status: %{http_code}\n" || echo "API测试失败"
echo ""

# 11. Python环境检查
echo -e "${YELLOW}11. Python环境检查${NC}"
echo "Python版本: $(python3 --version)"
echo "bcrypt包信息:"
pip3 show bcrypt || echo "bcrypt未安装"
echo ""

echo -e "${GREEN}=== 调查完成 ===${NC}"
echo -e "${CYAN}请将此输出发送给开发者进行分析${NC}"