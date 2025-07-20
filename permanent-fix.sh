#!/bin/bash

echo "永久修复Nginx缓存问题"
echo "====================="
echo ""
echo "请在VPS上执行以下命令："
echo ""
echo "1. SSH连接到VPS："
echo "   ssh root@45.149.156.216"
echo ""
echo "2. 创建新的Nginx配置："
echo ""
cat << 'NGINX_CONFIG'
sudo tee /etc/nginx/sites-available/research-dashboard > /dev/null << 'EOF'
server {
    listen 80;
    server_name 45.149.156.216;

    # 前端文件 - 禁用强缓存
    location / {
        root /var/www/html;
        try_files $uri $uri/ /index.html;
        
        # 安全头
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        
        # 对HTML文件完全禁用缓存
        location ~* \.html$ {
            add_header Cache-Control "no-cache, no-store, must-revalidate";
            add_header Pragma "no-cache";
            add_header Expires "0";
        }
        
        # 对JS/CSS文件使用短期缓存
        location ~* \.(js|css)$ {
            expires 1h;
            add_header Cache-Control "public, must-revalidate";
        }
        
        # 对图片使用较长缓存
        location ~* \.(jpg|jpeg|png|gif|ico|svg|webp)$ {
            expires 7d;
            add_header Cache-Control "public";
        }
    }

    # 后端API
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF
NGINX_CONFIG
echo ""
echo "3. 测试并重启Nginx："
echo "   sudo nginx -t && sudo systemctl restart nginx"
echo ""
echo "4. 更新前端代码："
echo "   cd /var/www/research-dashboard"
echo "   git pull origin main"
echo "   cd frontend"
echo "   rm -rf build node_modules/.cache"
echo "   npm install && npm run build"
echo "   rm -rf /var/www/html/*"
echo "   cp -r build/* /var/www/html/"
echo ""
echo "这样就永久解决了缓存问题！"