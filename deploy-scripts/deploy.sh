#!/bin/bash

# 智能部署脚本 - 自动检测修改并选择部署策略
# 使用方法: 
#   ./deploy.sh              # 自动检测并执行
#   ./deploy.sh --frontend   # 强制构建前端
#   ./deploy.sh --backend    # 仅推送，不构建
#   ./deploy.sh --all        # 构建并推送所有
#   ./deploy.sh --dry-run    # 预览模式
#   ./deploy.sh build        # 仅构建（兼容旧版）

set -e

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 切换到项目根目录
cd "$PROJECT_ROOT"

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

# 解析参数
MODE="auto"
DRY_RUN=false
FORCE_BUILD=false

for arg in "$@"; do
    case $arg in
        --frontend)
            MODE="frontend"
            FORCE_BUILD=true
            ;;
        --backend)
            MODE="backend"
            FORCE_BUILD=false
            ;;
        --all)
            MODE="all"
            FORCE_BUILD=true
            ;;
        --dry-run)
            DRY_RUN=true
            ;;
        build)
            MODE="build-only"
            FORCE_BUILD=true
            ;;
        *)
            echo -e "${RED}未知参数: $arg${NC}"
            echo "使用方法: ./deploy.sh [--frontend|--backend|--all|--dry-run|build]"
            exit 1
            ;;
    esac
done

# 显示模式
echo -e "${BLUE}=== Research Dashboard 智能部署脚本 ===${NC}"
echo -e "${CYAN}模式: $MODE${NC}"
if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}🔍 预览模式 - 不会执行实际操作${NC}"
fi
echo ""

# 检测文件修改函数
detect_changes() {
    echo -e "${YELLOW}🔍 检测文件修改...${NC}"
    
    # 获取所有修改的文件（包括未暂存和已暂存的）
    CHANGED_FILES=$(git status --porcelain | awk '{print $2}')
    
    # 初始化计数器
    FRONTEND_COUNT=0
    BACKEND_COUNT=0
    OTHER_COUNT=0
    
    # 分类文件
    for file in $CHANGED_FILES; do
        if [[ $file == frontend/* ]] && [[ $file != frontend/build.tar.gz ]]; then
            ((FRONTEND_COUNT++))
            FRONTEND_CHANGED=true
        elif [[ $file == backend/* ]]; then
            ((BACKEND_COUNT++))
            BACKEND_CHANGED=true
        else
            ((OTHER_COUNT++))
            OTHER_CHANGED=true
        fi
    done
    
    # 显示检测结果
    echo -e "${CYAN}检测结果：${NC}"
    echo -e "  前端文件: ${FRONTEND_COUNT}个"
    echo -e "  后端文件: ${BACKEND_COUNT}个"
    echo -e "  其他文件: ${OTHER_COUNT}个"
    echo ""
}

# 生成智能提交信息
generate_commit_message() {
    local prefix=""
    local scope=""
    local description=""
    
    # 根据修改内容确定前缀和范围
    if [ "$FRONTEND_CHANGED" = true ] && [ "$BACKEND_CHANGED" = true ]; then
        prefix="feat"
        scope=""
        description="Update frontend and backend"
    elif [ "$FRONTEND_CHANGED" = true ]; then
        prefix="feat"
        scope="frontend"
        description="Update frontend"
    elif [ "$BACKEND_CHANGED" = true ]; then
        prefix="feat"
        scope="backend"
        description="Update backend"
    else
        # 检查是否是文档更新
        if git status --porcelain | grep -E "\.md$" > /dev/null; then
            prefix="docs"
            description="Update documentation"
        else
            prefix="chore"
            description="Update configuration"
        fi
    fi
    
    # 添加版本信息（如果有）
    if [ -n "$VERSION" ]; then
        description="$description $VERSION"
    fi
    
    # 构建完整的提交信息
    if [ -n "$scope" ]; then
        COMMIT_MSG="$prefix($scope): $description"
    else
        COMMIT_MSG="$prefix: $description"
    fi
    
    # 添加时间戳
    COMMIT_MSG="$COMMIT_MSG - $(date +%Y-%m-%d_%H:%M)"
    
    echo -e "${CYAN}提交信息: $COMMIT_MSG${NC}"
}

# 构建前端函数
build_frontend() {
    echo -e "${YELLOW}📦 构建前端...${NC}"
    
    cd frontend
    
    # 设置生产环境配置
    echo "使用生产环境配置..."
    rm -f .env.production.local 2>/dev/null || true
    
    # 构建
    echo -e "${YELLOW}执行构建...${NC}"
    if [ "$DRY_RUN" = false ]; then
        npm run build
        
        if [ ! -d "build" ]; then
            echo -e "${RED}构建失败！${NC}"
            exit 1
        fi
        
        # 删除旧的打包文件
        rm -f build.tar.gz
        
        # 创建新的打包文件
        echo -e "${YELLOW}打包构建文件...${NC}"
        tar -czf build.tar.gz build/
        
        # 验证打包
        if [ -f "build.tar.gz" ]; then
            SIZE=$(ls -lh build.tar.gz | awk '{print $5}')
            echo -e "${GREEN}✅ 打包成功！文件大小: $SIZE${NC}"
            
            # 尝试获取版本信息
            VERSION=$(grep -o "v[0-9]\.[0-9]" build/static/js/main.*.js 2>/dev/null | head -1 || echo "")
            if [ -n "$VERSION" ]; then
                echo -e "${GREEN}构建版本: $VERSION${NC}"
            fi
        else
            echo -e "${RED}打包失败！${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}[预览] 将执行: npm run build${NC}"
        echo -e "${YELLOW}[预览] 将创建: build.tar.gz${NC}"
    fi
    
    cd ..
}

# 主逻辑
if [ "$MODE" = "auto" ]; then
    # 自动检测模式
    FRONTEND_CHANGED=false
    BACKEND_CHANGED=false
    OTHER_CHANGED=false
    
    detect_changes
    
    # 根据检测结果决定是否构建
    if [ "$FRONTEND_CHANGED" = true ]; then
        NEED_BUILD=true
        echo -e "${CYAN}决策: 检测到前端修改，需要构建${NC}"
    else
        NEED_BUILD=false
        echo -e "${CYAN}决策: 未检测到前端修改，跳过构建${NC}"
    fi
elif [ "$MODE" = "frontend" ] || [ "$MODE" = "all" ] || [ "$MODE" = "build-only" ]; then
    NEED_BUILD=true
    FRONTEND_CHANGED=true
    BACKEND_CHANGED=false
    echo -e "${CYAN}决策: 强制构建前端${NC}"
elif [ "$MODE" = "backend" ]; then
    NEED_BUILD=false
    FRONTEND_CHANGED=false
    BACKEND_CHANGED=true
    echo -e "${CYAN}决策: 仅推送后端代码${NC}"
fi

echo ""

# 执行构建（如果需要）
if [ "$NEED_BUILD" = true ]; then
    build_frontend
else
    echo -e "${YELLOW}跳过前端构建${NC}"
fi

# 如果是仅构建模式，到此结束
if [ "$MODE" = "build-only" ]; then
    echo ""
    echo -e "${GREEN}✅ 构建完成！${NC}"
    echo -e "${YELLOW}提示：如需部署，运行 ./deploy.sh${NC}"
    exit 0
fi

# 提交和推送
echo ""
echo -e "${YELLOW}📤 提交和推送代码...${NC}"

# 如果是预览模式，只显示将要执行的操作
if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}[预览] 将执行以下操作：${NC}"
    echo "1. git add -A"
    
    # 生成提交信息预览
    if [ "$MODE" = "auto" ]; then
        generate_commit_message
    else
        COMMIT_MSG="Manual deployment - $(date +%Y-%m-%d_%H:%M)"
    fi
    
    echo "2. git commit -m \"$COMMIT_MSG\""
    echo "3. git push"
    echo ""
    echo -e "${GREEN}✅ 预览完成！使用不带 --dry-run 参数来执行实际部署${NC}"
    exit 0
fi

# 实际执行提交
git add -A

# 生成智能提交信息
if [ "$MODE" = "auto" ]; then
    generate_commit_message
else
    # 手动模式使用简单的提交信息
    COMMIT_MSG="Manual deployment - $(date +%Y-%m-%d_%H:%M)"
fi

# 提交
git commit -m "$COMMIT_MSG" || {
    echo -e "${YELLOW}没有新的改动需要提交${NC}"
    echo -e "${YELLOW}如果您想强制部署，请使用 --all 参数${NC}"
    exit 0
}

# 推送到GitHub
echo ""
echo -e "${YELLOW}📡 推送到 GitHub...${NC}"
git push

# 完成提示
echo ""
echo -e "${GREEN}✅ 部署已触发！${NC}"
echo ""
echo "📋 后续步骤："
echo "1. 等待 1-2 分钟自动部署完成"
echo "2. 访问 http://45.149.156.216:3001 查看结果"
echo "3. 查看部署状态：GitHub Actions 页面"
echo ""

# 显示部署摘要
echo -e "${BLUE}📊 部署摘要：${NC}"
if [ "$NEED_BUILD" = true ]; then
    echo "  - 前端：已构建并打包"
else
    echo "  - 前端：未修改，跳过构建"
fi

if [ "$BACKEND_CHANGED" = true ]; then
    echo "  - 后端：已推送，将在VPS上重启"
else
    echo "  - 后端：未修改"
fi

echo ""
echo -e "${GREEN}部署时间: $(date)${NC}"