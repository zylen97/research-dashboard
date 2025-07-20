#!/bin/bash

echo "🔍 检查VPS服务状态..."

# SSH到VPS并检查服务状态
ssh root@45.149.156.216 << 'EOF'
echo "=== 检查后端服务状态 ==="
systemctl status research-backend

echo -e "\n=== 检查后端进程 ==="
ps aux | grep python | grep 8080

echo -e "\n=== 检查8080端口 ==="
netstat -tlnp | grep 8080

echo -e "\n=== 检查Nginx状态 ==="
systemctl status nginx

echo -e "\n=== 测试本地API ==="
curl -I http://localhost:8080/api/auth/login

echo -e "\n=== 检查Nginx配置 ==="
cat /etc/nginx/sites-enabled/research-dashboard | grep -A 10 "location /api/"

echo -e "\n=== 测试Nginx代理 ==="
curl -I http://localhost/api/auth/login
EOF