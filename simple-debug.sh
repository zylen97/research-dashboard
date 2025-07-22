#!/bin/bash

# 简单调试脚本 - 直接在VPS执行
echo "🔍 VPS 500错误简单调试"
echo "时间: $(date)"
echo "========================================"

cd /var/www/research-dashboard/backend || exit 1

# 1. 检查数据库
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

# 2. 检查服务状态
echo ""
echo "2. 检查后端服务状态："
systemctl is-active research-backend && echo "✅ 服务运行中" || echo "❌ 服务未运行"

# 3. 查看错误日志
echo ""
echo "3. 查看最近错误日志："
journalctl -u research-backend --no-pager -n 10 | tail -5

# 4. 测试Python模块
echo ""
echo "4. 测试Python模块导入："
python3 -c "
import sys
sys.path.insert(0, '.')
try:
    from app.models import ResearchProject, Literature, Idea
    print('✅ 模型导入成功')
except Exception as e:
    print('❌ 模型导入失败:', e)
"

# 5. 测试简单查询
echo ""
echo "5. 测试ORM查询："
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
    
    db.close()
except Exception as e:
    print(f'❌ ORM查询失败: {e}')
"

echo ""
echo "🏁 调试完成: $(date)"