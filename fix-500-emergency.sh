#!/bin/bash

# 🚨 紧急修复500错误 - 直接添加缺失字段
echo "🚨 紧急修复500错误 - 添加缺失的数据库字段"
echo "时间: $(date)"

# 进入后端目录
cd /var/www/research-dashboard/backend || exit 1

# 备份数据库
echo "📋 备份数据库..."
cp data/research_dashboard_prod.db data/research_dashboard_prod.db.backup.$(date +%Y%m%d_%H%M%S)

echo "🔧 直接修复数据库结构..."

# 使用Python直接修复数据库
python3 -c "
import sqlite3
import sys

try:
    conn = sqlite3.connect('data/research_dashboard_prod.db')
    cursor = conn.cursor()
    
    print('🔍 检查research_projects表结构...')
    cursor.execute('PRAGMA table_info(research_projects)')
    columns = cursor.fetchall()
    existing_columns = [col[1] for col in columns]
    
    print(f'现有字段: {existing_columns}')
    
    # 添加is_todo字段
    if 'is_todo' not in existing_columns:
        print('⚡ 添加is_todo字段...')
        cursor.execute('ALTER TABLE research_projects ADD COLUMN is_todo BOOLEAN DEFAULT 0')
        print('✅ is_todo字段已添加')
    else:
        print('ℹ️  is_todo字段已存在')
    
    # 添加todo_marked_at字段
    if 'todo_marked_at' not in existing_columns:
        print('⚡ 添加todo_marked_at字段...')
        cursor.execute('ALTER TABLE research_projects ADD COLUMN todo_marked_at DATETIME')
        print('✅ todo_marked_at字段已添加')
    else:
        print('ℹ️  todo_marked_at字段已存在')
    
    # 添加user_id字段（如果不存在）
    if 'user_id' not in existing_columns:
        print('⚡ 添加user_id字段...')
        cursor.execute('ALTER TABLE research_projects ADD COLUMN user_id INTEGER DEFAULT 1')
        print('✅ user_id字段已添加')
    else:
        print('ℹ️  user_id字段已存在')
        
    # 更新NULL的user_id
    cursor.execute('UPDATE research_projects SET user_id = 1 WHERE user_id IS NULL')
    
    conn.commit()
    conn.close()
    
    print('🎉 数据库修复完成!')
    
    # 验证修复结果
    conn = sqlite3.connect('data/research_dashboard_prod.db')
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM research_projects')
    count = cursor.fetchone()[0]
    print(f'✅ 验证成功: {count} 个项目记录')
    conn.close()
    
except Exception as e:
    print(f'❌ 修复失败: {e}')
    sys.exit(1)
"

echo ""
echo "🔄 重启后端服务..."
sudo systemctl restart research-backend

echo "⏳ 等待服务启动..."
sleep 5

echo "🏥 检查服务状态..."
sudo systemctl status research-backend --no-pager -l

echo ""
echo "🎯 测试API端点..."
curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:8080/api/research/

echo ""
echo "🏁 紧急修复完成!"
echo "请刷新浏览器测试：http://45.149.156.216:3001"