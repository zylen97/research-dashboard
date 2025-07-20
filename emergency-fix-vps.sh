#!/bin/bash

echo "🚨 紧急修复VPS服务..."

# SSH到VPS并执行修复
ssh root@45.149.156.216 << 'EOF'
# 1. 更新后端代码CORS配置
cd /root/research-dashboard/backend
echo "📝 添加CORS配置..."
sed -i 's|"http://45.149.156.216",|"http://45.149.156.216",\n        "http://45.149.156.216:3001",|' main.py

# 2. 重启后端服务
echo "🔄 重启后端服务..."
systemctl restart research-backend
sleep 3

# 3. 检查服务状态
echo "✅ 检查服务状态..."
systemctl status research-backend --no-pager

# 4. 测试API
echo -e "\n🧪 测试API..."
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: http://45.149.156.216:3001" \
  -d '{"username":"zz","password":"123"}' -v 2>&1 | grep -E "(< HTTP|< Access-Control)"

# 5. 测试Nginx代理
echo -e "\n🧪 测试Nginx代理..."
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: http://45.149.156.216:3001" \
  -d '{"username":"zz","password":"123"}' -v 2>&1 | grep -E "(< HTTP|< Access-Control)"
EOF

echo "✅ 修复完成！"