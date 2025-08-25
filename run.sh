#!/bin/bash

# 简化版启动脚本 - 用于快速测试
echo "🚀 快速启动 Research Dashboard..."

# 停止现有服务
echo "停止现有服务..."
pkill -f "python.*main.py" 2>/dev/null || true
pkill -f "npm.*start" 2>/dev/null || true
sleep 2

# 启动后端
echo "启动后端服务 (8080端口)..."
cd backend
python main.py &
BACKEND_PID=$!
echo "后端PID: $BACKEND_PID"

# 等待后端启动
echo "等待后端启动..."
sleep 5

# 测试后端
echo "测试后端连接..."
if curl -s http://localhost:8080/ >/dev/null; then
    echo "✅ 后端启动成功: http://localhost:8080"
    echo "📖 API文档: http://localhost:8080/docs"
else
    echo "❌ 后端启动失败"
    exit 1
fi

# 启动前端
echo "启动前端服务 (3001端口)..."
cd ../frontend
npm start &
FRONTEND_PID=$!
echo "前端PID: $FRONTEND_PID"

echo ""
echo "🎉 服务启动完成!"
echo "前端地址: http://localhost:3001"
echo "后端地址: http://localhost:8080"
echo ""
echo "按回车键停止所有服务..."
read

# 停止服务
echo "停止服务..."
kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
echo "✅ 服务已停止"