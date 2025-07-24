#!/bin/bash
# 测试待办API的认证功能

echo "========================================="
echo "🧪 测试待办API认证"
echo "========================================="

API_URL="http://localhost:8080"

# 1. 测试登录
echo -e "\n1. 测试登录..."
echo "尝试使用 zl 用户登录..."

LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=zl&password=zl123456")

echo "登录响应: $LOGIN_RESPONSE"

# 提取token
TOKEN=$(echo $LOGIN_RESPONSE | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('access_token', ''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
    echo "❌ 登录失败，无法获取token"
    
    # 尝试其他用户
    echo -e "\n尝试 admin 用户..."
    LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "username=admin&password=admin123")
    echo "登录响应: $LOGIN_RESPONSE"
    
    TOKEN=$(echo $LOGIN_RESPONSE | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('access_token', ''))" 2>/dev/null)
fi

if [ ! -z "$TOKEN" ]; then
    echo "✅ 登录成功，获取到token"
    
    # 2. 测试待办API（带认证）
    echo -e "\n2. 测试待办API（带认证）..."
    TODOS_RESPONSE=$(curl -s -w "\nHTTP状态码: %{http_code}" \
      -H "Authorization: Bearer $TOKEN" \
      "$API_URL/api/research/todos")
    
    echo "待办API响应: $TODOS_RESPONSE"
    
    # 3. 测试标记待办
    echo -e "\n3. 测试标记项目为待办..."
    MARK_RESPONSE=$(curl -s -w "\nHTTP状态码: %{http_code}" \
      -X POST \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"priority": 1, "notes": "测试待办"}' \
      "$API_URL/api/research/1/todo")
    
    echo "标记待办响应: $MARK_RESPONSE"
    
    # 4. 再次获取待办列表
    echo -e "\n4. 再次获取待办列表..."
    TODOS_RESPONSE=$(curl -s \
      -H "Authorization: Bearer $TOKEN" \
      "$API_URL/api/research/todos")
    
    echo "待办列表: $TODOS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$TODOS_RESPONSE"
    
else
    echo "❌ 无法获取认证token"
    
    # 显示可用的用户
    echo -e "\n显示数据库中的用户..."
    cd /var/www/research-dashboard/backend
    python3 -c "
import sqlite3
conn = sqlite3.connect('data/research_dashboard_prod.db')
cursor = conn.cursor()
cursor.execute('SELECT username, email FROM users')
users = cursor.fetchall()
print('可用用户:')
for user in users:
    print(f'  - 用户名: {user[0]}, 邮箱: {user[1]}')
conn.close()
"
fi

echo -e "\n========================================="
echo "测试完成！"
echo "========================================="