#!/bin/bash

echo "=== 修复Node.js版本并重建前端 ==="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. 卸载旧版本Node.js
echo -e "${YELLOW}卸载旧版本Node.js...${NC}"
sudo apt-get remove -y nodejs npm
sudo apt-get autoremove -y

# 2. 清理旧的Node源
sudo rm -f /etc/apt/sources.list.d/nodesource.list*

# 3. 安装Node.js 18.x
echo -e "${YELLOW}安装Node.js 18.x...${NC}"
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 4. 验证版本
echo -e "${GREEN}Node.js版本: $(node -v)${NC}"
echo -e "${GREEN}NPM版本: $(npm -v)${NC}"

# 5. 增加Node.js内存限制
export NODE_OPTIONS="--max-old-space-size=2048"

# 6. 进入项目目录
cd /var/www/research-dashboard/frontend

# 7. 清理并重新安装
echo -e "${YELLOW}清理旧文件...${NC}"
rm -rf node_modules package-lock.json build

# 8. 使用npm ci安装（更快更可靠）
echo -e "${YELLOW}安装依赖...${NC}"
npm install --legacy-peer-deps

# 9. 构建前端
echo -e "${YELLOW}构建前端...${NC}"
export NODE_ENV=production
npm run build

# 10. 检查构建结果
if [ -d "build" ]; then
    echo -e "${GREEN}构建成功！${NC}"
    
    # 检查并修复硬编码URL
    echo -e "${YELLOW}检查硬编码URL...${NC}"
    if grep -r "localhost:8080" build/static/js/*.js 2>/dev/null; then
        echo -e "${YELLOW}发现硬编码URL，正在修复...${NC}"
        find build/static/js -name "*.js" -type f -exec sed -i 's|http://localhost:8080|'\''/'\''|g' {} +
    fi
    
    # 部署
    echo -e "${YELLOW}部署到web目录...${NC}"
    sudo rm -rf /var/www/html/*
    sudo cp -r build/* /var/www/html/
    sudo chown -R www-data:www-data /var/www/html
    
    # 重启Nginx
    echo -e "${YELLOW}重启Nginx...${NC}"
    sudo systemctl reload nginx
    
    echo -e "${GREEN}✅ 部署完成！${NC}"
    echo ""
    echo "请清除浏览器缓存后访问 http://45.149.156.216:3001"
else
    echo -e "${RED}构建失败！${NC}"
    exit 1
fi