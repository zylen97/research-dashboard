#!/bin/bash

# VPS紧急修复脚本
# 解决500错误问题

echo "🚨 VPS紧急修复开始..."
echo "时间: $(date)"
echo "=========================================="

# SSH连接信息
VPS_HOST="45.149.156.216"
VPS_USER="root"

# 执行远程命令的函数
remote_exec() {
    ssh -o ConnectTimeout=10 ${VPS_USER}@${VPS_HOST} "$1"
}

echo "1. 检查VPS连接..."
if remote_exec "echo '✅ SSH连接成功'"; then
    echo "连接正常"
else
    echo "❌ 无法连接到VPS"
    exit 1
fi

echo ""
echo "2. 检查后端服务状态..."
remote_exec "systemctl status research-backend --no-pager | head -10"

echo ""
echo "3. 检查最近的错误日志..."
remote_exec "journalctl -u research-backend --no-pager -n 20 | grep -E '(ERROR|CRITICAL|500)'"

echo ""
echo "4. 检查数据库迁移状态..."
remote_exec "cd /var/www/research-dashboard/backend && sqlite3 data/research_dashboard_prod.db 'SELECT * FROM migration_history ORDER BY executed_at DESC LIMIT 5;'"

echo ""
echo "5. 检查数据库表结构..."
remote_exec "cd /var/www/research-dashboard/backend && sqlite3 data/research_dashboard_prod.db '.schema research_projects' | head -5"

echo ""
echo "6. 手动执行v1.7迁移..."
remote_exec "cd /var/www/research-dashboard/backend && python3 migrations/migration.py"

echo ""
echo "7. 重启后端服务..."
remote_exec "systemctl restart research-backend"

echo ""
echo "8. 等待服务启动..."
sleep 5

echo ""
echo "9. 验证服务状态..."
remote_exec "systemctl is-active research-backend"

echo ""
echo "10. 测试API端点..."
curl -s -w "状态码: %{http_code}\n" http://45.149.156.216:3001/api/auth/test

echo ""
echo "🏁 紧急修复完成"