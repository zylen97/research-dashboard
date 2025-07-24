#!/bin/bash

# 🚨 紧急修复数据库字段错位问题
echo "🚨 紧急修复数据库字段错位..."

cd /var/www/research-dashboard/backend || exit 1

echo "备份数据库..."
cp data/research_dashboard_prod.db data/research_dashboard_prod_backup_$(date +%Y%m%d_%H%M%S).db

echo "修复created_at字段中的错误数据..."
sqlite3 data/research_dashboard_prod.db "UPDATE collaborators SET created_at = datetime('now') WHERE created_at = 'senior' OR created_at = 'junior';"

echo "修复updated_at字段中的错误数据..."
sqlite3 data/research_dashboard_prod.db "UPDATE collaborators SET updated_at = datetime('now') WHERE updated_at = 'senior' OR updated_at = 'junior';"

echo "确保level字段正确..."
sqlite3 data/research_dashboard_prod.db "UPDATE collaborators SET level = 'senior' WHERE level IS NULL OR level = '';"

echo "清理deleted_at字段..."
sqlite3 data/research_dashboard_prod.db "UPDATE collaborators SET deleted_at = NULL WHERE deleted_at = 'senior' OR deleted_at = 'junior' OR deleted_at = '';"

echo "验证修复结果..."
echo "检查created_at字段:"
sqlite3 data/research_dashboard_prod.db "SELECT id, name, created_at FROM collaborators LIMIT 5;"

echo ""
echo "检查updated_at字段:"
sqlite3 data/research_dashboard_prod.db "SELECT id, name, updated_at FROM collaborators LIMIT 5;"

echo ""
echo "检查level字段:"
sqlite3 data/research_dashboard_prod.db "SELECT id, name, level FROM collaborators LIMIT 5;"

echo ""
echo "检查是否还有非日期时间的字段值:"
sqlite3 data/research_dashboard_prod.db "SELECT COUNT(*) as bad_created_at FROM collaborators WHERE created_at NOT LIKE '____-__-__ __:__:__' AND created_at NOT LIKE '____-__-__T__:__:__';"

echo "✅ 数据库修复完成!"