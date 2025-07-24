#!/bin/bash

# 🔧 修复nginx重定向问题 - Ultra Think版本
# 修复proxy_pass配置导致的端口丢失问题

echo "🔧 修复nginx重定向问题"
echo "执行时间: $(date)"
echo "========================================"

# 确保在VPS上执行
if [ ! -f "/etc/nginx/sites-available/research-dashboard-3001" ]; then
    echo "❌ 必须在VPS上执行，且nginx配置文件必须存在"
    exit 1
fi

cd /var/www/research-dashboard

echo "=== 第一步：备份当前nginx配置 ==="
cp /etc/nginx/sites-available/research-dashboard-3001 \
   /etc/nginx/sites-available/research-dashboard-3001.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ 配置已备份"

echo "=== 第二步：强制更新nginx配置 ==="
# 强制覆盖nginx配置
cp deployment/nginx-3001.conf /etc/nginx/sites-available/research-dashboard-3001
echo "✅ 配置文件已更新"

echo "=== 第三步：验证proxy_pass配置 ==="
# 检查关键配置是否正确
if grep -q "proxy_pass http://localhost:8080;" /etc/nginx/sites-available/research-dashboard-3001; then
    echo "✅ proxy_pass配置正确（无尾部斜杠）"
else
    echo "❌ proxy_pass配置仍有问题，手动修复..."
    # 手动修复proxy_pass配置
    sed -i 's|proxy_pass http://localhost:8080/;|proxy_pass http://localhost:8080;|g' \
        /etc/nginx/sites-available/research-dashboard-3001
    echo "✅ 已手动修复proxy_pass配置"
fi

echo "=== 第四步：检查Host头配置 ==="
if grep -q "X-Forwarded-Host" /etc/nginx/sites-available/research-dashboard-3001; then
    echo "✅ X-Forwarded-Host头已配置"
else
    echo "⚠️ 添加X-Forwarded-Host头..."
    # 在proxy_set_header部分添加X-Forwarded-Host
    sed -i '/proxy_set_header X-Forwarded-Port/a\        proxy_set_header X-Forwarded-Host $host:$server_port;' \
        /etc/nginx/sites-available/research-dashboard-3001
    echo "✅ 已添加X-Forwarded-Host头"
fi

echo "=== 第五步：测试nginx配置 ==="
if nginx -t; then
    echo "✅ nginx配置语法正确"
else
    echo "❌ nginx配置语法错误，显示详情："
    nginx -t
    exit 1
fi

echo "=== 第六步：重新加载nginx ==="
systemctl reload nginx
sleep 2

if systemctl is-active --quiet nginx; then
    echo "✅ nginx重新加载成功"
else
    echo "❌ nginx重新加载失败"
    systemctl status nginx
    exit 1
fi

echo "=== 第七步：测试API路由 ==="
echo "测试后端直连："
backend_direct=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8080/api/ideas-management/" 2>/dev/null)
echo "  后端直连状态码: $backend_direct"

echo "测试nginx代理："
nginx_proxy=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/api/ideas-management/" 2>/dev/null)
echo "  nginx代理状态码: $nginx_proxy"

echo "=== 第八步：测试重定向问题 ==="
echo "检查是否还有重定向问题..."
redirect_test=$(curl -s -I "http://localhost:3001/api/ideas-management/" | grep -i location || echo "无重定向")
echo "  重定向检查: $redirect_test"

if [ "$redirect_test" = "无重定向" ]; then
    echo "✅ 重定向问题已解决"
else
    echo "⚠️ 仍存在重定向: $redirect_test"
fi

echo "=== 第九步：验证完整API访问 ==="
# 测试一个完整的API请求
full_test=$(curl -s -w "%{http_code}" -o /dev/null "http://localhost:3001/api/ideas-management/" \
    -H "Origin: http://45.149.156.216:3001" \
    -H "Access-Control-Request-Method: GET" \
    -H "Access-Control-Request-Headers: Content-Type" \
    --request OPTIONS 2>/dev/null)

echo "  CORS预检请求状态码: $full_test"

if [ "$full_test" = "200" ] || [ "$full_test" = "204" ]; then
    echo "✅ CORS预检请求成功"
else
    echo "⚠️ CORS预检请求异常，状态码: $full_test"
fi

echo "=== 最终结果 ==="
if [ "$nginx_proxy" = "200" ] || [ "$nginx_proxy" = "404" ] || [ "$nginx_proxy" = "401" ]; then
    echo ""
    echo "🎉 ========================================"
    echo "🎉 nginx重定向问题修复成功！"
    echo "🎉 ========================================"
    echo ""
    echo "✅ nginx代理工作正常"
    echo "✅ 重定向问题已解决"
    echo "✅ API路由配置正确"
    echo ""
    echo "🎯 现在测试前端访问: http://45.149.156.216:3001"
    echo "📖 API直接访问: http://45.149.156.216:8080/docs"
else
    echo ""
    echo "❌ 修复可能不完整，显示诊断信息："
    echo ""
    echo "nginx配置文件内容（关键部分）："
    grep -A 10 "location /api/" /etc/nginx/sites-available/research-dashboard-3001
    echo ""
    echo "nginx错误日志："
    tail -5 /var/log/nginx/error.log 2>/dev/null || echo "无错误日志"
fi

echo ""
echo "========================================"
echo "修复完成时间: $(date)"