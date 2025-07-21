#!/bin/bash

# 快速修复脚本 - 直接在VPS上运行解决v4.0问题

echo "=== 快速修复 Research Dashboard 版本问题 ==="
echo ""

# 进入前端目录
cd /var/www/research-dashboard/frontend

# 1. 清理所有旧文件
echo "1. 清理旧文件..."
rm -rf node_modules build package-lock.json

# 2. 安装依赖
echo "2. 安装依赖（这可能需要几分钟）..."
npm install

# 3. 检查react-scripts
echo "3. 验证react-scripts..."
if [ ! -f "node_modules/.bin/react-scripts" ]; then
    echo "react-scripts未找到，单独安装..."
    npm install react-scripts --save
fi

# 4. 设置内存限制并构建
echo "4. 构建前端..."
export NODE_OPTIONS="--max-old-space-size=1024"
npm run build

# 5. 检查构建结果
if [ ! -d "build" ]; then
    echo "构建失败！尝试使用yarn..."
    npm install -g yarn
    yarn install
    yarn build
fi

# 6. 部署
if [ -d "build" ]; then
    echo "5. 部署新版本..."
    rm -rf /var/www/html.old
    mv /var/www/html /var/www/html.old 2>/dev/null || true
    cp -r build /var/www/html
    chown -R www-data:www-data /var/www/html
    
    # 验证版本
    VERSION=$(grep -o "Research Dashboard v[0-9]\.[0-9]" /var/www/html/static/js/main.*.js 2>/dev/null | head -1)
    echo ""
    echo "部署完成！"
    echo "当前版本: $VERSION"
    echo "请刷新浏览器查看"
else
    echo "构建失败，请检查错误信息"
fi