#!/bin/bash

# 开发环境快速启动脚本
# 一键启动前后端开发服务器

set -e

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}=== Research Dashboard 开发环境启动 ===${NC}"

# 检查环境
check_environment() {
    echo -e "${YELLOW}检查开发环境...${NC}"
    
    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}错误: 未安装 Node.js${NC}"
        exit 1
    fi
    
    # 检查 Python
    if ! command -v python3 &> /dev/null; then
        echo -e "${RED}错误: 未安装 Python 3${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ 环境检查通过${NC}"
}

# 设置环境配置
setup_env() {
    echo -e "${YELLOW}设置环境配置...${NC}"
    
    # 前端环境配置
    if [ ! -f "frontend/.env.local" ]; then
        if [ -f "frontend/.env.development" ]; then
            echo "创建前端本地配置..."
            cp frontend/.env.development frontend/.env.local
        fi
    fi
    
    # 后端环境配置
    if [ ! -f "backend/.env" ]; then
        if [ -f "backend/.env.development" ]; then
            echo "创建后端本地配置..."
            cp backend/.env.development backend/.env
        fi
    fi
    
    echo -e "${GREEN}✅ 环境配置完成${NC}"
}

# 安装依赖
install_dependencies() {
    echo -e "${YELLOW}检查并安装依赖...${NC}"
    
    # 前端依赖
    if [ ! -d "frontend/node_modules" ]; then
        echo "安装前端依赖..."
        cd frontend && npm install && cd ..
    fi
    
    # 后端依赖
    if [ ! -d "backend/venv" ]; then
        echo "创建Python虚拟环境..."
        cd backend
        python3 -m venv venv
        source venv/bin/activate
        pip install -r requirements.txt
        deactivate
        cd ..
    fi
    
    echo -e "${GREEN}✅ 依赖安装完成${NC}"
}

# 启动服务
start_services() {
    echo -e "${BLUE}启动开发服务器...${NC}"
    
    # 创建临时目录用于存储PID
    mkdir -p tmp
    
    # 启动后端
    echo -e "${YELLOW}启动后端服务 (端口 8080)...${NC}"
    cd backend
    source venv/bin/activate
    export ENVIRONMENT=development
    python main.py > ../tmp/backend.log 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > ../tmp/backend.pid
    cd ..
    
    # 等待后端启动
    sleep 3
    
    # 启动前端
    echo -e "${YELLOW}启动前端服务 (端口 3001)...${NC}"
    cd frontend
    npm start > ../tmp/frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > ../tmp/frontend.pid
    cd ..
    
    echo -e "${GREEN}✅ 服务启动完成${NC}"
    echo ""
    echo -e "${BLUE}访问地址：${NC}"
    echo "前端: http://localhost:3001"
    echo "后端: http://localhost:8080"
    echo "API文档: http://localhost:8080/docs"
    echo ""
    echo -e "${YELLOW}按 Ctrl+C 停止所有服务${NC}"
    
    # 捕获退出信号
    trap cleanup EXIT INT TERM
    
    # 等待
    wait
}

# 清理函数
cleanup() {
    echo ""
    echo -e "${YELLOW}停止所有服务...${NC}"
    
    # 停止前端
    if [ -f "tmp/frontend.pid" ]; then
        kill $(cat tmp/frontend.pid) 2>/dev/null || true
        rm -f tmp/frontend.pid
    fi
    
    # 停止后端
    if [ -f "tmp/backend.pid" ]; then
        kill $(cat tmp/backend.pid) 2>/dev/null || true
        rm -f tmp/backend.pid
    fi
    
    echo -e "${GREEN}✅ 服务已停止${NC}"
    exit 0
}

# 主流程
main() {
    check_environment
    setup_env
    install_dependencies
    start_services
}

# 运行主流程
main