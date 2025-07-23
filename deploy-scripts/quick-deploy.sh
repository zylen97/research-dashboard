#!/bin/bash

# 🚀 超级快速部署脚本 - 直接推送，不废话！
# 使用：./deploy-scripts/quick-deploy.sh

set -e

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== 快速部署脚本 ===${NC}"

# 切换到项目根目录
cd "$(dirname "$0")/.."

# 1. 检查是否有改动
if [ -z "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}没有检测到任何改动！${NC}"
    exit 0
fi

# 2. 显示改动
echo -e "${YELLOW}检测到以下改动：${NC}"
git status --short

# 3. 构建前端（如果有前端改动）
if git status --porcelain | grep -q "^.. frontend/"; then
    echo -e "${YELLOW}检测到前端改动，开始构建...${NC}"
    cd frontend
    npm run build
    tar -czf build.tar.gz build/
    cd ..
    echo -e "${GREEN}✅ 前端构建完成${NC}"
fi

# 4. 添加所有文件
echo -e "${YELLOW}添加所有改动...${NC}"
git add -A

# 5. 提交
echo -e "${YELLOW}提交改动...${NC}"
COMMIT_MSG="Quick deployment - $(date +%Y-%m-%d_%H:%M)"
git commit -m "$COMMIT_MSG" || {
    echo -e "${YELLOW}没有新改动需要提交${NC}"
    exit 0
}

# 6. 推送
echo -e "${YELLOW}推送到GitHub...${NC}"
git push

# 7. 完成
echo -e "${GREEN}✅ 部署成功！${NC}"
echo ""
echo "📋 后续步骤："
echo "1. 等待 1-2 分钟自动部署完成"
echo "2. 访问 http://45.149.156.216:3001"
echo ""
echo -e "${GREEN}🚀 快速部署完成！${NC}"