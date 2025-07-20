#!/bin/bash
# 自动部署脚本 - 可以通过webhook触发

echo "🔄 开始自动部署..."

# 进入项目目录
cd /var/www/research-dashboard

# 拉取最新代码
echo "📥 拉取最新代码..."
git pull origin main

# 检查是否有后端更改
if git diff HEAD~1 --name-only | grep -q "backend/"; then
    echo "🐍 检测到后端更改，重启后端服务..."
    systemctl restart research-backend
fi

# 检查是否有前端更改
if git diff HEAD~1 --name-only | grep -q "frontend/"; then
    echo "⚛️ 检测到前端更改，重新构建..."
    cd frontend
    npm run build
    cp -r build/* /var/www/html/
    cd ..
fi

# 检查服务状态
echo "🔍 检查服务状态..."
systemctl status research-backend --no-pager -l
systemctl status nginx --no-pager -l

echo "✅ 自动部署完成！"
echo "🌐 访问：http://45.149.156.216"

# 记录部署日志
echo "$(date): 自动部署完成" >> /var/log/auto-deploy.log