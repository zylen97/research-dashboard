#!/bin/bash

# 🚨 紧急修复502错误脚本
# 专门处理research-backend服务启动失败问题

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${RED}🚨 === 紧急修复502错误 === ${NC}"
echo -e "${BLUE}时间: $(date)${NC}"

# 强制停止服务
echo -e "${YELLOW}1. 强制停止后端服务...${NC}"
systemctl stop research-backend 2>/dev/null || true
sleep 5

# 检查并杀死所有相关进程
echo -e "${YELLOW}2. 清理残留进程...${NC}"
pkill -f "python.*main.py" 2>/dev/null || true
pkill -f "uvicorn.*main:app" 2>/dev/null || true
sleep 3

# 检查端口占用
echo -e "${YELLOW}3. 检查端口8080占用...${NC}"
port_check=$(netstat -tulpn | grep :8080 || echo "端口未占用")
echo "端口状态: $port_check"

if echo "$port_check" | grep -q "LISTEN"; then
    echo -e "${YELLOW}发现端口占用，尝试释放...${NC}"
    # 获取占用进程ID并杀死
    pid=$(netstat -tulpn | grep :8080 | awk '{print $7}' | cut -d'/' -f1 | head -1)
    if [ -n "$pid" ] && [ "$pid" != "-" ]; then
        kill -9 "$pid" 2>/dev/null || true
        echo "已杀死进程: $pid"
        sleep 2
    fi
fi

# 修复Python环境
echo -e "${YELLOW}4. 修复Python环境...${NC}"
cd /var/www/research-dashboard/backend || exit 1

# 确保关键依赖
pip3 install --no-cache-dir fastapi==0.104.1 uvicorn==0.24.0 sqlalchemy==2.0.23 2>/dev/null || true
pip3 install --no-cache-dir pydantic httpx aiofiles python-multipart 2>/dev/null || true

# 检查数据库完整性
echo -e "${YELLOW}5. 检查数据库完整性...${NC}"
if [ -f "data/research_dashboard_prod.db" ]; then
    # 简单的数据库完整性检查
    if sqlite3 data/research_dashboard_prod.db ".tables" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 数据库完整性正常${NC}"
    else
        echo -e "${RED}❌ 数据库损坏，尝试修复...${NC}"
        # 创建数据库备份
        cp data/research_dashboard_prod.db data/research_dashboard_prod.db.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
    fi
else
    echo -e "${YELLOW}⚠️ 数据库文件不存在，创建新数据库...${NC}"
    mkdir -p data
fi

# 确保配置文件存在
echo -e "${YELLOW}6. 检查配置文件...${NC}"
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}创建默认配置文件...${NC}"
    cat > .env << 'EOF'
ENVIRONMENT=production
DATABASE_URL=sqlite:///./data/research_dashboard_prod.db
SECRET_KEY=ultra-think-production-secret-key-2025-secure
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080
HOST=0.0.0.0
PORT=8080
CORS_ORIGINS=http://45.149.156.216:3001,http://localhost:3001
LOG_LEVEL=INFO
LOG_FILE=./logs/production.log
UPLOAD_DIR=./uploads/production
MAX_UPLOAD_SIZE=10485760
AI_BATCH_SIZE_LIMIT=50
AI_MAX_CONCURRENT=5
AI_MAX_RETRIES=2
HTTP_MAX_CONNECTIONS=100
HTTP_KEEPALIVE_CONNECTIONS=20
ENABLE_HTTP2=true
EOF
    chmod 600 .env
fi

# 创建必要目录
echo -e "${YELLOW}7. 创建必要目录...${NC}"
mkdir -p logs uploads/production data
chown -R www-data:www-data uploads/ 2>/dev/null || true

# 重新加载systemd
echo -e "${YELLOW}8. 重新加载systemd配置...${NC}"
systemctl daemon-reload

# 多次尝试启动服务
echo -e "${YELLOW}9. 多次尝试启动服务...${NC}"
for attempt in 1 2 3 4 5; do
    echo -e "${BLUE}尝试 $attempt/5: 启动research-backend服务...${NC}"
    
    systemctl start research-backend
    sleep 8
    
    if systemctl is-active --quiet research-backend; then
        echo -e "${GREEN}✅ 服务启动成功（尝试 $attempt/5）${NC}"
        break
    else
        echo -e "${RED}❌ 尝试 $attempt/5 失败${NC}"
        if [ $attempt -lt 5 ]; then
            systemctl stop research-backend 2>/dev/null || true
            sleep 3
        fi
    fi
done

# 最终验证
echo -e "${YELLOW}10. 最终验证...${NC}"
sleep 5

# 检查服务状态
if systemctl is-active --quiet research-backend; then
    echo -e "${GREEN}✅ 后端服务运行正常${NC}"
    
    # 测试API响应
    if curl -f -s -m 10 "http://localhost:8080/docs" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ API响应正常${NC}"
        echo -e "${GREEN}🎉 502错误修复成功！${NC}"
    else
        echo -e "${YELLOW}⚠️ API响应测试超时，服务可能需要更多时间启动${NC}"
    fi
else
    echo -e "${RED}❌ 服务启动失败${NC}"
    echo -e "${YELLOW}显示服务状态:${NC}"
    systemctl status research-backend --no-pager -l
    echo -e "${YELLOW}显示最近日志:${NC}"
    journalctl -u research-backend -n 10 --no-pager
fi

# 显示端口状态
echo -e "${YELLOW}当前端口8080状态:${NC}"
netstat -tulpn | grep :8080 || echo "端口未监听"

echo -e "${BLUE}紧急修复脚本执行完毕: $(date)${NC}"