#!/bin/bash

# 🔍 快速验证部署是否成功

echo "🔍 验证部署状态..."

echo "1. 检查前端是否可访问:"
if curl -s http://45.149.156.216:3001 > /dev/null; then
    echo "   ✅ 前端可访问"
else
    echo "   ❌ 前端不可访问"
fi

echo "2. 检查后端API是否可访问:"
if curl -s http://45.149.156.216:8080/docs > /dev/null; then
    echo "   ✅ 后端API可访问"
else
    echo "   ❌ 后端API不可访问 (可能502错误)"
fi

echo "3. 当前前端JS文件版本:"
curl -s http://45.149.156.216:3001 | grep -o 'main\.[a-z0-9]*\.js' | head -1

echo "4. 本地构建的JS文件版本:"
if [ -d "frontend/build/static/js" ]; then
    ls frontend/build/static/js/main.*.js | grep -o 'main\.[a-z0-9]*\.js'
else
    echo "   本地build目录不存在"
fi

echo ""
echo "🎯 手动测试步骤:"
echo "1. 访问: http://45.149.156.216:3001"
echo "2. 点击: Idea发掘与AI配置中心"
echo "3. 检查: 左侧AI配置面板是否更宽"
echo "4. 检查: AI配置表单是否默认展开"
echo ""
echo "如果布局没有变化，说明部署确实没有生效，需要手动操作或联系VPS服务商。"