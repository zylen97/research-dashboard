#!/bin/bash

# 🔧 修复交流进度显示问题
echo "🔧 修复交流进度显示问题"
echo "时间: $(date)"

cd /var/www/research-dashboard/backend || exit 1

echo "1. 检查交流记录与项目关联："
python3 -c "
import sqlite3
conn = sqlite3.connect('data/research_dashboard_prod.db')
cursor = conn.cursor()

print('📊 检查项目和交流记录关联:')
cursor.execute('''
    SELECT rp.id, rp.title, COUNT(cl.id) as comm_count
    FROM research_projects rp
    LEFT JOIN communication_logs cl ON rp.id = cl.project_id
    GROUP BY rp.id, rp.title
    ORDER BY rp.id
    LIMIT 10
''')
results = cursor.fetchall()

for project_id, title, comm_count in results:
    print(f'项目 {project_id}: \"{title}\" -> {comm_count} 条交流记录')

print('\\n📝 查看实际交流记录内容:')
cursor.execute('''
    SELECT cl.id, cl.project_id, cl.communication_type, cl.title, cl.content,
           c.name as collaborator_name, cl.created_at
    FROM communication_logs cl
    LEFT JOIN collaborators c ON cl.collaborator_id = c.id
    ORDER BY cl.project_id, cl.created_at DESC
    LIMIT 10
''')
comm_records = cursor.fetchall()

for record in comm_records:
    comm_id, proj_id, comm_type, title, content, collab_name, created_at = record
    content_preview = content[:50] + '...' if len(content) > 50 else content
    print(f'  记录 {comm_id}: 项目{proj_id} | {comm_type} | {title} | 参与者:{collab_name} | {content_preview}')

conn.close()
"

echo ""
echo "2. 测试API返回结构："
python3 -c "
import json, urllib.request

try:
    with urllib.request.urlopen('http://localhost:8080/api/research/') as response:
        data = json.load(response)
    
    print(f'🌐 API返回 {len(data)} 个项目')
    
    # 检查前3个项目的交流记录
    for i in range(min(3, len(data))):
        project = data[i]
        project_id = project.get('id')
        title = project.get('title', 'Unknown')[:30]
        comm_logs = project.get('communication_logs', [])
        
        print(f'\\n项目 {project_id} ({title}):')
        print(f'  - communication_logs字段存在: {\"communication_logs\" in project}')
        print(f'  - 交流记录数量: {len(comm_logs)}')
        
        if comm_logs:
            for j, log in enumerate(comm_logs[:2]):  # 显示前2条
                log_type = log.get('communication_type', 'Unknown')
                log_title = log.get('title', 'No title')
                log_content = log.get('content', 'No content')[:30]
                print(f'    记录{j+1}: {log_type} | {log_title} | {log_content}...')
        else:
            print('    ⚠️  无交流记录数据')

except Exception as e:
    print(f'❌ API调用失败: {e}')
"

echo ""
echo "3. 检查后端服务状态："
sudo systemctl status research-backend --no-pager -l | grep -E "(Active|Main PID|Status)" | head -3

echo ""
echo "4. 重启后端确保数据正确加载："
sudo systemctl restart research-backend
sleep 5
echo "✅ 后端服务已重启"

echo ""
echo "🏁 修复检查完成！"
echo "请刷新浏览器测试交流进度显示"