#!/bin/bash

echo "=== 一键部署前端到VPS ==="
echo ""

# VPS配置
VPS_HOST="45.149.156.216"
VPS_USER="root"

# 检查本地构建文件
if [ ! -d "frontend/build" ]; then
    echo "本地没有构建文件，开始构建..."
    cd frontend
    npm install
    npm run build
    cd ..
fi

echo "开始部署到VPS..."

# 使用tar打包上传（更可靠）
echo "1. 打包构建文件..."
cd frontend
tar -czf build.tar.gz build/

echo "2. 上传到VPS..."
scp build.tar.gz $VPS_USER@$VPS_HOST:/tmp/

echo "3. 在VPS上解压并部署..."
ssh $VPS_USER@$VPS_HOST << 'EOF'
cd /tmp
tar -xzf build.tar.gz
rm -rf /var/www/html/*
cp -r build/* /var/www/html/
chown -R www-data:www-data /var/www/html
rm -f build.tar.gz
rm -rf build
systemctl reload nginx
echo "部署完成！"
EOF

# 清理本地临时文件
rm -f build.tar.gz
cd ..

echo ""
echo "✅ 部署完成！"
echo "请访问: http://45.149.156.216:3001"