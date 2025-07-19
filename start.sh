#!/bin/bash

# Research Dashboard 启动脚本
# 作者: Claude Code
# 功能: 一键启动前后端服务

echo "🚀 启动 Research Dashboard..."
echo "========================================"

# 获取项目根目录
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

# 日志文件
LOG_DIR="$PROJECT_DIR/logs"
mkdir -p "$LOG_DIR"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"

# PID文件用于管理进程
PID_DIR="$PROJECT_DIR/pids"
mkdir -p "$PID_DIR"
BACKEND_PID="$PID_DIR/backend.pid"
FRONTEND_PID="$PID_DIR/frontend.pid"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查端口是否被占用
check_port() {
    local port=$1
    local service=$2
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        echo -e "${YELLOW}警告: 端口 $port 已被占用 ($service)${NC}"
        echo "正在尝试清理..."
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
}

# 清理之前的进程
cleanup_previous() {
    echo "🧹 清理之前的进程..."
    
    # 清理后端进程
    if [ -f "$BACKEND_PID" ]; then
        local backend_pid=$(cat "$BACKEND_PID")
        if ps -p $backend_pid > /dev/null 2>&1; then
            echo "停止后端服务 (PID: $backend_pid)"
            kill $backend_pid 2>/dev/null || true
        fi
        rm -f "$BACKEND_PID"
    fi
    
    # 清理前端进程
    if [ -f "$FRONTEND_PID" ]; then
        local frontend_pid=$(cat "$FRONTEND_PID")
        if ps -p $frontend_pid > /dev/null 2>&1; then
            echo "停止前端服务 (PID: $frontend_pid)"
            kill $frontend_pid 2>/dev/null || true
        fi
        rm -f "$FRONTEND_PID"
    fi
    
    # 检查并清理端口
    check_port 8080 "后端"
    check_port 3001 "前端"
}

# 检查Python依赖
check_python_deps() {
    echo "🐍 检查Python依赖..."
    cd "$BACKEND_DIR"
    
    if ! python -c "import fastapi, uvicorn, sqlalchemy, pydantic, pandas, openpyxl" 2>/dev/null; then
        echo -e "${YELLOW}Python依赖缺失，正在安装...${NC}"
        pip install -r requirements.txt
        if [ $? -ne 0 ]; then
            echo -e "${RED}Python依赖安装失败${NC}"
            exit 1
        fi
    fi
    echo -e "${GREEN}✅ Python依赖检查完成${NC}"
}

# 检查Node.js依赖
check_node_deps() {
    echo "📦 检查Node.js依赖..."
    cd "$FRONTEND_DIR"
    
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}Node.js依赖缺失，正在安装...${NC}"
        npm install
        if [ $? -ne 0 ]; then
            echo -e "${RED}Node.js依赖安装失败${NC}"
            exit 1
        fi
    fi
    echo -e "${GREEN}✅ Node.js依赖检查完成${NC}"
}

# 启动后端服务
start_backend() {
    echo "🔧 启动后端服务..."
    cd "$BACKEND_DIR"
    
    # 启动后端并获取PID
    nohup python main.py > "$BACKEND_LOG" 2>&1 &
    local backend_pid=$!
    echo $backend_pid > "$BACKEND_PID"
    
    # 等待后端启动
    echo "等待后端服务启动..."
    local count=0
    while [ $count -lt 30 ]; do
        if curl -s http://localhost:8080/ >/dev/null 2>&1; then
            echo -e "${GREEN}✅ 后端服务启动成功 (PID: $backend_pid, 端口: 8080)${NC}"
            return 0
        fi
        sleep 1
        count=$((count + 1))
        echo -n "."
    done
    
    echo -e "${RED}❌ 后端服务启动失败${NC}"
    echo "查看日志: tail -f $BACKEND_LOG"
    return 1
}

# 启动前端服务
start_frontend() {
    echo "🎨 启动前端服务..."
    cd "$FRONTEND_DIR"
    
    # 启动前端并获取PID
    nohup npm start > "$FRONTEND_LOG" 2>&1 &
    local frontend_pid=$!
    echo $frontend_pid > "$FRONTEND_PID"
    
    echo -e "${GREEN}✅ 前端服务启动中 (PID: $frontend_pid, 端口: 3001)${NC}"
    echo "前端需要几分钟编译时间，请稍等..."
}

# 显示服务状态
show_status() {
    echo ""
    echo "========================================"
    echo -e "${BLUE}🎉 Research Dashboard 启动完成！${NC}"
    echo "========================================"
    echo ""
    echo "📊 服务状态:"
    echo "  后端API:  http://localhost:8080"
    echo "  前端界面: http://localhost:3001"
    echo "  API文档:  http://localhost:8080/docs"
    echo ""
    echo "📁 日志文件:"
    echo "  后端日志: $BACKEND_LOG"
    echo "  前端日志: $FRONTEND_LOG"
    echo ""
    echo "🛠  管理命令:"
    echo "  查看后端日志: tail -f $BACKEND_LOG"
    echo "  查看前端日志: tail -f $FRONTEND_LOG"
    echo "  停止所有服务: ./stop.sh"
    echo ""
    echo -e "${GREEN}正在自动打开浏览器...${NC}"
}

# 打开浏览器
open_browser() {
    sleep 5  # 等待前端编译
    if command -v open >/dev/null 2>&1; then
        # macOS
        open http://localhost:3001
    elif command -v xdg-open >/dev/null 2>&1; then
        # Linux
        xdg-open http://localhost:3001
    elif command -v start >/dev/null 2>&1; then
        # Windows
        start http://localhost:3001
    fi
}

# 主流程
main() {
    # 清理之前的进程
    cleanup_previous
    
    # 检查依赖
    check_python_deps
    check_node_deps
    
    # 启动服务
    if start_backend; then
        start_frontend
        show_status
        
        # 后台打开浏览器
        open_browser &
        
        echo "按 Ctrl+C 查看日志，或运行 ./stop.sh 停止服务"
        echo ""
        
        # 可选择显示实时日志
        read -p "是否查看后端实时日志? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            tail -f "$BACKEND_LOG"
        fi
    else
        echo -e "${RED}启动失败，请检查错误信息${NC}"
        exit 1
    fi
}

# 捕获Ctrl+C信号
trap 'echo -e "\n\n${YELLOW}服务仍在后台运行，使用 ./stop.sh 停止服务${NC}"; exit 0' INT

# 执行主流程
main