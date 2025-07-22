#!/bin/bash

# 🔧 深度调试ORM关联关系
echo "🔧 深度调试ORM关联关系"
echo "时间: $(date)"

cd /var/www/research-dashboard/backend || exit 1

echo "1. 直接测试SQLAlchemy ORM关联："
python3 -c "
import sys
sys.path.insert(0, '.')

from app.models.database import engine
from sqlalchemy.orm import sessionmaker, joinedload
from app.models import ResearchProject, CommunicationLog

try:
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    print('📊 测试ORM关联查询:')
    
    # 测试基础查询
    project_count = db.query(ResearchProject).count()
    comm_count = db.query(CommunicationLog).count()
    print(f'项目总数: {project_count}, 交流记录总数: {comm_count}')
    
    # 测试joinedload
    print('\\n🔗 测试joinedload查询:')
    projects_with_logs = db.query(ResearchProject).options(
        joinedload(ResearchProject.communication_logs)
    ).limit(3).all()
    
    for project in projects_with_logs:
        print(f'\\n项目 {project.id}: {project.title[:30]}...')
        print(f'  - communication_logs属性: {hasattr(project, \"communication_logs\")}')
        
        if hasattr(project, 'communication_logs'):
            logs = project.communication_logs
            print(f'  - 交流记录数量: {len(logs)}')
            
            for i, log in enumerate(logs[:2]):  # 显示前2条
                print(f'    记录{i+1}: {log.communication_type} | {log.title} | {log.content[:30]}...')
        else:
            print('  - ❌ 没有communication_logs属性')
    
    db.close()
    
except Exception as e:
    print(f'❌ ORM测试失败: {e}')
    import traceback
    traceback.print_exc()
"

echo ""
echo "2. 检查数据库外键关联："
python3 -c "
import sqlite3
conn = sqlite3.connect('data/research_dashboard_prod.db')
cursor = conn.cursor()

print('🔗 检查外键关联:')

# 检查communication_logs的project_id是否正确
cursor.execute('''
    SELECT cl.project_id, COUNT(*) as count, rp.title
    FROM communication_logs cl
    LEFT JOIN research_projects rp ON cl.project_id = rp.id
    GROUP BY cl.project_id, rp.title
    ORDER BY cl.project_id
''')

results = cursor.fetchall()
print('项目ID -> 交流记录数量 -> 项目标题:')
for project_id, count, title in results:
    if title:
        print(f'  项目 {project_id}: {count} 条记录 -> {title[:40]}...')
    else:
        print(f'  项目 {project_id}: {count} 条记录 -> ❌ 找不到对应项目')

# 检查孤立的交流记录
cursor.execute('''
    SELECT cl.id, cl.project_id, cl.title
    FROM communication_logs cl
    LEFT JOIN research_projects rp ON cl.project_id = rp.id
    WHERE rp.id IS NULL
''')
orphaned = cursor.fetchall()

if orphaned:
    print(f'\\n⚠️  发现 {len(orphaned)} 条孤立的交流记录:')
    for log_id, project_id, title in orphaned:
        print(f'  记录 {log_id}: project_id={project_id} -> {title}')
else:
    print('\\n✅ 所有交流记录都有对应的项目')

conn.close()
"

echo ""
echo "3. 测试当前API代码是否生效："
python3 -c "
import sys
sys.path.insert(0, '.')

# 检查当前代码版本
try:
    from app.routes.research import get_research_projects
    from app.models import ResearchProject
    from app.models.database import engine
    from sqlalchemy.orm import sessionmaker, joinedload
    
    print('✅ 能够导入最新的research路由')
    
    # 模拟API调用
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    print('\\n🌐 模拟API调用过程:')
    
    # 执行与API相同的查询
    query = db.query(ResearchProject).options(
        joinedload(ResearchProject.communication_logs)
    )
    projects = query.limit(3).all()
    
    print(f'查询返回 {len(projects)} 个项目:')
    
    for project in projects:
        # 检查对象属性
        attrs = dir(project)
        has_comm_logs = 'communication_logs' in attrs
        print(f'\\n项目 {project.id}:')
        print(f'  - 属性中有communication_logs: {has_comm_logs}')
        
        if has_comm_logs:
            comm_logs = project.communication_logs
            print(f'  - 交流记录类型: {type(comm_logs)}')
            print(f'  - 交流记录数量: {len(comm_logs) if comm_logs else 0}')
            
            if comm_logs:
                first_log = comm_logs[0]
                print(f'  - 首条记录: {first_log.communication_type} | {first_log.title}')
        
    db.close()
    
except Exception as e:
    print(f'❌ 模拟API调用失败: {e}')
    import traceback
    traceback.print_exc()
"

echo ""
echo "4. 检查后端服务是否使用最新代码："
echo "🔍 检查服务进程和代码更新时间:"
ps aux | grep "python.*main.py" | head -2
echo ""
echo "最近的代码更新："
git log --oneline -3

echo ""
echo "🏁 深度调试完成！"