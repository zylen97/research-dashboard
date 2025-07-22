#!/bin/bash

# 🔧 502错误诊断脚本 - Ultra Think 紧急修复版
# 专注诊断和修复502 Bad Gateway问题

set -e

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 配置
PROJECT_ROOT="/var/www/research-dashboard"
LOG_FILE="/var/log/research-dashboard-verify.log"

# 计分系统
TOTAL_CHECKS=0
PASSED_CHECKS=0
CRITICAL_FAILURES=0

# 日志函数
log_message() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

# 验证结果函数
check_result() {
    local test_name=$1
    local success=$2
    local critical=${3:-false}
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    if [ "$success" = true ]; then
        echo -e "  ${GREEN}✅ $test_name${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        log_message "PASS" "$test_name"
    else
        if [ "$critical" = true ]; then
            echo -e "  ${RED}❌ $test_name (关键)${NC}"
            CRITICAL_FAILURES=$((CRITICAL_FAILURES + 1))
        else
            echo -e "  ${YELLOW}⚠️ $test_name (警告)${NC}"
        fi
        log_message "FAIL" "$test_name"
    fi
}

echo -e "${BLUE}=== Research Dashboard 502错误紧急诊断 ===${NC}"
echo -e "${CYAN}开始时间: $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo ""
log_message "INFO" "开始502错误诊断"

# 🚨 紧急502问题诊断
echo -e "${RED}🚨 502 Bad Gateway 错误诊断${NC}"
echo ""

# 快速检查关键问题
echo -e "${YELLOW}1. 快速问题诊断${NC}"

# 后端服务状态
if systemctl is-active --quiet research-backend; then
    echo -e "  ${GREEN}✅ 后端服务运行中${NC}"
else
    echo -e "  ${RED}❌ 后端服务未运行 - 这是502错误的主要原因！${NC}"
    echo -e "  ${CYAN}尝试启动服务...${NC}"
    systemctl start research-backend || echo -e "    ${RED}启动失败${NC}"
    sleep 5
    if systemctl is-active --quiet research-backend; then
        echo -e "    ${GREEN}✅ 服务启动成功${NC}"
    else
        echo -e "    ${RED}❌ 服务启动失败，查看错误日志：${NC}"
        journalctl -u research-backend --no-pager -n 10
    fi
fi

# 端口检查
echo -e "  ${CYAN}检查端口8080（后端API）:${NC}"
if netstat -tuln 2>/dev/null | grep ":8080 " > /dev/null; then
    echo -e "    ${GREEN}✅ 8080端口已监听${NC}"
else
    echo -e "    ${RED}❌ 8080端口未监听 - 后端服务未正常启动${NC}"
fi

# API直接测试
echo -e "  ${CYAN}测试后端API直接访问:${NC}"
api_response=$(curl -s --connect-timeout 5 "http://localhost:8080" 2>/dev/null || echo "FAIL")
if [ "$api_response" != "FAIL" ]; then
    echo -e "    ${GREEN}✅ 后端API响应正常${NC}"
else
    echo -e "    ${RED}❌ 后端API无响应${NC}"
fi

# Nginx代理测试
echo -e "  ${CYAN}测试Nginx API代理:${NC}"
proxy_response=$(curl -s --connect-timeout 5 "http://localhost:3001/api/" 2>/dev/null || echo "FAIL")
if [ "$proxy_response" != "FAIL" ]; then
    echo -e "    ${GREEN}✅ Nginx代理工作正常${NC}"
else
    echo -e "    ${RED}❌ Nginx代理失败 - 检查配置${NC}"
fi

echo ""

# 如果发现问题，立即尝试修复
if ! systemctl is-active --quiet research-backend; then
    echo -e "${YELLOW}🔧 尝试自动修复...${NC}"
    
    # 重新部署后端配置
    cd "$PROJECT_ROOT/backend" || exit 1
    
    # 检查配置文件
    if [ ! -f ".env" ]; then
        echo -e "  ${CYAN}创建生产环境配置...${NC}"
        cat > .env << 'EOF'
ENVIRONMENT=production
DATABASE_URL=sqlite:///./data/research_dashboard_prod.db
SECRET_KEY=ultra-think-production-secret-key-2025-secure
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080
HOST=0.0.0.0
PORT=8080
CORS_ORIGINS=http://45.149.156.216:3001,http://localhost:3001
LOG_LEVEL=INFO
LOG_FILE=./logs/production.log
UPLOAD_DIR=./uploads/production
MAX_UPLOAD_SIZE=10485760

# AI批量处理配置
AI_BATCH_SIZE_LIMIT=50
AI_MAX_CONCURRENT=5
AI_MAX_RETRIES=2

# HTTP性能优化配置
HTTP_MAX_CONNECTIONS=100
HTTP_KEEPALIVE_CONNECTIONS=20
ENABLE_HTTP2=true
EOF
        chmod 600 .env
        echo -e "    ${GREEN}✅ 配置文件创建完成${NC}"
    fi
    
    # 重启服务
    echo -e "  ${CYAN}重启后端服务...${NC}"
    systemctl restart research-backend
    sleep 10
    
    if systemctl is-active --quiet research-backend; then
        echo -e "    ${GREEN}✅ 服务重启成功${NC}"
        
        # 再次测试API
        sleep 5
        if curl -s --connect-timeout 5 "http://localhost:8080" > /dev/null; then
            echo -e "    ${GREEN}🎉 502错误已修复！${NC}"
        else
            echo -e "    ${RED}❌ API仍无响应，需要进一步诊断${NC}"
        fi
    else
        echo -e "    ${RED}❌ 服务重启失败${NC}"
        echo -e "    ${CYAN}查看错误日志:${NC}"
        journalctl -u research-backend --no-pager -n 15
    fi
fi

echo ""

# 1. 检查后端服务状态
echo -e "${YELLOW}1. 🚀 后端服务状态检查${NC}"

# 服务运行状态
check_result "后端服务运行状态" "$(systemctl is-active --quiet research-backend && echo true || echo false)" true

# 服务启动时间
if systemctl is-active --quiet research-backend; then
    uptime_info=$(systemctl show research-backend --property=ActiveEnterTimestamp --value)
    echo -e "${CYAN}    启动时间: $uptime_info${NC}"
    
    # 检查内存使用
    memory_usage=$(systemctl show research-backend --property=MemoryCurrent --value)
    if [ "$memory_usage" != "[not set]" ] && [ -n "$memory_usage" ]; then
        memory_mb=$((memory_usage / 1024 / 1024))
        echo -e "${CYAN}    内存使用: ${memory_mb}MB${NC}"
        check_result "内存使用合理 (<500MB)" "$([ $memory_mb -lt 500 ] && echo true || echo false)"
    fi
fi

echo ""

# 2. 环境配置检查
echo -e "${YELLOW}2. ⚙️ 环境配置检查${NC}"

# .env文件存在性
check_result ".env文件存在" "$([ -f "$PROJECT_ROOT/backend/.env" ] && echo true || echo false)" true

if [ -f "$PROJECT_ROOT/backend/.env" ]; then
    # 检查关键配置项
    env_file="$PROJECT_ROOT/backend/.env"
    
    check_result "ENVIRONMENT设置" "$(grep -q "ENVIRONMENT=production" "$env_file" && echo true || echo false)" true
    check_result "DATABASE_URL配置" "$(grep -q "DATABASE_URL=" "$env_file" && echo true || echo false)" true
    check_result "SECRET_KEY配置" "$(grep -q "SECRET_KEY=" "$env_file" && echo true || echo false)" true
    
    # 检查Ultra Think新增配置
    check_result "AI批量处理配置" "$(grep -q "AI_BATCH_SIZE_LIMIT=" "$env_file" && echo true || echo false)"
    check_result "HTTP性能配置" "$(grep -q "HTTP_MAX_CONNECTIONS=" "$env_file" && echo true || echo false)"
    
    # 显示配置摘要（隐藏敏感信息）
    echo -e "${CYAN}    配置摘要:${NC}"
    echo -e "${CYAN}      环境: $(grep "ENVIRONMENT=" "$env_file" | cut -d'=' -f2)${NC}"
    echo -e "${CYAN}      AI并发数: $(grep "AI_MAX_CONCURRENT=" "$env_file" | cut -d'=' -f2 || echo "未设置")${NC}"
fi

echo ""

# 3. 数据库检查
echo -e "${YELLOW}3. 🗄️ 数据库检查${NC}"

DB_DIR="$PROJECT_ROOT/backend/data"
DB_FILE="$DB_DIR/research_dashboard_prod.db"

# 数据目录存在性
check_result "数据目录存在" "$([ -d "$DB_DIR" ] && echo true || echo false)" true

# 生产数据库文件
check_result "生产数据库文件存在" "$([ -f "$DB_FILE" ] && echo true || echo false)" true

if [ -f "$DB_FILE" ]; then
    # 数据库完整性检查
    check_result "数据库完整性" "$(sqlite3 "$DB_FILE" "PRAGMA integrity_check;" | grep -q "ok" && echo true || echo false)" true
    
    # 表结构检查
    table_count=$(sqlite3 "$DB_FILE" ".tables" | wc -w)
    check_result "数据表数量 (>5)" "$([ $table_count -gt 5 ] && echo true || echo false)"
    
    # 数据大小
    db_size=$(du -sh "$DB_FILE" | cut -f1)
    echo -e "${CYAN}    数据库大小: $db_size${NC}"
    echo -e "${CYAN}    数据表数量: $table_count${NC}"
    
    # 检查关键表是否存在
    for table in users collaborators research_projects literature ideas system_configs; do
        table_exists=$(sqlite3 "$DB_FILE" ".tables" | grep -c "$table" || echo "0")
        check_result "表 $table 存在" "$([ $table_exists -gt 0 ] && echo true || echo false)"
    done
    
    # 检查索引是否创建
    index_count=$(sqlite3 "$DB_FILE" ".indices" | wc -l)
    check_result "数据库索引优化 (>10个索引)" "$([ $index_count -gt 10 ] && echo true || echo false)"
fi

echo ""

# 4. API功能检查
echo -e "${YELLOW}4. 🌐 API功能检查${NC}"

API_URL="http://localhost:8080"

# 基础API连通性
api_status=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL" 2>/dev/null || echo "000")
check_result "基础API响应" "$([ "$api_status" = "200" ] && echo true || echo false)" true

if [ "$api_status" = "200" ]; then
    # API文档可访问性
    docs_status=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/docs" 2>/dev/null || echo "000")
    check_result "API文档可访问" "$([ "$docs_status" = "200" ] && echo true || echo false)"
    
    # OpenAPI schema
    openapi_status=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/openapi.json" 2>/dev/null || echo "000")
    check_result "OpenAPI schema可访问" "$([ "$openapi_status" = "200" ] && echo true || echo false)"
    
    # 核心API端点测试
    for endpoint in "/api/auth/me" "/api/research/" "/api/collaborators/" "/api/literature/" "/api/ideas/"; do
        # 这里只测试端点是否存在（会返回401未授权，这是正常的）
        endpoint_status=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL$endpoint" 2>/dev/null || echo "000")
        if [ "$endpoint_status" = "401" ] || [ "$endpoint_status" = "200" ]; then
            check_result "端点 $endpoint 可达" true
        else
            check_result "端点 $endpoint 可达" false
        fi
    done
    
    # Ultra Think 新功能端点
    batch_match_status=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/literature/batch-match/stats" 2>/dev/null || echo "000")
    check_result "AI批量匹配统计端点" "$([ "$batch_match_status" = "401" ] || [ "$batch_match_status" = "200" ] && echo true || echo false)"
    
    # API响应时间测试
    response_time=$(curl -s -o /dev/null -w "%{time_total}" "$API_URL" 2>/dev/null || echo "999")
    response_time_ms=$(echo "$response_time * 1000" | bc -l 2>/dev/null | cut -d. -f1)
    check_result "API响应时间 (<2秒)" "$([ "$response_time_ms" -lt 2000 ] && echo true || echo false)"
    
    echo -e "${CYAN}    API响应时间: ${response_time}s${NC}"
fi

echo ""

# 5. 前端部署检查
echo -e "${YELLOW}5. 📦 前端部署检查${NC}"

# 前端目录和文件
check_result "前端目录存在" "$([ -d "/var/www/html" ] && echo true || echo false)" true
check_result "index.html存在" "$([ -f "/var/www/html/index.html" ] && echo true || echo false)" true

if [ -d "/var/www/html" ]; then
    # 检查关键文件
    check_result "静态JS文件存在" "$(find /var/www/html -name "*.js" | head -1 | wc -l | xargs test 1 -eq && echo true || echo false)"
    check_result "静态CSS文件存在" "$(find /var/www/html -name "*.css" | head -1 | wc -l | xargs test 1 -eq && echo true || echo false)"
    
    # 前端大小检查
    if [ -d "/var/www/html" ]; then
        frontend_size_kb=$(du -sk /var/www/html | cut -f1)
        frontend_size_mb=$((frontend_size_kb / 1024))
        echo -e "${CYAN}    前端大小: ${frontend_size_mb}MB${NC}"
        check_result "前端大小合理 (<100MB)" "$([ $frontend_size_mb -lt 100 ] && echo true || echo false)"
        
        # 文件数量检查
        file_count=$(find /var/www/html -type f | wc -l)
        echo -e "${CYAN}    文件数量: $file_count${NC}"
    fi
    
    # 权限检查
    html_owner=$(stat -c %U:%G /var/www/html)
    check_result "目录权限正确 (www-data)" "$(echo "$html_owner" | grep -q "www-data" && echo true || echo false)"
fi

# 前端可访问性
frontend_status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001" 2>/dev/null || echo "000")
check_result "前端页面可访问" "$([ "$frontend_status" = "200" ] && echo true || echo false)" true

echo ""

# 6. Nginx服务检查
echo -e "${YELLOW}6. 🌐 Nginx服务检查${NC}"

# Nginx服务状态
check_result "Nginx服务运行" "$(systemctl is-active --quiet nginx && echo true || echo false)" true

# Nginx配置测试
check_result "Nginx配置语法" "$(nginx -t 2>&1 | grep -q "successful" && echo true || echo false)"

# 端口监听检查
check_result "端口3001监听" "$(netstat -tlnp 2>/dev/null | grep -q ":3001" && echo true || echo false)" true
check_result "端口8080监听" "$(netstat -tlnp 2>/dev/null | grep -q ":8080" && echo true || echo false)" true

echo ""

# 7. Ultra Think功能验证
echo -e "${YELLOW}7. 🎯 Ultra Think功能验证${NC}"

# 系统集成验证脚本检查
check_result "集成验证脚本存在" "$([ -f "$PROJECT_ROOT/backend/test_integration.py" ] && echo true || echo false)"

# 新增工具文件检查
check_result "CRUD基类存在" "$([ -f "$PROJECT_ROOT/backend/app/utils/crud_base.py" ] && echo true || echo false)"
check_result "响应工具存在" "$([ -f "$PROJECT_ROOT/backend/app/utils/response.py" ] && echo true || echo false)"
check_result "加密工具存在" "$([ -f "$PROJECT_ROOT/backend/app/utils/encryption.py" ] && echo true || echo false)"
check_result "AI配置模块存在" "$([ -f "$PROJECT_ROOT/backend/app/core/ai_config.py" ] && echo true || echo false)"

# 前端组件检查
check_result "前端Hooks目录存在" "$([ -d "$PROJECT_ROOT/frontend/src/hooks" ] && echo true || echo false)"
check_result "通用组件目录存在" "$([ -d "$PROJECT_ROOT/frontend/src/components/common" ] && echo true || echo false)"

# 文档完整性检查
check_result "API文档存在" "$([ -f "$PROJECT_ROOT/API.md" ] && echo true || echo false)"
check_result "部署文档存在" "$([ -f "$PROJECT_ROOT/DEPLOYMENT.md" ] && echo true || echo false)"
check_result "集成验证报告存在" "$([ -f "$PROJECT_ROOT/INTEGRATION_VALIDATION.md" ] && echo true || echo false)"
check_result "代码清理报告存在" "$([ -f "$PROJECT_ROOT/CODE_CLEANUP_REPORT.md" ] && echo true || echo false)"

echo ""

# 8. 性能基准检查
echo -e "${YELLOW}8. 📊 性能基准检查${NC}"

# 系统资源使用
cpu_usage=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}' | head -1)
if [ -n "$cpu_usage" ]; then
    echo -e "${CYAN}    CPU使用率: ${cpu_usage}%${NC}"
    check_result "CPU使用率正常 (<80%)" "$(echo "$cpu_usage < 80" | bc -l 2>/dev/null | grep -q 1 && echo true || echo false)"
fi

# 内存使用
memory_info=$(free | grep Mem)
memory_used=$(echo $memory_info | awk '{print $3}')
memory_total=$(echo $memory_info | awk '{print $2}')
if [ -n "$memory_used" ] && [ -n "$memory_total" ]; then
    memory_percent=$(echo "scale=1; $memory_used * 100 / $memory_total" | bc -l)
    echo -e "${CYAN}    内存使用率: ${memory_percent}%${NC}"
    check_result "内存使用率正常 (<80%)" "$(echo "$memory_percent < 80" | bc -l 2>/dev/null | grep -q 1 && echo true || echo false)"
fi

# 磁盘使用
disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
echo -e "${CYAN}    磁盘使用率: ${disk_usage}%${NC}"
check_result "磁盘空间充足 (<80%)" "$([ $disk_usage -lt 80 ] && echo true || echo false)"

echo ""

# 9. 最终验证总结
echo -e "${BLUE}🎉 === Ultra Think 部署验证总结 === ${NC}"

# 计算成功率
if [ $TOTAL_CHECKS -gt 0 ]; then
    success_rate=$(echo "scale=1; $PASSED_CHECKS * 100 / $TOTAL_CHECKS" | bc -l)
else
    success_rate="0.0"
fi

echo -e "${CYAN}=== 验证统计 ===${NC}"
echo -e "  📊 总检查项目: $TOTAL_CHECKS"
echo -e "  ✅ 通过项目: $PASSED_CHECKS"
echo -e "  ⚠️ 失败项目: $((TOTAL_CHECKS - PASSED_CHECKS))"
echo -e "  🎯 成功率: ${success_rate}%"

if [ $CRITICAL_FAILURES -gt 0 ]; then
    echo -e "  🚨 关键失败: ${RED}$CRITICAL_FAILURES${NC}"
fi

echo ""
echo -e "${CYAN}=== 系统信息 ===${NC}"
echo -e "  📅 验证时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo -e "  🌍 环境: 生产环境"
echo -e "  🔗 访问地址: ${BLUE}http://45.149.156.216:3001${NC}"
echo -e "  📖 API文档: ${BLUE}http://45.149.156.216:8080/docs${NC}"

echo ""

# 根据结果给出最终评价
if [ $CRITICAL_FAILURES -eq 0 ] && (( $(echo "$success_rate >= 90" | bc -l) )); then
    echo -e "${GREEN}🎉 Ultra Think 部署验证优秀！系统运行状态完美${NC}"
    log_message "INFO" "部署验证优秀 - 成功率 $success_rate%"
elif [ $CRITICAL_FAILURES -eq 0 ] && (( $(echo "$success_rate >= 80" | bc -l) )); then
    echo -e "${YELLOW}👍 Ultra Think 部署验证良好！系统运行正常${NC}"
    log_message "INFO" "部署验证良好 - 成功率 $success_rate%"
else
    echo -e "${RED}⚠️ 发现问题需要关注，建议检查失败项目${NC}"
    log_message "WARN" "部署验证发现问题 - 关键失败 $CRITICAL_FAILURES 个"
fi

echo ""
echo -e "${CYAN}=== 故障排除建议 ===${NC}"
echo "  🔍 后端日志: journalctl -u research-backend -f"
echo "  🌐 Nginx日志: /var/log/nginx/error.log"
echo "  📝 部署日志: $LOG_FILE"
echo "  🚀 重启服务: systemctl restart research-backend"
echo "  🏥 健康检查: $PROJECT_ROOT/deploy-scripts/deploy.sh --health-check"

log_message "INFO" "Ultra Think 部署验证完成"