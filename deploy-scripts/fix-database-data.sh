#!/bin/bash

# 🚨 修复数据库中错误的字段数据
echo "🚨 修复数据库字段映射错误..."

cd /var/www/research-dashboard/backend || exit 1

echo "检查 collaborators 表中 deleted_at 字段的错误值:"
sqlite3 data/research_dashboard_prod.db "SELECT id, name, deleted_at FROM collaborators WHERE deleted_at IS NOT NULL AND deleted_at != '' AND deleted_at NOT LIKE '%-%-%';"

echo ""
echo "修复错误的 deleted_at 字段值 (把非日期字符串清空):"
sqlite3 data/research_dashboard_prod.db "UPDATE collaborators SET deleted_at = NULL WHERE deleted_at IS NOT NULL AND deleted_at != '' AND deleted_at NOT LIKE '%-%-%';"

echo ""
echo "检查修复结果:"
sqlite3 data/research_dashboard_prod.db "SELECT COUNT(*) as fixed_count FROM collaborators WHERE deleted_at IS NULL;"

echo ""
echo "检查是否还有其他字段的错误值:"
sqlite3 data/research_dashboard_prod.db "SELECT id, name, level FROM collaborators WHERE level IS NOT NULL LIMIT 5;"

echo "✅ 数据库字段修复完成!"