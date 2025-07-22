#!/bin/bash

# VPS 500错误调试脚本
# 在VPS上运行此脚本

echo "🔍 VPS 500错误深度调试"
echo "时间: $(date)"
echo "========================================"

cd /var/www/research-dashboard/backend || exit 1

echo "1. 检查数据库基础状态："
if [ -f "data/research_dashboard_prod.db" ]; then
    echo "✅ 生产数据库存在"
    python3 -c "
import sqlite3
conn = sqlite3.connect('data/research_dashboard_prod.db')
cursor = conn.cursor()

tables = ['users', 'research_projects', 'literature', 'ideas', 'collaborators']
for table in tables:
    try:
        cursor.execute(f'SELECT COUNT(*) FROM {table}')
        count = cursor.fetchone()[0]
        print(f'✅ {table}: {count} 条记录')
    except Exception as e:
        print(f'❌ {table}: {e}')

conn.close()
"
else
    echo "❌ 生产数据库不存在"
fi

echo ""
echo "2. 检查后端服务状态："
systemctl is-active research-backend && echo "✅ 服务运行中" || echo "❌ 服务未运行"

echo ""
echo "3. 检查最近错误日志："
journalctl -u research-backend --no-pager -n 20 | grep -E "(ERROR|500|Exception|Traceback)" | tail -10

echo ""
echo "4. 测试Python模块导入："
python3 -c "
import sys
sys.path.insert(0, '.')

print('Python路径:', sys.path[:3])

try:
    from app.models import ResearchProject, Literature, Idea
    print('✅ 模型导入成功')
except Exception as e:
    print('❌ 模型导入失败:', e)
    import traceback
    traceback.print_exc()

try:
    from app.models import get_db
    print('✅ get_db导入成功')
except Exception as e:
    print('❌ get_db导入失败:', e)
"

echo ""
echo "5. 测试简单ORM查询："
python3 -c "
import sys
sys.path.insert(0, '.')

try:
    from app.models.database import engine
    from sqlalchemy.orm import sessionmaker
    from app.models import ResearchProject
    
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    count = db.query(ResearchProject).count()
    print(f'✅ ORM查询成功: {count} 个项目')
    
    # 尝试获取一个项目
    project = db.query(ResearchProject).first()
    if project:
        print(f'✅ 获取项目成功: {project.title if hasattr(project, \"title\") else \"无标题\"}')
    else:
        print('ℹ️  没有项目数据')
    
    db.close()
    
except Exception as e:
    print('❌ ORM查询失败:', e)
    import traceback
    traceback.print_exc()
"

echo ""
echo "6. 测试API端点（内部调用）："
python3 -c "
import sys
sys.path.insert(0, '.')

try:
    from app.routes.research import get_research_projects
    from app.models import get_db
    from sqlalchemy.orm import sessionmaker
    from app.models.database import engine
    
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    print('✅ 尝试调用research API函数...')
    
    # 模拟调用
    import asyncio
    
    async def test_api():
        try:
            result = await get_research_projects(skip=0, limit=10, status_filter=None, db=db)
            print(f'✅ API调用成功: 返回{len(result)}条数据')
            return True
        except Exception as e:
            print(f'❌ API调用失败: {e}')
            import traceback
            traceback.print_exc()
            return False
    
    success = asyncio.run(test_api())
    db.close()
    
except Exception as e:
    print('❌ API测试环境准备失败:', e)
    import traceback
    traceback.print_exc()
"

echo ""
echo "========================================"
echo "🏁 调试完成: $(date)"