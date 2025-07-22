#!/bin/bash

# 🔍 检查交流记录数据详细诊断
echo "🔍 深度检查交流记录数据"
echo "时间: $(date)"

cd /var/www/research-dashboard/backend || exit 1

echo "1. 检查communication_logs表是否有数据："
python3 -c "
import sqlite3
conn = sqlite3.connect('data/research_dashboard_prod.db')
cursor = conn.cursor()

# 检查communication_logs表结构
print('📋 communication_logs表结构:')
cursor.execute('PRAGMA table_info(communication_logs)')
columns = cursor.fetchall()
for col in columns:
    print(f'  - {col[1]} ({col[2]})')

# 检查数据
cursor.execute('SELECT COUNT(*) FROM communication_logs')
count = cursor.fetchone()[0]
print(f'\\n📊 communication_logs记录总数: {count}')

if count == 0:
    print('⚠️  communication_logs表为空，需要创建测试数据')
    
    # 获取前几个项目ID
    cursor.execute('SELECT id, title FROM research_projects LIMIT 3')
    projects = cursor.fetchall()
    
    print('\\n🔧 为前3个项目创建交流记录...')
    for project_id, title in projects:
        # 为每个项目创建2-3条交流记录
        cursor.execute('''
            INSERT INTO communication_logs 
            (project_id, communication_type, participant_name, notes, created_at) 
            VALUES (?, ?, ?, ?, datetime('now'))
        ''', (project_id, 'meeting', '张三', f'与{title}项目团队讨论进展'))
        
        cursor.execute('''
            INSERT INTO communication_logs 
            (project_id, communication_type, participant_name, notes, created_at) 
            VALUES (?, ?, ?, ?, datetime('now', '-1 day'))
        ''', (project_id, 'email', '李四', f'{title}项目邮件沟通'))
        
        print(f'  ✅ 为项目 {project_id} ({title}) 创建了交流记录')
    
    conn.commit()
    
    # 重新检查数据
    cursor.execute('SELECT COUNT(*) FROM communication_logs')
    new_count = cursor.fetchone()[0]
    print(f'\\n🎉 成功创建 {new_count} 条交流记录')

else:
    print('\\n📝 现有交流记录:')
    cursor.execute('''
        SELECT cl.id, cl.project_id, rp.title, cl.communication_type, 
               cl.participant_name, cl.created_at 
        FROM communication_logs cl
        LEFT JOIN research_projects rp ON cl.project_id = rp.id
        LIMIT 10
    ''')
    records = cursor.fetchall()
    for record in records:
        print(f'  ID: {record[0]}, 项目: {record[1]} ({record[2]}), 类型: {record[3]}, 参与者: {record[4]}, 时间: {record[5]}')

conn.close()
"

echo ""
echo "2. 测试API返回数据："
echo "🌐 调用研究项目API..."
curl -s "http://localhost:8080/api/research/" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'API返回 {len(data)} 个项目')

for i, project in enumerate(data[:3]):  # 检查前3个项目
    project_id = project.get('id')
    title = project.get('title', 'Unknown')
    comm_logs = project.get('communication_logs', [])
    print(f'项目 {project_id} ({title}): {len(comm_logs)} 条交流记录')
    
    for j, log in enumerate(comm_logs[:2]):  # 显示前2条记录
        log_type = log.get('communication_type', 'Unknown')
        participant = log.get('participant_name', 'Unknown')
        notes = log.get('notes', 'No notes')[:30]
        print(f'  - {log_type} by {participant}: {notes}...')
"

echo ""
echo "3. 重启后端服务确保数据加载："
sudo systemctl restart research-backend
sleep 3
sudo systemctl status research-backend --no-pager -l | tail -5

echo ""
echo "🏁 诊断完成！"