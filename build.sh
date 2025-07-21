#!/bin/bash

# 构建脚本 - 自动构建并更新 tar.gz

set -e

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== 构建并打包前端 ===${NC}"

# 1. 进入前端目录
cd frontend

# 2. 构建
echo -e "${YELLOW}构建前端...${NC}"
npm run build

if [ ! -d "build" ]; then
    echo -e "${RED}构建失败！${NC}"
    exit 1
fi

# 3. 删除旧的 tar.gz
echo -e "${YELLOW}删除旧的打包文件...${NC}"
rm -f build.tar.gz

# 4. 创建新的 tar.gz
echo -e "${YELLOW}打包新版本...${NC}"
tar -czf build.tar.gz build/

# 5. 验证
if [ -f "build.tar.gz" ]; then
    SIZE=$(ls -lh build.tar.gz | awk '{print $5}')
    echo -e "${GREEN}✅ 打包成功！文件大小: $SIZE${NC}"
    
    # 显示版本信息
    VERSION=$(grep -o "v[0-9]\.[0-9]" build/static/js/main.*.js 2>/dev/null | head -1 || echo "未知")
    echo -e "${GREEN}构建版本: $VERSION${NC}"
else
    echo -e "${RED}打包失败！${NC}"
    exit 1
fi

# 6. 返回根目录
cd ..

echo ""
echo -e "${BLUE}下一步：${NC}"
echo "1. git add -A"
echo "2. git commit -m \"build: Update to $VERSION\""
echo "3. git push"
echo "4. 在VPS运行 ./vps-update.sh"