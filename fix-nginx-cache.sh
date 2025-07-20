#!/bin/bash

# 紧急修复Nginx缓存问题的脚本

echo "🚨 紧急修复：更新Nginx配置以解决缓存问题"

# 创建新的Nginx配置
cat > deployment/nginx-fixed.conf << 'EOF'
# Nginx configuration for Research Dashboard
# Place this file at: /etc/nginx/sites-available/research-dashboard
# Then create symlink: ln -s /etc/nginx/sites-available/research-dashboard /etc/nginx/sites-enabled/

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
        
        # 禁用缓存以确保更新生效
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
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
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 静态资源合理缓存（而不是1年！）
    location ~* \.(jpg|jpeg|png|gif|ico)$ {
        expires 7d;
        add_header Cache-Control "public";
    }
    
    # CSS和JS文件使用版本控制缓存
    location ~* \.(css|js)$ {
        expires 1h;
        add_header Cache-Control "public, must-revalidate";
    }
}
EOF

echo "✅ 新的Nginx配置已创建"
echo ""
echo "请将以下内容添加到 deployment.yml 的部署脚本中："
echo "sudo cp /var/www/research-dashboard/deployment/nginx-fixed.conf /etc/nginx/sites-available/research-dashboard"
echo "sudo systemctl reload nginx"