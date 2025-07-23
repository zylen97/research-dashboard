#!/bin/bash

# VPS状态检查脚本

echo "=== VPS部署状态检查脚本 ==="
echo "检查时间: $(date)"
echo ""

# 1. 检查前端文件
echo "1. 检查前端文件..."
echo "当前前端JS文件:"
curl -s "http://45.149.156.216:3001" | grep -o 'main\.[a-f0-9]\+\.js' || echo "未找到JS文件"

echo ""
echo "期望的JS文件: main.1e7e9707.js"
echo ""

# 2. 检查API状态
echo "2. 检查后端API..."
API_STATUS=$(curl -s -w "%{http_code}" -o /dev/null "http://45.149.156.216:8080/" || echo "000")
echo "API响应状态: $API_STATUS"

if [ "$API_STATUS" = "200" ]; then
    echo "✅ API运行正常"
else
    echo "❌ API异常"
fi

echo ""

# 3. 检查GitHub Actions最新状态
echo "3. GitHub Actions状态:"
echo "最新提交: $(git log -1 --oneline)"
echo "请手动检查: https://github.com/zylen97/research-dashboard/actions"

echo ""

# 4. 测试特定路径
echo "4. 测试文献管理路径..."
LITERATURE_STATUS=$(curl -s -w "%{http_code}" -o /dev/null "http://45.149.156.216:3001/literature" || echo "000")
echo "访问 /literature 响应: $LITERATURE_STATUS"

if [ "$LITERATURE_STATUS" = "200" ]; then
    echo "⚠️  文献路径仍然可访问"
else
    echo "✅ 文献路径已不可访问"
fi

echo ""

# 5. 检查VPS上的文件
echo "5. 建议检查VPS上的实际文件:"
echo "SSH命令: ssh root@45.149.156.216"
echo "检查命令:"
echo "  cd /var/www/research-dashboard"
echo "  git log -3 --oneline"
echo "  ls -la frontend/"
echo "  ls -la /var/www/html/"
echo "  systemctl status research-backend"
echo "  tail -20 /var/log/research-dashboard-deploy.log"

echo ""
echo "=== 检查完成 ==="