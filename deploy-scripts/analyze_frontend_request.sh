#!/bin/bash
# 分析前端请求和422错误

echo "========================================="
echo "🔬 分析前端请求和422错误"
echo "========================================="

# 1. 检查前端是否已部署最新版本
echo "1. 检查前端版本..."
FRONTEND_FILE="/var/www/research-dashboard/frontend/build/static/js/main.*.js"
if ls $FRONTEND_FILE 1> /dev/null 2>&1; then
    echo "前端构建时间:"
    stat -c "%y" $FRONTEND_FILE | head -1
else
    echo "❌ 前端文件未找到"
fi

# 2. 检查nginx日志中的请求
echo -e "\n2. 检查nginx访问日志中的/api/research/todos请求..."
grep "research/todos" /var/log/nginx/access.log | tail -10

# 3. 启用后端详细日志
echo -e "\n3. 临时启用FastAPI详细日志..."
cd /var/www/research-dashboard/backend

# 创建一个测试脚本来捕获详细的422错误
cat > test_422_capture.py << 'EOF'
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import json
import asyncio
import uvicorn

# 导入原始app
from main import app

# 添加详细的异常处理器
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    print(f"\n=== 422 ERROR DETAILS ===")
    print(f"URL: {request.url}")
    print(f"Method: {request.method}")
    print(f"Headers: {dict(request.headers)}")
    print(f"Path params: {request.path_params}")
    print(f"Query params: {request.query_params}")
    print(f"Validation errors: {exc.errors()}")
    print(f"Body: {exc.body}")
    print("========================\n")
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors()},
    )

print("测试服务器启动在端口 8081...")
print("请在另一个终端测试: curl http://localhost:8081/api/research/todos")

if __name__ == "__main__":
    config = uvicorn.Config(app, host="0.0.0.0", port=8081, log_level="debug")
    server = uvicorn.Server(config)
    server.run()
EOF

# 4. 检查前端代码中的API调用
echo -e "\n4. 检查前端getUserTodos实现..."
if [ -f "/var/www/research-dashboard/frontend/src/services/api.ts" ]; then
    grep -A5 -B5 "getUserTodos" /var/www/research-dashboard/frontend/src/services/api.ts
fi

# 5. 检查当前运行的进程
echo -e "\n5. 检查后端服务状态..."
ps aux | grep -E "uvicorn|research-backend" | grep -v grep

# 6. 测试不同的路由匹配
echo -e "\n6. 测试路由匹配..."
curl -s http://localhost:8080/api/research/todos -w "\n状态码: %{http_code}\n"
curl -s http://localhost:8080/api/research/123 -w "\n状态码: %{http_code}\n"
curl -s http://localhost:8080/api/research/abc -w "\n状态码: %{http_code}\n"

echo -e "\n========================================="
echo "分析建议："
echo "1. 如果要捕获详细的422错误，运行: python3 test_422_capture.py"
echo "2. 然后在浏览器中访问网站，触发错误"
echo "3. 检查控制台输出的详细错误信息"
echo "========================================="