#!/bin/bash

# 本地部署脚本 - 自动构建、打包、推送

set -e

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== 本地部署脚本 ===${NC}"

# 1. 构建前端
echo -e "${YELLOW}1. 构建前端...${NC}"
cd frontend
npm run build

# 2. 打包
echo -e "${YELLOW}2. 打包构建文件...${NC}"
rm -f build.tar.gz
tar -czf build.tar.gz build/

# 3. 提交代码
echo -e "${YELLOW}3. 提交到Git...${NC}"
cd ..
git add -A
git commit -m "build: Update frontend build $(date +%Y%m%d_%H%M%S)" || echo "没有更改需要提交"

# 4. 推送
echo -e "${YELLOW}4. 推送到GitHub...${NC}"
git push

echo ""
echo -e "${GREEN}✅ 本地部署完成！${NC}"
echo -e "${BLUE}下一步：在VPS运行 ./vps-update.sh${NC}"