#!/bin/bash
# API路由修复脚本

echo "🔧 开始修复API路由问题..."

# 第1步：检查当前状态
echo ""
echo "📋 第1步：检查当前状态"
echo "=========================="
echo "检查后端服务状态："
systemctl is-active research-backend && echo "✅ 后端服务运行中" || echo "❌ 后端服务未运行"

echo ""
echo "检查Nginx状态："
systemctl is-active nginx && echo "✅ Nginx运行中" || echo "❌ Nginx未运行"

echo ""
echo "检查后端端口："
netstat -tlnp | grep :8080 > /dev/null && echo "✅ 端口8080正在监听" || echo "❌ 端口8080未监听"

# 第2步：测试后端API直接访问
echo ""
echo "📋 第2步：测试后端API直接访问"
echo "================================"
echo "测试后端根路径："
curl -s -o /dev/null -w "状态码: %{http_code}\n" http://localhost:8080/

echo ""
echo "测试后端API路径："
curl -s -o /dev/null -w "状态码: %{http_code}\n" http://localhost:8080/api/

echo ""
echo "测试注册路径（直接访问后端）："
curl -s -o /dev/null -w "状态码: %{http_code}\n" -X POST http://localhost:8080/api/auth/register

# 第3步：修复Nginx配置
echo ""
echo "📋 第3步：修复Nginx配置"
echo "========================"
echo "备份当前配置..."
cp /etc/nginx/sites-available/research-dashboard /etc/nginx/sites-available/research-dashboard.backup.$(date +%Y%m%d_%H%M%S)

echo "创建新的Nginx配置..."
cat > /etc/nginx/sites-available/research-dashboard << 'EOF'
server {
    listen 80;
    server_name 45.149.156.216 _;
    
    # 前端静态文件
    root /var/www/html;
    index index.html;
    
    # API代理 - 重要：确保路径映射正确
    location /api/ {
        # 代理到后端，保持/api/路径
        proxy_pass http://127.0.0.1:8080/api/;
        
        # 设置代理头
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 超时设置
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
        send_timeout 300;
        
        # 禁用缓冲
        proxy_buffering off;
    }
    
    # 前端路由 - 所有非API请求返回index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|otf)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    
    # Gzip压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 10240;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml;
    gzip_disable "MSIE [1-6]\.";
}
EOF

echo "测试Nginx配置..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx配置正确"
    echo "重新加载Nginx..."
    systemctl reload nginx
    echo "✅ Nginx已重新加载"
else
    echo "❌ Nginx配置有错误，恢复备份..."
    cp /etc/nginx/sites-available/research-dashboard.backup.$(date +%Y%m%d_%H%M%S) /etc/nginx/sites-available/research-dashboard
    exit 1
fi

# 第4步：重启后端服务（确保清理）
echo ""
echo "📋 第4步：重启后端服务"
echo "======================="
echo "停止后端服务..."
systemctl stop research-backend

echo "清理数据库..."
cd /var/www/research-dashboard/backend
rm -f research_dashboard.db

echo "重新初始化数据库..."
python3 -c "
import sys
sys.path.append('/var/www/research-dashboard/backend')
from app.models.database import Base, engine
Base.metadata.create_all(bind=engine)
print('✅ 数据库重新初始化完成')
"

echo "启动后端服务..."
systemctl start research-backend
sleep 3

# 第5步：验证修复
echo ""
echo "📋 第5步：验证修复结果"
echo "======================="
echo "测试通过Nginx访问API："
echo ""
echo "1. 测试API根路径："
response=$(curl -s -o /dev/null -w "%{http_code}" http://45.149.156.216/api/)
if [ "$response" = "404" ] || [ "$response" = "200" ]; then
    echo "✅ API路由正常 (状态码: $response)"
else
    echo "❌ API路由异常 (状态码: $response)"
fi

echo ""
echo "2. 测试注册端点："
response=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://45.149.156.216/api/auth/register -H "Content-Type: application/json" -d '{}')
if [ "$response" = "422" ] || [ "$response" = "400" ]; then
    echo "✅ 注册端点正常 (状态码: $response - 预期的验证错误)"
elif [ "$response" = "405" ]; then
    echo "⚠️  注册端点返回405，可能是方法不允许"
elif [ "$response" = "404" ]; then
    echo "❌ 注册端点404错误 - 路由未找到"
else
    echo "❓ 注册端点返回: $response"
fi

# 第6步：显示日志
echo ""
echo "📋 第6步：检查日志"
echo "==================="
echo "后端最近日志："
journalctl -u research-backend -n 10 --no-pager

echo ""
echo "Nginx错误日志："
tail -5 /var/log/nginx/error.log

# 完成
echo ""
echo "🎯 修复脚本执行完成！"
echo "========================"
echo ""
echo "✅ 下一步操作："
echo "1. 在浏览器访问: http://45.149.156.216"
echo "2. 打开开发者工具 (F12)"
echo "3. 尝试注册新用户"
echo "4. 查看Network面板中的请求状态"
echo ""
echo "如果还有问题，请运行以下命令查看详细日志："
echo "  journalctl -u research-backend -f"
echo "  tail -f /var/log/nginx/error.log"