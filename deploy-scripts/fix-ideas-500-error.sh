#!/bin/bash

# 修复Ideas管理500错误的紧急脚本
# 2025-07-24 Ultra Think

set -e

echo "🚨 紧急修复Ideas管理500错误..."

# 切换到后端目录
cd /var/www/research-dashboard/backend

echo "1. 检查当前数据库状态..."
sqlite3 data/research_dashboard_prod.db "SELECT name FROM sqlite_master WHERE type='table';" | head -10

echo -e "\n2. 检查collaborators表结构..."
sqlite3 data/research_dashboard_prod.db "PRAGMA table_info(collaborators);"

echo -e "\n3. 强制执行migration..."
ENVIRONMENT=production python3 migrations/migration.py

echo -e "\n4. 验证修复结果..."
echo "检查level字段："
sqlite3 data/research_dashboard_prod.db "SELECT COUNT(*) FROM collaborators WHERE level IS NOT NULL;" || echo "level字段不存在！"

echo "检查deleted_at字段："
sqlite3 data/research_dashboard_prod.db "SELECT COUNT(*) FROM collaborators WHERE deleted_at IS NULL;" || echo "deleted_at字段不存在！"

echo -e "\n5. 重启后端服务..."
systemctl restart research-backend

echo -e "\n6. 检查服务状态..."
systemctl status research-backend --no-pager

echo -e "\n✅ 修复完成！请测试API是否正常"