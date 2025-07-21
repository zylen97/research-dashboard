#!/bin/bash

echo "=== 紧急部署前端 ==="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. 检查前端源码是否存在
if [ ! -d "/var/www/research-dashboard/frontend" ]; then
    echo -e "${RED}错误：前端源码不存在！${NC}"
    echo "尝试从GitHub克隆..."
    cd /var/www
    git clone https://github.com/zylen97/research-dashboard.git
fi

cd /var/www/research-dashboard/frontend

# 2. 安装Node.js（如果需要）
if ! command -v node &> /dev/null || [ $(node -v | cut -d'.' -f1 | sed 's/v//') -lt 14 ]; then
    echo -e "${YELLOW}安装Node.js 18.x...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

echo "Node版本: $(node -v)"

# 3. 清理并安装依赖
echo -e "${YELLOW}安装依赖...${NC}"
rm -rf node_modules package-lock.json
export NODE_OPTIONS="--max-old-space-size=2048"
npm install --legacy-peer-deps

# 4. 构建前端
echo -e "${YELLOW}构建前端...${NC}"
export NODE_ENV=production
npm run build

# 5. 检查构建结果
if [ ! -d "build" ]; then
    echo -e "${RED}构建失败！尝试下载预构建版本...${NC}"
    # 如果构建失败，创建一个临时的index.html
    mkdir -p /var/www/html
    cat > /var/www/html/index.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Research Dashboard - 部署中</title>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .status { color: #ff4d4f; }
    </style>
</head>
<body>
    <h1>Research Dashboard</h1>
    <p class="status">系统正在部署中，请稍后刷新页面...</p>
    <p>如果问题持续，请联系管理员。</p>
    <script>
        setTimeout(() => location.reload(), 30000);
    </script>
</body>
</html>
EOF
    echo -e "${YELLOW}已创建临时页面，请手动检查构建问题${NC}"
    exit 1
fi

# 6. 部署
echo -e "${YELLOW}部署前端文件...${NC}"
sudo rm -rf /var/www/html/*
sudo cp -r build/* /var/www/html/
sudo chown -R www-data:www-data /var/www/html

# 7. 验证部署
if [ -f "/var/www/html/index.html" ]; then
    echo -e "${GREEN}✅ 部署成功！${NC}"
    echo "部署的文件："
    ls -la /var/www/html/ | head -10
else
    echo -e "${RED}❌ 部署失败！${NC}"
fi

# 8. 重启服务
echo -e "${YELLOW}重启Nginx...${NC}"
sudo systemctl reload nginx

echo ""
echo -e "${GREEN}部署完成！请访问 http://45.149.156.216:3001${NC}"