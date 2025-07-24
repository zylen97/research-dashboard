#!/bin/bash

# 紧急修复nginx CORS重定向问题
echo "🚨 紧急修复nginx CORS重定向问题..."

# 备份当前配置
cp /etc/nginx/sites-available/research-dashboard-3001 /etc/nginx/sites-available/research-dashboard-3001.backup.$(date +%Y%m%d_%H%M%S)

# 修复proxy_pass配置 - 添加结尾斜杠
sed -i 's|proxy_pass http://localhost:8080;|proxy_pass http://localhost:8080/;|g' /etc/nginx/sites-available/research-dashboard-3001

# 修复Host头配置
sed -i 's|proxy_set_header Host $host;|proxy_set_header Host $host:$server_port;|g' /etc/nginx/sites-available/research-dashboard-3001

# 移除nginx中的CORS头配置，避免与FastAPI冲突
sed -i '/add_header.*Access-Control/d' /etc/nginx/sites-available/research-dashboard-3001
sed -i '/add_header.*Content-Type.*text\/plain/d' /etc/nginx/sites-available/research-dashboard-3001
sed -i '/add_header.*Content-Length.*0/d' /etc/nginx/sites-available/research-dashboard-3001
sed -i '/return 204/d' /etc/nginx/sites-available/research-dashboard-3001

# 移除OPTIONS处理块
sed -i '/if ($request_method = OPTIONS)/,/}/d' /etc/nginx/sites-available/research-dashboard-3001

# 测试nginx配置
if nginx -t; then
    echo "✅ nginx配置测试通过"
    systemctl reload nginx
    echo "✅ nginx已重新加载"
    
    # 测试修复结果
    echo "🧪 测试修复结果..."
    curl -I http://localhost:3001/api/ideas-management/ 2>/dev/null | head -5
    
    echo "🎉 nginx CORS修复完成！"
else
    echo "❌ nginx配置测试失败，恢复备份"
    cp /etc/nginx/sites-available/research-dashboard-3001.backup.$(date +%Y%m%d_%H%M%S) /etc/nginx/sites-available/research-dashboard-3001
    exit 1
fi