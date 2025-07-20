#!/bin/bash

echo "🚨 立即修复CORS问题..."

ssh root@45.149.156.216 << 'ENDSSH'
echo "=== 1. 检查后端服务 ==="
systemctl status research-backend --no-pager | head -10

echo -e "\n=== 2. 检查后端进程 ==="
ps aux | grep python | grep 8080

echo -e "\n=== 3. 停止后端服务 ==="
systemctl stop research-backend

echo -e "\n=== 4. 手动启动后端查看错误 ==="
cd /var/www/research-dashboard/backend
timeout 5 python3 main.py || true

echo -e "\n=== 5. 检查并修复main.py中的CORS配置 ==="
if ! grep -q "http://45.149.156.216:3001" main.py; then
    echo "添加CORS配置..."
    sed -i '/allow_origins=/,/\]/s|"http://45.149.156.216",|"http://45.149.156.216",\n        "http://45.149.156.216:3001",|' main.py
fi

echo -e "\n=== 6. 显示当前CORS配置 ==="
grep -A 10 "allow_origins=" main.py

echo -e "\n=== 7. 重启后端服务 ==="
systemctl start research-backend
sleep 3

echo -e "\n=== 8. 测试CORS响应 ==="
curl -X OPTIONS http://localhost:8080/api/auth/login \
  -H "Origin: http://45.149.156.216:3001" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v 2>&1 | grep -i "access-control"

echo -e "\n=== 9. 测试通过Nginx的CORS ==="
curl -X OPTIONS http://localhost/api/auth/login \
  -H "Origin: http://45.149.156.216:3001" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v 2>&1 | grep -i "access-control"

echo -e "\n=== 10. 确认服务状态 ==="
systemctl is-active research-backend && echo "✅ 后端运行中" || echo "❌ 后端未运行"
netstat -tlnp | grep 8080
ENDSSH