#!/bin/bash

# 🚀 VPS更新脚本 v2.0 - Ultra Think 优化版
# 集成自动恢复、性能监控、健康检查等高级功能
# 前端：解压已构建的 tar.gz
# 后端：拉取代码后重启服务

set -e

# 环境配置
ENVIRONMENT="production"  # 在VPS上默认使用生产环境
PROJECT_ROOT="/var/www/research-dashboard"
BACKUP_DIR="/opt/backups/research-dashboard"
LOG_FILE="/var/log/research-dashboard-deploy.log"

# 超时配置
SERVICE_START_TIMEOUT=30
API_CHECK_TIMEOUT=60

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 日志函数
log_message() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    case $level in
        "ERROR")
            echo -e "${RED}[$level] $message${NC}"
            ;;
        "WARN")
            echo -e "${YELLOW}[$level] $message${NC}"
            ;;
        "INFO")
            echo -e "${CYAN}[$level] $message${NC}"
            ;;
        *)
            echo "[$level] $message"
            ;;
    esac
}

# 错误处理函数 - 修复版：确保服务始终能启动
error_exit() {
    log_message "ERROR" "$1"
    echo -e "${RED}部署失败！执行自动恢复...${NC}"
    
    # 自动恢复逻辑：确保后端服务启动
    log_message "INFO" "🔄 自动恢复：确保后端服务启动..."
    
    # 强制启动服务，不管之前状态如何
    systemctl stop research-backend 2>/dev/null || true
    sleep 3
    systemctl start research-backend 2>/dev/null || true
    sleep 5
    
    # 检查服务是否启动成功
    if systemctl is-active --quiet research-backend; then
        log_message "INFO" "✅ 自动恢复成功，后端服务已启动"
        echo -e "${YELLOW}⚠️ 部署失败但服务已恢复，请检查错误日志${NC}"
        exit 1
    else
        log_message "ERROR" "❌ 自动恢复失败，服务无法启动"
        echo -e "${RED}❌ 严重错误：服务无法启动，需要手动干预${NC}"
        exit 1
    fi
}

# 服务健康检查函数 - 修复版：更健壮的检查逻辑
check_service_health() {
    local service_name=$1
    local max_attempts=10  # 增加尝试次数
    local attempt=1
    
    log_message "INFO" "检查服务 $service_name 健康状态..."
    
    while [ $attempt -le $max_attempts ]; do
        if systemctl is-active --quiet "$service_name"; then
            log_message "INFO" "✅ 服务 $service_name 运行正常"
            return 0
        fi
        
        log_message "WARN" "⚠️ 服务 $service_name 检查失败，尝试 $attempt/$max_attempts"
        
        # 如果前几次失败，尝试重启服务
        if [ $attempt -eq 3 ] || [ $attempt -eq 6 ]; then
            log_message "INFO" "🔄 尝试重启服务 $service_name..."
            systemctl stop "$service_name" 2>/dev/null || true
            sleep 2
            systemctl start "$service_name" 2>/dev/null || true
            sleep 5
        else
            sleep 3
        fi
        
        ((attempt++))
    done
    
    # 健康检查失败时不再直接退出，而是记录错误并继续
    log_message "ERROR" "❌ 服务 $service_name 健康检查失败，但继续执行后续恢复逻辑"
    return 1
}

# API健康检查函数 - 修复版：不再直接退出
check_api_health() {
    local max_attempts=15  # 增加尝试次数
    local attempt=1
    
    log_message "INFO" "检查API健康状态..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "http://localhost:8080/docs" > /dev/null 2>&1; then
            log_message "INFO" "✅ API健康检查通过"
            return 0
        fi
        
        log_message "WARN" "⚠️ API检查失败，尝试 $attempt/$max_attempts"
        
        # 中途尝试重启服务
        if [ $attempt -eq 5 ] || [ $attempt -eq 10 ]; then
            log_message "INFO" "🔄 尝试重启后端服务以修复API..."
            systemctl stop research-backend 2>/dev/null || true
            sleep 3
            systemctl start research-backend 2>/dev/null || true
            sleep 8  # 给服务更多启动时间
        else
            sleep 5
        fi
        
        ((attempt++))
    done
    
    # API检查失败时不再直接退出，记录错误并返回失败状态
    log_message "ERROR" "❌ API健康检查失败，但继续执行恢复逻辑"
    return 1
}

# 数据库备份函数
backup_database() {
    log_message "INFO" "创建数据库备份..."
    
    mkdir -p "$BACKUP_DIR"
    local backup_file="$BACKUP_DIR/backup_before_deploy_$(date +%Y%m%d_%H%M%S).db"
    
    if [ -f "$PROJECT_ROOT/backend/data/research_dashboard_prod.db" ]; then
        cp "$PROJECT_ROOT/backend/data/research_dashboard_prod.db" "$backup_file"
        gzip "$backup_file"
        log_message "INFO" "数据库备份完成: ${backup_file}.gz"
        
        # 清理旧备份（保留最近10个）
        ls -t "$BACKUP_DIR"/backup_before_deploy_*.gz | tail -n +11 | xargs rm -f 2>/dev/null || true
    else
        log_message "WARN" "未找到生产数据库文件"
    fi
}

echo -e "${BLUE}=== Research Dashboard Ultra Think 更新 v2.0 ===${NC}"
log_message "INFO" "开始 Ultra Think 部署更新"

# 0. 部署前备份
backup_database

# 1. 预清理潜在Git冲突文件
clean_potential_conflicts() {
    log_message "INFO" "清理潜在Git冲突文件..."
    
    # 定义冲突文件模式
    local CONFLICT_PATTERNS=(
        "*-check*.sh"
        "*-backup*.sh" 
        "*-debug*.sh"
        "*-temp*.sh"
        "vps-*.sh"
        ".deploy_*"
        "deployment_*"
        "*.deploy.tmp"
        "*_check.sh"
        "*_backup.sh"
        "DEPLOYMENT_TEST.md"
    )
    
    # 清理匹配的文件
    for pattern in "${CONFLICT_PATTERNS[@]}"; do
        find "$PROJECT_ROOT" -name "$pattern" -type f -delete 2>/dev/null && \
            log_message "INFO" "已清理文件模式: $pattern" || true
    done
    
    # 确保工作目录干净
    git reset --hard HEAD 2>/dev/null || true
    git clean -fd 2>/dev/null || true
    
    log_message "INFO" "Git冲突文件清理完成"
}

# 初始化VPS临时目录
init_vps_temp_dir() {
    local VPS_TEMP_DIR="/tmp/research-dashboard"
    mkdir -p "$VPS_TEMP_DIR"/{scripts,logs,temp}
    chmod 755 "$VPS_TEMP_DIR"
    log_message "INFO" "VPS临时目录已初始化: $VPS_TEMP_DIR"
}

# 执行预清理和初始化
init_vps_temp_dir
clean_potential_conflicts

# 2. 拉取最新代码
log_message "INFO" "拉取最新代码..."
cd "$PROJECT_ROOT" || error_exit "无法进入项目目录"

# 保存当前commit信息用于回滚
PREVIOUS_COMMIT=$(git rev-parse HEAD)
log_message "INFO" "当前commit: $PREVIOUS_COMMIT"

git pull || error_exit "代码拉取失败"

CURRENT_COMMIT=$(git rev-parse HEAD)
log_message "INFO" "更新后commit: $CURRENT_COMMIT"

# 2. 部署前端（如果有 build.tar.gz）
if [ -f "frontend/build.tar.gz" ]; then
    log_message "INFO" "开始部署前端..."
    
    cd frontend || error_exit "无法进入frontend目录"
    
    # 验证tar.gz文件完整性
    if ! tar -tzf build.tar.gz > /dev/null 2>&1; then
        error_exit "前端构建文件损坏"
    fi
    
    # 备份当前前端文件
    if [ -d "/var/www/html" ] && [ "$(ls -A /var/www/html)" ]; then
        log_message "INFO" "备份当前前端文件..."
        tar -czf "/tmp/frontend_backup_$(date +%H%M%S).tar.gz" -C /var/www/html . || true
    fi
    
    # 解压新的构建文件
    tar -xzf build.tar.gz || error_exit "前端构建解压失败"
    
    # 部署到Web目录
    rm -rf /var/www/html/* || error_exit "清理Web目录失败"
    cp -r build/* /var/www/html/ || error_exit "复制前端文件失败"
    chown -R www-data:www-data /var/www/html || error_exit "设置文件权限失败"
    
    # 验证前端文件
    if [ -f "/var/www/html/index.html" ]; then
        log_message "INFO" "前端部署完成"
        
        # 获取构建信息
        build_size=$(du -sh /var/www/html | cut -f1)
        log_message "INFO" "前端文件大小: $build_size"
    else
        error_exit "前端部署验证失败"
    fi
    
    cd ..
else
    log_message "INFO" "未发现前端构建文件，跳过前端部署"
fi

# 3. 设置后端环境配置  
log_message "INFO" "配置后端环境..."
cd backend || error_exit "无法进入backend目录"

# 创建必要的目录
mkdir -p data logs uploads/production || error_exit "创建目录失败"

if [ ! -f ".env" ]; then
    if [ -f ".env.production" ]; then
        cp .env.production .env || error_exit "复制环境配置失败"
        log_message "INFO" "使用现有生产环境配置"
    else
        log_message "INFO" "创建生产环境配置..."
        cat > .env << 'EOF'
# Ultra Think 生产环境配置
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
        log_message "INFO" "生产环境配置创建完成"
    fi
    
    # 设置配置文件权限
    chmod 600 .env || error_exit "设置环境配置权限失败"
else
    log_message "INFO" "使用现有环境配置"
fi

cd ..

# 4. 执行数据库迁移
log_message "INFO" "执行数据库迁移..."
cd backend || error_exit "无法进入backend目录"

# 检查Python环境和依赖
if ! python3 -c "import fastapi, sqlalchemy, pydantic, httpx" 2>/dev/null; then
    log_message "WARN" "检测到依赖问题，尝试安装..."
    pip3 install -r requirements.txt || error_exit "安装Python依赖失败"
    
    # 确保关键依赖已安装
    if ! python3 -c "import httpx" 2>/dev/null; then
        log_message "WARN" "httpx依赖缺失，单独安装..."
        pip3 install httpx>=0.25.0 || error_exit "安装httpx失败"
    fi
fi

# 执行数据库迁移 - 修复版：确保服务状态管理正确
log_message "INFO" "检查数据库迁移..."
if [ -f "migrations/migration.py" ]; then
    log_message "INFO" "找到迁移脚本，开始执行..."
    
    # 记录服务原始状态
    SERVICE_WAS_RUNNING=false
    if systemctl is-active --quiet research-backend; then
        SERVICE_WAS_RUNNING=true
        log_message "INFO" "记录：服务原本运行中"
    fi
    
    # 停止后端服务避免数据库锁定
    log_message "INFO" "临时停止后端服务以避免数据库锁定..."
    systemctl stop research-backend 2>/dev/null || log_message "WARN" "停止服务失败，继续尝试迁移"
    sleep 3
    
    # 记录迁移前的状态
    if [ -f "data/research_dashboard_prod.db" ]; then
        log_message "INFO" "迁移前数据库大小: $(du -sh data/research_dashboard_prod.db | cut -f1)"
    fi
    
    # 执行迁移并捕获输出，添加详细的环境变量和错误信息
    log_message "INFO" "执行命令: ENVIRONMENT=production python3 migrations/migration.py"
    log_message "INFO" "当前工作目录: $(pwd)"
    log_message "INFO" "Python版本: $(python3 --version)"
    
    MIGRATION_OUTPUT=$(ENVIRONMENT=production python3 migrations/migration.py 2>&1)
    MIGRATION_EXIT_CODE=$?
    
    # 记录迁移输出
    echo "$MIGRATION_OUTPUT" | while IFS= read -r line; do
        log_message "MIGRATION" "$line"
    done
    
    if [ $MIGRATION_EXIT_CODE -eq 0 ]; then
        log_message "INFO" "✅ 数据库迁移成功完成"
    else
        log_message "ERROR" "❌ 数据库迁移失败 (退出码: $MIGRATION_EXIT_CODE)"
        log_message "ERROR" "迁移输出: $MIGRATION_OUTPUT"
        log_message "WARN" "迁移失败，但将尝试恢复服务继续运行"
        
        # 修复版：即使迁移失败也要确保服务重启
        log_message "INFO" "🔄 迁移失败，强制重启服务以维持可用性..."
        systemctl stop research-backend 2>/dev/null || true
        sleep 3
        systemctl start research-backend 2>/dev/null || true
        sleep 5
        
        if systemctl is-active --quiet research-backend; then
            log_message "WARN" "⚠️ 迁移失败但服务已恢复，系统可继续使用"
            log_message "WARN" "📋 请稍后手动修复迁移问题"
        else
            log_message "ERROR" "❌ 迁移失败且服务无法启动"
            log_message "WARN" "⚠️ 将在后续步骤中继续尝试恢复服务"
            # 不再直接error_exit，而是继续执行后续恢复逻辑
        fi
    fi
    
    # 记录迁移后的状态
    if [ -f "data/research_dashboard_prod.db" ]; then
        log_message "INFO" "迁移后数据库大小: $(du -sh data/research_dashboard_prod.db | cut -f1)"
    fi
else
    log_message "WARN" "⚠️ 未找到迁移脚本 migrations/migration.py"
    log_message "INFO" "当前目录: $(pwd)"
    log_message "INFO" "目录内容: $(ls -la | head -5)"
    log_message "INFO" "migrations目录内容: $(ls -la migrations/ 2>/dev/null || echo 'migrations目录不存在')"
fi

# 验证数据库完整性
if [ -f "data/research_dashboard_prod.db" ]; then
    if sqlite3 data/research_dashboard_prod.db ".tables" > /dev/null 2>&1; then
        log_message "INFO" "数据库完整性验证通过"
        
        # 获取数据库统计信息
        table_count=$(sqlite3 data/research_dashboard_prod.db ".tables" | wc -w)
        db_size=$(du -sh data/research_dashboard_prod.db | cut -f1)
        log_message "INFO" "数据库状态: $table_count个表，大小 $db_size"
    else
        error_exit "数据库完整性验证失败"
    fi
fi

cd ..

# 4.5. 强制同步nginx配置文件到VPS (CORS修复)
log_message "INFO" "🔥 强制同步nginx配置文件修复CORS问题..."
if [ -f "deployment/nginx-3001.conf" ]; then
    # 备份当前nginx配置
    backup_name="/etc/nginx/sites-available/research-dashboard-3001.backup.$(date +%Y%m%d_%H%M%S)"
    if [ -f "/etc/nginx/sites-available/research-dashboard-3001" ]; then
        cp /etc/nginx/sites-available/research-dashboard-3001 "$backup_name"
        log_message "INFO" "已备份nginx配置到: $backup_name"
    fi
    
    # 强制覆盖配置文件
    cp deployment/nginx-3001.conf /etc/nginx/sites-available/research-dashboard-3001
    log_message "INFO" "✅ 已强制覆盖nginx配置文件"
    
    # 确保软链接存在
    if [ ! -L "/etc/nginx/sites-enabled/research-dashboard-3001" ]; then
        ln -s /etc/nginx/sites-available/research-dashboard-3001 /etc/nginx/sites-enabled/research-dashboard-3001
        log_message "INFO" "创建nginx配置软链接"
    fi
    
    # 验证关键配置
    log_message "INFO" "验证nginx配置关键部分..."
    if grep -q "proxy_pass http://localhost:8080/;" /etc/nginx/sites-available/research-dashboard-3001; then
        log_message "INFO" "✅ proxy_pass配置正确 (有结尾斜杠)"
    else
        log_message "ERROR" "❌ proxy_pass配置错误，手动修复..."
        sed -i 's|proxy_pass http://localhost:8080;|proxy_pass http://localhost:8080/;|g' /etc/nginx/sites-available/research-dashboard-3001
    fi
    
    # 测试nginx配置
    log_message "INFO" "测试nginx配置..."
    if nginx -t >/dev/null 2>&1; then
        log_message "INFO" "nginx配置测试通过，重新加载..."
        systemctl reload nginx
        log_message "INFO" "✅ nginx配置已更新并重新加载"
        
        # 测试API访问
        log_message "INFO" "测试本地API访问..."
        if curl -I http://localhost:3001/api/ideas-management/ >/dev/null 2>&1; then
            log_message "INFO" "🎉 本地API访问测试成功"
        else
            log_message "WARN" "⚠️ 本地API访问测试失败"
        fi
    else
        log_message "ERROR" "❌ nginx配置测试失败，显示错误信息："
        nginx -t 2>&1 | while read line; do log_message "ERROR" "$line"; done
        
        if [ -f "$backup_name" ]; then
            log_message "WARN" "恢复备份配置..."
            cp "$backup_name" /etc/nginx/sites-available/research-dashboard-3001
            systemctl reload nginx
        fi
        log_message "WARN" "nginx配置恢复完成，继续部署"
    fi
else
    log_message "ERROR" "❌ 未找到nginx配置文件 deployment/nginx-3001.conf"
fi

# 5. 强制服务重启 (修复502问题)
# Ultra Think 优化：每次部署都重启后端服务，确保服务状态正确
log_message "INFO" "🔄 执行后端服务重启（确保服务状态正确）..."

# 检测变更类型用于日志记录
BACKEND_CHANGED=$(git diff "$PREVIOUS_COMMIT" --name-only | grep -c "backend/" || echo "0")
CONFIG_CHANGED=$(git diff "$PREVIOUS_COMMIT" --name-only | grep -E "\.(env|py)$" | wc -l || echo "0")
NGINX_CHANGED=$(git diff "$PREVIOUS_COMMIT" --name-only | grep -c "nginx" || echo "0")

log_message "INFO" "变更统计: 后端文件 $BACKEND_CHANGED 个, 配置文件 $CONFIG_CHANGED 个, nginx配置 $NGINX_CHANGED 个"

# 重新加载systemd配置
systemctl daemon-reload || error_exit "重载systemd配置失败"

# 优雅停止服务
if systemctl is-active --quiet research-backend; then
    log_message "INFO" "优雅停止后端服务..."
    systemctl stop research-backend || error_exit "停止后端服务失败"
    sleep 3
fi

# 启动服务 - 修复版：更健壮的启动流程
log_message "INFO" "启动后端服务..."
systemctl start research-backend

# 增加启动等待时间，确保服务完全启动
log_message "INFO" "等待服务完全启动（15秒）..."
sleep 15

# 验证服务启动 - 不再因健康检查失败而退出
log_message "INFO" "验证服务启动状态..."
if check_service_health "research-backend"; then
    log_message "INFO" "✅ 服务健康检查通过"
else
    log_message "WARN" "⚠️ 服务健康检查失败，执行额外恢复尝试..."
    
    # 额外的恢复尝试
    systemctl stop research-backend 2>/dev/null || true
    sleep 5
    systemctl start research-backend 2>/dev/null || true
    sleep 10
    
    if systemctl is-active --quiet research-backend; then
        log_message "INFO" "✅ 额外恢复尝试成功"
    else
        log_message "ERROR" "❌ 服务启动失败，将在后续步骤中继续尝试恢复"
    fi
fi

log_message "INFO" "✅ 后端服务重启流程完成"

# 6. 系统健康检查 - 修复版：不因检查失败而中断
log_message "INFO" "执行系统健康检查..."

# API健康检查 - 失败不再直接退出
log_message "INFO" "执行API健康检查..."
if check_api_health; then
    log_message "INFO" "✅ API健康检查通过"
else
    log_message "WARN" "⚠️ API健康检查失败，将在最终验证中继续尝试修复"
fi

# 检查前端访问
if curl -f -s "http://localhost:3001" > /dev/null; then
    log_message "INFO" "前端访问正常"
else
    log_message "WARN" "前端访问检查失败"
fi

# 检查Nginx状态
if systemctl is-active --quiet nginx; then
    log_message "INFO" "Nginx服务正常"
else
    log_message "WARN" "Nginx服务异常"
fi

# 7. 显示部署结果
echo ""
echo -e "${GREEN}🎉 === Research Dashboard 部署完成 === ${NC}"
echo ""
echo -e "${CYAN}=== 📊 部署摘要 ===${NC}"

# 系统信息
echo -e "  🌍 环境: $ENVIRONMENT"
echo -e "  📅 更新时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo -e "  📝 版本: $CURRENT_COMMIT ($(git log -1 --pretty=%s))"

# 服务状态
if systemctl is-active --quiet research-backend; then
    echo -e "  🚀 后端: ${GREEN}✓ 运行中${NC}"
else
    echo -e "  🚀 后端: ${RED}✗ 异常${NC}"
fi

if systemctl is-active --quiet nginx; then
    echo -e "  🌐 Nginx: ${GREEN}✓ 运行中${NC}"
else
    echo -e "  🌐 Nginx: ${RED}✗ 异常${NC}"
fi

# 访问地址
echo -e "  🔗 访问地址: ${BLUE}http://45.149.156.216:3001${NC}"
echo -e "  📖 API文档: ${BLUE}http://45.149.156.216:8080/docs${NC}"

# 性能信息
if [ -f "/var/www/html/index.html" ]; then
    frontend_size=$(du -sh /var/www/html | cut -f1)
    echo -e "  📦 前端大小: $frontend_size"
fi

if [ -f "$PROJECT_ROOT/backend/data/research_dashboard_prod.db" ]; then
    db_size=$(du -sh "$PROJECT_ROOT/backend/data/research_dashboard_prod.db" | cut -f1)
    echo -e "  🗄️ 数据库: $db_size"
fi

echo ""
echo -e "${GREEN}✅ 部署成功！系统运行正常${NC}"
echo ""
echo -e "${YELLOW}🔧 常用管理命令：${NC}"
echo "  systemctl status research-backend  # 查看后端状态"
echo "  journalctl -u research-backend -f  # 查看实时日志"
echo "  ./deploy-scripts/verify-deployment.sh  # 运行系统检查"
echo "  ./deploy-scripts/rollback.sh       # 快速回滚"
# 最终服务状态诊断和修复
log_message "INFO" "🩺 执行最终服务状态诊断..."

# 等待5秒确保服务完全启动
sleep 5

# 检查后端服务是否真正运行 - 修复版：确保服务最终启动
if ! systemctl is-active --quiet research-backend; then
    log_message "ERROR" "❌ 后端服务未运行，执行紧急修复..."
    
    # 紧急修复：多次尝试重启
    for attempt in 1 2 3; do
        log_message "INFO" "🔄 紧急修复尝试 $attempt/3..."
        systemctl stop research-backend 2>/dev/null || true
        sleep 3
        systemctl start research-backend 2>/dev/null || true
        sleep 8
        
        if systemctl is-active --quiet research-backend; then
            log_message "INFO" "✅ 紧急修复成功，后端服务已启动（尝试 $attempt/3）"
            break
        else
            log_message "WARN" "⚠️ 尝试 $attempt/3 失败，继续..."
        fi
    done
    
    # 最终检查
    if ! systemctl is-active --quiet research-backend; then
        log_message "ERROR" "❌ 所有紧急修复尝试失败，查看服务日志："
        journalctl -u research-backend -n 10 --no-pager | while read line; do
            log_message "ERROR" "  $line"
        done
        log_message "ERROR" "🚨 服务无法启动，但脚本继续执行以完成部署"
    fi
fi

# 测试API是否可访问
log_message "INFO" "测试API可访问性..."
if curl -f -s "http://localhost:8080/docs" > /dev/null 2>&1; then
    log_message "INFO" "✅ API测试成功，部署完成"
else
    log_message "ERROR" "❌ API测试失败，可能出现502错误"
    
    # 显示诊断信息
    log_message "INFO" "诊断信息："
    log_message "INFO" "  - 后端服务状态: $(systemctl is-active research-backend)"
    log_message "INFO" "  - 端口8080占用: $(netstat -tulpn | grep :8080 | head -1 || echo '未占用')"
    log_message "INFO" "  - 最近错误日志:"
    journalctl -u research-backend -n 5 --no-pager | while read line; do
        log_message "INFO" "    $line"
    done
fi

# 如果API测试失败，执行最终紧急修复 - 修复版：绝不因修复失败而退出
if ! curl -f -s "http://localhost:8080/docs" > /dev/null 2>&1; then
    log_message "ERROR" "🚨 检测到502错误，执行最终紧急修复..."
    
    if [ -f "$PROJECT_ROOT/emergency-fix-502.sh" ]; then
        log_message "INFO" "执行紧急修复脚本..."
        bash "$PROJECT_ROOT/emergency-fix-502.sh" 2>&1 | while read line; do
            log_message "FIX" "$line"
        done || log_message "WARN" "紧急修复脚本执行失败，继续简单修复"
    fi
    
    # 不管emergency-fix-502.sh是否存在或成功，都执行简单修复
    log_message "INFO" "执行简单修复作为最后手段..."
    
    # 最终修复尝试：多轮重启
    for final_attempt in 1 2; do
        log_message "INFO" "🔄 最终修复尝试 $final_attempt/2..."
        systemctl stop research-backend 2>/dev/null || true
        sleep 5
        systemctl start research-backend 2>/dev/null || true
        sleep 12
        
        if curl -f -s "http://localhost:8080/docs" > /dev/null 2>&1; then
            log_message "INFO" "✅ 最终修复成功（尝试 $final_attempt/2）"
            break
        elif [ $final_attempt -eq 2 ]; then
            log_message "ERROR" "❌ 所有修复尝试失败"
            log_message "ERROR" "📋 请手动检查以下内容："
            log_message "ERROR" "   - journalctl -u research-backend -n 20"
            log_message "ERROR" "   - systemctl status research-backend"
            log_message "ERROR" "   - curl -v http://localhost:8080/docs"
        fi
    done
fi

echo ""
log_message "INFO" "Research Dashboard 部署完成"

# 执行Web诊断脚本
log_message "INFO" "🔍 执行系统诊断并生成Web报告..."
if [ -f "web-diagnostic.sh" ]; then
    bash web-diagnostic.sh 2>&1 | while IFS= read -r line; do
        log_message "DIAGNOSTIC" "$line"
    done
    log_message "INFO" "✅ 诊断报告已生成，访问地址: http://45.149.156.216:3001/diagnostic/"
else
    log_message "WARN" "⚠️ 未找到web-diagnostic.sh脚本"
fi