#!/bin/bash

# 🔧 恢复丢失的字段数据
echo "🔧 恢复丢失的字段数据..."
echo "时间: $(date)"
echo ""

cd /var/www/research-dashboard/backend || exit 1

echo "=== 1. 检查当前数据库字段 ==="
echo "当前collaborators表结构:"
sqlite3 data/research_dashboard_prod.db "PRAGMA table_info(collaborators);"

echo ""
echo "当前数据样例:"
sqlite3 data/research_dashboard_prod.db "SELECT id, name, email, institution, research_area, level FROM collaborators LIMIT 5;"

echo ""
echo "=== 2. 查找包含完整字段的备份 ==="
echo "检查各个备份中的数据结构..."

for backup in data/research_dashboard_prod_backup_*.db data/*.backup.*; do
    if [ -f "$backup" ]; then
        echo ""
        echo "检查备份: $backup"
        echo "表结构:"
        sqlite3 "$backup" "PRAGMA table_info(collaborators);" 2>/dev/null | head -3
        echo "数据样例:"
        sqlite3 "$backup" "SELECT id, name, email FROM collaborators LIMIT 2;" 2>/dev/null || echo "无法读取"
        
        # 检查是否有性别等字段
        gender_count=$(sqlite3 "$backup" "SELECT COUNT(*) FROM collaborators WHERE gender IS NOT NULL AND gender != '';" 2>/dev/null || echo "0")
        echo "有性别数据的记录数: $gender_count"
    fi
done

echo ""
echo "=== 3. 检查最新的好备份 ==="
# 检查最近的备份，找到有完整数据的
latest_good_backup=""
max_gender_count=0

for backup in data/research_dashboard_prod_backup_20250724_*.db; do
    if [ -f "$backup" ]; then
        gender_count=$(sqlite3 "$backup" "SELECT COUNT(*) FROM collaborators WHERE gender IS NOT NULL AND gender != '';" 2>/dev/null || echo "0")
        if [ "$gender_count" -gt "$max_gender_count" ]; then
            max_gender_count=$gender_count
            latest_good_backup=$backup
        fi
    fi
done

if [ -n "$latest_good_backup" ] && [ "$max_gender_count" -gt 0 ]; then
    echo "✅ 找到最佳备份: $latest_good_backup (有$max_gender_count条性别数据)"
    
    echo ""
    echo "=== 4. 备份当前数据库 ==="
    cp data/research_dashboard_prod.db "data/research_dashboard_prod.db.backup.before_restore_$(date +%Y%m%d_%H%M%S)"
    
    echo ""
    echo "=== 5. 恢复完整数据 ==="
    echo "从 $latest_good_backup 恢复数据..."
    cp "$latest_good_backup" data/research_dashboard_prod.db
    
    echo "恢复后的数据验证:"
    sqlite3 data/research_dashboard_prod.db "SELECT id, name, gender, class_name FROM collaborators LIMIT 5;" 2>/dev/null || echo "恢复可能失败"
    
    echo ""
    echo "统计恢复的数据:"
    echo "总记录数: $(sqlite3 data/research_dashboard_prod.db 'SELECT COUNT(*) FROM collaborators;')"
    echo "有性别的记录: $(sqlite3 data/research_dashboard_prod.db "SELECT COUNT(*) FROM collaborators WHERE gender IS NOT NULL AND gender != '';" 2>/dev/null)"
    echo "有班级的记录: $(sqlite3 data/research_dashboard_prod.db "SELECT COUNT(*) FROM collaborators WHERE class_name IS NOT NULL AND class_name != '';" 2>/dev/null)"
    
    echo ""
    echo "Level分布:"
    sqlite3 data/research_dashboard_prod.db "SELECT level, COUNT(*) FROM collaborators GROUP BY level;" 2>/dev/null
    
else
    echo "❌ 没有找到包含完整字段数据的备份"
    echo ""
    echo "=== 手动数据修复建议 ==="
    echo "需要手动添加缺失的字段，或者从其他来源导入数据"
    
    # 尝试添加缺失的字段
    echo "尝试添加缺失的字段到当前表..."
    sqlite3 data/research_dashboard_prod.db "ALTER TABLE collaborators ADD COLUMN gender TEXT;" 2>/dev/null || echo "gender字段可能已存在"
    sqlite3 data/research_dashboard_prod.db "ALTER TABLE collaborators ADD COLUMN class_name TEXT;" 2>/dev/null || echo "class_name字段可能已存在"
    sqlite3 data/research_dashboard_prod.db "ALTER TABLE collaborators ADD COLUMN future_plan TEXT;" 2>/dev/null || echo "future_plan字段可能已存在"
    sqlite3 data/research_dashboard_prod.db "ALTER TABLE collaborators ADD COLUMN background TEXT;" 2>/dev/null || echo "background字段可能已存在"
    
    echo "字段添加完成，但数据需要手动填充"
fi

echo ""
echo "=== 6. 重启服务以应用更改 ==="
systemctl restart research-backend
sleep 3
echo "服务状态: $(systemctl is-active research-backend)"

echo ""
echo "=== 恢复完成 ==="
echo "检查前端页面以验证数据是否正确显示"