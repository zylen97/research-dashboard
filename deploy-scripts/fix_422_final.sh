#!/bin/bash
# 终极修复422错误方案

echo "========================================="
echo "🚀 终极修复422错误"
echo "========================================="

# 1. 清理前端缓存
echo "1. 清理前端缓存..."
rm -rf /var/www/research-dashboard/frontend/build
echo "✅ 前端缓存已清理"

# 2. 拉取最新代码
echo -e "\n2. 拉取最新代码..."
cd /var/www/research-dashboard
git pull

# 3. 重新构建前端
echo -e "\n3. 重新构建前端..."
cd /var/www/research-dashboard/frontend
npm run build
echo "✅ 前端构建完成"

# 4. 重启nginx
echo -e "\n4. 重启nginx..."
systemctl restart nginx
echo "✅ Nginx已重启"

# 5. 重启后端
echo -e "\n5. 重启后端服务..."
systemctl restart research-backend
sleep 3
echo "✅ 后端服务已重启"

# 6. 测试API
echo -e "\n6. 测试API端点..."
cd /var/www/research-dashboard/backend

# 先登录获取token
echo "登录获取token..."
LOGIN_RESPONSE=$(curl -s -X POST "http://localhost:8080/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "zl", "password": "zl123456"}')

TOKEN=$(echo $LOGIN_RESPONSE | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('access_token', ''))" 2>/dev/null)

if [ ! -z "$TOKEN" ]; then
    echo "✅ 登录成功"
    
    # 测试待办API
    echo -e "\n测试待办API..."
    RESPONSE=$(curl -s -w "\nHTTP状态码: %{http_code}" \
      -H "Authorization: Bearer $TOKEN" \
      "http://localhost:8080/api/research/todos")
    
    echo "$RESPONSE"
else
    echo "❌ 登录失败: $LOGIN_RESPONSE"
fi

# 7. 清理浏览器缓存提示
echo -e "\n========================================="
echo "📌 重要提示："
echo "1. 服务已经全部重启"
echo "2. 请在浏览器中执行以下操作："
echo "   - Ctrl+F5 强制刷新页面"
echo "   - 或者打开开发者工具 (F12)"
echo "   - 在Network标签中勾选 'Disable cache'"
echo "   - 然后刷新页面"
echo "3. 如果还有问题，请清除浏览器所有缓存和Cookie"
echo "========================================="
echo ""
echo "访问地址: http://45.149.156.216:3001"
echo "========================================="