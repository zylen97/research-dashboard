#!/bin/bash

echo "=== 测试VPS备份API ==="

# 1. 登录获取Token
echo "🔐 登录获取Token..."
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"zl","password":"123"}' | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])")

if [ -z "$TOKEN" ]; then
    echo "❌ 登录失败"
    exit 1
fi

echo "✅ 登录成功"
echo ""

# 2. 测试备份统计API
echo "📊 测试备份统计API..."
echo "请求: GET /api/backup/stats"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X GET http://localhost:8080/api/backup/stats \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed -n '1,/HTTP_STATUS/p' | sed '$d')

echo "状态码: $HTTP_STATUS"
echo "响应内容:"
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
echo ""

# 3. 测试备份列表API
echo "📋 测试备份列表API..."
echo "请求: GET /api/backup/list"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X GET http://localhost:8080/api/backup/list \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed -n '1,/HTTP_STATUS/p' | sed '$d')

echo "状态码: $HTTP_STATUS"
echo "响应内容:"
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
echo ""

# 4. 测试创建备份API
echo "➕ 测试创建备份API..."
echo "请求: POST /api/backup/create"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "http://localhost:8080/api/backup/create?reason=test" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed -n '1,/HTTP_STATUS/p' | sed '$d')

echo "状态码: $HTTP_STATUS"
echo "响应内容:"
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
echo ""

# 5. 检查错误日志
echo "📝 最新错误日志:"
sudo journalctl -u research-backend -n 30 --no-pager | grep -E "(ERROR|error|Error|Traceback|Exception)" | tail -10
echo ""

echo "=== 测试完成 ==="