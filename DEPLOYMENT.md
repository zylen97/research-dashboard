# USTS Research Dashboard - Deployment Guide

本文档提供USTS科研管理系统的完整部署指南，包括本地开发、生产环境部署、监控和故障排除。

## 📋 目录

- [环境要求](#环境要求)
- [本地开发部署](#本地开发部署)
- [生产环境部署](#生产环境部署)
- [自动化部署](#自动化部署)
- [环境配置](#环境配置)
- [数据库管理](#数据库管理)
- [性能监控](#性能监控)
- [故障排除](#故障排除)
- [安全配置](#安全配置)
- [备份策略](#备份策略)

## 🔧 环境要求

### 基础环境
- **操作系统**: Ubuntu 20.04+ / CentOS 8+ / macOS 12+
- **Python**: 3.8+ (推荐 3.9+)
- **Node.js**: 16+ (推荐 18 LTS)
- **Git**: 2.25+

### 生产环境附加要求
- **Nginx**: 1.18+
- **Systemd**: 242+
- **内存**: 最小2GB，推荐4GB+
- **存储**: 最小10GB，推荐50GB+
- **网络**: 稳定的互联网连接

### 推荐配置
```bash
# CPU核心数
min: 2 cores
recommended: 4+ cores

# 内存
min: 2GB RAM
recommended: 8GB+ RAM

# 存储
min: 20GB SSD
recommended: 100GB+ SSD
```

## 🏠 本地开发部署

### 方式一：一键启动（推荐）

```bash
# 1. 克隆项目
git clone https://github.com/zylen97/research-dashboard.git
cd research-dashboard

# 2. 给予执行权限
chmod +x start-dev.sh

# 3. 一键启动
./start-dev.sh
```

### 方式二：分步部署

#### 后端部署
```bash
# 1. 进入后端目录
cd backend

# 2. 创建虚拟环境（推荐）
python -m venv venv
source venv/bin/activate  # Linux/macOS
# venv\Scripts\activate  # Windows

# 3. 安装依赖
pip install -r requirements.txt

# 4. 初始化数据库
python scripts/init_db.py

# 5. 运行开发服务器
python main.py
```

#### 前端部署
```bash
# 1. 打开新终端，进入前端目录
cd frontend

# 2. 安装依赖
npm install
# 或使用yarn
yarn install

# 3. 启动开发服务器
npm start
# 或
yarn start
```

### 访问应用
- **前端**: http://localhost:3001
- **后端API**: http://localhost:8080
- **API文档**: http://localhost:8080/docs

### 默认账户
| 用户名 | 密码 | 说明 |
|--------|------|------|
| zl     | 123  | 测试用户1 |
| zz     | 123  | 测试用户2 |
| yq     | 123  | 测试用户3 |
| dj     | 123  | 测试用户4 |

## 🌐 生产环境部署

### 服务器准备

#### 1. 系统更新
```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y

# CentOS/RHEL
sudo yum update -y
```

#### 2. 安装基础软件
```bash
# Ubuntu/Debian
sudo apt install -y python3 python3-pip python3-venv nodejs npm nginx git

# CentOS/RHEL
sudo yum install -y python3 python3-pip nodejs npm nginx git
```

#### 3. 安装Node.js LTS（如果版本过低）
```bash
# 使用NodeSource仓库
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 应用部署

#### 1. 项目克隆
```bash
# 创建应用目录
sudo mkdir -p /opt/research-dashboard
sudo chown $USER:$USER /opt/research-dashboard

# 克隆项目
cd /opt
git clone https://github.com/zylen97/research-dashboard.git
cd research-dashboard
```

#### 2. 后端部署
```bash
# 创建虚拟环境
cd backend
python3 -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 设置环境变量
export ENVIRONMENT=production
export SECRET_KEY="your-super-secret-key-change-in-production"
export DATABASE_URL="sqlite:///./data/research_dashboard_prod.db"

# 初始化生产数据库
python scripts/init_db.py

# 测试启动
python main.py
```

#### 3. 前端构建
```bash
# 进入前端目录
cd ../frontend

# 安装依赖
npm install --production

# 构建生产版本
npm run build

# 构建文件位于 build/ 目录
```

### Systemd服务配置

#### 创建后端服务
```bash
sudo nano /etc/systemd/system/research-backend.service
```

```ini
[Unit]
Description=USTS Research Dashboard Backend
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/research-dashboard/backend
Environment=ENVIRONMENT=production
Environment=SECRET_KEY=your-super-secret-key-change-in-production
Environment=DATABASE_URL=sqlite:///./data/research_dashboard_prod.db
Environment=CORS_ORIGINS=http://45.149.156.216:3001
ExecStart=/opt/research-dashboard/backend/venv/bin/python main.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

#### 启动后端服务
```bash
# 重新加载systemd配置
sudo systemctl daemon-reload

# 启用服务（开机自启）
sudo systemctl enable research-backend

# 启动服务
sudo systemctl start research-backend

# 检查状态
sudo systemctl status research-backend
```

### Nginx配置

#### 创建站点配置
```bash
sudo nano /etc/nginx/sites-available/research-dashboard
```

```nginx
# 前端配置
server {
    listen 3001;
    server_name 45.149.156.216;
    
    root /opt/research-dashboard/frontend/build;
    index index.html;
    
    # 启用Gzip压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 10240;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }
    
    # React路由支持
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
    
    # API代理
    location /api {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 超时配置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Swagger文档代理
    location /docs {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# 后端直接访问（可选）
server {
    listen 8080;
    server_name 45.149.156.216;
    
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### 启用站点
```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/research-dashboard /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重新加载配置
sudo systemctl reload nginx

# 检查状态
sudo systemctl status nginx
```

### SSL/HTTPS配置（推荐）

#### 使用Let's Encrypt
```bash
# 安装Certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取SSL证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo crontab -e
# 添加以下行：
0 12 * * * /usr/bin/certbot renew --quiet
```

## 🚀 自动化部署

### GitHub Actions部署

项目已配置GitHub Actions自动部署，推送到main分支时自动触发。

#### 部署脚本使用
```bash
# 自动检测修改类型并部署
./deploy-scripts/deploy.sh

# 指定部署类型
./deploy-scripts/deploy.sh --frontend  # 仅前端
./deploy-scripts/deploy.sh --backend   # 仅后端  
./deploy-scripts/deploy.sh --all       # 前后端
```

#### 部署流程
1. **代码推送** → GitHub仓库
2. **GitHub Actions** → 自动构建和测试
3. **部署到VPS** → 自动更新生产环境
4. **服务重启** → 自动重启相关服务
5. **健康检查** → 验证部署成功

### 手动部署更新

```bash
# 1. 进入项目目录
cd /opt/research-dashboard

# 2. 备份数据库
cp backend/data/research_dashboard_prod.db backend/data/research_dashboard_prod.db.backup

# 3. 更新代码
git pull origin main

# 4. 更新后端依赖
cd backend
source venv/bin/activate
pip install -r requirements.txt

# 5. 运行数据库迁移
python migrations/migration.py

# 6. 重启后端服务
sudo systemctl restart research-backend

# 7. 更新前端
cd ../frontend
npm install --production
npm run build

# 8. 重新加载Nginx
sudo systemctl reload nginx

# 9. 验证部署
curl -f http://localhost:8080/api/auth/me || echo "Backend failed"
curl -f http://localhost:3001 || echo "Frontend failed"
```

## ⚙️ 环境配置

### 环境变量

#### 开发环境 (.env.development)
```bash
# 基础配置
ENVIRONMENT=development
SECRET_KEY=development-secret-key-change-in-production
DATABASE_URL=sqlite:///./data/research_dashboard_dev.db
CORS_ORIGINS=http://localhost:3001

# AI配置
AI_BATCH_SIZE_LIMIT=10
AI_MAX_CONCURRENT=3
AI_MAX_RETRIES=2

# 性能配置
HTTP_MAX_CONNECTIONS=50
HTTP_KEEPALIVE_CONNECTIONS=10
ENABLE_HTTP2=true
```

#### 生产环境 (.env.production)
```bash
# 基础配置
ENVIRONMENT=production
SECRET_KEY=your-super-secret-key-change-in-production-must-be-long
DATABASE_URL=sqlite:///./data/research_dashboard_prod.db
CORS_ORIGINS=http://45.149.156.216:3001,https://your-domain.com

# AI配置
AI_BATCH_SIZE_LIMIT=50
AI_MAX_CONCURRENT=5
AI_MAX_RETRIES=2

# 性能配置
HTTP_MAX_CONNECTIONS=100
HTTP_KEEPALIVE_CONNECTIONS=20
ENABLE_HTTP2=true

# 日志配置
LOG_LEVEL=INFO
LOG_FILE=/opt/research-dashboard/backend/logs/app.log
```

### 系统配置文件

#### backend/app/core/config.py
```python
import os
from typing import List
from pydantic import BaseSettings

class Settings(BaseSettings):
    # 基础设置
    environment: str = os.getenv("ENVIRONMENT", "development")
    secret_key: str = os.getenv("SECRET_KEY", "your-secret-key")
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./data/research_dashboard.db")
    
    # CORS设置
    cors_origins: List[str] = os.getenv("CORS_ORIGINS", "http://localhost:3001").split(",")
    
    # JWT设置
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 24 * 7  # 7天
    
    # AI批量处理配置
    ai_batch_size_limit: int = int(os.getenv("AI_BATCH_SIZE_LIMIT", "50"))
    ai_max_concurrent: int = int(os.getenv("AI_MAX_CONCURRENT", "5"))
    ai_max_retries: int = int(os.getenv("AI_MAX_RETRIES", "2"))
    
    class Config:
        env_file = f".env.{os.getenv('ENVIRONMENT', 'development')}"

settings = Settings()
```

## 🗄️ 数据库管理

### 数据库初始化

#### 开发环境
```bash
cd backend
python scripts/init_db.py
```

#### 生产环境
```bash
cd backend
export ENVIRONMENT=production
python scripts/init_db.py
```

### 数据库迁移

#### 创建迁移
```bash
cd backend/migrations

# 编辑 migration.py
nano migration.py

# 更新版本号
MIGRATION_VERSION = "v1.4_add_new_feature"

# 添加迁移SQL
def run_migration(cursor):
    cursor.execute("ALTER TABLE users ADD COLUMN new_field VARCHAR(255)")
```

#### 执行迁移
```bash
cd backend
python migrations/migration.py
```

#### 迁移验证
```bash
# 检查迁移状态
sqlite3 data/research_dashboard_prod.db "SELECT * FROM migration_history ORDER BY executed_at DESC LIMIT 5;"

# 验证表结构
sqlite3 data/research_dashboard_prod.db ".schema table_name"
```

### 数据库备份和恢复

#### 自动备份配置
```bash
# 创建备份脚本
sudo nano /opt/research-dashboard/scripts/backup_db.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/opt/research-dashboard/backend/backups/production"
DB_PATH="/opt/research-dashboard/backend/data/research_dashboard_prod.db"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/backup_${TIMESTAMP}.db"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 创建备份
sqlite3 $DB_PATH ".backup $BACKUP_FILE"

# 压缩备份
gzip $BACKUP_FILE

# 清理旧备份（保留7个最新的）
ls -t $BACKUP_DIR/*.gz | tail -n +8 | xargs rm -f

echo "Backup created: ${BACKUP_FILE}.gz"
```

#### 设置自动备份
```bash
# 给予执行权限
chmod +x /opt/research-dashboard/scripts/backup_db.sh

# 添加到crontab
crontab -e

# 每天凌晨2点自动备份
0 2 * * * /opt/research-dashboard/scripts/backup_db.sh
```

#### 手动恢复备份
```bash
cd backend

# 停止服务
sudo systemctl stop research-backend

# 备份当前数据库
cp data/research_dashboard_prod.db data/research_dashboard_prod.db.before_restore

# 解压备份文件
gunzip backups/production/backup_20250722_020000.db.gz

# 恢复数据库
cp backups/production/backup_20250722_020000.db data/research_dashboard_prod.db

# 启动服务
sudo systemctl start research-backend

# 验证恢复
curl -f http://localhost:8080/api/auth/me
```

## 📊 性能监控

### 系统监控

#### 1. 服务状态监控
```bash
# 检查后端服务状态
sudo systemctl status research-backend

# 检查Nginx状态
sudo systemctl status nginx

# 检查服务日志
sudo journalctl -u research-backend -f
sudo journalctl -u nginx -f
```

#### 2. 资源使用监控
```bash
# 系统资源
htop
free -h
df -h

# 网络连接
netstat -tulnp | grep :8080
ss -tulnp | grep :3001

# 进程监控
ps aux | grep python
ps aux | grep nginx
```

### 应用监控

#### 1. API健康检查
```bash
# 创建健康检查脚本
nano /opt/research-dashboard/scripts/health_check.sh
```

```bash
#!/bin/bash
API_URL="http://localhost:8080"
FRONTEND_URL="http://localhost:3001"

# 检查后端API
if curl -f -s "$API_URL/docs" > /dev/null; then
    echo "✅ Backend API is healthy"
else
    echo "❌ Backend API is down"
    exit 1
fi

# 检查前端
if curl -f -s "$FRONTEND_URL" > /dev/null; then
    echo "✅ Frontend is healthy"  
else
    echo "❌ Frontend is down"
    exit 1
fi

# 检查数据库连接（通过API）
if curl -f -s "$API_URL/api/backup/stats" > /dev/null; then
    echo "✅ Database connection is healthy"
else
    echo "❌ Database connection failed"
    exit 1
fi

echo "🎉 All systems are healthy"
```

#### 2. 自动监控脚本
```bash
# 设置定时健康检查
chmod +x /opt/research-dashboard/scripts/health_check.sh

# 每5分钟检查一次
crontab -e
*/5 * * * * /opt/research-dashboard/scripts/health_check.sh >> /var/log/research-health.log 2>&1
```

#### 3. 性能指标监控
```bash
# 检查AI批量匹配性能
curl -s "http://localhost:8080/api/literature/batch-match/stats" | jq

# 检查数据库大小
du -h backend/data/research_dashboard_prod.db

# 检查备份状态
ls -lh backend/backups/production/
```

### 日志管理

#### 1. 日志配置
```python
# backend/app/core/logging_config.py
import logging
import logging.handlers
import os

def setup_logging():
    log_dir = "logs"
    os.makedirs(log_dir, exist_ok=True)
    
    # 创建formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # 文件处理器（轮转）
    file_handler = logging.handlers.RotatingFileHandler(
        os.path.join(log_dir, 'app.log'),
        maxBytes=10*1024*1024,  # 10MB
        backupCount=5
    )
    file_handler.setFormatter(formatter)
    file_handler.setLevel(logging.INFO)
    
    # 控制台处理器
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    console_handler.setLevel(logging.INFO)
    
    # 配置root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    root_logger.addHandler(file_handler)
    root_logger.addHandler(console_handler)
```

#### 2. 日志查看
```bash
# 实时查看应用日志
tail -f backend/logs/app.log

# 查看系统服务日志
sudo journalctl -u research-backend -f

# 查看Nginx访问日志
sudo tail -f /var/log/nginx/access.log

# 查看Nginx错误日志
sudo tail -f /var/log/nginx/error.log
```

## 🚨 故障排除

### 常见问题

#### 1. 端口占用
```bash
# 检查端口占用
sudo lsof -i :8080
sudo lsof -i :3001

# 终止占用进程
sudo kill -9 <PID>

# 或使用fuser
sudo fuser -k 8080/tcp
```

#### 2. 服务启动失败
```bash
# 查看服务状态
sudo systemctl status research-backend

# 查看详细日志
sudo journalctl -u research-backend -n 50

# 手动启动测试
cd /opt/research-dashboard/backend
source venv/bin/activate
python main.py
```

#### 3. 数据库连接问题
```bash
# 检查数据库文件权限
ls -la backend/data/

# 修复权限
sudo chown -R www-data:www-data backend/data/
sudo chmod 644 backend/data/*.db

# 测试数据库连接
sqlite3 backend/data/research_dashboard_prod.db ".tables"
```

#### 4. Nginx配置问题
```bash
# 测试配置文件
sudo nginx -t

# 检查配置语法
sudo nginx -T

# 重新加载配置
sudo systemctl reload nginx
```

#### 5. 前端构建问题
```bash
# 清理缓存
cd frontend
rm -rf node_modules package-lock.json
npm install

# 重新构建
npm run build

# 检查构建文件
ls -la build/
```

### 性能问题排查

#### 1. 数据库性能
```bash
# 检查数据库大小
du -h backend/data/research_dashboard_prod.db

# 分析查询性能
sqlite3 backend/data/research_dashboard_prod.db "EXPLAIN QUERY PLAN SELECT * FROM literature WHERE user_id = 1;"

# 检查索引使用
sqlite3 backend/data/research_dashboard_prod.db ".indices"
```

#### 2. API响应时间
```bash
# 测试API响应时间
time curl -s "http://localhost:8080/api/research/"

# 使用ab进行压力测试
ab -n 100 -c 10 http://localhost:8080/api/research/

# 检查系统负载
uptime
iostat 1 5
```

#### 3. 内存使用
```bash
# 检查Python进程内存使用
ps aux | grep python | head -1; ps aux | grep python | grep -v grep | sort -nrk 4

# 检查系统内存
free -h
cat /proc/meminfo
```

### 紧急恢复程序

#### 1. 服务快速重启
```bash
#!/bin/bash
# 紧急重启脚本：emergency_restart.sh

echo "🚨 Emergency restart initiated..."

# 停止服务
sudo systemctl stop research-backend
sudo systemctl stop nginx

# 等待进程完全停止
sleep 5

# 检查并清理僵尸进程
sudo pkill -f "python.*main.py"
sudo pkill -f nginx

# 重启服务
sudo systemctl start research-backend
sudo systemctl start nginx

# 等待服务启动
sleep 10

# 健康检查
if curl -f -s "http://localhost:8080/docs" > /dev/null; then
    echo "✅ Backend restarted successfully"
else
    echo "❌ Backend restart failed"
    exit 1
fi

if curl -f -s "http://localhost:3001" > /dev/null; then
    echo "✅ Frontend accessible"
else
    echo "❌ Frontend not accessible"
    exit 1
fi

echo "🎉 Emergency restart completed successfully"
```

#### 2. 数据库紧急恢复
```bash
#!/bin/bash
# 数据库紧急恢复脚本：emergency_db_restore.sh

BACKUP_DIR="/opt/research-dashboard/backend/backups/production"
LATEST_BACKUP=$(ls -t $BACKUP_DIR/*.gz | head -1)

if [ -z "$LATEST_BACKUP" ]; then
    echo "❌ No backup found"
    exit 1
fi

echo "🔄 Restoring from: $LATEST_BACKUP"

# 停止后端服务
sudo systemctl stop research-backend

# 备份当前数据库
cp backend/data/research_dashboard_prod.db backend/data/emergency_backup_$(date +%Y%m%d_%H%M%S).db

# 恢复备份
gunzip -c "$LATEST_BACKUP" > backend/data/research_dashboard_prod.db

# 启动服务
sudo systemctl start research-backend

echo "✅ Database restored successfully"
```

## 🔒 安全配置

### SSL/TLS配置

#### 强化SSL配置
```nginx
# 在Nginx配置中添加
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL证书
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # SSL配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;
    
    # 其他安全头
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    
    # 其余配置...
}

# HTTP重定向到HTTPS
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

### 防火墙配置

#### Ubuntu/Debian (ufw)
```bash
# 安装ufw
sudo apt install ufw

# 默认策略
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 允许SSH
sudo ufw allow ssh

# 允许HTTP/HTTPS
sudo ufw allow 80
sudo ufw allow 443

# 允许应用端口
sudo ufw allow 3001
sudo ufw allow 8080

# 启用防火墙
sudo ufw enable

# 检查状态
sudo ufw status verbose
```

### 系统安全加固

#### 1. 用户权限
```bash
# 创建专用用户
sudo useradd -r -s /bin/false research-app
sudo usermod -a -G www-data research-app

# 设置目录权限
sudo chown -R research-app:www-data /opt/research-dashboard
sudo chmod -R 750 /opt/research-dashboard

# 数据目录权限
sudo chmod 700 /opt/research-dashboard/backend/data
sudo chmod 600 /opt/research-dashboard/backend/data/*.db
```

#### 2. 敏感文件保护
```bash
# 环境变量文件
chmod 600 backend/.env.*

# 私钥和证书
chmod 600 /etc/ssl/private/*
chmod 644 /etc/ssl/certs/*
```

## 💾 备份策略

### 完整备份方案

#### 1. 数据备份
```bash
# 创建完整备份脚本
nano /opt/research-dashboard/scripts/full_backup.sh
```

```bash
#!/bin/bash
BACKUP_ROOT="/opt/backups/research-dashboard"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="$BACKUP_ROOT/$TIMESTAMP"

mkdir -p "$BACKUP_DIR"

# 备份数据库
cp /opt/research-dashboard/backend/data/*.db "$BACKUP_DIR/"

# 备份上传文件
tar -czf "$BACKUP_DIR/uploads.tar.gz" /opt/research-dashboard/backend/uploads/

# 备份配置文件
cp /opt/research-dashboard/backend/.env.* "$BACKUP_DIR/"
cp /etc/nginx/sites-available/research-dashboard "$BACKUP_DIR/"
cp /etc/systemd/system/research-backend.service "$BACKUP_DIR/"

# 创建备份清单
echo "Backup created: $TIMESTAMP" > "$BACKUP_DIR/backup_info.txt"
echo "Database files:" >> "$BACKUP_DIR/backup_info.txt"
ls -lh "$BACKUP_DIR"/*.db >> "$BACKUP_DIR/backup_info.txt"

# 清理旧备份（保留30天）
find "$BACKUP_ROOT" -type d -mtime +30 -exec rm -rf {} \;

echo "Full backup completed: $BACKUP_DIR"
```

#### 2. 远程备份
```bash
# 同步到远程服务器
rsync -avz --delete "$BACKUP_DIR/" user@remote-server:/backups/research-dashboard/

# 或上传到云存储（示例：AWS S3）
aws s3 sync "$BACKUP_DIR/" s3://your-backup-bucket/research-dashboard/$TIMESTAMP/
```

### 备份测试和验证

#### 自动备份验证脚本
```bash
#!/bin/bash
# 验证备份完整性

BACKUP_FILE="/opt/research-dashboard/backend/backups/production/backup_$(date +%Y%m%d)*.db.gz"

if [ -f "$BACKUP_FILE" ]; then
    # 解压并测试
    gunzip -t "$BACKUP_FILE" && echo "✅ Backup file integrity OK" || echo "❌ Backup file corrupted"
    
    # 测试数据库结构
    TEMP_DB="/tmp/test_restore_$(date +%s).db"
    gunzip -c "$BACKUP_FILE" > "$TEMP_DB"
    
    if sqlite3 "$TEMP_DB" ".tables" > /dev/null 2>&1; then
        echo "✅ Database structure OK"
        rm "$TEMP_DB"
    else
        echo "❌ Database structure damaged"
    fi
else
    echo "❌ No backup found for today"
fi
```

## 📋 部署检查清单

### 部署前检查
- [ ] 服务器资源充足（CPU、内存、存储）
- [ ] 必要软件已安装（Python、Node.js、Nginx）
- [ ] 防火墙规则配置正确
- [ ] SSL证书已配置（生产环境）
- [ ] 环境变量已设置
- [ ] 数据库备份已创建

### 部署后验证
- [ ] 前端可正常访问
- [ ] 后端API正常响应
- [ ] 用户认证功能正常
- [ ] 数据库连接正常
- [ ] 文件上传功能正常
- [ ] AI批量匹配功能正常
- [ ] 系统配置功能正常
- [ ] 备份功能正常
- [ ] 日志记录正常
- [ ] 性能指标正常

### 监控设置
- [ ] 健康检查脚本已设置
- [ ] 自动备份已配置
- [ ] 日志轮转已配置
- [ ] 磁盘空间监控已设置
- [ ] 服务状态监控已设置

---

📝 **部署文档版本**: v1.0  
🕒 **最后更新**: 2025-07-22  
🚀 **生产环境**: http://45.149.156.216:3001  
📞 **技术支持**: [GitHub Issues](https://github.com/zylen97/research-dashboard/issues)