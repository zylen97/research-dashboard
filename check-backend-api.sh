#!/bin/bash

# 检查后端API路径结构脚本
# 找出后端实际暴露的API端点

echo "🔍 检查后端API路径结构..."
echo "========================================"

# 1. 检查后端根路径
echo "1. 检查后端根路径:"
echo "curl http://localhost:8080/"
curl http://localhost:8080/
echo ""
echo ""

# 2. 检查API文档
echo "========================================"
echo "2. 检查API文档页面:"
echo "curl http://localhost:8080/docs"
curl -s http://localhost:8080/docs | head -10
echo ""
echo ""

# 3. 检查OpenAPI规范
echo "========================================"
echo "3. 检查OpenAPI规范 (API路径定义):"
echo "curl http://localhost:8080/openapi.json"
if curl -s http://localhost:8080/openapi.json > /tmp/openapi.json 2>/dev/null; then
    echo "✅ OpenAPI规范获取成功"
    echo "📋 API路径列表:"
    cat /tmp/openapi.json | grep -o '"/[^"]*"' | sort | uniq | head -20
    echo ""
    echo "📋 具体的auth相关路径:"
    cat /tmp/openapi.json | grep -o '"/[^"]*auth[^"]*"' | sort | uniq
    echo ""
else
    echo "❌ 无法获取OpenAPI规范"
fi

# 4. 测试常见API路径
echo "========================================"
echo "4. 测试常见API路径:"

echo "测试 /api/:"
curl -s -o /dev/null -w "状态码: %{http_code}\n" http://localhost:8080/api/

echo "测试 /api/auth/:"
curl -s -o /dev/null -w "状态码: %{http_code}\n" http://localhost:8080/api/auth/

echo "测试 /auth/:"
curl -s -o /dev/null -w "状态码: %{http_code}\n" http://localhost:8080/auth/

echo "测试 /api/auth/login:"
curl -s -o /dev/null -w "状态码: %{http_code}\n" http://localhost:8080/api/auth/login

echo "测试 /auth/login:"
curl -s -o /dev/null -w "状态码: %{http_code}\n" http://localhost:8080/auth/login

echo "测试 /login:"
curl -s -o /dev/null -w "状态码: %{http_code}\n" http://localhost:8080/login

# 5. 测试其他可能的API端点
echo ""
echo "========================================"
echo "5. 测试其他可能的API端点:"

echo "测试 /api/users:"
curl -s -o /dev/null -w "状态码: %{http_code}\n" http://localhost:8080/api/users

echo "测试 /users:"
curl -s -o /dev/null -w "状态码: %{http_code}\n" http://localhost:8080/users

echo "测试 /api/research:"
curl -s -o /dev/null -w "状态码: %{http_code}\n" http://localhost:8080/api/research

echo "测试 /research:"
curl -s -o /dev/null -w "状态码: %{http_code}\n" http://localhost:8080/research

echo "测试 /api/collaborators:"
curl -s -o /dev/null -w "状态码: %{http_code}\n" http://localhost:8080/api/collaborators

echo "测试 /collaborators:"
curl -s -o /dev/null -w "状态码: %{http_code}\n" http://localhost:8080/collaborators

# 6. 检查后端源码中的路由定义
echo ""
echo "========================================"
echo "6. 检查后端源码中的路由定义:"
echo "📁 查找路由定义文件:"
find /var/www/research-dashboard/backend -name "*.py" -exec grep -l "app.include_router\|@app\|APIRouter" {} \;

echo ""
echo "📋 路由定义内容:"
find /var/www/research-dashboard/backend -name "*.py" -exec grep -H "app.include_router\|@app\.\|router\." {} \; | head -10

echo ""
echo "========================================"
echo "🎯 检查完成！"
echo ""
echo "💡 分析结果："
echo "   - 查看OpenAPI规范中的路径定义"
echo "   - 找出返回200状态码的API端点"
echo "   - 检查源码中的实际路由配置"