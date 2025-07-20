#!/bin/bash
# VPS自动部署脚本 - 研究看板

set -e  # 遇到错误立即退出

echo "🚀 开始部署研究看板到VPS..."

# 第1步：更新系统
echo "📦 更新系统软件包..."
apt update
apt upgrade -y

# 第2步：安装必要软件
echo "🛠️ 安装必要软件..."
apt install -y nginx python3 python3-pip nodejs npm git curl supervisor sqlite3 ufw htop

# 第3步：配置防火墙
echo "🔒 配置防火墙..."
ufw allow 22      # SSH
ufw allow 80      # HTTP
ufw allow 443     # HTTPS
ufw --force enable

# 第4步：创建项目目录
echo "📁 创建项目目录..."
mkdir -p /var/www/research-dashboard
cd /var/www/research-dashboard

# 提示用户上传代码
echo "⏸️  现在需要上传项目代码..."
echo "请在本地运行以下命令上传代码："
echo "tar -czf research-dashboard.tar.gz --exclude='node_modules' --exclude='*.log' --exclude='*.pid' ."
echo "scp research-dashboard.tar.gz root@62.106.70.2:/var/www/"
echo ""
echo "上传完成后，请按任意键继续..."
read -n 1 -s

# 第5步：解压代码
echo "📦 解压项目代码..."
cd /var/www
if [ -f "research-dashboard.tar.gz" ]; then
    tar -xzf research-dashboard.tar.gz -C research-dashboard
    echo "✅ 代码解压完成"
else
    echo "❌ 找不到项目代码文件，请确保已上传 research-dashboard.tar.gz"
    exit 1
fi

# 第6步：配置后端
echo "🐍 配置Python后端..."
cd /var/www/research-dashboard/backend

# 安装Python依赖
pip3 install fastapi uvicorn python-jose[cryptography] passlib[bcrypt] python-multipart sqlalchemy

# 初始化数据库
echo "🗄️ 初始化数据库..."
python3 -c "
import sys
sys.path.append('/var/www/research-dashboard/backend')
from app.models.database import init_db
init_db()
print('数据库初始化完成')
"

# 第7步：创建后端服务
echo "⚙️ 创建后端systemd服务..."
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

# 第8步：配置前端
echo "⚛️ 配置React前端..."
cd /var/www/research-dashboard/frontend

# 安装Node.js依赖
npm install

# 创建生产环境配置
echo "REACT_APP_API_URL=http://62.106.70.2" > .env.production

# 构建前端
npm run build

# 复制到web目录
rm -rf /var/www/html/*
cp -r build/* /var/www/html/

# 第9步：配置Nginx
echo "🌐 配置Nginx..."
cat > /etc/nginx/sites-available/research-dashboard << 'EOF'
server {
    listen 80;
    server_name 62.106.70.2;
    
    # 前端文件
    root /var/www/html;
    index index.html;
    
    # 前端路由处理
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # 后端API代理
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
    
    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
}
EOF

# 启用站点
ln -sf /etc/nginx/sites-available/research-dashboard /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 第10步：设置文件权限
echo "🔑 设置文件权限..."
chown -R www-data:www-data /var/www/research-dashboard
chown -R www-data:www-data /var/www/html
chmod +x /var/www/research-dashboard/backend/main.py

# 第11步：启动服务
echo "🚀 启动所有服务..."
systemctl daemon-reload
systemctl enable research-backend
systemctl start research-backend
systemctl restart nginx

# 第12步：检查服务状态
echo "🔍 检查服务状态..."
echo "后端服务状态："
systemctl is-active research-backend && echo "✅ 后端运行正常" || echo "❌ 后端启动失败"

echo "Nginx状态："
systemctl is-active nginx && echo "✅ Nginx运行正常" || echo "❌ Nginx启动失败"

echo "端口监听状态："
netstat -tlnp | grep :8080 && echo "✅ 后端端口8080正常" || echo "❌ 后端端口8080未监听"
netstat -tlnp | grep :80 && echo "✅ HTTP端口80正常" || echo "❌ HTTP端口80未监听"

# 第13步：创建管理脚本
echo "📝 创建管理脚本..."
cat > /root/research-admin.sh << 'EOF'
#!/bin/bash
case "$1" in
    status)
        echo "=== 服务状态 ==="
        systemctl status research-backend --no-pager
        systemctl status nginx --no-pager
        ;;
    restart)
        echo "重启所有服务..."
        systemctl restart research-backend
        systemctl restart nginx
        echo "重启完成"
        ;;
    logs)
        echo "=== 后端日志 ==="
        journalctl -u research-backend -n 50
        ;;
    backup)
        DATE=$(date +%Y%m%d_%H%M%S)
        cp /var/www/research-dashboard/backend/research_dashboard.db /root/backup_$DATE.db
        echo "数据库已备份到: /root/backup_$DATE.db"
        ;;
    *)
        echo "用法: $0 {status|restart|logs|backup}"
        ;;
esac
EOF

chmod +x /root/research-admin.sh

# 第14步：创建自动备份
echo "💾 设置自动备份..."
cat > /root/auto-backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/root/backups"
mkdir -p $BACKUP_DIR

# 备份数据库
cp /var/www/research-dashboard/backend/research_dashboard.db $BACKUP_DIR/db_backup_$DATE.db

# 删除7天前的备份
find $BACKUP_DIR -name "*.db" -mtime +7 -delete

echo "自动备份完成: $DATE"
EOF

chmod +x /root/auto-backup.sh

# 设置每天凌晨2点自动备份
(crontab -l 2>/dev/null; echo "0 2 * * * /root/auto-backup.sh") | crontab -

echo ""
echo "🎉 部署完成！"
echo "=================================="
echo "访问地址: http://62.106.70.2"
echo "管理命令: /root/research-admin.sh status"
echo "备份命令: /root/research-admin.sh backup"
echo "查看日志: /root/research-admin.sh logs"
echo "重启服务: /root/research-admin.sh restart"
echo "=================================="
echo ""
echo "请在浏览器访问 http://62.106.70.2 测试部署结果"
echo "首次访问请点击'注册账号'创建团队"