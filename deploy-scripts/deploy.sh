#!/bin/bash

# 本地部署脚本 - 极简版
# 功能：构建前端（如需要）、提交代码、触发GitHub Actions

set -e

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 错误处理
error_exit() {
    echo -e "${RED}[错误] $1${NC}"
    exit 1
}

# 解析参数
BUILD_FRONTEND=false
SKIP_CONFIRM=false
HELP=false

for arg in "$@"; do
    case $arg in
        --frontend)
            BUILD_FRONTEND=true
            ;;
        --force)
            SKIP_CONFIRM=true
            ;;
        --help)
            HELP=true
            ;;
    esac
done

# 显示帮助
if [ "$HELP" = true ]; then
    echo -e "${CYAN}=== Research Dashboard 部署脚本 ===${NC}"
    echo ""
    echo "用法: ./deploy.sh [选项]"
    echo ""
    echo "选项:"
    echo "  --frontend   强制构建前端"
    echo "  --force      跳过确认提示"
    echo "  --help       显示此帮助信息"
    echo ""
    echo "默认行为:"
    echo "  - 自动检测前端修改并构建"
    echo "  - 提交所有修改并推送到GitHub"
    echo "  - GitHub Actions自动部署到VPS"
    exit 0
fi

echo -e "${GREEN}=== Research Dashboard 部署 ===${NC}"

# 1. 检查Git状态
if ! git diff-index --quiet HEAD --; then
    echo -e "${CYAN}检测到以下修改：${NC}"
    git status --short
else
    echo -e "${YELLOW}没有检测到修改${NC}"
    exit 0
fi

# 2. 自动检测是否需要构建前端
if [ "$BUILD_FRONTEND" = false ]; then
    if git diff --name-only | grep -q "frontend/"; then
        BUILD_FRONTEND=true
        echo -e "${CYAN}检测到前端修改，将自动构建${NC}"
    fi
fi

# 3. 构建前端（如果需要）
if [ "$BUILD_FRONTEND" = true ]; then
    echo -e "${CYAN}构建前端...${NC}"
    cd frontend
    
    # 检查依赖
    if [ ! -d "node_modules" ]; then
        echo "安装前端依赖..."
        npm install || error_exit "依赖安装失败"
    fi
    
    # 构建
    npm run build || error_exit "前端构建失败"
    
    # 打包
    tar -czf build.tar.gz -C build . || error_exit "前端打包失败"
    echo -e "${GREEN}✅ 前端构建完成: $(ls -lh build.tar.gz | awk '{print $5}')${NC}"
    
    cd ..
else
    echo -e "${CYAN}跳过前端构建${NC}"
fi

# 4. 确认部署
if [ "$SKIP_CONFIRM" = false ]; then
    echo ""
    echo -e "${YELLOW}准备提交并部署到生产环境${NC}"
    echo -e "目标: ${CYAN}http://45.149.156.216:3001${NC}"
    read -p "确认部署? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "已取消部署"
        exit 0
    fi
fi

# 5. 提交并推送
echo -e "${CYAN}提交代码...${NC}"
git add .
git commit -m "Manual deployment - $(date '+%Y-%m-%d_%H:%M')" || error_exit "提交失败"

echo -e "${CYAN}推送到GitHub...${NC}"
git push || error_exit "推送失败"

# 6. 显示结果
echo ""
echo -e "${GREEN}✅ 部署已触发！${NC}"
echo ""
echo -e "📊 部署信息："
echo -e "  查看进度: ${CYAN}https://github.com/zylen97/research-dashboard/actions${NC}"
echo -e "  目标地址: ${CYAN}http://45.149.156.216:3001${NC}"
echo -e "  API文档: ${CYAN}http://45.149.156.216:8080/docs${NC}"
echo ""
echo -e "${YELLOW}提示: GitHub Actions将在1-2分钟内完成部署${NC}"