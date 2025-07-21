#!/bin/bash

echo "=== VPS上部署前端 ==="
echo ""

# 检查是否在正确目录
if [ ! -d "/var/www/research-dashboard" ]; then
    echo "错误：不在VPS上或目录不正确"
    exit 1
fi

cd /var/www/research-dashboard

# 从GitHub拉取最新代码（包括修复的api.ts）
echo "1. 拉取最新代码..."
git pull

# 检查前端构建
if [ -d "frontend/build" ]; then
    echo "2. 发现本地构建文件，直接部署..."
else
    echo "2. 没有构建文件，需要在VPS上构建..."
    cd frontend
    
    # 检查Node.js
    if ! command -v node &> /dev/null; then
        echo "安装Node.js..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
    
    echo "安装依赖..."
    npm install --production
    
    echo "构建前端..."
    npm run build
    cd ..
fi

# 部署
echo "3. 部署到网站目录..."
sudo rm -rf /var/www/html/*
sudo cp -r frontend/build/* /var/www/html/
sudo chown -R www-data:www-data /var/www/html

# 重启Nginx
echo "4. 重启Nginx..."
sudo systemctl reload nginx

echo ""
echo "✅ 部署完成！"
echo "访问: http://45.149.156.216:3001"