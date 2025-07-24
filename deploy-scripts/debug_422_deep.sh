#!/bin/bash
# 深度调试422错误

echo "========================================="
echo "🔍 深度调试422错误"
echo "========================================="

API_URL="http://localhost:8080"

# 1. 先测试登录（使用重置后的密码）
echo "1. 测试登录..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "zl", "password": "zl123456"}')

echo "登录响应: $LOGIN_RESPONSE"

TOKEN=$(echo $LOGIN_RESPONSE | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('access_token', ''))" 2>/dev/null)

if [ ! -z "$TOKEN" ]; then
    echo "✅ 登录成功"
    
    # 2. 测试各种可能导致422的情况
    echo -e "\n2. 测试不同的Authorization格式..."
    
    # 正确格式
    echo "a) 正确格式: Bearer TOKEN"
    curl -s -w "\nHTTP状态码: %{http_code}\n" \
      -H "Authorization: Bearer $TOKEN" \
      "$API_URL/api/research/todos"
    
    # 错误格式1：没有Bearer前缀
    echo -e "\nb) 错误格式: 只有TOKEN（没有Bearer）"
    curl -s -w "\nHTTP状态码: %{http_code}\n" \
      -H "Authorization: $TOKEN" \
      "$API_URL/api/research/todos"
    
    # 错误格式2：小写bearer
    echo -e "\nc) 错误格式: bearer TOKEN（小写）"
    curl -s -w "\nHTTP状态码: %{http_code}\n" \
      -H "Authorization: bearer $TOKEN" \
      "$API_URL/api/research/todos"
    
    # 错误格式3：额外空格
    echo -e "\nd) 错误格式: Bearer  TOKEN（双空格）"
    curl -s -w "\nHTTP状态码: %{http_code}\n" \
      -H "Authorization: Bearer  $TOKEN" \
      "$API_URL/api/research/todos"
    
else
    echo "❌ 登录失败"
fi

# 3. 检查HTTPBearer依赖
echo -e "\n3. 检查HTTPBearer实现..."
cd /var/www/research-dashboard/backend
python3 -c "
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Request

# 测试HTTPBearer
bearer = HTTPBearer()
print(f'HTTPBearer auto_error: {bearer.auto_error}')
print(f'HTTPBearer scheme_name: {bearer.scheme_name}')

# 模拟请求
class MockRequest:
    def __init__(self, auth_header):
        self.headers = {'authorization': auth_header} if auth_header else {}

# 测试不同的header格式
test_cases = [
    ('Bearer valid_token', 'Bearer valid_token'),
    ('bearer valid_token', 'bearer valid_token'),
    ('valid_token', 'only token'),
    ('', 'empty'),
    (None, 'none')
]

print('\n测试HTTPBearer解析:')
for header, desc in test_cases:
    try:
        request = MockRequest(header)
        result = bearer(request)
        print(f'  {desc}: 可能会通过验证')
    except Exception as e:
        print(f'  {desc}: 会抛出异常 - {type(e).__name__}')
"

# 4. 检查get_current_user的实际实现
echo -e "\n4. 检查get_current_user函数..."
grep -B5 -A15 "def get_current_user" /var/www/research-dashboard/backend/app/utils/auth.py

# 5. 检查Depends导入
echo -e "\n5. 检查FastAPI依赖导入..."
grep -n "from fastapi import" /var/www/research-dashboard/backend/app/routes/research.py | head -5

# 6. 查看实际的422错误详情
echo -e "\n6. 查看最近的错误日志详情..."
journalctl -u research-backend --since "2 hours ago" | grep -B2 -A10 "422\|Unprocessable Entity" | tail -50

echo -e "\n========================================="
echo "调试完成！"
echo "========================================="