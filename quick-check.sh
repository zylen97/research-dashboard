#!/bin/bash

echo "检查前端LoginForm.tsx文件中是否还有注册相关内容..."
echo ""

# 检查本地文件
echo "📁 本地文件检查:"
grep -n "注册\|立即注册\|有邀请码\|加入团队" frontend/src/components/auth/LoginForm.tsx || echo "✅ 本地文件已清理干净"

echo ""
echo "🌐 检查线上部署:"
echo "请在浏览器中："
echo "1. 打开开发者工具 (F12)"
echo "2. 切换到 Network 标签"
echo "3. 勾选 Disable cache"
echo "4. 刷新页面"
echo ""
echo "或者使用无痕模式访问: http://45.149.156.216"