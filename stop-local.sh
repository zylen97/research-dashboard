#!/bin/bash

# 停止本地服务脚本

PROJECT_ROOT="/Users/zylen/Library/CloudStorage/Dropbox/04-Coding/_research/research-dashboard"
cd "$PROJECT_ROOT"

GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}停止所有服务...${NC}"

# 停止后端
if [ -f "pids/backend.pid" ]; then
    BACKEND_PID=$(cat pids/backend.pid)
    kill $BACKEND_PID 2>/dev/null && echo -e "${GREEN}✓ 后端已停止${NC}" || echo "后端未运行"
    rm pids/backend.pid
fi

# 停止前端
if [ -f "pids/frontend.pid" ]; then
    FRONTEND_PID=$(cat pids/frontend.pid)
    kill $FRONTEND_PID 2>/dev/null && echo -e "${GREEN}✓ 前端已停止${NC}" || echo "前端未运行"
    rm pids/frontend.pid
fi

# 备用：杀死所有相关进程
pkill -f "uvicorn main:app" 2>/dev/null
pkill -f "react-scripts start" 2>/dev/null
pkill -f "node.*react-scripts" 2>/dev/null

echo -e "${GREEN}所有服务已停止${NC}"
