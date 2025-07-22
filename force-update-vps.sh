#!/bin/bash

# 🔥 强制更新VPS代码并重启服务
echo "🔥 强制更新VPS并重启所有服务"
echo "时间: $(date)"
echo "========================================"

cd /var/www/research-dashboard || exit 1

echo "📥 1. 拉取最新代码"
echo "------------------"
git fetch origin main
git reset --hard origin/main
git pull origin main

echo ""
echo "🔍 2. 验证后端代码已更新"
echo "-----------------------"
echo "检查schemas.py中的日期解析器:"
grep -A5 "parse_communication_date" backend/app/models/schemas.py | head -20

echo ""
echo "🔄 3. 重启后端服务"
echo "-----------------"
sudo systemctl stop research-backend
sleep 2
sudo systemctl start research-backend
sleep 3
sudo systemctl status research-backend --no-pager | grep Active

echo ""
echo "🏗️ 4. 重建前端"
echo "--------------"
cd frontend
echo "安装依赖..."
npm install
echo "构建生产版本..."
npm run build
echo "新构建时间: $(stat -c %y build/index.html)"

echo ""
echo "🔄 5. 重启前端服务"
echo "-----------------"
sudo systemctl restart research-frontend
sudo systemctl status research-frontend --no-pager | grep Active

echo ""
echo "⏳ 6. 等待服务完全启动"
echo "---------------------"
echo "等待10秒..."
sleep 10

echo ""
echo "✅ 7. 测试API"
echo "------------"
cd /var/www/research-dashboard

# 登录
token=$(curl -s -X POST "http://localhost:8080/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "zl", "password": "123"}' | \
  python3 -c "import sys, json; print(json.load(sys.stdin).get('access_token', 'NO_TOKEN'))")

if [ "$token" = "NO_TOKEN" ]; then
    echo "❌ 登录失败"
else
    echo "✅ 登录成功"
    
    # 测试添加交流记录（注意：不需要project_id在body中）
    echo ""
    echo "测试添加交流记录..."
    curl -X POST "http://localhost:8080/api/research/1/logs" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      -d '{
        "title": "VPS更新测试",
        "content": "通过force-update-vps脚本添加",
        "communication_type": "meeting",
        "communication_date": "2025-07-23"
      }' -w "\nHTTP状态码: %{http_code}\n"
fi

echo ""
echo "🏁 强制更新完成！"
echo ""
echo "请访问 http://45.149.156.216:3001 查看效果"
echo "========================================"