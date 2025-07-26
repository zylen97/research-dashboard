#!/bin/bash

# =============================================================================
# Ideas转化为项目失败问题全面诊断脚本
# 错误: POST /api/ideas/9/convert-to-project 404 "Idea not found"
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

VPS_IP="45.149.156.216"
API_BASE="http://${VPS_IP}:3001/api"
BACKEND_PORT="8080"
TARGET_IDEA_ID="9"

echo -e "${PURPLE}=================================================================================="
echo -e "🔍 Ideas转化项目失败问题全面诊断"
echo -e "目标ID: $TARGET_IDEA_ID"
echo -e "时间: $(date)"
echo -e "==================================================================================${NC}\n"

# =============================================================================
# 1. 系统基础检查
# =============================================================================
echo -e "${CYAN}📋 步骤1: 系统基础检查${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "1️⃣ 后端服务状态检查:"
BACKEND_STATUS=$(systemctl is-active research-backend 2>/dev/null || echo "inactive")
if [ "$BACKEND_STATUS" = "active" ]; then
    echo -e "   ${GREEN}✅ research-backend服务运行中${NC}"
else
    echo -e "   ${RED}❌ research-backend服务未运行: $BACKEND_STATUS${NC}"
fi

echo ""
echo "2️⃣ 端口监听检查:"
BACKEND_LISTEN=$(netstat -tlnp 2>/dev/null | grep ":$BACKEND_PORT " || echo "not_listening")
if echo "$BACKEND_LISTEN" | grep -q ":$BACKEND_PORT "; then
    echo -e "   ${GREEN}✅ 后端端口$BACKEND_PORT正在监听${NC}"
    echo "   详情: $BACKEND_LISTEN"
else
    echo -e "   ${RED}❌ 后端端口$BACKEND_PORT未监听${NC}"
fi

FRONTEND_LISTEN=$(netstat -tlnp 2>/dev/null | grep ":3001 " || echo "not_listening")
if echo "$FRONTEND_LISTEN" | grep -q ":3001 "; then
    echo -e "   ${GREEN}✅ 前端端口3001正在监听${NC}"
else
    echo -e "   ${RED}❌ 前端端口3001未监听${NC}"
fi

echo ""

# =============================================================================
# 2. API端点可用性测试
# =============================================================================
echo -e "${CYAN}📋 步骤2: API端点可用性测试${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "1️⃣ 测试Ideas列表端点:"
IDEAS_RESPONSE=$(curl -s -w "HTTP_CODE:%{http_code}" "$API_BASE/ideas/" 2>/dev/null)
HTTP_CODE=$(echo "$IDEAS_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
RESPONSE_BODY=$(echo "$IDEAS_RESPONSE" | sed '/HTTP_CODE:/,$d')

echo "   HTTP状态码: $HTTP_CODE"
echo "   响应内容: $RESPONSE_BODY"

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "   ${GREEN}✅ Ideas列表端点正常${NC}"
    
    # 尝试解析Ideas数量
    if echo "$RESPONSE_BODY" | jq . &>/dev/null; then
        if echo "$RESPONSE_BODY" | jq -e 'type' &>/dev/null; then
            RESPONSE_TYPE=$(echo "$RESPONSE_BODY" | jq -r 'type')
            if [ "$RESPONSE_TYPE" = "array" ]; then
                IDEAS_COUNT=$(echo "$RESPONSE_BODY" | jq 'length')
                echo "   Ideas数量: $IDEAS_COUNT"
                
                if [ "$IDEAS_COUNT" -gt 0 ]; then
                    echo "   Ideas列表:"
                    echo "$RESPONSE_BODY" | jq -r '.[] | "     ID: \(.id) - \(.project_name)"' | head -10
                fi
            else
                echo -e "   ${YELLOW}⚠️  响应不是数组格式: $RESPONSE_TYPE${NC}"
            fi
        fi
    else
        echo -e "   ${YELLOW}⚠️  响应不是有效JSON${NC}"
    fi
elif [ "$HTTP_CODE" = "401" ]; then
    echo -e "   ${YELLOW}⚠️  需要认证 - 这是正常的${NC}"
else
    echo -e "   ${RED}❌ Ideas列表端点异常${NC}"
fi

echo ""
echo "2️⃣ 测试特定Ideas端点:"
SPECIFIC_IDEA_RESPONSE=$(curl -s -w "HTTP_CODE:%{http_code}" "$API_BASE/ideas/$TARGET_IDEA_ID" 2>/dev/null)
SPECIFIC_HTTP_CODE=$(echo "$SPECIFIC_IDEA_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
SPECIFIC_RESPONSE_BODY=$(echo "$SPECIFIC_IDEA_RESPONSE" | sed '/HTTP_CODE:/,$d')

echo "   HTTP状态码: $SPECIFIC_HTTP_CODE"
echo "   响应内容: $SPECIFIC_RESPONSE_BODY"

if [ "$SPECIFIC_HTTP_CODE" = "200" ]; then
    echo -e "   ${GREEN}✅ Idea ID $TARGET_IDEA_ID 存在${NC}"
elif [ "$SPECIFIC_HTTP_CODE" = "404" ]; then
    echo -e "   ${RED}❌ Idea ID $TARGET_IDEA_ID 不存在${NC}"
elif [ "$SPECIFIC_HTTP_CODE" = "401" ]; then
    echo -e "   ${YELLOW}⚠️  需要认证${NC}"
else
    echo -e "   ${YELLOW}⚠️  未知状态${NC}"
fi

echo ""
echo "3️⃣ 测试转化端点 (无认证):"
CONVERT_RESPONSE=$(curl -s -w "HTTP_CODE:%{http_code}" -X POST "$API_BASE/ideas/$TARGET_IDEA_ID/convert-to-project" 2>/dev/null)
CONVERT_HTTP_CODE=$(echo "$CONVERT_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
CONVERT_RESPONSE_BODY=$(echo "$CONVERT_RESPONSE" | sed '/HTTP_CODE:/,$d')

echo "   HTTP状态码: $CONVERT_HTTP_CODE"
echo "   响应内容: $CONVERT_RESPONSE_BODY"

case "$CONVERT_HTTP_CODE" in
    "200")
        echo -e "   ${GREEN}✅ 转化成功${NC}"
        ;;
    "401")
        echo -e "   ${YELLOW}⚠️  需要认证 (正常)${NC}"
        ;;
    "404")
        echo -e "   ${RED}❌ Idea不存在 (这是问题所在)${NC}"
        ;;
    *)
        echo -e "   ${YELLOW}⚠️  其他错误${NC}"
        ;;
esac

echo ""

# =============================================================================
# 3. 数据库直接查询
# =============================================================================
echo -e "${CYAN}📋 步骤3: 数据库直接查询${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

DB_PATH="/var/www/research-dashboard/backend/data/research_dashboard_prod.db"

if [ -f "$DB_PATH" ]; then
    echo "1️⃣ 数据库文件存在: $DB_PATH"
    
    echo ""
    echo "2️⃣ Ideas表结构:"
    sqlite3 "$DB_PATH" ".schema ideas" 2>/dev/null || echo "   无法查询表结构"
    
    echo ""
    echo "3️⃣ Ideas总数统计:"
    TOTAL_IDEAS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM ideas;" 2>/dev/null || echo "查询失败")
    echo "   总Ideas数量: $TOTAL_IDEAS"
    
    echo ""
    echo "4️⃣ 检查特定ID:"
    SPECIFIC_IDEA=$(sqlite3 "$DB_PATH" "SELECT id, project_name, responsible_person, created_at FROM ideas WHERE id = $TARGET_IDEA_ID;" 2>/dev/null || echo "查询失败")
    if [ -n "$SPECIFIC_IDEA" ] && [ "$SPECIFIC_IDEA" != "查询失败" ]; then
        echo -e "   ${GREEN}✅ 找到Idea ID $TARGET_IDEA_ID:${NC}"
        echo "   $SPECIFIC_IDEA"
    else
        echo -e "   ${RED}❌ 数据库中不存在Idea ID $TARGET_IDEA_ID${NC}"
    fi
    
    echo ""
    echo "5️⃣ 所有Ideas列表 (最新10条):"
    sqlite3 -header "$DB_PATH" "SELECT id, project_name, responsible_person, maturity, created_at FROM ideas ORDER BY created_at DESC LIMIT 10;" 2>/dev/null || echo "   查询失败"
    
    echo ""
    echo "6️⃣ ID范围检查:"
    ID_RANGE=$(sqlite3 "$DB_PATH" "SELECT MIN(id) as min_id, MAX(id) as max_id FROM ideas;" 2>/dev/null || echo "查询失败")
    echo "   ID范围: $ID_RANGE"
    
else
    echo -e "${RED}❌ 数据库文件不存在: $DB_PATH${NC}"
    
    # 尝试查找其他可能的数据库文件
    echo ""
    echo "查找其他数据库文件:"
    find /var/www/research-dashboard -name "*.db" 2>/dev/null || echo "   无法查找数据库文件"
fi

echo ""

# =============================================================================
# 4. 日志分析
# =============================================================================
echo -e "${CYAN}📋 步骤4: 日志分析${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "1️⃣ 最近的后端服务日志:"
journalctl -u research-backend -n 20 --no-pager 2>/dev/null | tail -10 || echo "   无法获取服务日志"

echo ""
echo "2️⃣ 查找Ideas相关错误日志:"
journalctl -u research-backend --since "1 hour ago" --no-pager 2>/dev/null | grep -i "idea\|convert\|404" || echo "   未找到相关错误日志"

echo ""

# =============================================================================
# 5. 认证状态测试
# =============================================================================
echo -e "${CYAN}📋 步骤5: 认证状态测试${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "1️⃣ 测试登录端点:"
LOGIN_RESPONSE=$(curl -s -w "HTTP_CODE:%{http_code}" -X POST "$API_BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin"}' 2>/dev/null)
LOGIN_HTTP_CODE=$(echo "$LOGIN_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
LOGIN_RESPONSE_BODY=$(echo "$LOGIN_RESPONSE" | sed '/HTTP_CODE:/,$d')

echo "   登录测试 HTTP状态码: $LOGIN_HTTP_CODE"
echo "   登录响应: $LOGIN_RESPONSE_BODY"

if [ "$LOGIN_HTTP_CODE" = "200" ]; then
    echo -e "   ${GREEN}✅ 登录端点可用${NC}"
    
    # 尝试提取token
    if echo "$LOGIN_RESPONSE_BODY" | jq -e '.access_token' &>/dev/null; then
        TOKEN=$(echo "$LOGIN_RESPONSE_BODY" | jq -r '.access_token')
        echo "   提取到Token: ${TOKEN:0:20}..."
        
        echo ""
        echo "2️⃣ 使用Token测试Ideas端点:"
        AUTH_IDEAS_RESPONSE=$(curl -s -w "HTTP_CODE:%{http_code}" \
            -H "Authorization: Bearer $TOKEN" \
            "$API_BASE/ideas/" 2>/dev/null)
        AUTH_HTTP_CODE=$(echo "$AUTH_IDEAS_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
        AUTH_RESPONSE_BODY=$(echo "$AUTH_IDEAS_RESPONSE" | sed '/HTTP_CODE:/,$d')
        
        echo "   认证后 HTTP状态码: $AUTH_HTTP_CODE"
        if [ "$AUTH_HTTP_CODE" = "200" ]; then
            echo -e "   ${GREEN}✅ 认证后可以访问Ideas${NC}"
            
            if echo "$AUTH_RESPONSE_BODY" | jq -e 'type' &>/dev/null; then
                AUTH_RESPONSE_TYPE=$(echo "$AUTH_RESPONSE_BODY" | jq -r 'type')
                if [ "$AUTH_RESPONSE_TYPE" = "array" ]; then
                    AUTH_IDEAS_COUNT=$(echo "$AUTH_RESPONSE_BODY" | jq 'length')
                    echo "   认证后Ideas数量: $AUTH_IDEAS_COUNT"
                    
                    # 检查目标ID是否在列表中
                    if echo "$AUTH_RESPONSE_BODY" | jq -e ".[] | select(.id == $TARGET_IDEA_ID)" &>/dev/null; then
                        echo -e "   ${GREEN}✅ 在列表中找到目标ID $TARGET_IDEA_ID${NC}"
                        TARGET_IDEA_INFO=$(echo "$AUTH_RESPONSE_BODY" | jq -r ".[] | select(.id == $TARGET_IDEA_ID) | \"名称: \(.project_name), 负责人: \(.responsible_person)\"")
                        echo "   目标Idea信息: $TARGET_IDEA_INFO"
                    else
                        echo -e "   ${RED}❌ 在列表中未找到目标ID $TARGET_IDEA_ID${NC}"
                        echo "   可用的ID列表:"
                        echo "$AUTH_RESPONSE_BODY" | jq -r '.[] | "     ID: \(.id)"' | head -10
                    fi
                fi
            fi
            
            echo ""
            echo "3️⃣ 使用Token测试特定Ideas:"
            AUTH_SPECIFIC_RESPONSE=$(curl -s -w "HTTP_CODE:%{http_code}" \
                -H "Authorization: Bearer $TOKEN" \
                "$API_BASE/ideas/$TARGET_IDEA_ID" 2>/dev/null)
            AUTH_SPECIFIC_HTTP_CODE=$(echo "$AUTH_SPECIFIC_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
            AUTH_SPECIFIC_BODY=$(echo "$AUTH_SPECIFIC_RESPONSE" | sed '/HTTP_CODE:/,$d')
            
            echo "   认证后特定Idea HTTP状态码: $AUTH_SPECIFIC_HTTP_CODE"
            echo "   认证后特定Idea响应: $AUTH_SPECIFIC_BODY"
            
            echo ""
            echo "4️⃣ 使用Token测试转化:"
            AUTH_CONVERT_RESPONSE=$(curl -s -w "HTTP_CODE:%{http_code}" \
                -X POST \
                -H "Authorization: Bearer $TOKEN" \
                -H "Content-Type: application/json" \
                "$API_BASE/ideas/$TARGET_IDEA_ID/convert-to-project" 2>/dev/null)
            AUTH_CONVERT_HTTP_CODE=$(echo "$AUTH_CONVERT_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
            AUTH_CONVERT_BODY=$(echo "$AUTH_CONVERT_RESPONSE" | sed '/HTTP_CODE:/,$d')
            
            echo "   认证后转化 HTTP状态码: $AUTH_CONVERT_HTTP_CODE"
            echo "   认证后转化响应: $AUTH_CONVERT_BODY"
            
        else
            echo -e "   ${RED}❌ 即使认证后也无法访问Ideas${NC}"
        fi
    else
        echo -e "   ${YELLOW}⚠️  无法从登录响应中提取Token${NC}"
    fi
else
    echo -e "   ${RED}❌ 登录端点不可用${NC}"
fi

echo ""

# =============================================================================
# 6. 问题诊断总结
# =============================================================================
echo -e "${PURPLE}📊 问题诊断总结${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo -e "${YELLOW}🔍 关键发现:${NC}"

# 服务状态
if [ "$BACKEND_STATUS" = "active" ]; then
    echo -e "   服务状态: ${GREEN}后端服务正常运行${NC}"
else
    echo -e "   服务状态: ${RED}后端服务异常${NC}"
fi

# API可达性
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ]; then
    echo -e "   API可达性: ${GREEN}API端点正常${NC}"
else
    echo -e "   API可达性: ${RED}API端点异常${NC}"
fi

# 目标Idea存在性
if [ -n "$SPECIFIC_IDEA" ] && [ "$SPECIFIC_IDEA" != "查询失败" ]; then
    echo -e "   目标Idea: ${GREEN}在数据库中存在${NC}"
elif [ "$SPECIFIC_HTTP_CODE" = "404" ]; then
    echo -e "   目标Idea: ${RED}不存在 - 这是问题根源${NC}"
else
    echo -e "   目标Idea: ${YELLOW}状态不明${NC}"
fi

# 认证状态
if [ "$LOGIN_HTTP_CODE" = "200" ]; then
    echo -e "   认证功能: ${GREEN}正常${NC}"
else
    echo -e "   认证功能: ${RED}异常${NC}"
fi

echo ""
echo -e "${YELLOW}💡 可能的解决方案:${NC}"

if [ "$SPECIFIC_HTTP_CODE" = "404" ]; then
    echo "   1. 目标Idea ID $TARGET_IDEA_ID 不存在"
    echo "   2. 检查前端显示的Ideas列表是否是缓存数据"
    echo "   3. 刷新页面重新获取最新的Ideas列表"
    echo "   4. 选择一个存在的Idea ID进行转化"
fi

if [ "$HTTP_CODE" = "401" ]; then
    echo "   1. 确保用户已正确登录"
    echo "   2. 检查前端是否正确传递认证Token"
    echo "   3. 清除浏览器缓存重新登录"
fi

if [ "$BACKEND_STATUS" != "active" ]; then
    echo "   1. 重启后端服务: systemctl restart research-backend"
    echo "   2. 检查服务日志: journalctl -u research-backend -f"
fi

echo ""
echo -e "${YELLOW}🔧 下一步建议:${NC}"
echo "   1. 访问前端页面刷新Ideas列表"
echo "   2. 确认要转化的Idea确实存在"
echo "   3. 确保用户已登录"
echo "   4. 选择列表中显示的有效Idea进行转化"

echo ""
echo -e "${GREEN}✅ 诊断完成！${NC}"
echo -e "${PURPLE}==================================================================================${NC}"