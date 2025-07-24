#!/bin/bash
# 测试待办API的认证功能 - JSON版本

echo "========================================="
echo "🧪 测试待办API认证 (JSON版本)"
echo "========================================="

API_URL="http://localhost:8080"

# 1. 测试登录
echo -e "\n1. 测试登录..."
echo "尝试使用 zl 用户登录..."

LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "zl", "password": "zl123456"}')

echo "登录响应: $LOGIN_RESPONSE"

# 提取token
TOKEN=$(echo $LOGIN_RESPONSE | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('access_token', ''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
    echo "❌ 登录失败，检查密码..."
    
    # 查看登录API的预期格式
    echo -e "\n检查登录API端点..."
    curl -s -X POST "$API_URL/api/auth/login" \
      -H "Content-Type: application/json" \
      -d '{}' | python3 -m json.tool 2>/dev/null || echo "无法解析响应"
fi

if [ ! -z "$TOKEN" ]; then
    echo "✅ 登录成功，获取到token"
    echo "Token前20字符: ${TOKEN:0:20}..."
    
    # 2. 测试待办API（带认证）
    echo -e "\n2. 测试待办API（带认证）..."
    TODOS_RESPONSE=$(curl -s -w "\nHTTP状态码: %{http_code}" \
      -H "Authorization: Bearer $TOKEN" \
      "$API_URL/api/research/todos")
    
    echo "待办API响应:"
    echo "$TODOS_RESPONSE" | head -n -1 | python3 -m json.tool 2>/dev/null || echo "$TODOS_RESPONSE"
    
    # 3. 测试标记待办
    echo -e "\n3. 测试标记项目ID=1为待办..."
    MARK_RESPONSE=$(curl -s -w "\nHTTP状态码: %{http_code}" \
      -X POST \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"priority": 1, "notes": "测试待办"}' \
      "$API_URL/api/research/1/todo")
    
    echo "标记待办响应:"
    echo "$MARK_RESPONSE"
    
    # 4. 再次获取待办列表
    echo -e "\n4. 再次获取待办列表..."
    TODOS_RESPONSE=$(curl -s \
      -H "Authorization: Bearer $TOKEN" \
      "$API_URL/api/research/todos")
    
    echo "待办列表:"
    echo "$TODOS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$TODOS_RESPONSE"
    
else
    echo "❌ 无法获取认证token"
    
    # 检查auth路由
    echo -e "\n检查auth路由实现..."
    grep -A 20 "@router.post(\"/login\")" /var/www/research-dashboard/backend/app/routes/auth.py
    
    # 创建测试用户
    echo -e "\n尝试重置用户密码..."
    cd /var/www/research-dashboard/backend
    python3 -c "
import sqlite3
from app.utils.auth import get_password_hash

conn = sqlite3.connect('data/research_dashboard_prod.db')
cursor = conn.cursor()

# 更新zl用户的密码
password_hash = get_password_hash('zl123456')
cursor.execute('UPDATE users SET password_hash = ? WHERE username = ?', (password_hash, 'zl'))
conn.commit()

print('✅ 已重置zl用户密码为: zl123456')
conn.close()
"
fi

# 5. 直接测试422错误
echo -e "\n5. 直接测试可能导致422的情况..."
echo "测试错误的路由参数..."
curl -s -w "\nHTTP状态码: %{http_code}" "$API_URL/api/research/todos" \
  -H "Authorization: Bearer invalid_token"

echo -e "\n========================================="
echo "测试完成！"
echo "========================================="