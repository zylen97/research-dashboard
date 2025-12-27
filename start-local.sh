#!/bin/bash

# Research Dashboard 本地启动脚本

set -e

PROJECT_ROOT="/Users/zylen/Library/CloudStorage/OneDrive-个人/04-Coding/_research/research-dashboard"
cd "$PROJECT_ROOT"

# 颜色定义
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}=== Research Dashboard 本地启动 ===${NC}"

# 创建必要目录
mkdir -p pids logs backend/data backend/logs

# 1. 启动后端
echo -e "${CYAN}[1/2] 启动后端服务...${NC}"
cd backend

# 检查虚拟环境
if [ ! -d "venv" ]; then
    echo "创建虚拟环境..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

# 确保数据库存在
if [ ! -f "data/research_dashboard.db" ]; then
    echo -e "${CYAN}初始化数据库...${NC}"
    python -c "from app.models.database import init_db; init_db()"
fi

# 检查并运行数据库迁移
echo -e "${CYAN}检查数据库迁移...${NC}"
python migrations/migration.py

# 后台启动后端
nohup python -m uvicorn main:app --host 127.0.0.1 --port 8080 --reload > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > ../pids/backend.pid
echo -e "${GREEN}✓ 后端已启动 (PID: $BACKEND_PID)${NC}"

# 等待后端启动
sleep 3

# 2. 启动前端
cd ../frontend
echo -e "${CYAN}[2/2] 启动前端服务...${NC}"

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "安装前端依赖..."
    npm install
fi

# 启动前端（开发模式）
# 设置 NODE_OPTIONS 解决 Node.js v25 兼容性问题
NODE_OPTIONS='--no-experimental-webstorage' PORT=3001 npm start > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > ../pids/frontend.pid
echo -e "${GREEN}✓ 前端已启动 (PID: $FRONTEND_PID)${NC}"

echo ""
echo -e "${GREEN}=== 启动完成 ===${NC}"
echo -e "前端地址: ${CYAN}http://localhost:3001${NC}"
echo -e "后端API: ${CYAN}http://localhost:8080/docs${NC}"
echo -e ""
echo "查看日志: tail -f logs/backend.log"
echo "停止服务: ./stop-local.sh"
