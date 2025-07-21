#!/bin/bash

echo "=== 诊断CORS问题 ==="
echo "时间: $(date)"
echo ""

echo "=== 1. 检查Nginx配置文件 ==="
echo "主配置文件 (/etc/nginx/sites-enabled/):"
ls -la /etc/nginx/sites-enabled/
echo ""

echo "=== 2. 测试Nginx配置语法 ==="
sudo nginx -t
echo ""

echo "=== 3. 检查端口监听情况 ==="
sudo netstat -tlnp | grep -E "80|3001|8080"
echo ""

echo "=== 4. 检查后端服务状态 ==="
sudo systemctl status research-backend || echo "后端服务未找到"
echo ""
echo "检查8080端口进程:"
sudo lsof -i :8080
echo ""

echo "=== 5. 测试API端点 (从服务器内部) ==="
echo "测试80端口的API:"
curl -I -X OPTIONS http://localhost/api/auth/login
echo ""
echo "测试3001端口的API:"
curl -I -X OPTIONS http://localhost:3001/api/auth/login
echo ""
echo "直接测试后端8080端口:"
curl -I -X OPTIONS http://localhost:8080/api/auth/login
echo ""

echo "=== 6. 检查前端文件中的API配置 ==="
if [ -f /var/www/html/static/js/main.*.js ]; then
    echo "搜索前端打包文件中的API地址:"
    grep -o "REACT_APP_API_URL[^,]*" /var/www/html/static/js/main.*.js | head -5
    grep -o "window\.location\.origin" /var/www/html/static/js/main.*.js | head -5
fi
echo ""

echo "=== 7. 检查Nginx错误日志 ==="
echo "最近的错误日志:"
sudo tail -20 /var/log/nginx/error.log
echo ""

echo "=== 8. 检查前端访问日志 ==="
echo "最近的访问日志 (查找OPTIONS请求):"
sudo tail -50 /var/log/nginx/access.log | grep -E "OPTIONS|/api/"
echo ""

echo "=== 9. 检查防火墙规则 ==="
sudo ufw status numbered || sudo iptables -L -n
echo ""

echo "=== 10. 测试跨域请求 ==="
echo "从3001端口向80端口发起OPTIONS请求:"
curl -v -X OPTIONS \
  -H "Origin: http://45.149.156.216:3001" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  http://45.149.156.216/api/auth/login 2>&1 | grep -E "< HTTP|< Access-Control"
echo ""

echo "从3001端口向3001端口发起OPTIONS请求:"
curl -v -X OPTIONS \
  -H "Origin: http://45.149.156.216:3001" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  http://45.149.156.216:3001/api/auth/login 2>&1 | grep -E "< HTTP|< Access-Control"
echo ""

echo "=== 诊断完成 ==="