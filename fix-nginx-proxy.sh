#!/bin/bash

# 修复Nginx代理配置和测试POST请求
# 解决405错误和代理问题

echo "🔧 修复Nginx代理配置..."
echo "========================================"

# 1. 测试真正的POST请求
echo "1. 测试真正的POST请求到/api/auth/login:"
curl -X POST http://localhost:8080/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"zl","password":"123"}' \
     -w "状态码: %{http_code}\n"

echo ""

# 2. 测试通过3001端口的POST请求
echo "2. 测试通过Nginx代理的POST请求:"
curl -X POST http://localhost:3001/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"zl","password":"123"}' \
     -w "状态码: %{http_code}\n"

echo ""
echo "========================================"

# 3. 检查当前Nginx配置
echo "3. 当前Nginx代理配置:"
grep -A 15 "location /api/" /etc/nginx/sites-available/research-dashboard-3001

echo ""
echo "========================================"

# 4. 改进Nginx配置 - 添加更多代理头
echo "4. 改进Nginx代理配置..."

# 备份当前配置
cp /etc/nginx/sites-available/research-dashboard-3001 /etc/nginx/sites-available/research-dashboard-3001.backup2

# 创建改进的配置
cat > /etc/nginx/sites-available/research-dashboard-3001 << 'EOF'
# Nginx configuration for Research Dashboard (Port 3001)
server {
    listen 3001;
    server_name 45.149.156.216 localhost;

    # Frontend static files
    location / {
        root /var/www/html;
        try_files $uri $uri/ /index.html;
        
        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
    }
    
    # HTML files - no cache
    location ~* \.html$ {
        root /var/www/html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }
    
    # JS/CSS files - short cache for quick updates
    location ~* \.(js|css)$ {
        root /var/www/html;
        expires 1h;
        add_header Cache-Control "public, must-revalidate";
    }
    
    # Images - longer cache
    location ~* \.(jpg|jpeg|png|gif|ico|svg|webp)$ {
        root /var/www/html;
        expires 7d;
        add_header Cache-Control "public";
    }

    # Backend API proxy - 改进版本
    location /api/ {
        # 强制使用IPv4，避免IPv6问题
        proxy_pass http://127.0.0.1:8080;
        
        # HTTP版本和连接设置
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        
        # 基础代理头
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;
        
        # 确保正确传递请求方法和内容
        proxy_set_header X-Original-Method $request_method;
        proxy_pass_request_headers on;
        proxy_pass_request_body on;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # 缓存设置
        proxy_cache_bypass $http_upgrade;
        proxy_no_cache $http_pragma $http_authorization;
        
        # 错误处理
        proxy_intercept_errors off;
    }
}
EOF

echo "✅ 新的Nginx配置已创建"

# 5. 测试新配置
echo ""
echo "========================================"
echo "5. 测试新的Nginx配置:"
if nginx -t; then
    echo "✅ 配置语法正确"
    
    # 重新加载
    systemctl reload nginx
    echo "✅ Nginx已重新加载"
    
    # 等待服务稳定
    sleep 2
    
    # 测试改进后的代理
    echo ""
    echo "🧪 测试改进后的API代理:"
    
    echo "测试GET请求:"
    curl -s -w "GET /api/ 状态码: %{http_code}\n" http://localhost:3001/api/
    
    echo "测试POST登录请求:"
    curl -X POST http://localhost:3001/api/auth/login \
         -H "Content-Type: application/json" \
         -d '{"username":"zl","password":"123"}' \
         -s -w "POST /api/auth/login 状态码: %{http_code}\n"
    
    echo "测试GET用户信息:"
    curl -s -w "GET /api/auth/me 状态码: %{http_code}\n" http://localhost:3001/api/auth/me
    
else
    echo "❌ 配置语法错误，恢复备份"
    cp /etc/nginx/sites-available/research-dashboard-3001.backup2 /etc/nginx/sites-available/research-dashboard-3001
    nginx -t
    exit 1
fi

echo ""
echo "========================================"
echo "🎉 Nginx代理配置改进完成！"
echo "🌐 现在测试登录: http://45.149.156.216:3001"
echo ""
echo "📋 如果还有问题，检查:"
echo "   - 浏览器开发者工具的Network标签"
echo "   - tail -f /var/log/nginx/error.log"
echo "   - journalctl -u research-backend -f"