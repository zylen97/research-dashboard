#!/bin/bash

# VPS CORS问题快速修复脚本
# 在VPS上运行这个脚本修复CORS问题

echo "🚀 开始修复CORS问题..."

# 备份现有配置
echo "📋 备份现有Nginx配置..."
cp /etc/nginx/sites-available/research-dashboard /etc/nginx/sites-available/research-dashboard.backup.$(date +%Y%m%d_%H%M%S)
cp /etc/nginx/sites-available/research-dashboard-3001 /etc/nginx/sites-available/research-dashboard-3001.backup.$(date +%Y%m%d_%H%M%S)

# 更新research-dashboard配置
echo "⚙️  更新主配置文件..."
cat > /etc/nginx/sites-available/research-dashboard << 'EOF'
# Nginx configuration for Research Dashboard
server {
    listen 80;
    server_name 45.149.156.216;

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

    # Backend API proxy
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Real IP headers
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS headers - 修复CORS问题
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, PATCH, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Accept, Accept-Language, Content-Language, Content-Type, Authorization' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        
        # Handle preflight requests
        if ($request_method = OPTIONS) {
            add_header 'Access-Control-Allow-Origin' '*' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, PATCH, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'Accept, Accept-Language, Content-Language, Content-Type, Authorization' always;
            add_header 'Access-Control-Allow-Credentials' 'true' always;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

# 更新research-dashboard-3001配置
echo "⚙️  更新3001端口配置文件..."
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

    # Backend API proxy
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Real IP headers
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS headers - 修复CORS问题
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, PATCH, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Accept, Accept-Language, Content-Language, Content-Type, Authorization' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        
        # Handle preflight requests
        if ($request_method = OPTIONS) {
            add_header 'Access-Control-Allow-Origin' '*' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, PATCH, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'Accept, Accept-Language, Content-Language, Content-Type, Authorization' always;
            add_header 'Access-Control-Allow-Credentials' 'true' always;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

# 测试Nginx配置
echo "🔍 测试Nginx配置..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx配置测试通过"
    
    # 重启Nginx
    echo "🔄 重启Nginx..."
    systemctl restart nginx
    
    echo "✅ CORS问题已修复！"
    echo "🌐 现在可以正常登录了"
else
    echo "❌ Nginx配置测试失败，请检查配置"
    echo "🔄 正在恢复备份..."
    cp /etc/nginx/sites-available/research-dashboard.backup.* /etc/nginx/sites-available/research-dashboard
    cp /etc/nginx/sites-available/research-dashboard-3001.backup.* /etc/nginx/sites-available/research-dashboard-3001
    systemctl restart nginx
fi