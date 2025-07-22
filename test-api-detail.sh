#!/bin/bash

# 🔍 详细API测试脚本
echo "🔍 详细API测试"
echo "时间: $(date)"
echo "================================"

cd /var/www/research-dashboard/backend || exit 1

# 1. 先运行迁移脚本
echo "📝 1. 执行迁移脚本"
echo "-------------------"
python3 migrations/migration.py

echo ""
echo "🔐 2. 测试认证"
echo "--------------"
# 使用预设用户登录获取token
echo "尝试登录..."
response=$(curl -s -X POST "http://localhost:8080/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "zl", "password": "123"}')

token=$(echo "$response" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if 'access_token' in data:
        print(data['access_token'])
    else:
        print('NO_TOKEN')
        print('响应:', data, file=sys.stderr)
except Exception as e:
    print('NO_TOKEN')
    print('错误:', e, file=sys.stderr)
")

if [ "$token" = "NO_TOKEN" ]; then
    echo "❌ 登录失败"
    echo "原始响应: $response"
else
    echo "✅ 登录成功，获得token"
fi

echo ""
echo "🌐 3. 测试API（带认证）"
echo "---------------------"
if [ "$token" != "NO_TOKEN" ]; then
    echo "获取项目列表..."
    curl -s -H "Authorization: Bearer $token" \
      "http://localhost:8080/api/research/" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(f'✅ 成功获取 {len(data)} 个项目')
    
    if data:
        proj = data[0]
        print(f'\\n第一个项目:')
        print(f'  ID: {proj.get(\"id\")}')
        print(f'  标题: {proj.get(\"title\")[:30]}...')
        print(f'  字段列表: {list(proj.keys())}')
        
        if 'communication_logs' in proj:
            logs = proj['communication_logs']
            print(f'\\n  ✅ communication_logs存在')
            print(f'  类型: {type(logs)}')
            print(f'  数量: {len(logs)}')
            if logs:
                log = logs[0]
                print(f'  第一条: {log.get(\"communication_type\")} - {log.get(\"title\")}')
        else:
            print(f'\\n  ❌ 没有communication_logs字段!')
            print(f'  实际字段: {list(proj.keys())}')
except Exception as e:
    print(f'❌ 解析失败: {e}')
"
fi

echo ""
echo "🔥 4. 测试无认证访问"
echo "-------------------"
curl -s "http://localhost:8080/api/research/" -w "\nHTTP状态码: %{http_code}\n"

echo ""
echo "🔧 5. 检查FastAPI日志"
echo "-------------------"
echo "最近的错误日志:"
journalctl -u research-backend --since "1 hour ago" | grep -i -E "(error|exception|traceback)" | tail -10

echo ""
echo "🏁 测试完成"