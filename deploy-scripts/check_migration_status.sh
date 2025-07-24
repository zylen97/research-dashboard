#!/bin/bash

# 检查VPS上的迁移状态和数据库结构

echo "=== VPS迁移状态检查 ==="
echo "请在VPS上执行以下命令进行诊断："
echo ""

echo "# 1. 检查迁移历史"
echo "cd /var/www/research-dashboard/backend"
echo "sqlite3 data/research_dashboard_prod.db \"SELECT version, executed_at FROM migration_history ORDER BY executed_at DESC LIMIT 5;\""
echo ""

echo "# 2. 检查ideas表结构"
echo "sqlite3 data/research_dashboard_prod.db \"PRAGMA table_info(ideas);\""
echo ""

echo "# 3. 检查collaborators表字段"
echo "sqlite3 data/research_dashboard_prod.db \"PRAGMA table_info(collaborators);\" | grep -E \"(level|deleted_at)\""
echo ""

echo "# 4. 检查部署日志"
echo "grep -A20 \"v1.17\" /var/log/research-dashboard-deploy.log"
echo ""

echo "# 5. 手动执行迁移（如果需要）"
echo "ENVIRONMENT=production python3 migrations/migration.py"
echo ""

echo "# 6. 重启后端服务"
echo "systemctl restart research-backend"
echo ""

echo "# 7. 检查服务状态"
echo "systemctl status research-backend"