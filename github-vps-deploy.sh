#!/bin/bash
# VPS GitHub部署脚本 - 研究看板
# 使用方法：在VPS上运行此脚本

set -e

echo "🚀 从GitHub部署研究看板到VPS..."
echo "IP: 62.106.70.2"
echo "========================================"

# 第1步：更新系统
echo "📦 更新系统..."
apt update && apt upgrade -y

# 第2步：安装必要软件
echo "🛠️ 安装软件..."
apt install -y nginx python3 python3-pip nodejs npm git curl supervisor sqlite3 ufw htop

# 第3步：配置防火墙
echo "🔒 配置防火墙..."
ufw allow 22
ufw allow 80
ufw allow 443
ufw --force enable

# 第4步：克隆项目
echo "📥 从GitHub克隆项目..."
cd /var/www
rm -rf research-dashboard
git clone https://github.com/zylen97/research-dashboard.git
cd research-dashboard

# 第5步：配置后端
echo "🐍 配置后端..."
cd backend
pip3 install -r requirements.txt

# 初始化数据库
python3 -c "
import sys
sys.path.append('/var/www/research-dashboard/backend')
from app.models.database import init_db
init_db()
print('✅ 数据库初始化完成')
"

# 创建后端服务
cat > /etc/systemd/system/research-backend.service << 'EOF'
[Unit]
Description=Research Dashboard Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/research-dashboard/backend
Environment=PATH=/usr/bin:/usr/local/bin
Environment=PYTHONPATH=/var/www/research-dashboard/backend
ExecStart=/usr/bin/python3 -m uvicorn main:app --host 0.0.0.0 --port 8080
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# 第6步：配置前端
echo "⚛️ 配置前端..."
cd /var/www/research-dashboard/frontend
npm install

# 创建生产环境配置
echo "REACT_APP_API_URL=http://62.106.70.2" > .env.production

# 构建前端
npm run build

# 复制到web目录
rm -rf /var/www/html/*
cp -r build/* /var/www/html/

# 第7步：配置Nginx
echo "🌐 配置Nginx..."
cat > /etc/nginx/sites-available/research-dashboard << 'EOF'
server {
    listen 80;
    server_name 62.106.70.2 _;
    
    root /var/www/html;
    index index.html;
    
    # 前端路由
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # API代理到后端
    location /api/ {
        proxy_pass http://127.0.0.1:8080/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }
    
    # 静态文件缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# 启用站点
ln -sf /etc/nginx/sites-available/research-dashboard /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 第8步：设置权限
echo "🔑 设置权限..."
chown -R www-data:www-data /var/www/research-dashboard
chown -R www-data:www-data /var/www/html

# 第9步：启动服务
echo "🚀 启动服务..."
systemctl daemon-reload
systemctl enable research-backend
systemctl start research-backend
systemctl reload nginx

# 第10步：检查状态
echo "🔍 检查服务状态..."
sleep 3

if systemctl is-active --quiet research-backend; then
    echo "✅ 后端服务运行正常"
else
    echo "❌ 后端服务启动失败"
    journalctl -u research-backend --no-pager -n 10
fi

if systemctl is-active --quiet nginx; then
    echo "✅ Nginx运行正常"
else
    echo "❌ Nginx启动失败"
fi

if netstat -tlnp | grep -q :8080; then
    echo "✅ 后端端口8080正常监听"
else
    echo "❌ 后端端口8080未监听"
fi

if netstat -tlnp | grep -q :80; then
    echo "✅ HTTP端口80正常监听"
else
    echo "❌ HTTP端口80未监听"
fi

# 第11步：创建管理脚本
echo "📝 创建管理脚本..."
cat > /root/research-manage.sh << 'EOF'
#!/bin/bash
case "$1" in
    status)
        echo "=== 研究看板服务状态 ==="
        echo -n "后端服务: "
        systemctl is-active research-backend || echo "停止"
        echo -n "Nginx服务: "
        systemctl is-active nginx || echo "停止"
        echo ""
        echo "=== 端口监听状态 ==="
        netstat -tlnp | grep :8080 | head -1 || echo "后端端口8080未监听"
        netstat -tlnp | grep :80 | head -1 || echo "HTTP端口80未监听"
        ;;
    restart)
        echo "重启研究看板服务..."
        systemctl restart research-backend
        systemctl reload nginx
        echo "重启完成"
        ;;
    update)
        echo "从GitHub更新代码..."
        cd /var/www/research-dashboard
        git pull origin main
        cd frontend
        npm run build
        cp -r build/* /var/www/html/
        systemctl restart research-backend
        echo "更新完成"
        ;;
    logs)
        echo "=== 后端日志 ==="
        journalctl -u research-backend -n 20 --no-pager
        ;;
    backup)
        DATE=$(date +%Y%m%d_%H%M%S)
        mkdir -p /root/backups
        cp /var/www/research-dashboard/backend/research_dashboard.db /root/backups/backup_$DATE.db
        echo "数据库已备份到: /root/backups/backup_$DATE.db"
        ;;
    *)
        echo "研究看板管理脚本"
        echo "用法: $0 {status|restart|update|logs|backup}"
        echo ""
        echo "  status  - 查看服务状态"
        echo "  restart - 重启所有服务"
        echo "  update  - 从GitHub更新代码"
        echo "  logs    - 查看后端日志"
        echo "  backup  - 备份数据库"
        ;;
esac
EOF

chmod +x /root/research-manage.sh

# 第12步：设置自动备份
echo "💾 设置自动备份..."
cat > /root/auto-backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/root/backups"
mkdir -p $BACKUP_DIR

cp /var/www/research-dashboard/backend/research_dashboard.db $BACKUP_DIR/auto_backup_$DATE.db
find $BACKUP_DIR -name "auto_backup_*.db" -mtime +7 -delete

echo "$(date): 自动备份完成" >> /var/log/research-backup.log
EOF

chmod +x /root/auto-backup.sh
(crontab -l 2>/dev/null; echo "0 2 * * * /root/auto-backup.sh") | crontab -

echo ""
echo "🎉 部署完成！"
echo "========================================"
echo "🌐 访问地址: http://62.106.70.2"
echo "📱 手机也可以访问同样的地址"
echo ""
echo "📋 常用管理命令："
echo "  /root/research-manage.sh status   - 查看状态"
echo "  /root/research-manage.sh restart  - 重启服务"
echo "  /root/research-manage.sh update   - 更新代码"
echo "  /root/research-manage.sh logs     - 查看日志"
echo "  /root/research-manage.sh backup   - 手动备份"
echo ""
echo "🔄 自动备份：每天凌晨2点自动备份数据库"
echo "📁 备份位置：/root/backups/"
echo ""
echo "✨ 使用说明："
echo "1. 访问 http://62.106.70.2"
echo "2. 点击'注册账号'创建第一个用户"
echo "3. 创建团队并获得邀请码"
echo "4. 分享邀请码给团队成员"
echo "========================================"

# 显示访问测试
echo "🧪 测试访问..."
curl -s -o /dev/null -w "HTTP状态码: %{http_code}\n" http://localhost:80/ || echo "❌ 无法访问本地服务"

echo ""
echo "🎯 下一步：在浏览器打开 http://62.106.70.2 开始使用！"