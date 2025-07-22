#!/bin/bash

# API调试脚本
# 检查VPS上的API问题

echo "🔍 API调试开始..."

# 先检查基础API健康
echo "1. 检查API健康状态..."
curl -s -w "状态码: %{http_code}\n" http://45.149.156.216:3001/docs

echo ""
echo "2. 测试认证API..."
TOKEN=$(curl -s "http://45.149.156.216:3001/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"zl","password":"123"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin).get('access_token', 'FAILED'))")

if [ "$TOKEN" == "FAILED" ]; then
    echo "❌ 认证失败"
    exit 1
else
    echo "✅ 认证成功，获取token: ${TOKEN:0:20}..."
fi

echo ""
echo "3. 测试collaborators API (应该正常)..."
curl -s -w "\n状态码: %{http_code}\n" "http://45.149.156.216:3001/api/collaborators/" \
  -H "Authorization: Bearer $TOKEN" | head -n 5

echo ""
echo "4. 测试research API (可能有问题)..."
curl -s -w "\n状态码: %{http_code}\n" "http://45.149.156.216:3001/api/research/" \
  -H "Authorization: Bearer $TOKEN" | head -n 5

echo ""
echo "5. 测试ideas API..."
curl -s -w "\n状态码: %{http_code}\n" "http://45.149.156.216:3001/api/ideas/" \
  -H "Authorization: Bearer $TOKEN" | head -n 5

echo ""
echo "6. 测试literature API..."
curl -s -w "\n状态码: %{http_code}\n" "http://45.149.156.216:3001/api/literature/" \
  -H "Authorization: Bearer $TOKEN" | head -n 5

echo ""
echo "🏁 API调试完成"