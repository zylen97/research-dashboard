#!/bin/bash

# 部署脚本 - 构建并部署到VPS
# 使用方法: 
#   ./deploy.sh          # 构建并部署
#   ./deploy.sh build    # 仅构建，不推送

set -e

# 获取参数
MODE=${1:-deploy}  # 默认是部署模式

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# 检查模式
if [ "$MODE" = "build" ]; then
    echo -e "${BLUE}=== 仅构建模式 ===${NC}"
else
    echo -e "${BLUE}=== 构建并部署模式 ===${NC}"
fi

# 1. 构建前端
echo -e "${YELLOW}步骤 1: 构建前端...${NC}"

cd frontend

# 设置生产环境配置
echo "使用生产环境配置..."
rm -f .env.production.local 2>/dev/null || true

# 构建
echo -e "${YELLOW}执行构建...${NC}"
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

cd ..

# 如果是仅构建模式，到此结束
if [ "$MODE" = "build" ]; then
    echo ""
    echo -e "${GREEN}✅ 构建完成！${NC}"
    echo -e "${YELLOW}提示：如需部署，运行 ./deploy.sh${NC}"
    exit 0
fi

# 2. 提交代码
echo ""
echo -e "${YELLOW}步骤 2: 提交代码...${NC}"
git add -A

# 生成提交信息
COMMIT_MSG="build: Deploy frontend"
if [ -n "$VERSION" ]; then
    COMMIT_MSG="build: Deploy frontend $VERSION"
fi
COMMIT_MSG="$COMMIT_MSG - $(date +%Y-%m-%d_%H:%M)"

git commit -m "$COMMIT_MSG" || {
    echo -e "${YELLOW}没有新的改动需要提交${NC}"
}

# 3. 推送到GitHub
echo ""
echo -e "${YELLOW}步骤 3: 推送到 GitHub...${NC}"
git push

# 4. 完成提示
echo ""
echo -e "${GREEN}✅ 部署已触发！${NC}"
echo ""
echo "📋 后续步骤："
echo "1. 等待 1-2 分钟自动部署完成"
echo "2. 访问 http://45.149.156.216:3001 查看结果"
echo "3. 查看部署状态：GitHub Actions 页面"
echo ""
echo -e "${GREEN}部署时间: $(date)${NC}"