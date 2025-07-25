#!/bin/bash

# VPS部署脚本 - 极简版
# 功能：拉代码、部署前端、执行迁移、重启后端

set -e  # 遇到错误立即退出

# 基础配置
PROJECT_ROOT="/var/www/research-dashboard"
LOG_FILE="/var/log/research-dashboard-deploy.log"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# 错误退出函数
error_exit() {
    echo -e "${RED}[错误] $1${NC}" | tee -a "$LOG_FILE"
    exit 1
}

# 开始部署
echo -e "${GREEN}=== Research Dashboard VPS部署 ===${NC}"
log "开始部署..."

# 1. 切换到项目目录
cd "$PROJECT_ROOT" || error_exit "无法进入项目目录"

# 2. 拉取最新代码
log "拉取最新代码..."
git pull || error_exit "代码拉取失败"

# 3. 部署前端（如果有build.tar.gz）
if [ -f "frontend/build.tar.gz" ]; then
    log "发现前端构建文件，开始部署前端..."
    cd frontend
    
    # 创建临时目录用于解压
    rm -rf build_temp
    mkdir build_temp
    cd build_temp
    
    # 解压构建文件到临时目录
    tar -xzf ../build.tar.gz || error_exit "前端构建文件解压失败"
    
    # 清理并部署到Web目录
    rm -rf /var/www/html/*
    cp -r * /var/www/html/ || error_exit "前端文件复制失败"
    
    # 返回上级目录并清理临时目录
    cd ..
    rm -rf build_temp
    chown -R www-data:www-data /var/www/html
    
    log "前端部署完成"
    cd ..
else
    log "未发现前端构建文件，跳过前端部署"
fi

# 4. 处理后端
cd backend || error_exit "无法进入backend目录"

# 4.1 确保环境文件存在
if [ ! -f ".env" ]; then
    if [ -f ".env.production" ]; then
        cp .env.production .env
        log "使用生产环境配置文件"
    else
        error_exit "未找到环境配置文件"
    fi
fi

# 4.2 执行数据库迁移（如果有）
if [ -f "migrations/migration.py" ]; then
    log "执行数据库迁移..."
    
    # 停止服务避免数据库锁定
    systemctl stop research-backend 2>/dev/null || true
    sleep 2
    
    # 执行迁移
    ENVIRONMENT=production python3 migrations/migration.py 2>&1 | tee -a "$LOG_FILE" || {
        log "迁移失败，但继续部署"
    }
fi

# 5. 重启后端服务
log "重启后端服务..."
systemctl daemon-reload
systemctl restart research-backend || error_exit "服务重启失败"

# 6. 等待服务启动
log "等待服务启动..."
sleep 10

# 7. 检查服务状态
if systemctl is-active --quiet research-backend; then
    log "✅ 服务启动成功"
    
    # 简单的健康检查
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health | grep -q "200"; then
        log "✅ API健康检查通过"
    else
        log "⚠️  API健康检查失败，但服务已启动"
    fi
else
    error_exit "服务启动失败，查看日志: journalctl -u research-backend -n 50"
fi

# 8. 显示部署结果
echo ""
echo -e "${GREEN}=== 部署完成 ===${NC}"
echo -e "访问地址: ${GREEN}http://45.149.156.216:3001${NC}"
echo -e "API文档: ${GREEN}http://45.149.156.216:8080/docs${NC}"
echo ""
echo "查看日志: journalctl -u research-backend -f"
echo "查看状态: systemctl status research-backend"

log "部署完成"