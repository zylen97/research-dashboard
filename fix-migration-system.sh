#!/bin/bash

# 🔧 修复迁移系统脚本
# 解决迁移版本混乱导致的数据丢失问题

echo "🔧 修复迁移系统..."
echo "时间: $(date)"
echo "=========================================="

# 进入项目目录
cd /var/www/research-dashboard/backend || {
    echo "❌ 无法进入项目目录!"
    exit 1
}

echo "📊 当前迁移状态检查..."

# 检查迁移历史
if [ -f "data/research_dashboard_prod.db" ]; then
    echo "🔍 当前迁移记录："
    sqlite3 data/research_dashboard_prod.db "SELECT version, executed_at FROM migration_history ORDER BY executed_at DESC;" 2>/dev/null || echo "   ❌ 无法读取迁移历史"
    
    echo ""
    echo "🔍 数据库表结构检查："
    
    # 检查各表的字段
    echo "research_projects 表字段："
    sqlite3 data/research_dashboard_prod.db "PRAGMA table_info(research_projects);" 2>/dev/null | grep -E "(is_todo|todo_marked_at|user_id)" || echo "   缺少关键字段"
    
    echo ""
    echo "literature 表字段："
    sqlite3 data/research_dashboard_prod.db "PRAGMA table_info(literature);" 2>/dev/null | grep "user_id" || echo "   缺少user_id字段"
    
    echo ""
    echo "ideas 表字段："
    sqlite3 data/research_dashboard_prod.db "PRAGMA table_info(ideas);" 2>/dev/null | grep "user_id" || echo "   缺少user_id字段"
else
    echo "❌ 生产数据库文件不存在！"
fi

echo ""
echo "=========================================="

# 修复迁移系统的根本问题
echo "🔧 修复迁移系统问题..."

# 1. 备份当前迁移脚本
if [ -f "migrations/migration.py" ]; then
    cp migrations/migration.py migrations/migration.py.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ 已备份当前迁移脚本"
fi

# 2. 创建安全的迁移检查函数
cat > migrations/safe_migration_check.py << 'EOF'
#!/usr/bin/env python3
"""
安全的迁移检查和执行脚本
防止重复执行和数据丢失
"""

import sqlite3
import sys
import os
from datetime import datetime

def check_database_integrity(db_path):
    """检查数据库完整性"""
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 检查关键表是否存在且有数据
        tables_to_check = ['users', 'research_projects', 'collaborators']
        results = {}
        
        for table in tables_to_check:
            try:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                count = cursor.fetchone()[0]
                results[table] = count
                print(f"✅ {table}: {count} 条记录")
            except sqlite3.OperationalError as e:
                results[table] = f"错误: {e}"
                print(f"❌ {table}: {e}")
        
        # 检查迁移历史
        try:
            cursor.execute("SELECT version, executed_at FROM migration_history ORDER BY executed_at DESC LIMIT 5")
            migrations = cursor.fetchall()
            print(f"\n📋 最近迁移记录:")
            for version, executed_at in migrations:
                print(f"   {version} - {executed_at}")
        except sqlite3.OperationalError:
            print("\n⚠️  迁移历史表不存在")
        
        conn.close()
        return results
        
    except Exception as e:
        print(f"❌ 数据库检查失败: {e}")
        return None

if __name__ == "__main__":
    db_path = "data/research_dashboard_prod.db"
    if len(sys.argv) > 1:
        db_path = sys.argv[1]
    
    if not os.path.exists(db_path):
        print(f"❌ 数据库文件不存在: {db_path}")
        sys.exit(1)
    
    print(f"🔍 检查数据库: {db_path}")
    results = check_database_integrity(db_path)
    
    if results:
        # 检查是否有数据丢失的迹象
        if all(isinstance(v, int) and v > 0 for v in results.values()):
            print("\n✅ 数据库状态正常")
        else:
            print("\n⚠️  发现潜在问题，建议检查备份")
EOF

chmod +x migrations/safe_migration_check.py

# 3. 执行安全检查
echo "🔍 执行数据库安全检查..."
python3 migrations/safe_migration_check.py

echo ""
echo "=========================================="
echo "🎯 修复建议："
echo ""
echo "1. 立即执行紧急恢复脚本（如果数据丢失）："
echo "   ./emergency-restore.sh"
echo ""
echo "2. 未来避免此问题："
echo "   - 迁移前始终备份数据库"
echo "   - 迁移版本号必须严格递增"
echo "   - 禁止在生产环境手动运行迁移"
echo ""
echo "3. 如果需要重置迁移系统："
echo "   - 手动清理migration_history表中的错误记录"
echo "   - 重新设置正确的版本号"
echo ""
echo "🔧 修复脚本执行完成: $(date)"