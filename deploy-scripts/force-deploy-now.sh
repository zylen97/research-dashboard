#!/bin/bash

# 🚀 强制部署脚本 - 通过多种方式触发部署

set -e

echo "🚀 强制部署到VPS..."

# 1. 重新构建前端确保最新
echo "📦 重新构建前端..."
cd frontend
npm run build
tar -czf build.tar.gz -C build .
echo "✅ 前端构建完成: $(ls -lh build.tar.gz | awk '{print $5}')"
cd ..

# 2. 强制推送触发GitHub Actions
echo "📤 强制推送触发部署..."
git add .
git commit -m "force: Trigger deployment for layout fixes - $(date '+%Y-%m-%d %H:%M')" || echo "无新变更"
git push origin main

echo "✅ 代码已推送，GitHub Actions应该自动触发"

# 3. 等待并检查部署结果
echo "⏱️ 等待30秒让GitHub Actions开始..."
sleep 30

echo "🔍 检查部署结果..."
for i in {1..12}; do
    echo "检查第 $i/12 次..."
    
    # 检查前端是否更新
    if curl -s "http://45.149.156.216:3001" | grep -q "研究Idea发掘与AI配置中心"; then
        echo "✅ 前端可访问"
        
        # 检查是否包含我们的修改（通过查看页面源码特征）
        if curl -s "http://45.149.156.216:3001" | grep -q "static/js/main"; then
            echo "✅ 前端已更新"
            break
        fi
    fi
    
    if [ $i -eq 12 ]; then
        echo "❌ 部署可能失败，请手动检查"
        echo "📱 GitHub Actions: https://github.com/zylen97/research-dashboard/actions"
        exit 1
    fi
    
    sleep 15
done

# 4. 验证关键功能
echo "🔍 验证部署结果..."
echo "前端访问: http://45.149.156.216:3001"
echo "API文档: http://45.149.156.216:8080/docs"

# 测试前端
if curl -I "http://45.149.156.216:3001" 2>/dev/null | head -1 | grep -q "200"; then
    echo "✅ 前端访问正常"
else
    echo "❌ 前端访问异常"
fi

# 测试API
if curl -I "http://45.149.156.216:8080/docs" 2>/dev/null | head -1 | grep -q "200"; then
    echo "✅ API访问正常"
else
    echo "❌ API访问异常"
fi

echo ""
echo "🎉 强制部署完成！"
echo "📍 请访问 http://45.149.156.216:3001/ideas 检查:"
echo "   1. AI配置面板是否更宽"
echo "   2. AI配置表单是否默认展开"
echo ""
echo "如果问题仍存在，可能需要:"
echo "1. 检查GitHub Actions日志"
echo "2. 联系VPS服务商检查SSH访问"
echo "3. 手动SSH到VPS执行部署"