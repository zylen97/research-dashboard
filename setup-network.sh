#!/bin/bash

# 研究看板 - 网络穿透配置脚本
# 支持团队成员通过广域网访问

echo "🌐 研究看板网络穿透配置"
echo "=========================="

# 检查是否安装了ngrok
check_ngrok() {
    if command -v ngrok &> /dev/null; then
        echo "✅ ngrok已安装"
        return 0
    else
        echo "❌ ngrok未安装"
        return 1
    fi
}

# 安装ngrok
install_ngrok() {
    echo "📦 正在安装ngrok..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install ngrok/ngrok/ngrok
        else
            echo "请先安装Homebrew，然后运行: brew install ngrok/ngrok/ngrok"
            exit 1
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
        echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
        sudo apt update && sudo apt install ngrok
    else
        echo "请手动安装ngrok: https://ngrok.com/download"
        exit 1
    fi
}

# 配置ngrok
setup_ngrok() {
    echo "🔧 配置ngrok..."
    
    # 检查是否已配置auth token
    if ngrok config check &> /dev/null; then
        echo "✅ ngrok已配置"
    else
        echo "⚠️  需要配置ngrok auth token"
        echo "1. 访问 https://dashboard.ngrok.com/get-started/your-authtoken"
        echo "2. 复制您的authtoken"
        echo "3. 运行: ngrok config add-authtoken YOUR_TOKEN"
        echo ""
        read -p "请输入您的ngrok authtoken: " authtoken
        if [ ! -z "$authtoken" ]; then
            ngrok config add-authtoken "$authtoken"
            echo "✅ ngrok authtoken已配置"
        else
            echo "❌ 未输入authtoken，请手动配置"
            exit 1
        fi
    fi
}

# 创建ngrok配置文件
create_ngrok_config() {
    echo "📝 创建ngrok配置文件..."
    
    cat > ngrok.yml << EOF
version: "2"
authtoken_from_env: true
tunnels:
  backend:
    addr: 8080
    proto: http
    bind_tls: true
    inspect: false
  frontend:
    addr: 3000
    proto: http
    bind_tls: true
    inspect: false
EOF

    echo "✅ ngrok配置文件已创建"
}

# 启动服务
start_services() {
    echo "🚀 启动服务..."
    
    # 检查后端是否运行
    if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null; then
        echo "✅ 后端服务已在运行 (端口8080)"
    else
        echo "🔄 启动后端服务..."
        cd backend
        python main.py &
        BACKEND_PID=$!
        echo "后端PID: $BACKEND_PID"
        cd ..
        sleep 3
    fi
    
    # 检查前端是否运行
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null; then
        echo "✅ 前端服务已在运行 (端口3000)"
    else
        echo "🔄 启动前端服务..."
        cd frontend
        npm start &
        FRONTEND_PID=$!
        echo "前端PID: $FRONTEND_PID"
        cd ..
        sleep 5
    fi
}

# 启动ngrok隧道
start_ngrok() {
    echo "🌐 启动ngrok隧道..."
    
    # 启动ngrok（后台运行）
    ngrok start --config=ngrok.yml --all > ngrok.log 2>&1 &
    NGROK_PID=$!
    
    echo "等待ngrok启动..."
    sleep 5
    
    # 获取公网地址
    echo "📋 获取公网访问地址..."
    
    # 通过ngrok API获取tunnel信息
    BACKEND_URL=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[] | select(.config.addr=="localhost:8080") | .public_url')
    FRONTEND_URL=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[] | select(.config.addr=="localhost:3000") | .public_url')
    
    if [ "$BACKEND_URL" != "null" ] && [ "$FRONTEND_URL" != "null" ]; then
        echo ""
        echo "🎉 成功！您的应用现在可以通过以下地址访问："
        echo "=========================="
        echo "🌐 前端地址: $FRONTEND_URL"
        echo "🔗 后端地址: $BACKEND_URL"
        echo "=========================="
        echo ""
        echo "📤 分享给团队成员："
        echo "团队成员访问: $FRONTEND_URL"
        echo ""
        echo "💡 注意事项："
        echo "- 免费版ngrok会话8小时后自动断开"
        echo "- 每次重启地址会变化"
        echo "- 建议升级到付费版获得固定域名"
        echo ""
        
        # 创建访问信息文件
        cat > network-info.txt << EOF
研究看板网络访问信息
===================

前端地址: $FRONTEND_URL
后端地址: $BACKEND_URL

分享给团队成员：
团队成员请访问: $FRONTEND_URL

注意：
- 地址有效期8小时（免费版限制）
- 重启后地址会变化
- 请及时分享给团队成员

生成时间: $(date)
EOF
        
        echo "📁 访问信息已保存到 network-info.txt"
        
        # 等待用户输入停止服务
        echo ""
        echo "按 Ctrl+C 停止所有服务"
        trap 'echo "🛑 正在停止服务..."; kill $NGROK_PID 2>/dev/null; exit 0' INT
        
        # 持续显示状态
        while true; do
            sleep 30
            echo "⏰ $(date '+%H:%M:%S') - 服务运行中... (Ctrl+C停止)"
        done
        
    else
        echo "❌ 无法获取ngrok地址，请检查配置"
        cat ngrok.log
        exit 1
    fi
}

# 主流程
main() {
    if ! check_ngrok; then
        install_ngrok
    fi
    
    setup_ngrok
    create_ngrok_config
    start_services
    start_ngrok
}

# 检查依赖
if ! command -v jq &> /dev/null; then
    echo "📦 安装jq..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install jq
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-get install jq
    fi
fi

main