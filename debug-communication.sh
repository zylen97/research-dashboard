#!/bin/bash

# 🔍 诊断交流进度不显示问题
echo "🔍 诊断交流进度问题"
echo "时间: $(date)"

cd /var/www/research-dashboard/backend || exit 1

echo "1. 检查communication_logs表数据："
python3 -c "
import sqlite3
conn = sqlite3.connect('data/research_dashboard_prod.db')
cursor = conn.cursor()

# 检查communication_logs表
try:
    cursor.execute('SELECT COUNT(*) FROM communication_logs')
    count = cursor.fetchone()[0]
    print(f'✅ communication_logs表: {count} 条记录')
    
    if count > 0:
        cursor.execute('SELECT id, project_id, communication_type, created_at FROM communication_logs LIMIT 5')
        records = cursor.fetchall()
        print('最近5条记录:')
        for record in records:
            print(f'  ID: {record[0]}, 项目ID: {record[1]}, 类型: {record[2]}, 时间: {record[3]}')
    else:
        print('⚠️  communication_logs表为空')
        
except Exception as e:
    print(f'❌ 查询communication_logs失败: {e}')

# 检查research_projects表
try:
    cursor.execute('SELECT id, title FROM research_projects LIMIT 5')
    projects = cursor.fetchall()
    print(f'\\n✅ research_projects表中的项目:')
    for project in projects:
        print(f'  项目ID: {project[0]}, 标题: {project[1]}')
        
        # 检查每个项目的交流记录
        cursor.execute('SELECT COUNT(*) FROM communication_logs WHERE project_id = ?', (project[0],))
        comm_count = cursor.fetchone()[0]
        print(f'    -> 交流记录数: {comm_count}')
        
except Exception as e:
    print(f'❌ 查询research_projects失败: {e}')

conn.close()
"

echo ""
echo "2. 测试研究项目API："
curl -s "http://localhost:8080/api/research/" | python3 -m json.tool | head -20

echo ""
echo "🏁 诊断完成"