#!/bin/bash

# Research Dashboard 停止脚本
# 作者: Claude Code
# 功能: 优雅停止所有服务

echo "🛑 停止 Research Dashboard 服务..."
echo "========================================"

# 获取项目根目录
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="$PROJECT_DIR/pids"
BACKEND_PID="$PID_DIR/backend.pid"
FRONTEND_PID="$PID_DIR/frontend.pid"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 停止服务函数
stop_service() {
    local service_name=$1
    local pid_file=$2
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p $pid > /dev/null 2>&1; then
            echo "停止${service_name}服务 (PID: $pid)..."
            kill $pid
            
            # 等待进程优雅退出
            local count=0
            while [ $count -lt 10 ] && ps -p $pid > /dev/null 2>&1; do
                sleep 1
                count=$((count + 1))
            done
            
            # 如果还没退出，强制杀死
            if ps -p $pid > /dev/null 2>&1; then
                echo "强制停止${service_name}服务..."
                kill -9 $pid 2>/dev/null || true
            fi
            
            echo -e "${GREEN}✅ ${service_name}服务已停止${NC}"
        else
            echo -e "${YELLOW}${service_name}服务未运行${NC}"
        fi
        rm -f "$pid_file"
    else
        echo -e "${YELLOW}未找到${service_name}服务PID文件${NC}"
    fi
}

# 通过端口停止服务
stop_by_port() {
    local port=$1
    local service_name=$2
    
    local pids=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$pids" ]; then
        echo "通过端口 $port 停止${service_name}服务..."
        echo $pids | xargs kill -9 2>/dev/null || true
        echo -e "${GREEN}✅ 端口 $port 上的${service_name}服务已停止${NC}"
    fi
}

# 主停止流程
main() {
    # 停止后端服务
    stop_service "后端" "$BACKEND_PID"
    
    # 停止前端服务
    stop_service "前端" "$FRONTEND_PID"
    
    # 额外通过端口清理（防止PID文件丢失的情况）
    stop_by_port 8080 "后端"
    stop_by_port 3001 "前端"
    
    # 清理临时文件
    rm -rf "$PID_DIR" 2>/dev/null || true
    
    echo ""
    echo "========================================"
    echo -e "${GREEN}🎉 所有服务已停止${NC}"
    echo "========================================"
}

# 执行主流程
main