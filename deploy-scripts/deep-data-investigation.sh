#!/bin/bash

# 🔍 深度数据调查脚本
echo "🔍🔍🔍 深度数据调查开始 🔍🔍🔍"
echo "时间: $(date)"
echo "============================================"

cd /var/www/research-dashboard/backend || exit 1

echo ""
echo "=== 1. 数据库文件状态调查 ==="
echo "当前目录: $(pwd)"
echo "数据目录内容:"
ls -la data/ 2>/dev/null || echo "data目录不存在"

echo ""
echo "所有可能的数据库文件:"
find . -name "*.db" -type f 2>/dev/null | while read file; do
    echo "文件: $file, 大小: $(du -sh "$file" | cut -f1), 修改时间: $(stat -c %y "$file" 2>/dev/null || stat -f %Sm "$file" 2>/dev/null)"
done

echo ""
echo "=== 2. 主数据库详细分析 ==="
if [ -f "data/research_dashboard_prod.db" ]; then
    echo "✅ 主数据库存在"
    echo "数据库大小: $(du -sh data/research_dashboard_prod.db | cut -f1)"
    echo "数据库修改时间: $(stat -c %y data/research_dashboard_prod.db 2>/dev/null || stat -f %Sm data/research_dashboard_prod.db 2>/dev/null)"
    
    echo ""
    echo "数据库中所有表:"
    sqlite3 data/research_dashboard_prod.db ".tables" 2>/dev/null || echo "无法读取表列表"
    
    echo ""
    echo "Collaborators表结构:"
    sqlite3 data/research_dashboard_prod.db "PRAGMA table_info(collaborators);" 2>/dev/null || echo "无法读取表结构"
    
    echo ""
    echo "Collaborators表总行数:"
    sqlite3 data/research_dashboard_prod.db "SELECT COUNT(*) as total_count FROM collaborators;" 2>/dev/null || echo "查询失败"
    
    echo ""
    echo "Collaborators表所有数据 (不管deleted_at状态):"
    sqlite3 data/research_dashboard_prod.db "SELECT id, name, email, level, deleted_at, created_at FROM collaborators ORDER BY id;" 2>/dev/null || echo "查询失败"
    
    echo ""
    echo "检查deleted_at字段的具体值:"
    sqlite3 data/research_dashboard_prod.db "SELECT deleted_at, COUNT(*) FROM collaborators GROUP BY deleted_at;" 2>/dev/null || echo "查询失败"
    
    echo ""
    echo "检查是否有NULL以外的deleted_at值:"
    sqlite3 data/research_dashboard_prod.db "SELECT id, name, deleted_at FROM collaborators WHERE deleted_at IS NOT NULL;" 2>/dev/null || echo "查询失败"
    
else
    echo "❌ 主数据库不存在!"
fi

echo ""
echo "=== 3. 备份文件调查 ==="
echo "寻找所有备份文件:"
find . -name "*backup*" -o -name "*.bak" -o -name "*_prod_*" 2>/dev/null | while read backup; do
    echo "备份文件: $backup, 大小: $(du -sh "$backup" | cut -f1)"
    if [[ "$backup" == *.db ]]; then
        echo "  备份中的collaborators数量: $(sqlite3 "$backup" "SELECT COUNT(*) FROM collaborators;" 2>/dev/null || echo "无法查询")"
        echo "  备份中的前5条数据:"
        sqlite3 "$backup" "SELECT id, name, email FROM collaborators LIMIT 5;" 2>/dev/null || echo "无法查询数据"
    fi
    echo ""
done

echo ""
echo "=== 4. Migration历史调查 ==="
if [ -f "data/research_dashboard_prod.db" ]; then
    echo "Migration历史记录:"
    sqlite3 data/research_dashboard_prod.db "SELECT version, executed_at FROM migration_history ORDER BY executed_at DESC;" 2>/dev/null || echo "无法查询migration历史"
    
    echo ""
    echo "最近的migration是否影响了collaborators表:"
    sqlite3 data/research_dashboard_prod.db "SELECT sql FROM sqlite_master WHERE type='table' AND name='collaborators';" 2>/dev/null || echo "无法查询表创建语句"
fi

echo ""
echo "=== 5. API查询逻辑调查 ==="
echo "测试不同的查询条件:"

echo "5.1 查询所有collaborators (无条件):"
sqlite3 data/research_dashboard_prod.db "SELECT COUNT(*) FROM collaborators;" 2>/dev/null || echo "查询失败"

echo "5.2 查询deleted_at IS NULL的collaborators:"
sqlite3 data/research_dashboard_prod.db "SELECT COUNT(*) FROM collaborators WHERE deleted_at IS NULL;" 2>/dev/null || echo "查询失败"

echo "5.3 查询deleted_at IS NOT NULL的collaborators:"
sqlite3 data/research_dashboard_prod.db "SELECT COUNT(*) FROM collaborators WHERE deleted_at IS NOT NULL;" 2>/dev/null || echo "查询失败"

echo "5.4 查询所有collaborators的详细信息:"
sqlite3 data/research_dashboard_prod.db "SELECT id, name, COALESCE(deleted_at, 'NULL') as deleted_at_status FROM collaborators ORDER BY id;" 2>/dev/null || echo "查询失败"

echo ""
echo "=== 6. 服务状态调查 ==="
echo "后端服务状态:"
systemctl is-active research-backend

echo ""
echo "后端服务最新日志 (查找数据相关错误):"
journalctl -u research-backend -n 30 --no-pager | grep -E "(collaborator|SELECT|database|error)" | tail -10

echo ""
echo "=== 7. 手动API测试 ==="
echo "直接测试collaborators API:"
if systemctl is-active research-backend >/dev/null; then
    echo "测试 /api/collaborators/ (默认查询):"
    curl -s "http://localhost:8080/api/collaborators/" | head -200 || echo "API调用失败"
    
    echo ""
    echo "测试 /api/collaborators/?include_deleted=true (包含已删除):"
    curl -s "http://localhost:8080/api/collaborators/?include_deleted=true" | head -200 || echo "API调用失败"
else
    echo "❌ 后端服务未运行"
fi

echo ""
echo "=== 8. 紧急数据恢复尝试 ==="
echo "如果有备份，列出恢复选项:"
find . -name "*backup*.db" -o -name "*_prod_backup_*.db" 2>/dev/null | while read backup; do
    echo "可用备份: $backup"
    backup_count=$(sqlite3 "$backup" "SELECT COUNT(*) FROM collaborators;" 2>/dev/null || echo "0")
    echo "  备份中的collaborators数量: $backup_count"
    if [ "$backup_count" != "0" ] && [ "$backup_count" != "" ]; then
        echo "  🔄 可以用此命令恢复: cp '$backup' data/research_dashboard_prod.db"
    fi
done

echo ""
echo "============================================"
echo "🎯 深度调查完成!"
echo ""
echo "🔧 根据上述结果，可能的解决方案:"
echo "1. 如果有备份且包含数据，执行恢复命令"
echo "2. 如果数据存在但deleted_at字段有问题，执行: sqlite3 data/research_dashboard_prod.db \"UPDATE collaborators SET deleted_at = NULL;\""
echo "3. 如果表为空，需要从其他备份恢复或重新导入数据"
echo "4. 如果API查询逻辑有问题，检查路由中的查询条件"