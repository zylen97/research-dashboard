#!/bin/bash

# VPS更新脚本 - 在VPS上运行此脚本来更新到最新版本
# 用法: ./vps-update.sh [选项]
# 选项: 
#   --force-build  强制重新构建前端（即使没有检测到更改）

set -e

# 检查参数
FORCE_BUILD=false
if [ "$1" = "--force-build" ]; then
    FORCE_BUILD=true
    echo "强制构建模式已启用"
fi

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
    # 尝试多种方式获取版本号
    CURRENT_VERSION=$(grep -o "Research Dashboard v[0-9]\.[0-9]" $WEB_DIR/static/js/main.*.js 2>/dev/null | head -1 || echo "")
    if [ -z "$CURRENT_VERSION" ]; then
        # 尝试更宽泛的匹配
        CURRENT_VERSION=$(grep -o "v[0-9]\.[0-9]" $WEB_DIR/static/js/main.*.js 2>/dev/null | head -1 || echo "版本未知")
    fi
    echo "网站版本: $CURRENT_VERSION"
    
    # 显示文件信息用于调试
    if [ -f "$WEB_DIR/static/js/main."*.js ]; then
        JS_FILE=$(ls -1 $WEB_DIR/static/js/main.*.js | head -1)
        echo "JS文件: $(basename $JS_FILE)"
        echo "文件大小: $(ls -lh $JS_FILE | awk '{print $5}')"
        echo "修改时间: $(stat -c %y $JS_FILE | cut -d' ' -f1-2)"
    fi
else
    echo -e "${RED}警告：网站目录不存在或为空${NC}"
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
if [ "$CURRENT_COMMIT" = "$NEW_COMMIT" ] && [ "$FORCE_BUILD" = false ]; then
    echo -e "${YELLOW}已经是最新版本，无需更新${NC}"
    echo "提示：使用 ./vps-update.sh --force-build 强制重新构建"
    exit 0
fi

# 检查前端是否有更改
FRONTEND_CHANGED=$(git diff $CURRENT_COMMIT..$NEW_COMMIT --name-only | grep -c "frontend/" || echo "0")

if [ "$FRONTEND_CHANGED" -gt 0 ] || [ "$FORCE_BUILD" = true ]; then
    if [ "$FORCE_BUILD" = true ]; then
        echo -e "${YELLOW}强制构建前端...${NC}"
    else
        echo -e "${YELLOW}检测到前端更改，开始构建...${NC}"
    fi
    
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
    
    # 清理旧的构建和缓存
    echo "清理旧构建..."
    rm -rf build
    rm -rf node_modules/.cache
    
    # 设置Node内存限制（防止VPS内存不足）
    export NODE_OPTIONS="--max-old-space-size=1024"
    echo "设置Node内存限制: $NODE_OPTIONS"
    
    # 安装依赖（如果package.json有更新或node_modules不存在）
    if [ ! -d "node_modules" ] || git diff $CURRENT_COMMIT..$NEW_COMMIT --name-only | grep -q "frontend/package.json"; then
        echo "安装依赖..."
        # 先尝试 npm ci，失败则用 npm install
        npm ci || npm install
        if [ $? -ne 0 ]; then
            echo -e "${RED}依赖安装失败！${NC}"
            exit 1
        fi
    fi
    
    # 构建
    echo "开始构建..."
    npm run build
    
    if [ ! -d "build" ]; then
        echo -e "${RED}构建失败！${NC}"
        echo "尝试清理并重新构建..."
        rm -rf node_modules
        npm install
        npm run build
        
        if [ ! -d "build" ]; then
            echo -e "${RED}重试后仍然构建失败！${NC}"
            exit 1
        fi
    fi
    
    # 验证构建版本
    BUILD_VERSION=$(grep -o "Research Dashboard v[0-9]\.[0-9]" build/static/js/main.*.js 2>/dev/null | head -1 || echo "")
    if [ -z "$BUILD_VERSION" ]; then
        echo -e "${RED}警告：无法在构建文件中找到版本信息${NC}"
    else
        echo -e "${GREEN}构建版本: $BUILD_VERSION${NC}"
    fi
    
    # 8. 部署新版本（蓝绿部署）
    echo -e "${YELLOW}部署新版本...${NC}"
    
    # 确保构建目录存在并包含文件
    if [ ! -d "build" ] || [ -z "$(ls -A build)" ]; then
        echo -e "${RED}错误：构建目录为空或不存在${NC}"
        exit 1
    fi
    
    # 显示构建文件信息
    echo "构建目录内容："
    ls -la build/
    echo ""
    
    # 准备新版本目录
    echo "准备新版本..."
    rm -rf $WEB_DIR.new
    cp -r build $WEB_DIR.new
    
    # 验证复制是否成功
    if [ ! -d "$WEB_DIR.new" ] || [ -z "$(ls -A $WEB_DIR.new)" ]; then
        echo -e "${RED}错误：复制构建文件失败${NC}"
        exit 1
    fi
    
    # 快速切换
    echo "切换到新版本..."
    if [ -d "$WEB_DIR" ]; then
        rm -rf $WEB_DIR.old
        mv $WEB_DIR $WEB_DIR.old
    fi
    mv $WEB_DIR.new $WEB_DIR
    
    # 设置权限
    echo "设置文件权限..."
    chown -R www-data:www-data $WEB_DIR
    chmod -R 755 $WEB_DIR
    
    # 清理旧版本
    rm -rf $WEB_DIR.old
    
    # 验证部署
    DEPLOYED_VERSION=$(grep -o "Research Dashboard v[0-9]\.[0-9]" $WEB_DIR/static/js/main.*.js 2>/dev/null | head -1 || echo "")
    if [ -n "$DEPLOYED_VERSION" ]; then
        echo -e "${GREEN}✅ 成功部署: $DEPLOYED_VERSION${NC}"
    else
        echo -e "${YELLOW}警告：无法验证部署版本${NC}"
    fi
    
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