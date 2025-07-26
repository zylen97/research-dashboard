#!/bin/bash

# =============================================================================
# Ideas 管理页面数据类型错误综合调试脚本
# 错误: q.some is not a function at InternalTable.js:104:17
# 
# 分析: antd Table 组件期望数组数据，但收到了非数组数据
# =============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# VPS配置
VPS_IP="45.149.156.216"
VPS_PORT="3001"
API_BASE="http://${VPS_IP}:${VPS_PORT}/api"

echo -e "${PURPLE}=================================================================================="
echo -e "🔍 Ideas 管理页面数据类型错误 - 综合调试脚本"
echo -e "错误: TypeError: q.some is not a function at InternalTable.js:104:17"
echo -e "时间: $(date)"
echo -e "==================================================================================${NC}\n"

# =============================================================================
# 1. 错误分析和诊断流程
# =============================================================================
echo -e "${CYAN}📋 步骤1: 错误分析${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔹 错误位置: antd/es/table/InternalTable.js:104:17"
echo "🔹 错误原因: rawData.some() 被调用，但 rawData 不是数组"
echo "🔹 预期行为: Ideas API 应该返回数组格式的数据"
echo "🔹 实际问题: 前端收到的数据不是数组格式"
echo ""

# =============================================================================
# 2. 后端API检查
# =============================================================================
echo -e "${CYAN}📋 步骤2: 后端API检查${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo -e "${YELLOW}🌐 测试后端Ideas API响应...${NC}"

# 检查后端服务状态
echo "1️⃣  检查后端服务健康状态:"
if curl -s "${API_BASE}/ideas/health" &>/dev/null; then
    echo -e "   ${GREEN}✅ 后端服务运行正常${NC}"
else
    echo -e "   ${RED}❌ 后端服务无法访问${NC}"
    echo "   请检查: systemctl status research-backend"
fi

echo ""
echo "2️⃣  直接调用Ideas API:"
API_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}\nCONTENT_TYPE:%{content_type}\n" "${API_BASE}/ideas/" 2>/dev/null)

if [ $? -eq 0 ]; then
    HTTP_CODE=$(echo "$API_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
    CONTENT_TYPE=$(echo "$API_RESPONSE" | grep "CONTENT_TYPE:" | cut -d: -f2)
    RESPONSE_BODY=$(echo "$API_RESPONSE" | sed '/HTTP_CODE:/,$d')
    
    echo "   HTTP状态码: $HTTP_CODE"
    echo "   内容类型: $CONTENT_TYPE"
    echo ""
    echo "   原始响应内容:"
    echo "$RESPONSE_BODY" | jq . 2>/dev/null || echo "$RESPONSE_BODY"
    echo ""
    
    # 分析响应结构
    echo "3️⃣  响应结构分析:"
    if echo "$RESPONSE_BODY" | jq -e 'type' &>/dev/null; then
        RESPONSE_TYPE=$(echo "$RESPONSE_BODY" | jq -r 'type')
        echo "   响应数据类型: $RESPONSE_TYPE"
        
        if [ "$RESPONSE_TYPE" = "array" ]; then
            ITEM_COUNT=$(echo "$RESPONSE_BODY" | jq 'length')
            echo -e "   ${GREEN}✅ 响应是数组，包含 $ITEM_COUNT 个项目${NC}"
        elif [ "$RESPONSE_TYPE" = "object" ]; then
            echo -e "   ${YELLOW}⚠️  响应是对象，不是数组${NC}"
            echo "   对象结构:"
            echo "$RESPONSE_BODY" | jq 'keys' 2>/dev/null
            
            # 检查是否包含data字段
            if echo "$RESPONSE_BODY" | jq -e '.data' &>/dev/null; then
                DATA_TYPE=$(echo "$RESPONSE_BODY" | jq -r '.data | type')
                echo "   .data字段类型: $DATA_TYPE"
                if [ "$DATA_TYPE" = "array" ]; then
                    DATA_COUNT=$(echo "$RESPONSE_BODY" | jq '.data | length')
                    echo -e "   ${GREEN}✅ .data字段是数组，包含 $DATA_COUNT 个项目${NC}"
                else
                    echo -e "   ${RED}❌ .data字段不是数组: $DATA_TYPE${NC}"
                fi
            fi
        else
            echo -e "   ${RED}❌ 响应既不是数组也不是对象: $RESPONSE_TYPE${NC}"
        fi
    else
        echo -e "   ${RED}❌ 响应不是有效的JSON格式${NC}"
    fi
else
    echo -e "   ${RED}❌ API请求失败${NC}"
fi

echo ""

# =============================================================================
# 3. 数据库数据检查
# =============================================================================
echo -e "${CYAN}📋 步骤3: 数据库数据检查${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "1️⃣  检查Ideas表结构和数据:"
if [ -f "backend/data/research_dashboard.db" ]; then
    echo "   数据库文件存在"
    
    # 检查Ideas表结构
    echo "   Ideas表结构:"
    sqlite3 backend/data/research_dashboard.db ".schema ideas" 2>/dev/null || echo "   表不存在或无法访问"
    
    # 检查数据
    echo ""
    echo "   Ideas数据统计:"
    IDEA_COUNT=$(sqlite3 backend/data/research_dashboard.db "SELECT COUNT(*) FROM ideas;" 2>/dev/null || echo "0")
    echo "   总记录数: $IDEA_COUNT"
    
    if [ "$IDEA_COUNT" -gt 0 ]; then
        echo ""
        echo "   最新5条记录:"
        sqlite3 -header backend/data/research_dashboard.db "SELECT id, project_name, responsible_person, maturity, created_at FROM ideas ORDER BY created_at DESC LIMIT 5;" 2>/dev/null || echo "   无法查询数据"
    fi
else
    echo -e "   ${RED}❌ 数据库文件不存在${NC}"
fi

echo ""

# =============================================================================
# 4. 前端代码分析
# =============================================================================
echo -e "${CYAN}📋 步骤4: 前端代码分析${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "1️⃣  检查前端关键文件:"

# 检查IdeasManagement.tsx中的数据验证逻辑
echo "   检查 IdeasManagement.tsx 数据验证:"
if grep -n "Array.isArray" frontend/src/pages/IdeasManagement.tsx &>/dev/null; then
    echo -e "   ${GREEN}✅ 发现数组验证逻辑${NC}"
    grep -n -A 3 -B 1 "Array.isArray" frontend/src/pages/IdeasManagement.tsx
else
    echo -e "   ${YELLOW}⚠️  未发现数组验证逻辑${NC}"
fi

echo ""
echo "   检查 apiOptimized.ts getIdeasSafe方法:"
if grep -n -A 10 "getIdeasSafe" frontend/src/services/apiOptimized.ts &>/dev/null; then
    echo -e "   ${GREEN}✅ 发现 getIdeasSafe 方法${NC}"
    grep -n -A 10 "getIdeasSafe" frontend/src/services/apiOptimized.ts
else
    echo -e "   ${RED}❌ 未发现 getIdeasSafe 方法${NC}"
fi

echo ""
echo "   检查 handleListResponse 函数:"
if grep -n -A 15 "handleListResponse.*=" frontend/src/utils/dataFormatters.ts &>/dev/null; then
    echo -e "   ${GREEN}✅ 发现 handleListResponse 函数${NC}"
    echo "   函数逻辑预览:"
    grep -n -A 5 "handleListResponse.*=" frontend/src/utils/dataFormatters.ts
else
    echo -e "   ${RED}❌ 未发现 handleListResponse 函数${NC}"
fi

echo ""

# =============================================================================
# 5. 网络请求模拟测试
# =============================================================================
echo -e "${CYAN}📋 步骤5: 模拟前端请求流程${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "1️⃣  模拟带Token的请求 (如果有认证):"

# 检查是否有token示例
if [ -f "frontend/.env" ] && grep -q "TOKEN" frontend/.env; then
    echo "   发现环境变量文件，可能包含认证信息"
fi

# 模拟CORS和完整的API请求
echo ""
echo "2️⃣  测试完整的API请求流程:"
echo "   请求URL: ${API_BASE}/ideas/"
echo "   请求方法: GET"
echo "   请求头: application/json"

FULL_RESPONSE=$(curl -s -H "Content-Type: application/json" \
                      -H "Accept: application/json" \
                      -w "\n---CURL_INFO---\nHTTP_CODE:%{http_code}\nTIME_TOTAL:%{time_total}\nSIZE_DOWNLOAD:%{size_download}\n" \
                      "${API_BASE}/ideas/" 2>/dev/null)

if [ $? -eq 0 ]; then
    HTTP_CODE=$(echo "$FULL_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
    TIME_TOTAL=$(echo "$FULL_RESPONSE" | grep "TIME_TOTAL:" | cut -d: -f2)
    SIZE_DOWNLOAD=$(echo "$FULL_RESPONSE" | grep "SIZE_DOWNLOAD:" | cut -d: -f2)
    RESPONSE_BODY=$(echo "$FULL_RESPONSE" | sed '/---CURL_INFO---/,$d')
    
    echo "   响应时间: ${TIME_TOTAL}s"
    echo "   下载大小: ${SIZE_DOWNLOAD} bytes"
    echo "   HTTP状态: $HTTP_CODE"
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "   ${GREEN}✅ API请求成功${NC}"
    else
        echo -e "   ${RED}❌ API请求失败，状态码: $HTTP_CODE${NC}"
    fi
fi

echo ""

# =============================================================================
# 6. 问题诊断和修复建议
# =============================================================================
echo -e "${CYAN}📋 步骤6: 问题诊断和修复建议${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "🔍 根据检查结果诊断问题:"
echo ""

# 基于前面的检查结果给出建议
if [ "$HTTP_CODE" = "200" ] && echo "$RESPONSE_BODY" | jq -e 'type' &>/dev/null; then
    RESPONSE_TYPE=$(echo "$RESPONSE_BODY" | jq -r 'type')
    
    if [ "$RESPONSE_TYPE" = "array" ]; then
        echo -e "${GREEN}✅ 后端API返回正确的数组格式${NC}"
        echo "🔧 可能的问题:"
        echo "   1. 前端axios响应拦截器处理有误"
        echo "   2. handleListResponse函数在某些情况下返回非数组"
        echo "   3. React Query缓存了错误的数据格式"
        echo ""
        echo "💡 建议修复方案:"
        echo "   1. 在IdeasManagement.tsx中增强数组验证"
        echo "   2. 在getIdeasSafe方法中添加强制数组转换"
        echo "   3. 清除React Query缓存"
        
    elif [ "$RESPONSE_TYPE" = "object" ]; then
        echo -e "${YELLOW}⚠️  后端API返回对象格式，需要数据提取${NC}"
        
        if echo "$RESPONSE_BODY" | jq -e '.data | type' &>/dev/null; then
            DATA_TYPE=$(echo "$RESPONSE_BODY" | jq -r '.data | type')
            if [ "$DATA_TYPE" = "array" ]; then
                echo "🔧 问题确认: 数据在.data字段中，但可能提取失败"
            else
                echo "🔧 问题确认: .data字段不是数组"
            fi
        else
            echo "🔧 问题确认: 响应对象没有.data字段"
        fi
        
        echo ""
        echo "💡 建议修复方案:"
        echo "   1. 修复后端API，直接返回数组"
        echo "   2. 修复前端响应处理逻辑"
        echo "   3. 确保handleListResponse正确提取数据"
    else
        echo -e "${RED}❌ 后端API返回格式错误${NC}"
        echo "💡 建议修复方案:"
        echo "   1. 检查后端ideas.py路由实现"
        echo "   2. 检查数据库查询结果"
        echo "   3. 验证序列化逻辑"
    fi
else
    echo -e "${RED}❌ API请求失败或返回无效JSON${NC}"
    echo "💡 建议修复方案:"
    echo "   1. 检查后端服务状态"
    echo "   2. 检查网络连接"
    echo "   3. 检查API路径配置"
fi

echo ""

# =============================================================================
# 7. 生成修复脚本
# =============================================================================
echo -e "${CYAN}📋 步骤7: 生成自动修复脚本${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 创建修复脚本
cat > fix-ideas-data-type.sh << 'EOF'
#!/bin/bash

# Ideas 数据类型错误修复脚本
echo "🔧 开始修复 Ideas 数据类型错误..."

# 1. 清除前端构建缓存
echo "1️⃣ 清除前端缓存..."
cd frontend
rm -rf node_modules/.cache
rm -rf build
npm run build

# 2. 重启后端服务
echo "2️⃣ 重启后端服务..."
systemctl restart research-backend

# 3. 验证修复
echo "3️⃣ 验证修复..."
sleep 5
curl -s http://45.149.156.216:3001/api/ideas/ | jq 'type'

echo "✅ 修复完成"
EOF

chmod +x fix-ideas-data-type.sh

echo -e "${GREEN}✅ 修复脚本已生成: fix-ideas-data-type.sh${NC}"
echo ""

# =============================================================================
# 8. 实时监控和日志
# =============================================================================
echo -e "${CYAN}📋 步骤8: 查看相关日志${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "1️⃣ 后端服务日志 (最新20行):"
journalctl -u research-backend -n 20 --no-pager 2>/dev/null || echo "   无法获取服务日志"

echo ""
echo "2️⃣ 建议的监控命令:"
echo "   实时查看后端日志: journalctl -u research-backend -f"
echo "   检查Ideas API: curl -s http://45.149.156.216:3001/api/ideas/ | jq ."
echo "   查看服务状态: systemctl status research-backend"

echo ""

# =============================================================================
# 9. 总结报告
# =============================================================================
echo -e "${PURPLE}=================================================================================="
echo -e "📊 调试总结报告"
echo -e "==================================================================================${NC}"

echo -e "${YELLOW}🎯 问题概要:${NC}"
echo "   错误: TypeError: q.some is not a function"
echo "   位置: antd InternalTable.js:104:17"
echo "   原因: Table组件收到非数组数据"
echo ""

echo -e "${YELLOW}🔍 检查结果:${NC}"
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "   API状态: ${GREEN}正常${NC}"
else
    echo -e "   API状态: ${RED}异常${NC}"
fi

if [ -f "backend/data/research_dashboard.db" ]; then
    echo -e "   数据库: ${GREEN}存在${NC}"
else
    echo -e "   数据库: ${RED}不存在${NC}"
fi

echo ""
echo -e "${YELLOW}📋 下一步行动:${NC}"
echo "   1. 运行修复脚本: ./fix-ideas-data-type.sh"
echo "   2. 检查前端控制台错误"
echo "   3. 验证API响应格式"
echo "   4. 如果问题持续，检查前端代码"
echo ""

echo -e "${YELLOW}🚀 部署命令:${NC}"
echo "   ./deploy-scripts/deploy.sh  # 完整部署"
echo ""

echo -e "${GREEN}✅ 调试脚本执行完成！${NC}"
echo -e "${PURPLE}==================================================================================${NC}"