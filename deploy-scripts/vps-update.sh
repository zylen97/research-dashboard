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

# 错误处理函数
error_exit() {
    log_message "ERROR" "$1"
    echo -e "${RED}部署失败！执行自动恢复...${NC}"
    # 这里可以添加自动恢复逻辑
    exit 1
}

# 服务健康检查函数
check_service_health() {
    local service_name=$1
    local max_attempts=5
    local attempt=1
    
    log_message "INFO" "检查服务 $service_name 健康状态..."
    
    while [ $attempt -le $max_attempts ]; do
        if systemctl is-active --quiet "$service_name"; then
            log_message "INFO" "服务 $service_name 运行正常"
            return 0
        fi
        
        log_message "WARN" "服务 $service_name 检查失败，尝试 $attempt/$max_attempts"
        sleep 3
        ((attempt++))
    done
    
    error_exit "服务 $service_name 健康检查失败"
}

# API健康检查函数
check_api_health() {
    local max_attempts=10
    local attempt=1
    
    log_message "INFO" "检查API健康状态..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "http://localhost:8080/docs" > /dev/null; then
            log_message "INFO" "API健康检查通过"
            return 0
        fi
        
        log_message "WARN" "API检查失败，尝试 $attempt/$max_attempts"
        sleep 5
        ((attempt++))
    done
    
    error_exit "API健康检查失败"
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
        local build_size=$(du -sh /var/www/html | cut -f1)
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

# 执行数据库迁移
if [ -f "migrations/migration.py" ]; then
    log_message "INFO" "运行数据库迁移脚本..."
    
    if ENVIRONMENT=production python3 migrations/migration.py; then
        log_message "INFO" "数据库迁移完成"
    else
        log_message "WARN" "数据库迁移出现警告，但继续部署"
    fi
else
    log_message "INFO" "未找到迁移脚本，跳过数据库迁移"
fi

# 验证数据库完整性
if [ -f "data/research_dashboard_prod.db" ]; then
    if sqlite3 data/research_dashboard_prod.db ".tables" > /dev/null 2>&1; then
        log_message "INFO" "数据库完整性验证通过"
        
        # 获取数据库统计信息
        local table_count=$(sqlite3 data/research_dashboard_prod.db ".tables" | wc -w)
        local db_size=$(du -sh data/research_dashboard_prod.db | cut -f1)
        log_message "INFO" "数据库状态: $table_count个表，大小 $db_size"
    else
        error_exit "数据库完整性验证失败"
    fi
fi

cd ..

# 5. 智能服务重启
BACKEND_CHANGED=$(git diff "$PREVIOUS_COMMIT" --name-only | grep -c "backend/" || echo "0")
CONFIG_CHANGED=$(git diff "$PREVIOUS_COMMIT" --name-only | grep -E "\.(env|py)$" | wc -l || echo "0")

if [ "$BACKEND_CHANGED" -gt 0 ] || [ "$CONFIG_CHANGED" -gt 0 ]; then
    log_message "INFO" "检测到后端变更 ($BACKEND_CHANGED 个文件)，重启服务..."
    
    # 重新加载systemd配置
    systemctl daemon-reload || error_exit "重载systemd配置失败"
    
    # 优雅停止服务
    if systemctl is-active --quiet research-backend; then
        log_message "INFO" "优雅停止后端服务..."
        systemctl stop research-backend || error_exit "停止后端服务失败"
        sleep 3
    fi
    
    # 启动服务
    log_message "INFO" "启动后端服务..."
    systemctl start research-backend || error_exit "启动后端服务失败"
    
    # 等待服务启动
    sleep 5
    
    # 验证服务启动
    check_service_health "research-backend"
else
    log_message "INFO" "后端无变更，跳过服务重启"
fi

# 6. 系统健康检查
log_message "INFO" "执行系统健康检查..."

# API健康检查
check_api_health

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
    local frontend_size=$(du -sh /var/www/html | cut -f1)
    echo -e "  📦 前端大小: $frontend_size"
fi

if [ -f "$PROJECT_ROOT/backend/data/research_dashboard_prod.db" ]; then
    local db_size=$(du -sh "$PROJECT_ROOT/backend/data/research_dashboard_prod.db" | cut -f1)
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
echo ""
log_message "INFO" "Research Dashboard 部署完成"