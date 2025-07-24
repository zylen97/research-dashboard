#!/bin/bash

# 部署后验证脚本 - 确保所有API端点正常工作

set -e

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
API_BASE="http://localhost:8080"
FRONTEND_URL="http://45.149.156.216:3001"

echo -e "${BLUE}=== Research Dashboard 部署验证 ===${NC}"
echo -e "时间: $(date)"
echo ""

# 1. 检查服务状态
echo -e "${YELLOW}1. 检查服务状态...${NC}"
if systemctl is-active --quiet research-backend; then
    echo -e "${GREEN}✅ 后端服务运行正常${NC}"
else
    echo -e "${RED}❌ 后端服务未运行${NC}"
    exit 1
fi

# 2. 检查端口监听
echo -e "${YELLOW}2. 检查端口监听...${NC}"
if netstat -tlnp 2>/dev/null | grep -q ":8080"; then
    echo -e "${GREEN}✅ 8080端口正在监听${NC}"
else
    echo -e "${RED}❌ 8080端口未监听${NC}"
    exit 1
fi

# 3. 测试公开API端点
echo -e "${YELLOW}3. 测试公开API端点...${NC}"

# 3.1 根路径
echo -n "  根路径 / ... "
if curl -s "$API_BASE/" | grep -q "Research Dashboard API"; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${RED}❌${NC}"
fi

# 3.2 全局健康检查
echo -n "  全局健康检查 /health ... "
HEALTH_RESPONSE=$(curl -s "$API_BASE/health")
if echo "$HEALTH_RESPONSE" | grep -q '"status":"healthy"'; then
    echo -e "${GREEN}✅${NC}"
    echo "    环境: $(echo "$HEALTH_RESPONSE" | grep -o '"environment":"[^"]*"' | cut -d'"' -f4)"
else
    echo -e "${RED}❌${NC}"
    echo "    响应: $HEALTH_RESPONSE"
fi

# 3.3 Ideas健康检查
echo -n "  Ideas健康检查 /api/ideas-management/health ... "
IDEAS_HEALTH=$(curl -s "$API_BASE/api/ideas-management/health")
if echo "$IDEAS_HEALTH" | grep -q '"status":"healthy"'; then
    echo -e "${GREEN}✅${NC}"
    # 检查数据库字段
    if echo "$IDEAS_HEALTH" | grep -q '"has_is_senior_field":true'; then
        echo -e "    ${GREEN}✅ 数据库字段正确${NC}"
    else
        echo -e "    ${RED}❌ 数据库字段错误${NC}"
    fi
else
    echo -e "${RED}❌${NC}"
    echo "    响应: $IDEAS_HEALTH"
fi

# 4. 测试认证流程
echo -e "${YELLOW}4. 测试认证流程...${NC}"

# 4.1 测试登录
echo -n "  测试登录接口 ... "
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"zl","password":"12345"}')

if echo "$LOGIN_RESPONSE" | grep -q '"access_token"'; then
    echo -e "${GREEN}✅${NC}"
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
    echo "    获取到token: ${TOKEN:0:20}..."
else
    echo -e "${RED}❌${NC}"
    echo "    响应: $LOGIN_RESPONSE"
    TOKEN=""
fi

# 5. 测试需要认证的API端点
if [ -n "$TOKEN" ]; then
    echo -e "${YELLOW}5. 测试需要认证的API端点...${NC}"
    
    # 5.1 合作者列表
    echo -n "  合作者列表 /api/collaborators/ ... "
    COLLAB_RESPONSE=$(curl -s "$API_BASE/api/collaborators/" \
        -H "Authorization: Bearer $TOKEN")
    
    if echo "$COLLAB_RESPONSE" | grep -q '\[' || echo "$COLLAB_RESPONSE" | grep -q '"id"'; then
        echo -e "${GREEN}✅${NC}"
    else
        echo -e "${RED}❌${NC}"
        echo "    响应: $COLLAB_RESPONSE"
    fi
    
    # 5.2 研究项目列表
    echo -n "  研究项目列表 /api/research/ ... "
    RESEARCH_RESPONSE=$(curl -s "$API_BASE/api/research/" \
        -H "Authorization: Bearer $TOKEN")
    
    if echo "$RESEARCH_RESPONSE" | grep -q '\[' || echo "$RESEARCH_RESPONSE" | grep -q '"id"'; then
        echo -e "${GREEN}✅${NC}"
    else
        echo -e "${RED}❌${NC}"
        echo "    响应: $RESEARCH_RESPONSE"
    fi
    
    # 5.3 Ideas列表
    echo -n "  Ideas列表 /api/ideas-management/ ... "
    IDEAS_RESPONSE=$(curl -s "$API_BASE/api/ideas-management/" \
        -H "Authorization: Bearer $TOKEN")
    
    if echo "$IDEAS_RESPONSE" | grep -q '\[' || echo "$IDEAS_RESPONSE" | grep -q '"id"'; then
        echo -e "${GREEN}✅${NC}"
    else
        echo -e "${RED}❌${NC}"
        echo "    响应: $IDEAS_RESPONSE"
    fi
else
    echo -e "${YELLOW}5. 跳过认证API测试（无token）${NC}"
fi

# 6. 检查前端访问
echo -e "${YELLOW}6. 检查前端访问...${NC}"
echo -n "  前端页面 $FRONTEND_URL ... "
if curl -s "$FRONTEND_URL" | grep -q "Research Dashboard"; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${RED}❌${NC}"
fi

# 7. 检查最新部署日志
echo -e "${YELLOW}7. 最新服务日志...${NC}"
journalctl -u research-backend -n 10 --no-pager | tail -5

echo ""
echo -e "${BLUE}=== 验证完成 ===${NC}"
echo -e "时间: $(date)"

# 统计结果
echo ""
echo -e "${BLUE}验证摘要：${NC}"
echo "- 如果看到多个✅，说明部署基本成功"
echo "- 如果有❌，请根据错误信息进行修复"
echo "- 特别注意认证token是否正常获取"