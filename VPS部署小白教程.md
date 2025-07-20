# 🚀 VPS部署小白教程：研究看板

## 👋 欢迎！

这个教程将手把手教你在自己的VPS上部署研究看板，让你的团队通过永久域名访问。

---

## 🎯 你将得到什么

- ✅ 永久稳定的访问地址（如：https://research.你的域名.com）
- ✅ 完全控制服务器和数据
- ✅ 无使用时间限制
- ✅ 更快的访问速度
- ✅ 专业的HTTPS加密

---

## 📋 你需要准备什么

### 必须有的：
- ✅ 一台VPS服务器（1GB内存以上）
- ✅ 一个域名（如果没有可以买一个，约$10/年）
- ✅ 30分钟-1小时时间

### 推荐的VPS配置：
- **内存**：1GB以上
- **CPU**：1核以上
- **存储**：20GB以上
- **系统**：Ubuntu 20.04 或 22.04
- **网络**：不限流量

---

## 🚀 开始部署！总共7步

### 第1步：连接到你的VPS

#### 使用SSH连接：
```bash
ssh root@你的VPS的IP地址
```

例如：
```bash
ssh root@123.456.789.101
```

#### 第一次连接会询问：
```
Are you sure you want to continue connecting (yes/no)?
```
输入 `yes` 并回车。

#### 然后输入密码
输入你VPS的root密码（输入时屏幕不会显示，这是正常的）。

连接成功后你会看到类似这样：
```
Welcome to Ubuntu 22.04.2 LTS
root@your-server:~#
```

---

### 第2步：更新系统并安装必要软件

复制粘贴下面的命令（一行一行执行）：

```bash
# 更新系统包列表
apt update

# 升级系统
apt upgrade -y

# 安装必要的软件
apt install -y nginx python3 python3-pip nodejs npm git curl supervisor sqlite3
```

这会花费几分钟时间，等待完成。

---

### 第3步：下载项目代码

```bash
# 进入网站根目录
cd /var/www

# 下载项目代码（替换成你的项目地址）
git clone https://github.com/你的用户名/research-dashboard.git

# 或者如果你有项目文件，可以用scp上传
# scp -r /本地/项目/路径 root@你的IP:/var/www/
```

如果你没有git仓库，可以先在本地打包项目：
```bash
# 在本地项目目录下
tar -czf research-dashboard.tar.gz .

# 上传到服务器
scp research-dashboard.tar.gz root@你的IP:/var/www/

# 在服务器上解压
cd /var/www
tar -xzf research-dashboard.tar.gz
mv research-dashboard研究看板项目文件夹名 research-dashboard
```

---

### 第4步：配置后端服务

```bash
# 进入项目目录
cd /var/www/research-dashboard

# 安装Python依赖
cd backend
pip3 install -r requirements.txt

# 创建数据库
python3 -c "
from app.models.database import init_db
init_db()
print('数据库初始化完成')
"

# 创建systemd服务文件
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
ExecStart=/usr/bin/python3 main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# 启动并设置开机自启
systemctl daemon-reload
systemctl enable research-backend
systemctl start research-backend

# 检查状态
systemctl status research-backend
```

---

### 第5步：配置前端

```bash
# 进入前端目录
cd /var/www/research-dashboard/frontend

# 安装依赖
npm install

# 创建环境配置文件
cat > .env.production << 'EOF'
REACT_APP_API_URL=https://你的域名.com
EOF

# 构建前端
npm run build

# 将构建结果复制到网站目录
cp -r build/* /var/www/html/
```

---

### 第6步：配置Nginx

```bash
# 备份默认配置
cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup

# 创建新的配置文件
cat > /etc/nginx/sites-available/research-dashboard << 'EOF'
server {
    listen 80;
    server_name 你的域名.com www.你的域名.com;
    
    # 重定向到HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name 你的域名.com www.你的域名.com;
    
    # SSL证书路径（先用HTTP测试，稍后配置SSL）
    # ssl_certificate /etc/letsencrypt/live/你的域名.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/你的域名.com/privkey.pem;
    
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
    }
    
    # 静态文件缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# 启用站点
ln -sf /etc/nginx/sites-available/research-dashboard /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 测试配置
nginx -t

# 重启Nginx
systemctl restart nginx
```

---

### 第7步：配置域名和SSL

#### A. 配置域名解析
1. 登录你的域名管理面板
2. 添加A记录：
   - **名称**：@ （或者你想要的子域名如 research）
   - **类型**：A
   - **值**：你的VPS IP地址
   - **TTL**：300

#### B. 安装免费SSL证书
```bash
# 安装Certbot
apt install -y certbot python3-certbot-nginx

# 获取SSL证书（替换成你的域名）
certbot --nginx -d 你的域名.com -d www.你的域名.com

# 测试自动续期
certbot renew --dry-run
```

按照提示填写邮箱，同意条款，选择是否接收邮件。

---

## 🎉 完成！测试你的部署

### 检查服务状态：
```bash
# 检查后端服务
systemctl status research-backend

# 检查Nginx
systemctl status nginx

# 检查端口是否在监听
netstat -tlnp | grep :8080  # 后端
netstat -tlnp | grep :80    # HTTP
netstat -tlnp | grep :443   # HTTPS
```

### 访问你的网站：
在浏览器输入：`https://你的域名.com`

你应该能看到研究看板的登录界面！

---

## 🔧 日常管理

### 重启服务：
```bash
# 重启后端
systemctl restart research-backend

# 重启前端（Nginx）
systemctl restart nginx

# 查看日志
journalctl -u research-backend -f
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### 更新项目：
```bash
cd /var/www/research-dashboard

# 拉取最新代码
git pull

# 重新构建前端
cd frontend
npm run build
cp -r build/* /var/www/html/

# 重启后端
systemctl restart research-backend
```

### 备份数据：
```bash
# 创建备份脚本
cat > /root/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/root/backups"
mkdir -p $BACKUP_DIR

# 备份数据库
cp /var/www/research-dashboard/backend/research_dashboard.db $BACKUP_DIR/db_backup_$DATE.db

# 备份代码
tar -czf $BACKUP_DIR/code_backup_$DATE.tar.gz /var/www/research-dashboard

# 删除7天前的备份
find $BACKUP_DIR -name "*.db" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "备份完成: $DATE"
EOF

chmod +x /root/backup.sh

# 设置每天自动备份
echo "0 2 * * * /root/backup.sh" | crontab -
```

---

## 🆘 常见问题解决

### Q1: 502 Bad Gateway错误
```bash
# 检查后端是否运行
systemctl status research-backend

# 如果没运行，启动它
systemctl start research-backend

# 查看错误日志
journalctl -u research-backend
```

### Q2: 无法访问网站
```bash
# 检查防火墙
ufw status

# 如果开启了防火墙，允许HTTP和HTTPS
ufw allow 80
ufw allow 443

# 检查域名解析
nslookup 你的域名.com
```

### Q3: SSL证书问题
```bash
# 重新获取证书
certbot --nginx --force-renewal -d 你的域名.com

# 检查证书状态
certbot certificates
```

### Q4: 数据库错误
```bash
# 重新初始化数据库
cd /var/www/research-dashboard/backend
python3 -c "
from app.models.database import init_db
init_db()
"
```

---

## 💰 成本估算

### 服务器费用：
- **基础VPS**：$2.5-5/月（1GB内存）
- **域名**：$10-15/年
- **总计**：约$40-75/年

### 推荐VPS提供商：
- **DigitalOcean**：$4/月起，新用户送$200
- **Vultr**：$2.5/月起，稳定可靠
- **Linode**：$5/月起，性能很好
- **国内阿里云/腾讯云**：约¥100-200/年

---

## 🔒 安全建议

### 基础安全设置：
```bash
# 1. 更改SSH端口
sed -i 's/#Port 22/Port 2222/' /etc/ssh/sshd_config
systemctl restart ssh

# 2. 禁用root密码登录（建议配置密钥后）
# sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config

# 3. 安装防火墙
ufw enable
ufw allow 2222  # SSH端口
ufw allow 80    # HTTP
ufw allow 443   # HTTPS

# 4. 自动安全更新
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
```

### 定期维护：
```bash
# 创建维护脚本
cat > /root/maintenance.sh << 'EOF'
#!/bin/bash
# 更新系统
apt update && apt upgrade -y

# 清理日志
journalctl --vacuum-time=30d

# 清理包缓存
apt autoremove -y
apt autoclean

echo "维护完成: $(date)"
EOF

chmod +x /root/maintenance.sh

# 设置每周自动维护
echo "0 3 * * 0 /root/maintenance.sh" | crontab -
```

---

## 🎓 进阶功能

### 监控和告警：
```bash
# 安装监控工具
apt install -y htop iotop nethogs

# 简单的服务监控脚本
cat > /root/monitor.sh << 'EOF'
#!/bin/bash
if ! systemctl is-active --quiet research-backend; then
    systemctl start research-backend
    echo "后端服务已重启: $(date)"
fi

if ! systemctl is-active --quiet nginx; then
    systemctl start nginx
    echo "Nginx已重启: $(date)"
fi
EOF

chmod +x /root/monitor.sh

# 每5分钟检查一次
echo "*/5 * * * * /root/monitor.sh" | crontab -
```

### 多域名配置：
如果你想要多个域名指向同一个网站，修改Nginx配置：
```bash
# 在server_name行添加多个域名
server_name 你的域名.com www.你的域名.com 另一个域名.com;
```

---

## 🎉 恭喜！你成功了！

现在你有了：
- ✅ 专业的HTTPS网站
- ✅ 永久稳定的访问地址
- ✅ 完全控制的服务器环境
- ✅ 自动备份和监控
- ✅ 安全的访问控制

你的团队成员现在可以通过 `https://你的域名.com` 访问研究看板了！

### 下一步：
1. 创建团队并获得邀请码
2. 分享网址给团队成员
3. 开始愉快的团队协作！

---

## 📞 需要帮助？

如果遇到问题：
1. 检查服务状态：`systemctl status research-backend nginx`
2. 查看日志：`journalctl -u research-backend`
3. 检查网络：`curl -I https://你的域名.com`
4. 准备好错误信息寻求技术支持

**祝你使用愉快！** 🎉