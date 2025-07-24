#!/bin/bash

# 🔍 诊断500错误的脚本

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}=== 诊断API 500错误 ===${NC}"
echo -e "${CYAN}诊断时间: $(date)${NC}"
echo ""

# 1. 检查后端服务状态
echo -e "${YELLOW}1. 检查后端服务状态${NC}"
systemctl status research-backend --no-pager | head -20
echo ""

# 2. 检查最近的错误日志
echo -e "${YELLOW}2. 最近的错误日志（500错误相关）${NC}"
journalctl -u research-backend -n 100 --no-pager | grep -E "(500|ERROR|Exception|Traceback|Failed)" | tail -30
echo ""

# 3. 检查Python错误详情
echo -e "${YELLOW}3. 详细的Python错误信息${NC}"
journalctl -u research-backend -n 200 --no-pager | grep -A10 -B5 "Traceback" | tail -50
echo ""

# 4. 检查数据库连接
echo -e "${YELLOW}4. 测试数据库连接${NC}"
cd /var/www/research-dashboard/backend

# 测试数据库文件
if [ -f "data/research_dashboard_prod.db" ]; then
    echo "✅ 数据库文件存在"
    echo "数据库大小: $(du -sh data/research_dashboard_prod.db | cut -f1)"
    echo "数据库权限: $(ls -l data/research_dashboard_prod.db)"
    
    # 测试数据库访问
    if sqlite3 data/research_dashboard_prod.db ".tables" > /dev/null 2>&1; then
        echo "✅ 数据库可访问"
        echo "表数量: $(sqlite3 data/research_dashboard_prod.db ".tables" | wc -w)"
    else
        echo "❌ 数据库无法访问"
    fi
else
    echo "❌ 数据库文件不存在！"
fi
echo ""

# 5. 检查文件权限
echo -e "${YELLOW}5. 检查文件权限${NC}"
echo "backend目录权限:"
ls -la /var/www/research-dashboard/backend | head -10
echo ""
echo "data目录权限:"
ls -la /var/www/research-dashboard/backend/data/
echo ""

# 6. 测试API端点
echo -e "${YELLOW}6. 测试API端点${NC}"
echo "测试健康检查:"
curl -s -w "\nHTTP状态码: %{http_code}\n" http://localhost:8080/docs | head -5
echo ""

echo "测试ideas API:"
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "zl", "password": "123"}' | python3 -c "import sys, json; print(json.load(sys.stdin).get('access_token', ''))" 2>/dev/null)

if [ -n "$TOKEN" ]; then
    echo "✅ 登录成功，获取到Token"
    echo "测试ideas管理API:"
    curl -s -w "\nHTTP状态码: %{http_code}\n" \
      -H "Authorization: Bearer $TOKEN" \
      http://localhost:8080/api/ideas-management/ | python3 -m json.tool 2>&1 | head -20
else
    echo "❌ 登录失败，无法获取Token"
fi
echo ""

# 7. 检查Python环境
echo -e "${YELLOW}7. Python环境检查${NC}"
echo "Python版本: $(python3 --version)"
echo "当前目录: $(pwd)"
echo ""

# 8. 检查内存使用
echo -e "${YELLOW}8. 系统资源状态${NC}"
echo "内存使用:"
free -h
echo ""
echo "磁盘使用:"
df -h | grep -E "/$|/var"
echo ""

# 9. 检查进程状态
echo -e "${YELLOW}9. Python进程详情${NC}"
ps aux | grep python | grep -v grep
echo ""

# 10. 最近的访问日志
echo -e "${YELLOW}10. 最近的API访问记录${NC}"
journalctl -u research-backend -n 50 --no-pager | grep -E "GET|POST" | tail -20
echo ""

echo -e "${GREEN}=== 诊断完成 ===${NC}"
echo -e "${CYAN}请根据上述信息分析500错误原因${NC}"