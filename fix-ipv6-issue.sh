#!/bin/bash

# 修复Nginx IPv6连接问题
# 强制Nginx使用IPv4连接后端

echo "🔧 修复Nginx IPv6连接问题..."

# 1. 备份当前配置
echo "📋 备份当前Nginx配置..."
cp /etc/nginx/sites-available/research-dashboard-3001 /etc/nginx/sites-available/research-dashboard-3001.backup

# 2. 修复IPv6问题 - 强制使用IPv4地址
echo "⚙️ 修复proxy_pass配置..."
sed -i 's|proxy_pass http://localhost:8080;|proxy_pass http://127.0.0.1:8080;|g' /etc/nginx/sites-available/research-dashboard-3001

# 3. 显示修改后的配置
echo "📋 修改后的proxy_pass配置:"
grep -A 2 -B 2 "proxy_pass" /etc/nginx/sites-available/research-dashboard-3001

# 4. 测试配置
echo "🔍 测试Nginx配置..."
if nginx -t; then
    echo "✅ 配置语法正确"
    
    # 5. 重新加载Nginx
    echo "🔄 重新加载Nginx..."
    systemctl reload nginx
    
    # 6. 等待服务稳定
    sleep 2
    
    # 7. 测试修复结果
    echo "🌐 测试API代理修复结果:"
    curl -s -o /dev/null -w "API代理状态码: %{http_code}\n" http://localhost:3001/api/
    
    # 8. 详细测试
    echo "🧪 详细测试API端点:"
    echo "测试根路径代理:"
    curl -v http://localhost:3001/api/ 2>&1 | head -10
    
else
    echo "❌ 配置语法错误，恢复备份"
    cp /etc/nginx/sites-available/research-dashboard-3001.backup /etc/nginx/sites-available/research-dashboard-3001
    exit 1
fi

echo ""
echo "🎉 IPv6问题修复完成！"
echo "🌐 现在应该可以正常访问: http://45.149.156.216:3001"