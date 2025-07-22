#!/bin/bash

# 🎯 最终验证脚本
echo "🎯 最终验证 - 确认所有问题已解决"
echo "时间: $(date)"
echo "========================================"

cd /var/www/research-dashboard || exit 1

echo "📌 1. 确认最新代码"
echo "-------------------"
git log --oneline -1

echo ""
echo "✅ 2. 测试添加交流记录"
echo "----------------------"
# 登录
token=$(curl -s -X POST "http://localhost:8080/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "zl", "password": "123"}' | \
  python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])")

# 添加交流记录
echo "添加新的交流记录..."
response=$(curl -s -X POST "http://localhost:8080/api/research/1/logs" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "测试交流记录",
    "content": "通过最终验证脚本添加",
    "communication_type": "meeting",
    "communication_date": "2025-07-23"
  }' -w "\nHTTP状态码: %{http_code}")

echo "$response"

echo ""
echo "📊 3. 验证交流进度显示"
echo "----------------------"
# 获取项目列表检查communication_logs
curl -s -H "Authorization: Bearer $token" \
  "http://localhost:8080/api/research/" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'获取到 {len(data)} 个项目')

for proj in data[:3]:
    print(f'\\n项目: {proj[\"title\"][:30]}...')
    logs = proj.get('communication_logs', [])
    print(f'  交流记录数: {len(logs)}')
    if logs:
        latest = logs[0]
        print(f'  最新: {latest[\"communication_type\"]} - {latest[\"title\"]}')
"

echo ""
echo "🌐 4. 检查前端构建"
echo "------------------"
if [ -f "frontend/build/index.html" ]; then
    echo "构建时间: $(stat -c %y frontend/build/index.html | cut -d' ' -f1-2)"
    echo "检查communication_logs处理代码:"
    grep -q "communication_logs" frontend/build/static/js/*.js && echo "✅ 前端包含communication_logs处理" || echo "❌ 前端缺少communication_logs处理"
fi

echo ""
echo "🏁 验证完成！"
echo ""
echo "如果以上都显示正常，请："
echo "1. 访问 http://45.149.156.216:3001"
echo "2. 查看研究看板的交流进度列"
echo "3. 尝试添加新的交流记录"
echo "========================================"