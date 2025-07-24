#!/bin/bash

# 404错误紧急诊断脚本

set -e

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Research Dashboard 404错误诊断 ===${NC}"
echo -e "时间: $(date)"
echo ""

# 1. 检查后端服务状态
echo -e "${YELLOW}1. 检查后端服务状态...${NC}"
if systemctl is-active --quiet research-backend; then
    echo -e "${GREEN}✅ 服务正在运行${NC}"
    echo "详细状态:"
    systemctl status research-backend --no-pager | head -15
else
    echo -e "${RED}❌ 服务未运行${NC}"
    echo "尝试查看最近日志:"
    journalctl -u research-backend -n 50 --no-pager
fi

# 2. 检查端口监听
echo -e "\n${YELLOW}2. 检查端口监听...${NC}"
echo "8080端口 (后端API):"
netstat -tlnp 2>/dev/null | grep :8080 || echo "❌ 8080端口未监听"
echo ""
echo "3001端口 (nginx):"
netstat -tlnp 2>/dev/null | grep :3001 || echo "❌ 3001端口未监听"

# 3. 测试本地API访问
echo -e "\n${YELLOW}3. 测试本地API访问...${NC}"
echo -n "根路径: "
if curl -s http://localhost:8080/ | grep -q "Research Dashboard API"; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${RED}❌${NC}"
    curl -s http://localhost:8080/ | head -5
fi

echo -n "健康检查: "
HEALTH=$(curl -s http://localhost:8080/health)
if echo "$HEALTH" | grep -q '"status":"healthy"'; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${RED}❌${NC}"
    echo "$HEALTH"
fi

# 4. 测试nginx代理
echo -e "\n${YELLOW}4. 测试nginx代理...${NC}"
echo -n "通过nginx访问API: "
NGINX_API=$(curl -s http://localhost:3001/health)
if echo "$NGINX_API" | grep -q '"status":"healthy"'; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${RED}❌${NC}"
    echo "$NGINX_API"
fi

# 5. 检查nginx配置
echo -e "\n${YELLOW}5. 检查nginx配置...${NC}"
if nginx -t 2>&1 | grep -q "syntax is ok"; then
    echo -e "${GREEN}✅ nginx配置正确${NC}"
else
    echo -e "${RED}❌ nginx配置错误${NC}"
    nginx -t
fi

# 6. 检查nginx错误日志
echo -e "\n${YELLOW}6. nginx最近错误...${NC}"
tail -10 /var/log/nginx/error.log 2>/dev/null || echo "无法读取错误日志"

# 7. 快速修复建议
echo -e "\n${BLUE}=== 快速修复建议 ===${NC}"
if ! systemctl is-active --quiet research-backend; then
    echo -e "${YELLOW}后端服务未运行，执行:${NC}"
    echo "sudo systemctl start research-backend"
    echo "sudo systemctl status research-backend"
fi

if ! netstat -tlnp 2>/dev/null | grep -q :8080; then
    echo -e "${YELLOW}8080端口未监听，检查:${NC}"
    echo "1. 环境配置文件 .env.production"
    echo "2. 数据库连接"
    echo "3. Python依赖"
fi

echo -e "\n${GREEN}诊断完成！${NC}"