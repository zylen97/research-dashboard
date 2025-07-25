#!/bin/bash

# 🔍 后端服务深度诊断脚本
# 用于找出502错误的真正原因

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 === 后端服务深度诊断 === ${NC}"
echo -e "${BLUE}时间: $(date)${NC}"

# 1. 检查systemd服务状态
echo -e "\n${YELLOW}1. 检查systemd服务状态...${NC}"
systemctl status research-backend --no-pager -l || echo "服务状态异常"

# 2. 检查服务日志
echo -e "\n${YELLOW}2. 检查最近20条服务日志...${NC}"
journalctl -u research-backend -n 20 --no-pager

# 3. 检查Python环境
echo -e "\n${YELLOW}3. 检查Python环境...${NC}"
cd /var/www/research-dashboard/backend

echo "Python版本: $(python3 --version)"
echo "工作目录: $(pwd)"

# 检查关键依赖
echo -e "\n${YELLOW}4. 检查关键Python依赖...${NC}"
python3 -c "import fastapi; print('✅ FastAPI可用')" || echo "❌ FastAPI缺失"
python3 -c "import uvicorn; print('✅ Uvicorn可用')" || echo "❌ Uvicorn缺失"
python3 -c "import sqlalchemy; print('✅ SQLAlchemy可用')" || echo "❌ SQLAlchemy缺失"

# 5. 尝试直接启动应用
echo -e "\n${YELLOW}5. 尝试直接导入main模块...${NC}"
python3 -c "
try:
    import main
    print('✅ main模块导入成功')
except Exception as e:
    print(f'❌ main模块导入失败: {e}')
"

# 6. 检查端口占用
echo -e "\n${YELLOW}6. 检查端口8080占用情况...${NC}"
netstat -tulpn | grep :8080 || echo "端口8080未被占用"

# 7. 测试简单的uvicorn启动
echo -e "\n${YELLOW}7. 尝试简单的uvicorn启动（5秒测试）...${NC}"
timeout 5 python3 -m uvicorn main:app --host 127.0.0.1 --port 8081 --log-level debug || echo "Uvicorn启动测试完成"

# 8. 检查数据库文件
echo -e "\n${YELLOW}8. 检查数据库文件...${NC}"
if [ -f "data/research_dashboard_prod.db" ]; then
    echo "✅ 数据库文件存在"
    echo "数据库大小: $(du -sh data/research_dashboard_prod.db)"
    # 简单验证数据库完整性
    if sqlite3 data/research_dashboard_prod.db ".tables" > /dev/null 2>&1; then
        echo "✅ 数据库完整性正常"
    else
        echo "❌ 数据库文件损坏"
    fi
else
    echo "❌ 数据库文件不存在"
fi

# 9. 检查配置文件
echo -e "\n${YELLOW}9. 检查配置文件...${NC}"
if [ -f ".env" ]; then
    echo "✅ 配置文件存在"
    echo "配置文件内容（敏感信息已隐藏）:"
    grep -v "SECRET\|KEY\|PASSWORD" .env || echo "无配置内容可显示"
else
    echo "❌ 配置文件.env不存在"
fi

# 10. 检查文件权限
echo -e "\n${YELLOW}10. 检查关键文件权限...${NC}"
ls -la main.py 2>/dev/null || echo "❌ main.py不存在"
ls -la data/ 2>/dev/null || echo "❌ data目录不存在"

echo -e "\n${GREEN}🎉 诊断完成！${NC}"
echo -e "${BLUE}如果看到错误，这些就是502问题的根本原因${NC}"