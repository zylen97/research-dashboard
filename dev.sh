#!/bin/bash

# 开发环境快速启动脚本
echo "🚀 启动开发环境..."

# 获取项目根目录
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 停止现有服务
echo "清理现有服务..."
pkill -f "python.*main.py" 2>/dev/null || true
pkill -f "react-scripts" 2>/dev/null || true
pkill -f "npm.*start" 2>/dev/null || true
sleep 3

# 启动后端
echo "启动后端服务..."
cd "$PROJECT_DIR/backend"
python main.py &
BACKEND_PID=$!

# 等待后端启动
echo "等待后端启动..."
sleep 8

# 测试后端
if curl -s http://localhost:8080/ >/dev/null 2>&1; then
    echo "✅ 后端启动成功: http://localhost:8080"
else
    echo "❌ 后端启动失败"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

# 启动前端
echo "启动前端服务..."
cd "$PROJECT_DIR/frontend"

# 检查node_modules
if [ ! -d "node_modules" ]; then
    echo "安装前端依赖..."
    npm install
fi

echo "启动React开发服务器..."
echo "这可能需要几分钟时间进行首次编译..."
PORT=3001 npm start &
FRONTEND_PID=$!

echo ""
echo "🎉 开发环境启动中..."
echo "后端: http://localhost:8080 (已就绪)"
echo "前端: http://localhost:3001 (编译中...)"
echo ""
echo "请稍等前端编译完成，然后在浏览器中访问:"
echo "👉 http://localhost:3001"
echo ""
echo "按任意键显示实时日志，或等待几分钟后直接访问网址..."
read -n 1 -s

echo "显示前端编译日志..."
echo "前端编译完成后会自动打开浏览器"
echo "如果没有自动打开，请手动访问: http://localhost:3001"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 等待用户中断
trap 'echo -e "\n停止服务..."; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true; exit 0' INT

# 保持脚本运行
wait