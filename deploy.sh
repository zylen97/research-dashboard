#!/bin/bash

# 一键部署脚本 - 构建、打包、推送

set -e

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}=== 一键部署脚本 ===${NC}"

# 1. 构建和打包
echo -e "${YELLOW}1. 构建前端...${NC}"
cd frontend

# 清理所有缓存和旧构建
echo "清理旧构建和缓存..."
rm -rf build
rm -rf node_modules/.cache
rm -f build.tar.gz

# 构建
npm run build

if [ ! -d "build" ]; then
    echo -e "${RED}构建失败！${NC}"
    exit 1
fi

# 删除旧的并创建新的 tar.gz
echo -e "${YELLOW}2. 打包文件...${NC}"
rm -f build.tar.gz
tar -czf build.tar.gz build/

# 获取版本号
VERSION=$(grep -o "Research Dashboard v[0-9]\.[0-9]" build/static/js/main.*.js 2>/dev/null | head -1 | sed 's/Research Dashboard //' || echo "未知")
SIZE=$(ls -lh build.tar.gz | awk '{print $5}')
echo -e "${GREEN}✅ 构建版本: $VERSION (大小: $SIZE)${NC}"

cd ..

# 2. Git 操作
echo -e "${YELLOW}3. 提交到Git...${NC}"
git add -A
git commit -m "build: Update frontend to $VERSION - $(date +%Y-%m-%d' '%H:%M)" || {
    echo -e "${YELLOW}没有更改需要提交${NC}"
}

# 3. 推送
echo -e "${YELLOW}4. 推送到GitHub...${NC}"
git push

echo ""
echo -e "${GREEN}=== 部署完成！===${NC}"
echo -e "${BLUE}版本: $VERSION${NC}"
echo ""
echo -e "${YELLOW}最后一步：在VPS上运行${NC}"
echo -e "${BLUE}./vps-update.sh${NC}"
echo ""
echo "🚀 完成！"