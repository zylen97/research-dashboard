#!/bin/bash

echo "🔍 VPS备份完整检查脚本"
echo "====================="
echo ""

echo "1. 查找所有数据库文件："
echo "------------------------"
find /var/www/research-dashboard -name "*.db" -type f 2>/dev/null | sort

echo ""
echo "2. 检查backend/backups目录："
echo "----------------------------"
if [ -d "/var/www/research-dashboard/backend/backups" ]; then
    echo "目录结构："
    ls -la /var/www/research-dashboard/backend/backups/
    echo ""
    echo "production子目录："
    ls -la /var/www/research-dashboard/backend/backups/production/ 2>/dev/null || echo "production目录不存在"
    echo ""
    echo "dev子目录："
    ls -la /var/www/research-dashboard/backend/backups/dev/ 2>/dev/null || echo "dev目录不存在"
else
    echo "❌ backend/backups目录不存在"
fi

echo ""
echo "3. 检查backend/data目录："
echo "-------------------------"
ls -la /var/www/research-dashboard/backend/data/ 2>/dev/null || echo "data目录不存在"

echo ""
echo "4. 查找所有备份相关目录："
echo "-------------------------"
find /var/www/research-dashboard -type d -name "*backup*" 2>/dev/null | grep -v node_modules

echo ""
echo "5. 检查环境配置："
echo "-----------------"
echo "环境变量 IS_PRODUCTION:"
echo $IS_PRODUCTION
echo ""
echo "后端服务状态："
systemctl status research-backend | grep Active

echo ""
echo "6. 测试备份API（需要后端运行）："
echo "-------------------------------"
# 获取token
token=$(curl -s -X POST "http://localhost:8080/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "zl", "password": "123"}' | \
  python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('access_token', 'NO_TOKEN'))" 2>/dev/null)

if [ "$token" != "NO_TOKEN" ] && [ -n "$token" ]; then
    echo "✅ 登录成功"
    echo ""
    echo "备份列表API响应："
    curl -s -H "Authorization: Bearer $token" "http://localhost:8080/api/backup/list" | python3 -m json.tool
else
    echo "❌ 无法获取认证token"
fi

echo ""
echo "检查完成！"