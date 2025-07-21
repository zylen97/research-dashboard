#!/bin/bash

# VPS更新脚本 - 在VPS上运行此脚本来更新到最新版本
# 用法: ./vps-update.sh

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
PROJECT_DIR="/var/www/research-dashboard"
WEB_DIR="/var/www/html"
BACKUP_DIR="/var/www/backup"

echo -e "${BLUE}=== Research Dashboard VPS更新脚本 ===${NC}"
echo -e "${YELLOW}开始时间: $(date)${NC}"
echo ""

# 1. 检查当前位置
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}错误：项目目录不存在: $PROJECT_DIR${NC}"
    exit 1
fi

cd $PROJECT_DIR

# 2. 显示当前版本
echo -e "${YELLOW}当前版本信息：${NC}"
CURRENT_COMMIT=$(git rev-parse --short HEAD)
echo "Git提交: $CURRENT_COMMIT"
if [ -f "$WEB_DIR/index.html" ]; then
    CURRENT_VERSION=$(grep -o "Research Dashboard v[0-9]\.[0-9]" $WEB_DIR/static/js/main.*.js 2>/dev/null | head -1 || echo "版本未知")
    echo "网站版本: $CURRENT_VERSION"
fi
echo ""

# 3. 拉取最新代码
echo -e "${YELLOW}正在拉取最新代码...${NC}"
git fetch --all
git reset --hard origin/main
git clean -fd

# 4. 显示新版本
NEW_COMMIT=$(git rev-parse --short HEAD)
echo -e "${GREEN}更新到提交: $NEW_COMMIT${NC}"
git log --oneline -1
echo ""

# 5. 检查是否需要更新前端
if [ "$CURRENT_COMMIT" = "$NEW_COMMIT" ]; then
    echo -e "${YELLOW}已经是最新版本，无需更新${NC}"
    exit 0
fi

# 检查前端是否有更改
FRONTEND_CHANGED=$(git diff $CURRENT_COMMIT..$NEW_COMMIT --name-only | grep -c "frontend/" || echo "0")

if [ "$FRONTEND_CHANGED" -gt 0 ]; then
    echo -e "${YELLOW}检测到前端更改，开始构建...${NC}"
    
    # 6. 备份当前版本
    echo -e "${BLUE}备份当前版本...${NC}"
    mkdir -p $BACKUP_DIR
    if [ -d "$WEB_DIR" ]; then
        BACKUP_NAME="backup_$(date +%Y%m%d_%H%M%S)"
        cp -r $WEB_DIR $BACKUP_DIR/$BACKUP_NAME
        echo "备份保存到: $BACKUP_DIR/$BACKUP_NAME"
    fi
    
    # 7. 构建前端
    echo -e "${YELLOW}构建前端应用...${NC}"
    cd frontend
    
    # 安装依赖（如果package.json有更新）
    if git diff $CURRENT_COMMIT..$NEW_COMMIT --name-only | grep -q "frontend/package.json"; then
        echo "检测到package.json更改，安装依赖..."
        npm ci
    fi
    
    # 构建
    npm run build
    
    if [ ! -d "build" ]; then
        echo -e "${RED}构建失败！${NC}"
        exit 1
    fi
    
    # 8. 部署新版本（蓝绿部署）
    echo -e "${YELLOW}部署新版本...${NC}"
    
    # 准备新版本目录
    rm -rf $WEB_DIR.new
    cp -r build $WEB_DIR.new
    
    # 快速切换
    if [ -d "$WEB_DIR" ]; then
        mv $WEB_DIR $WEB_DIR.old
    fi
    mv $WEB_DIR.new $WEB_DIR
    
    # 设置权限
    chown -R www-data:www-data $WEB_DIR
    
    # 清理旧版本
    rm -rf $WEB_DIR.old
    
    cd ..
    
    echo -e "${GREEN}✅ 前端部署完成${NC}"
else
    echo -e "${YELLOW}前端无更改，跳过构建${NC}"
fi

# 9. 检查后端是否需要重启
BACKEND_CHANGED=$(git diff $CURRENT_COMMIT..$NEW_COMMIT --name-only | grep -c "backend/" || echo "0")

if [ "$BACKEND_CHANGED" -gt 0 ]; then
    echo -e "${YELLOW}检测到后端更改，重启服务...${NC}"
    
    # 备份数据库
    if [ -f "backend/research_dashboard.db" ]; then
        cp backend/research_dashboard.db backend/research_dashboard.db.backup_$(date +%Y%m%d_%H%M%S)
        echo "数据库已备份"
    fi
    
    # 重启服务
    systemctl restart research-backend
    sleep 3
    
    echo -e "${GREEN}✅ 后端服务已重启${NC}"
else
    echo -e "${YELLOW}后端无更改${NC}"
fi

# 10. 重新加载Nginx
echo -e "${YELLOW}重新加载Nginx...${NC}"
nginx -t && systemctl reload nginx

# 11. 显示最终状态
echo ""
echo -e "${BLUE}=== 更新完成 ===${NC}"
echo -e "完成时间: $(date)"
echo ""

# 检查服务状态
echo -e "${YELLOW}服务状态：${NC}"
systemctl is-active --quiet research-backend && echo -e "后端: ${GREEN}✓ 运行中${NC}" || echo -e "后端: ${RED}✗ 未运行${NC}"
systemctl is-active --quiet nginx && echo -e "Nginx: ${GREEN}✓ 运行中${NC}" || echo -e "Nginx: ${RED}✗ 未运行${NC}"

# 显示新版本
if [ -f "$WEB_DIR/index.html" ]; then
    NEW_VERSION=$(grep -o "Research Dashboard v[0-9]\.[0-9]" $WEB_DIR/static/js/main.*.js 2>/dev/null | head -1 || echo "版本未知")
    echo ""
    echo -e "${GREEN}当前网站版本: $NEW_VERSION${NC}"
fi

echo ""
echo -e "${BLUE}访问地址: http://45.149.156.216:3001${NC}"

# 12. 清理旧备份（保留最近5个）
echo ""
echo -e "${YELLOW}清理旧备份...${NC}"
cd $BACKUP_DIR 2>/dev/null && ls -t | tail -n +6 | xargs -r rm -rf
echo "备份清理完成"