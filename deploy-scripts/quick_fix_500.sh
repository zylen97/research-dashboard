#!/bin/bash

# 快速修复500错误 - 在VPS上执行

echo "🔧 快速修复500错误..."
echo "请在VPS上执行以下命令："
echo ""
echo "cd /var/www/research-dashboard"
echo "git pull"
echo "cd backend"
echo "ENVIRONMENT=production python3 migrations/migration.py"
echo "systemctl restart research-backend"
echo ""
echo "执行完成后，API应该恢复正常！"