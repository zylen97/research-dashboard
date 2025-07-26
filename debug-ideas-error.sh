#!/bin/bash

# Ideas Management 错误全面排查脚本
# 用于诊断 "q.some is not a function" 错误

set -e

echo "🔍 === Ideas Management 错误诊断脚本 ==="
echo "时间: $(date)"
echo

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 输出函数
info() { echo -e "${BLUE}[信息]${NC} $1"; }
success() { echo -e "${GREEN}[成功]${NC} $1"; }
warning() { echo -e "${YELLOW}[警告]${NC} $1"; }
error() { echo -e "${RED}[错误]${NC} $1"; }

# VPS配置
VPS_IP="45.149.156.216"
BACKEND_PORT="8000"
FRONTEND_PORT="3001"
BACKEND_URL="http://${VPS_IP}:${BACKEND_PORT}"
FRONTEND_URL="http://${VPS_IP}:${FRONTEND_PORT}"

echo "🎯 目标环境:"
echo "   后端: ${BACKEND_URL}"
echo "   前端: ${FRONTEND_URL}"
echo

# ======================================
# 1. 系统状态检查
# ======================================
echo "📊 1. 系统状态检查"
echo "-------------------"

info "检查后端服务状态..."
if systemctl is-active --quiet research-backend 2>/dev/null; then
    success "后端服务运行中"
else
    error "后端服务未运行"
    info "尝试启动后端服务..."
    sudo systemctl start research-backend || true
fi

info "检查前端服务状态..."
if curl -s -o /dev/null -w "%{http_code}" "${FRONTEND_URL}" | grep -q "200"; then
    success "前端服务正常"
else
    error "前端服务异常"
fi

# ======================================
# 2. 后端API测试
# ======================================
echo
echo "🔧 2. 后端API详细测试"
echo "-------------------"

info "测试基础连接..."
if curl -s --connect-timeout 5 "${BACKEND_URL}/api/" >/dev/null 2>&1; then
    success "后端基础连接正常"
else
    error "后端基础连接失败"
fi

info "测试Ideas API端点 (无认证)..."
echo "请求: GET ${BACKEND_URL}/api/ideas"
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}\nCONTENT_TYPE:%{content_type}" "${BACKEND_URL}/api/ideas" 2>/dev/null || echo "REQUEST_FAILED")

if [[ "$RESPONSE" == *"REQUEST_FAILED"* ]]; then
    error "API请求完全失败"
else
    echo "响应内容:"
    echo "$RESPONSE" | head -20
    echo
    
    HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d':' -f2)
    if [[ "$HTTP_CODE" == "200" ]]; then
        success "API返回200状态"
        # 检查返回数据是否为数组
        CONTENT=$(echo "$RESPONSE" | sed '/HTTP_CODE:/,$d')
        if echo "$CONTENT" | grep -q '^\['; then
            success "返回数据是数组格式"
        else
            warning "返回数据不是数组格式"
            echo "实际返回: $(echo "$CONTENT" | head -3)"
        fi
    elif [[ "$HTTP_CODE" == "401" ]]; then
        warning "API返回401 - 需要认证"
    else
        error "API返回错误状态码: $HTTP_CODE"
    fi
fi

# 模拟认证请求
info "尝试模拟认证请求..."
AUTH_RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin"}' 2>/dev/null || echo "AUTH_FAILED")

if [[ "$AUTH_RESPONSE" == *"AUTH_FAILED"* ]]; then
    warning "认证请求失败"
else
    echo "认证响应: $(echo "$AUTH_RESPONSE" | head -3)"
    
    # 尝试提取token
    TOKEN=$(echo "$AUTH_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "")
    
    if [[ -n "$TOKEN" ]]; then
        success "成功获取认证token"
        
        info "使用认证token测试Ideas API..."
        AUTH_IDEAS_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "${BACKEND_URL}/api/ideas" 2>/dev/null || echo "FAILED")
        
        if [[ "$AUTH_IDEAS_RESPONSE" == *"FAILED"* ]]; then
            error "认证后API请求失败"
        else
            echo "认证后响应:"
            echo "$AUTH_IDEAS_RESPONSE" | head -10
            
            if echo "$AUTH_IDEAS_RESPONSE" | grep -q '^\['; then
                success "认证后返回正确数组格式"
            else
                error "认证后仍返回非数组格式"
            fi
        fi
    else
        warning "无法提取认证token"
    fi
fi

# ======================================
# 3. 数据库检查
# ======================================
echo
echo "💾 3. 数据库状态检查"
echo "-------------------"

info "检查Ideas表结构..."
if command -v sqlite3 >/dev/null 2>&1; then
    if [[ -f "/app/database.db" ]]; then
        echo "Ideas表结构:"
        sqlite3 /app/database.db ".schema ideas" 2>/dev/null || warning "无法查询表结构"
        
        echo "Ideas表数据量:"
        sqlite3 /app/database.db "SELECT COUNT(*) FROM ideas;" 2>/dev/null || warning "无法查询数据量"
        
        echo "示例数据:"
        sqlite3 /app/database.db "SELECT id, project_name, created_at FROM ideas LIMIT 3;" 2>/dev/null || warning "无法查询示例数据"
    else
        warning "数据库文件不存在: /app/database.db"
    fi
else
    warning "sqlite3命令不可用"
fi

# ======================================
# 4. 前端状态检查
# ======================================
echo
echo "🌐 4. 前端状态检查"
echo "-------------------"

info "检查前端文件版本..."
FRONTEND_JS_URL="${FRONTEND_URL}/static/js"
FRONTEND_MAIN_JS=$(curl -s "${FRONTEND_URL}" | grep -o 'static/js/main\.[^"]*\.js' | head -1 2>/dev/null || echo "")

if [[ -n "$FRONTEND_MAIN_JS" ]]; then
    success "找到主JS文件: $FRONTEND_MAIN_JS"
    
    info "检查JS文件是否包含修复代码..."
    JS_CONTENT=$(curl -s "${FRONTEND_URL}/${FRONTEND_MAIN_JS}" 2>/dev/null || echo "")
    
    if echo "$JS_CONTENT" | grep -q "getIdeasSafe"; then
        success "JS文件包含修复代码 (getIdeasSafe)"
    else
        warning "JS文件不包含修复代码"
    fi
    
    if echo "$JS_CONTENT" | grep -q "45.149.156.216:8000"; then
        success "JS文件包含正确的API地址"
    else
        warning "JS文件不包含正确的API地址"
    fi
else
    error "无法找到主JS文件"
fi

# ======================================
# 5. 网络和CORS检查
# ======================================
echo
echo "🌍 5. 网络和CORS检查"
echo "-------------------"

info "检查CORS配置..."
CORS_RESPONSE=$(curl -s -I -X OPTIONS "${BACKEND_URL}/api/ideas" \
    -H "Origin: ${FRONTEND_URL}" \
    -H "Access-Control-Request-Method: GET" 2>/dev/null || echo "CORS_FAILED")

if [[ "$CORS_RESPONSE" == *"CORS_FAILED"* ]]; then
    error "CORS预检请求失败"
else
    if echo "$CORS_RESPONSE" | grep -q "Access-Control-Allow-Origin"; then
        success "CORS配置存在"
    else
        warning "CORS配置可能有问题"
    fi
    echo "CORS响应头:"
    echo "$CORS_RESPONSE" | grep -i "access-control" || warning "无CORS相关头部"
fi

# ======================================
# 6. 实际浏览器模拟
# ======================================
echo
echo "🖥️  6. 浏览器请求模拟"
echo "-------------------"

info "模拟浏览器请求Ideas API..."
BROWSER_RESPONSE=$(curl -s "${BACKEND_URL}/api/ideas" \
    -H "Accept: application/json" \
    -H "Referer: ${FRONTEND_URL}/ideas-management" \
    -H "User-Agent: Mozilla/5.0" 2>/dev/null || echo "BROWSER_FAILED")

if [[ "$BROWSER_RESPONSE" == *"BROWSER_FAILED"* ]]; then
    error "浏览器模拟请求失败"
else
    echo "浏览器模拟响应:"
    echo "$BROWSER_RESPONSE" | head -10
    
    # 验证JSON格式
    if echo "$BROWSER_RESPONSE" | python3 -m json.tool >/dev/null 2>&1; then
        success "返回有效JSON格式"
        
        # 检查是否为数组
        if echo "$BROWSER_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); exit(0 if isinstance(data, list) else 1)" 2>/dev/null; then
            success "返回数据确实是数组"
            COUNT=$(echo "$BROWSER_RESPONSE" | python3 -c "import sys, json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?")
            info "数组长度: $COUNT"
        else
            error "返回数据不是数组！这是问题根源！"
            echo "数据类型: $(echo "$BROWSER_RESPONSE" | python3 -c "import sys, json; print(type(json.load(sys.stdin)).__name__)" 2>/dev/null)"
        fi
    else
        error "返回无效JSON格式"
        echo "原始响应: $(echo "$BROWSER_RESPONSE" | head -3)"
    fi
fi

# ======================================
# 7. 建议修复方案
# ======================================
echo
echo "💡 7. 修复建议"
echo "-------------------"

if [[ "$HTTP_CODE" == "401" ]]; then
    warning "主要问题: API需要认证但前端可能没有发送正确的认证信息"
    echo "建议:"
    echo "1. 检查localStorage中是否有auth_token"
    echo "2. 验证前端认证逻辑"
    echo "3. 考虑暂时跳过认证进行测试"
elif ! echo "$BROWSER_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); exit(0 if isinstance(data, list) else 1)" 2>/dev/null; then
    error "主要问题: API返回非数组数据"
    echo "建议:"
    echo "1. 修复后端API确保返回数组"
    echo "2. 检查错误处理逻辑"
    echo "3. 添加更强的前端数据验证"
else
    success "API数据格式正确，问题可能在前端缓存或代码逻辑"
    echo "建议:"
    echo "1. 强制刷新浏览器缓存 (Ctrl+F5)"
    echo "2. 检查React Query缓存"
    echo "3. 验证前端代码是否正确部署"
fi

echo
echo "🏁 诊断完成！请根据上述信息进行修复。"
echo "时间: $(date)"