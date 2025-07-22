#!/bin/bash

# 🔍 检查前端认证问题
echo "🔍 检查前端认证配置"
echo "时间: $(date)"
echo "================================"

cd /var/www/research-dashboard || exit 1

echo "📝 1. 检查后端认证配置"
echo "----------------------"
cd backend
python3 -c "
from app.core.config import settings
print(f'JWT算法: {settings.ALGORITHM}')
print(f'JWT过期时间: {settings.ACCESS_TOKEN_EXPIRE_DAYS}天')
print(f'环境: {settings.ENV}')
print(f'数据共享模式: 已启用（所有用户看到所有数据）')
"

echo ""
echo "🌐 2. 检查前端API配置"
echo "--------------------"
cd ../frontend/build
echo "检查API基础URL配置:"
grep -r "baseURL" static/js/*.js | head -3 | cut -c1-150

echo ""
echo "检查认证头配置:"
grep -r "Authorization" static/js/*.js | head -3 | cut -c1-150

echo ""
echo "🧪 3. 模拟前端请求（无认证）"
echo "---------------------------"
echo "直接访问API（应该失败）:"
curl -s "http://localhost:8080/api/research/" | head -100

echo ""
echo ""
echo "🧪 4. 模拟前端请求（带认证）"
echo "---------------------------"
# 获取token
token=$(curl -s -X POST "http://localhost:8080/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "zl", "password": "123"}' | \
  python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])")

echo "带token访问API:"
curl -s -H "Authorization: Bearer $token" \
  "http://localhost:8080/api/research/" | \
  python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'返回 {len(data)} 个项目')
if data:
    proj = data[0]
    logs = proj.get('communication_logs', [])
    print(f'第一个项目有 {len(logs)} 条交流记录')
"

echo ""
echo "🔧 5. 检查前端路由配置"
echo "---------------------"
echo "检查React Router配置:"
grep -r "PrivateRoute" static/js/*.js | wc -l
echo "找到 $(grep -r "PrivateRoute" static/js/*.js | wc -l) 处PrivateRoute引用"

echo ""
echo "📊 6. 建议"
echo "---------"
echo "如果前端没有正确处理认证，可能需要："
echo "1. 检查localStorage中是否有token"
echo "2. 确保API请求携带Authorization头"
echo "3. 处理401错误并重新登录"

echo ""
echo "🏁 检查完成"