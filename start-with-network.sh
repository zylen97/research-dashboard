#!/bin/bash

# 研究看板 - 一键启动（支持网络访问）
# 自动检测环境并配置最佳的访问方式

echo "🚀 研究看板一键启动"
echo "===================="

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查依赖
check_dependencies() {
    echo "🔍 检查依赖..."
    
    # 检查Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js未安装${NC}"
        echo "请安装Node.js: https://nodejs.org/"
        exit 1
    fi
    
    # 检查Python
    if ! command -v python &> /dev/null && ! command -v python3 &> /dev/null; then
        echo -e "${RED}❌ Python未安装${NC}"
        echo "请安装Python: https://python.org/"
        exit 1
    fi
    
    echo -e "${GREEN}✅ 依赖检查通过${NC}"
}

# 选择启动模式
choose_mode() {
    echo ""
    echo "📋 请选择启动模式："
    echo "1) 本地开发（仅本机访问）"
    echo "2) 网络访问（团队成员可访问）"
    echo "3) 自动检测"
    echo ""
    read -p "请输入选择 (1-3): " mode_choice
    
    case $mode_choice in
        1)
            START_MODE="local"
            ;;
        2)
            START_MODE="network"
            ;;
        3)
            START_MODE="auto"
            ;;
        *)
            echo -e "${YELLOW}使用默认模式: 自动检测${NC}"
            START_MODE="auto"
            ;;
    esac
}

# 安装依赖
install_dependencies() {
    echo "📦 安装依赖..."
    
    # 后端依赖
    if [ ! -d "backend/venv" ] && [ ! -f "backend/.installed" ]; then
        echo "安装后端依赖..."
        cd backend
        pip install -r requirements.txt
        touch .installed
        cd ..
    fi
    
    # 前端依赖
    if [ ! -d "frontend/node_modules" ]; then
        echo "安装前端依赖..."
        cd frontend
        npm install
        cd ..
    fi
    
    echo -e "${GREEN}✅ 依赖安装完成${NC}"
}

# 启动后端
start_backend() {
    echo "🔧 启动后端服务..."
    
    cd backend
    
    # 检查端口是否占用
    if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null; then
        echo -e "${YELLOW}⚠️ 端口8080已被占用，尝试停止现有服务${NC}"
        kill -9 $(lsof -t -i:8080) 2>/dev/null || true
        sleep 2
    fi
    
    # 启动后端
    python main.py &
    BACKEND_PID=$!
    echo "后端PID: $BACKEND_PID"
    echo $BACKEND_PID > ../backend.pid
    
    cd ..
    
    # 等待后端启动
    echo "等待后端启动..."
    sleep 3
    
    # 检查后端是否启动成功
    if curl -s http://localhost:8080/ > /dev/null; then
        echo -e "${GREEN}✅ 后端启动成功${NC}"
        return 0
    else
        echo -e "${RED}❌ 后端启动失败${NC}"
        return 1
    fi
}

# 配置前端环境
configure_frontend() {
    echo "⚙️ 配置前端环境..."
    
    cd frontend
    
    # 创建环境配置
    if [ "$START_MODE" = "network" ] || ([ "$START_MODE" = "auto" ] && command -v ngrok &> /dev/null); then
        echo "配置网络访问模式..."
        
        # 检测ngrok是否可用
        if command -v ngrok &> /dev/null; then
            # 启动ngrok
            echo "启动ngrok..."
            ngrok http 8080 --log=stdout > ../ngrok.log 2>&1 &
            NGROK_PID=$!
            echo $NGROK_PID > ../ngrok.pid
            
            sleep 3
            
            # 获取ngrok地址
            BACKEND_URL=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[0].public_url' 2>/dev/null)
            
            if [ "$BACKEND_URL" != "null" ] && [ ! -z "$BACKEND_URL" ]; then
                echo "REACT_APP_API_URL=$BACKEND_URL" > .env.local
                echo -e "${GREEN}✅ 网络访问已配置${NC}"
                echo -e "${BLUE}🌐 后端地址: $BACKEND_URL${NC}"
                NETWORK_MODE=true
            else
                echo -e "${YELLOW}⚠️ ngrok启动失败，使用本地模式${NC}"
                echo "REACT_APP_API_URL=http://localhost:8080" > .env.local
                NETWORK_MODE=false
            fi
        else
            echo -e "${YELLOW}⚠️ ngrok未安装，使用本地模式${NC}"
            echo "REACT_APP_API_URL=http://localhost:8080" > .env.local
            NETWORK_MODE=false
        fi
    else
        echo "配置本地访问模式..."
        echo "REACT_APP_API_URL=http://localhost:8080" > .env.local
        NETWORK_MODE=false
    fi
    
    cd ..
}

# 启动前端
start_frontend() {
    echo "🎨 启动前端服务..."
    
    cd frontend
    
    # 检查端口是否占用
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null; then
        echo -e "${YELLOW}⚠️ 端口3000已被占用，尝试停止现有服务${NC}"
        kill -9 $(lsof -t -i:3000) 2>/dev/null || true
        sleep 2
    fi
    
    # 启动前端
    npm start &
    FRONTEND_PID=$!
    echo "前端PID: $FRONTEND_PID"
    echo $FRONTEND_PID > ../frontend.pid
    
    cd ..
    
    echo -e "${GREEN}✅ 前端启动中...${NC}"
}

# 显示访问信息
show_access_info() {
    echo ""
    echo "🎉 启动完成！"
    echo "=============="
    
    if [ "$NETWORK_MODE" = true ]; then
        # 等待获取完整的ngrok信息
        sleep 5
        BACKEND_URL=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[] | select(.config.addr=="localhost:8080") | .public_url' 2>/dev/null)
        FRONTEND_URL=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[] | select(.config.addr=="localhost:3000") | .public_url' 2>/dev/null)
        
        if [ ! -z "$FRONTEND_URL" ] && [ "$FRONTEND_URL" != "null" ]; then
            echo -e "${BLUE}🌐 网络访问地址:${NC}"
            echo -e "${GREEN}   前端: $FRONTEND_URL${NC}"
            echo -e "${GREEN}   后端: $BACKEND_URL${NC}"
            echo ""
            echo -e "${YELLOW}📤 分享给团队成员:${NC}"
            echo -e "${BLUE}   $FRONTEND_URL${NC}"
            echo ""
            
            # 保存网络信息
            cat > network-info.txt << EOF
研究看板网络访问信息
===================

前端地址: $FRONTEND_URL
后端地址: $BACKEND_URL

分享给团队成员：
$FRONTEND_URL

生成时间: $(date)
EOF
            
        else
            echo -e "${RED}❌ 无法获取网络地址，使用本地访问${NC}"
            echo -e "${GREEN}🏠 本地访问: http://localhost:3000${NC}"
        fi
    else
        echo -e "${GREEN}🏠 本地访问: http://localhost:3000${NC}"
    fi
    
    echo ""
    echo -e "${YELLOW}💡 使用说明:${NC}"
    echo "- 按 Ctrl+C 停止所有服务"
    echo "- 服务日志保存在 logs/ 目录"
    echo "- 网络信息保存在 network-info.txt"
    echo ""
}

# 清理函数
cleanup() {
    echo ""
    echo "🛑 正在停止服务..."
    
    # 停止进程
    if [ -f backend.pid ]; then
        kill $(cat backend.pid) 2>/dev/null || true
        rm backend.pid
    fi
    
    if [ -f frontend.pid ]; then
        kill $(cat frontend.pid) 2>/dev/null || true
        rm frontend.pid
    fi
    
    if [ -f ngrok.pid ]; then
        kill $(cat ngrok.pid) 2>/dev/null || true
        rm ngrok.pid
    fi
    
    echo -e "${GREEN}✅ 服务已停止${NC}"
    exit 0
}

# 捕获中断信号
trap cleanup INT TERM

# 主流程
main() {
    check_dependencies
    choose_mode
    install_dependencies
    
    if start_backend; then
        configure_frontend
        start_frontend
        show_access_info
        
        # 保持运行
        echo "服务运行中... (按 Ctrl+C 停止)"
        while true; do
            sleep 30
            echo -e "${BLUE}⏰ $(date '+%H:%M:%S') - 服务运行中...${NC}"
            
            # 检查服务状态
            if ! kill -0 $(cat backend.pid 2>/dev/null) 2>/dev/null; then
                echo -e "${RED}❌ 后端服务异常停止${NC}"
                break
            fi
        done
    else
        echo -e "${RED}❌ 启动失败${NC}"
        cleanup
    fi
}

# 检查jq依赖
if ! command -v jq &> /dev/null; then
    echo "📦 安装jq..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install jq
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-get install jq -y
    fi
fi

main