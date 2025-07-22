#!/bin/bash

# 🔨 强制重建前端
echo "🔨 强制重建前端"
echo "时间: $(date)"
echo "================================"

cd /var/www/research-dashboard || exit 1

echo "📦 1. 拉取最新代码"
git pull

echo ""
echo "🏗️ 2. 重建前端"
cd frontend
echo "清理旧构建..."
rm -rf build/

echo "安装依赖..."
npm install

echo "构建生产版本..."
npm run build

echo ""
echo "✅ 3. 验证构建"
if [ -d "build" ]; then
    echo "构建成功！"
    echo "构建大小: $(du -sh build/)"
    echo "检查communication_logs引用:"
    grep -r "communication_logs" build/static/js/*.js | wc -l
else
    echo "❌ 构建失败！"
fi

echo ""
echo "🚀 4. 重启服务"
sudo systemctl restart research-backend
sudo systemctl restart research-frontend

echo ""
echo "📊 5. 服务状态"
systemctl status research-backend --no-pager | grep Active
systemctl status research-frontend --no-pager | grep Active

echo ""
echo "🏁 重建完成！"