#!/bin/bash

# =============================================================================
# CORS和端口配置问题诊断脚本
# 错误: 前端请求8000端口，但后端在3001端口，且CORS配置问题
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

echo -e "${PURPLE}=================================================================================="
echo -e "🔍 CORS和端口配置问题诊断"
echo -e "错误: 前端请求8000端口，但后端在3001端口"
echo -e "时间: $(date)"
echo -e "==================================================================================${NC}\n"

# =============================================================================
# 1. 端口状态检查
# =============================================================================
echo -e "${CYAN}📋 步骤1: 端口状态检查${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "1️⃣ 检查哪些端口在运行:"
echo "   检查3001端口 (应该是后端):"
if curl -s --connect-timeout 3 "http://${VPS_IP}:3001/api/ideas/health" &>/dev/null; then
    echo -e "   ${GREEN}✅ 3001端口后端服务正常${NC}"
    BACKEND_PORT=3001
else
    echo -e "   ${RED}❌ 3001端口无响应${NC}"
fi

echo ""
echo "   检查8000端口 (前端错误请求的端口):"
if curl -s --connect-timeout 3 "http://${VPS_IP}:8000/api/ideas/" &>/dev/null; then
    echo -e "   ${YELLOW}⚠️  8000端口有服务运行${NC}"
    WRONG_PORT_ACTIVE=true
else
    echo -e "   ${GREEN}✅ 8000端口无服务(符合预期)${NC}"
    WRONG_PORT_ACTIVE=false
fi

echo ""
echo "2️⃣ 端口监听状态:"
echo "   所有监听的端口:"
netstat -tlnp 2>/dev/null | grep -E ":(3001|8000|80|443)" || echo "   无相关端口监听"

echo ""

# =============================================================================
# 2. 前端配置检查
# =============================================================================
echo -e "${CYAN}📋 步骤2: 前端配置检查${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "1️⃣ 检查前端API配置文件:"

# 检查API配置
if [ -f "frontend/src/config/api.ts" ]; then
    echo "   api.ts配置:"
    grep -n "BASE_URL\|baseURL\|8000\|3001" frontend/src/config/api.ts || echo "   未找到相关配置"
else
    echo -e "   ${RED}❌ api.ts文件不存在${NC}"
fi

echo ""
if [ -f "frontend/src/config/environment.ts" ]; then
    echo "   environment.ts配置:"
    grep -n "API\|URL\|8000\|3001" frontend/src/config/environment.ts || echo "   未找到相关配置"
else
    echo -e "   ${RED}❌ environment.ts文件不存在${NC}"
fi

echo ""
echo "2️⃣ 检查环境变量:"
if [ -f "frontend/.env" ]; then
    echo "   .env文件内容:"
    grep -E "API|URL|PORT" frontend/.env || echo "   无相关环境变量"
else
    echo "   无.env文件"
fi

if [ -f "frontend/.env.production" ]; then
    echo "   .env.production文件内容:"
    grep -E "API|URL|PORT" frontend/.env.production || echo "   无相关环境变量"
else
    echo "   无.env.production文件"
fi

echo ""
echo "3️⃣ 检查构建后的配置:"
if [ -f "frontend/build/static/js/main.*.js" ]; then
    echo "   检查构建文件中的端口引用:"
    BUILD_FILE=$(ls frontend/build/static/js/main.*.js | head -1)
    if grep -q "8000" "$BUILD_FILE"; then
        echo -e "   ${RED}❌ 构建文件中发现8000端口引用${NC}"
        echo "   8000端口引用位置:"
        grep -o -E ".{0,20}8000.{0,20}" "$BUILD_FILE" | head -3
    else
        echo -e "   ${GREEN}✅ 构建文件中无8000端口引用${NC}"
    fi
    
    if grep -q "3001" "$BUILD_FILE"; then
        echo -e "   ${GREEN}✅ 构建文件中发现3001端口引用${NC}"
    else
        echo -e "   ${YELLOW}⚠️  构建文件中无3001端口引用${NC}"
    fi
else
    echo -e "   ${RED}❌ 构建文件不存在${NC}"
fi

echo ""

# =============================================================================
# 3. 后端CORS配置检查
# =============================================================================
echo -e "${CYAN}📋 步骤3: 后端CORS配置检查${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "1️⃣ 检查后端CORS配置文件:"
if [ -f "backend/main.py" ]; then
    echo "   main.py中的CORS配置:"
    grep -n -A 5 -B 5 "CORS\|cors\|allow_origins" backend/main.py || echo "   未找到CORS配置"
else
    echo -e "   ${RED}❌ main.py文件不存在${NC}"
fi

echo ""
echo "2️⃣ 测试CORS预检请求:"
echo "   测试OPTIONS请求到3001端口:"
CORS_TEST=$(curl -s -w "HTTP_CODE:%{http_code}" -X OPTIONS \
    -H "Origin: http://${VPS_IP}:3001" \
    -H "Access-Control-Request-Method: GET" \
    -H "Access-Control-Request-Headers: Content-Type" \
    "http://${VPS_IP}:3001/api/ideas/" 2>/dev/null)

if [ $? -eq 0 ]; then
    HTTP_CODE=$(echo "$CORS_TEST" | grep "HTTP_CODE:" | cut -d: -f2)
    RESPONSE_BODY=$(echo "$CORS_TEST" | sed '/HTTP_CODE:/,$d')
    
    echo "   HTTP状态码: $HTTP_CODE"
    echo "   响应头:"
    curl -s -I -X OPTIONS \
        -H "Origin: http://${VPS_IP}:3001" \
        -H "Access-Control-Request-Method: GET" \
        "http://${VPS_IP}:3001/api/ideas/" 2>/dev/null | grep -i "access-control" || echo "   无CORS相关响应头"
else
    echo -e "   ${RED}❌ CORS预检请求失败${NC}"
fi

echo ""

# =============================================================================
# 4. 服务状态和日志检查
# =============================================================================
echo -e "${CYAN}📋 步骤4: 服务状态检查${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "1️⃣ 后端服务状态:"
systemctl is-active research-backend &>/dev/null && echo -e "   ${GREEN}✅ research-backend服务运行中${NC}" || echo -e "   ${RED}❌ research-backend服务未运行${NC}"

echo ""
echo "2️⃣ 最新服务日志:"
journalctl -u research-backend -n 10 --no-pager 2>/dev/null || echo "   无法获取服务日志"

echo ""
echo "3️⃣ Nginx配置检查:"
if [ -f "/etc/nginx/sites-available/research-3001" ] || [ -f "/etc/nginx/conf.d/research-3001.conf" ]; then
    echo "   发现Nginx配置文件"
    nginx -t 2>/dev/null && echo -e "   ${GREEN}✅ Nginx配置有效${NC}" || echo -e "   ${RED}❌ Nginx配置有误${NC}"
else
    echo "   未发现Nginx配置文件"
fi

echo ""

# =============================================================================
# 5. 生成修复方案
# =============================================================================
echo -e "${CYAN}📋 步骤5: 生成修复方案${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 创建修复脚本
cat > fix-cors-port-config.sh << 'EOF'
#!/bin/bash

echo "🔧 修复CORS和端口配置问题..."

# 1. 检查并修复前端API配置
echo "1️⃣ 修复前端API配置..."

# 确保API配置指向正确端口
if [ -f "frontend/src/config/api.ts" ]; then
    # 备份原文件
    cp frontend/src/config/api.ts frontend/src/config/api.ts.backup.$(date +%Y%m%d_%H%M%S)
    
    # 替换错误的端口配置
    sed -i 's/8000/3001/g' frontend/src/config/api.ts
    echo "   ✅ 修复api.ts中的端口配置"
fi

if [ -f "frontend/src/config/environment.ts" ]; then
    # 备份原文件
    cp frontend/src/config/environment.ts frontend/src/config/environment.ts.backup.$(date +%Y%m%d_%H%M%S)
    
    # 替换错误的端口配置
    sed -i 's/8000/3001/g' frontend/src/config/environment.ts
    echo "   ✅ 修复environment.ts中的端口配置"
fi

# 2. 修复后端CORS配置
echo "2️⃣ 检查后端CORS配置..."

if [ -f "backend/main.py" ]; then
    # 检查是否已有CORS配置
    if ! grep -q "CORSMiddleware" backend/main.py; then
        echo "   ⚠️  需要添加CORS配置到backend/main.py"
        echo "   请手动添加CORS中间件配置"
    else
        echo "   ✅ 后端已有CORS配置"
    fi
fi

# 3. 重新构建前端
echo "3️⃣ 重新构建前端..."
cd frontend
rm -rf build node_modules/.cache
npm run build
cd ..

# 4. 重启服务
echo "4️⃣ 重启后端服务..."
systemctl restart research-backend

echo "✅ 修复完成，请测试页面"
EOF

chmod +x fix-cors-port-config.sh

echo -e "${GREEN}✅ 修复脚本已生成: fix-cors-port-config.sh${NC}"

echo ""
echo -e "${YELLOW}🎯 问题诊断结果:${NC}"

if [ "$BACKEND_PORT" = "3001" ]; then
    echo -e "   后端状态: ${GREEN}正常运行在3001端口${NC}"
else
    echo -e "   后端状态: ${RED}3001端口无响应${NC}"
fi

if [ "$WRONG_PORT_ACTIVE" = "true" ]; then
    echo -e "   端口冲突: ${YELLOW}8000端口有服务运行${NC}"
else
    echo -e "   端口状态: ${GREEN}8000端口无冲突${NC}"
fi

echo ""
echo -e "${YELLOW}💡 推荐修复步骤:${NC}"
echo "   1. 运行修复脚本: ./fix-cors-port-config.sh"
echo "   2. 检查前端配置文件中的端口设置"
echo "   3. 确保后端CORS配置正确"
echo "   4. 重新部署: ./deploy-scripts/deploy.sh"

echo ""
echo -e "${YELLOW}📋 手动检查命令:${NC}"
echo "   查看前端配置: grep -r '8000' frontend/src/config/"
echo "   查看后端日志: journalctl -u research-backend -f"
echo "   测试API: curl http://45.149.156.216:3001/api/ideas/health"

echo ""
echo -e "${GREEN}✅ 诊断完成！${NC}"
echo -e "${PURPLE}==================================================================================${NC}"