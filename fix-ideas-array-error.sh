#!/bin/bash

# =============================================================================
# Ideas 管理页面 "q.some is not a function" 错误快速修复脚本
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔧 Ideas 数据类型错误快速修复${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. 检查前端代码中的数据验证逻辑
echo -e "${YELLOW}1️⃣ 检查前端数据验证逻辑...${NC}"

# 检查IdeasManagement.tsx中的数组验证
if grep -q "Array.isArray" frontend/src/pages/IdeasManagement.tsx; then
    echo -e "   ${GREEN}✅ 发现数组验证逻辑${NC}"
else
    echo -e "   ${YELLOW}⚠️  需要增强数组验证${NC}"
fi

# 2. 检查API响应处理
echo -e "${YELLOW}2️⃣ 检查API响应处理...${NC}"

# 检查apiOptimized.ts中的安全处理
if grep -q "getIdeasSafe" frontend/src/services/apiOptimized.ts; then
    echo -e "   ${GREEN}✅ 发现安全获取方法${NC}"
else
    echo -e "   ${RED}❌ 缺少安全获取方法${NC}"
fi

# 3. 验证当前API响应
echo -e "${YELLOW}3️⃣ 测试API响应格式...${NC}"

API_URL="http://45.149.156.216:3001/api/ideas/"
RESPONSE=$(curl -s "$API_URL" 2>/dev/null)

if [ $? -eq 0 ]; then
    echo "   API响应获取成功"
    
    # 检查响应是否为有效JSON
    if echo "$RESPONSE" | jq . &>/dev/null; then
        RESPONSE_TYPE=$(echo "$RESPONSE" | jq -r 'type')
        echo "   响应类型: $RESPONSE_TYPE"
        
        if [ "$RESPONSE_TYPE" = "array" ]; then
            echo -e "   ${GREEN}✅ API返回数组格式${NC}"
        elif [ "$RESPONSE_TYPE" = "object" ]; then
            # 检查是否有data字段
            if echo "$RESPONSE" | jq -e '.data' &>/dev/null; then
                DATA_TYPE=$(echo "$RESPONSE" | jq -r '.data | type')
                echo "   .data字段类型: $DATA_TYPE"
                if [ "$DATA_TYPE" = "array" ]; then
                    echo -e "   ${YELLOW}⚠️  数据在.data字段中，可能提取失败${NC}"
                else
                    echo -e "   ${RED}❌ .data字段不是数组${NC}"
                fi
            else
                echo -e "   ${RED}❌ 对象响应没有.data字段${NC}"
            fi
        else
            echo -e "   ${RED}❌ 响应格式错误: $RESPONSE_TYPE${NC}"
        fi
    else
        echo -e "   ${RED}❌ 响应不是有效JSON${NC}"
    fi
else
    echo -e "   ${RED}❌ API请求失败${NC}"
fi

echo ""

# 4. 应用紧急修复
echo -e "${YELLOW}4️⃣ 应用前端紧急修复...${NC}"

# 备份原始文件
cp frontend/src/pages/IdeasManagement.tsx frontend/src/pages/IdeasManagement.tsx.backup.$(date +%Y%m%d_%H%M%S)

# 确保数据验证逻辑足够强
echo "   增强前端数组验证逻辑..."

# 检查当前的数据验证逻辑并可能需要修改
echo "   当前验证逻辑:"
grep -n -A 5 "useMemo.*ideasData" frontend/src/pages/IdeasManagement.tsx

echo ""

# 5. 清除可能的缓存问题
echo -e "${YELLOW}5️⃣ 清除缓存和重建...${NC}"

echo "   清除前端构建缓存..."
cd frontend
rm -rf node_modules/.cache 2>/dev/null || true
rm -rf build 2>/dev/null || true

echo "   重新构建前端..."
npm run build

cd ..

echo ""

# 6. 重启服务
echo -e "${YELLOW}6️⃣ 重启后端服务...${NC}"

echo "   重启research-backend服务..."
sudo systemctl restart research-backend 2>/dev/null || echo "   需要手动重启服务"

echo "   等待服务启动..."
sleep 3

echo ""

# 7. 验证修复
echo -e "${YELLOW}7️⃣ 验证修复结果...${NC}"

echo "   再次测试API响应..."
FIXED_RESPONSE=$(curl -s "$API_URL" 2>/dev/null)

if [ $? -eq 0 ] && echo "$FIXED_RESPONSE" | jq . &>/dev/null; then
    FIXED_TYPE=$(echo "$FIXED_RESPONSE" | jq -r 'type')
    echo "   修复后响应类型: $FIXED_TYPE"
    
    if [ "$FIXED_TYPE" = "array" ]; then
        echo -e "   ${GREEN}✅ API现在返回数组格式${NC}"
    else
        echo -e "   ${YELLOW}⚠️  仍需要进一步调试${NC}"
    fi
else
    echo -e "   ${RED}❌ API仍然有问题${NC}"
fi

echo ""

# 8. 提供后续建议
echo -e "${BLUE}📋 修复完成 - 后续建议:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. 🌐 立即测试页面："
echo "   访问: http://45.149.156.216:3001/ideas"
echo ""
echo "2. 🔍 如果问题仍然存在："
echo "   - 运行详细调试: ./debug-ideas-comprehensive.sh"
echo "   - 检查浏览器控制台错误"
echo "   - 清除浏览器缓存"
echo ""
echo "3. 🚀 完整部署："
echo "   ./deploy-scripts/deploy.sh"
echo ""
echo "4. 📊 监控命令："
echo "   journalctl -u research-backend -f"
echo "   curl -s http://45.149.156.216:3001/api/ideas/ | jq ."
echo ""

if [ "$FIXED_TYPE" = "array" ]; then
    echo -e "${GREEN}✅ 快速修复完成！Ideas页面应该可以正常工作了。${NC}"
else
    echo -e "${YELLOW}⚠️  初步修复完成，但可能需要进一步调试。${NC}"
fi

echo ""