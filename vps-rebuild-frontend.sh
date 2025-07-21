#!/bin/bash

echo "=== VPS前端重新构建脚本 ==="
echo "此脚本将在VPS上重新构建前端，确保使用正确的生产环境配置"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. 检查是否在正确目录
if [ ! -d "/var/www/research-dashboard" ]; then
    echo -e "${RED}错误：找不到项目目录 /var/www/research-dashboard${NC}"
    exit 1
fi

cd /var/www/research-dashboard

# 2. 检查Node.js
echo -e "${YELLOW}检查Node.js环境...${NC}"
if ! command -v node &> /dev/null; then
    echo "安装Node.js 18.x..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
echo "Node版本: $(node -v)"
echo "NPM版本: $(npm -v)"

# 3. 进入前端目录
cd frontend

# 4. 清理旧的构建
echo -e "${YELLOW}清理旧的构建文件...${NC}"
rm -rf build node_modules package-lock.json

# 5. 安装依赖
echo -e "${YELLOW}安装依赖...${NC}"
npm install

# 6. 设置环境变量并构建
echo -e "${YELLOW}构建前端（使用生产环境配置）...${NC}"
export NODE_ENV=production
# 使用window.location.origin，不需要硬编码API URL
unset REACT_APP_API_URL
npm run build

# 7. 检查构建结果
echo -e "${YELLOW}检查构建结果...${NC}"
if [ -d "build" ]; then
    echo -e "${GREEN}构建成功！${NC}"
    
    # 检查是否有硬编码的localhost
    if grep -r "localhost:8080" build/static/js/*.js 2>/dev/null; then
        echo -e "${RED}警告：发现硬编码的localhost:8080！${NC}"
        echo "尝试替换..."
        find build/static/js -name "*.js" -type f -exec sed -i 's|http://localhost:8080|window.location.origin|g' {} +
    fi
else
    echo -e "${RED}构建失败！${NC}"
    exit 1
fi

# 8. 部署新构建
echo -e "${YELLOW}部署新构建到web目录...${NC}"
sudo rm -rf /var/www/html/*
sudo cp -r build/* /var/www/html/
sudo chown -R www-data:www-data /var/www/html

# 9. 重启服务
echo -e "${YELLOW}重启Nginx...${NC}"
sudo nginx -t && sudo systemctl reload nginx

# 10. 验证
echo -e "${GREEN}部署完成！${NC}"
echo ""
echo "请执行以下步骤："
echo "1. 清除浏览器缓存（Ctrl+Shift+Delete）"
echo "2. 使用隐私/无痕模式访问 http://45.149.156.216:3001"
echo "3. 或在浏览器控制台运行："
echo "   localStorage.clear();"
echo "   sessionStorage.clear();"
echo "   location.reload();"
echo ""
echo -e "${YELLOW}诊断信息：${NC}"
echo "前端文件位置: /var/www/html"
echo "API地址配置: 使用 window.location.origin (动态)"
echo "访问地址: http://45.149.156.216:3001"