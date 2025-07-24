#!/bin/bash

# 🚨 超级系统诊断脚本 - 查出所有500错误的根本原因
# 这个脚本会详细检查每一个可能的问题

echo "🚨🚨🚨 超级系统诊断开始 🚨🚨🚨"
echo "时间: $(date)"
echo "============================================"

# 进入后端目录
cd /var/www/research-dashboard/backend || exit 1

# 1. 基础服务检查
echo ""
echo "=== 1. 基础服务状态 ==="
echo "后端服务状态:"
systemctl status research-backend --no-pager -l | head -15

echo ""
echo "端口监听:"
netstat -tlnp | grep -E "(8080|3001)"

echo ""
echo "Python进程:"
ps aux | grep uvicorn | grep -v grep

# 2. 实时错误日志捕获
echo ""
echo "=== 2. 最新的详细错误日志 ==="
echo "最近50行错误日志:"
journalctl -u research-backend -n 50 --no-pager | grep -E "(ERROR|Exception|Traceback|ValueError|Invalid)" | tail -20

echo ""
echo "Pydantic相关错误:"
journalctl -u research-backend -n 100 --no-pager | grep -E "(pydantic|isoformat|get_attribute_error)" | tail -10

# 3. 数据库深度检查
echo ""
echo "=== 3. 数据库深度分析 ==="

echo "数据库文件状态:"
ls -la data/research_dashboard_prod.db

echo ""
echo "所有表和行数:"
sqlite3 data/research_dashboard_prod.db "SELECT name, (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=main.name) as count FROM sqlite_master WHERE type='table';"

echo ""
echo "Collaborators表详细检查:"
echo "表结构:"
sqlite3 data/research_dashboard_prod.db "PRAGMA table_info(collaborators);"

echo ""
echo "检查deleted_at字段的所有值(包括错误值):"
sqlite3 data/research_dashboard_prod.db "SELECT id, name, level, deleted_at, created_at FROM collaborators LIMIT 10;"

echo ""
echo "检查deleted_at字段中的非日期值:"
sqlite3 data/research_dashboard_prod.db "SELECT id, name, deleted_at FROM collaborators WHERE deleted_at IS NOT NULL AND deleted_at != '' AND (deleted_at NOT LIKE '____-__-__ __:__:__' AND deleted_at NOT LIKE '____-__-__T__:__:__');" 

echo ""
echo "研究项目表检查:"
echo "ResearchProject表结构:"
sqlite3 data/research_dashboard_prod.db "PRAGMA table_info(research_projects);"

echo ""
echo "项目-合作者关联表:"
sqlite3 data/research_dashboard_prod.db "SELECT * FROM project_collaborators LIMIT 10;"

# 4. 具体API端点测试
echo ""
echo "=== 4. 具体API端点详细测试 ==="

echo "测试各个API端点并捕获响应:"

echo ""
echo "4.1 测试 /api/research/ (这个在报错):"
curl -v -H "Accept: application/json" http://localhost:8080/api/research/ 2>&1 | head -20

echo ""
echo "4.2 测试 /api/collaborators/:"
curl -v -H "Accept: application/json" http://localhost:8080/api/collaborators/ 2>&1 | head -20

echo ""
echo "4.3 测试单个研究项目:"
curl -v -H "Accept: application/json" http://localhost:8080/api/research/1 2>&1 | head -20

# 5. Python模型验证
echo ""
echo "=== 5. Python模型和Schema验证 ==="

python3 -c "
import sys
sys.path.insert(0, '.')
print('=== 5.1 基础模块导入测试 ===')
try:
    from app.models.database import Collaborator, ResearchProject
    from app.models.schemas import Collaborator as CollabSchema, ResearchProject as ProjectSchema
    print('✅ 所有模型导入成功')
except Exception as e:
    print(f'❌ 模型导入失败: {e}')
    import traceback
    traceback.print_exc()

print('\\n=== 5.2 数据库连接和查询测试 ===')
try:
    from app.models.database import get_db, SessionLocal
    db = SessionLocal()
    
    # 测试查询collaborators
    collab_count = db.query(Collaborator).count()
    print(f'✅ Collaborators查询成功: {collab_count} 条记录')
    
    # 测试查询单个collaborator
    first_collab = db.query(Collaborator).first()
    if first_collab:
        print(f'✅ 单个Collaborator查询成功: {first_collab.name}')
        print(f'   Level: {first_collab.level}')
        print(f'   Deleted_at: {first_collab.deleted_at}')
        print(f'   Created_at: {first_collab.created_at}')
    
    db.close()
except Exception as e:
    print(f'❌ 数据库查询失败: {e}')
    import traceback
    traceback.print_exc()

print('\\n=== 5.3 序列化测试 ===')
try:
    from app.models.database import get_db, SessionLocal, Collaborator, ResearchProject
    from app.models.schemas import Collaborator as CollabSchema, ResearchProject as ProjectSchema
    db = SessionLocal()
    
    # 测试collaborator序列化
    print('测试Collaborator序列化...')
    collaborators = db.query(Collaborator).limit(3).all()
    for i, collab in enumerate(collaborators):
        try:
            schema_obj = CollabSchema.from_orm(collab)
            print(f'✅ Collaborator {i+1} 序列化成功')
        except Exception as e:
            print(f'❌ Collaborator {i+1} 序列化失败: {e}')
            print(f'   ID: {collab.id}, Name: {collab.name}')
            print(f'   Level: {repr(collab.level)}, Deleted_at: {repr(collab.deleted_at)}')
    
    # 测试research project序列化 (这个是问题所在)
    print('\\n测试ResearchProject序列化...')
    projects = db.query(ResearchProject).limit(3).all()
    for i, project in enumerate(projects):
        try:
            # 先检查关联的collaborators
            print(f'\\n项目 {i+1}: {project.title}')
            print(f'关联的collaborators数量: {len(project.collaborators)}')
            for j, collab in enumerate(project.collaborators):
                print(f'  - Collaborator {j+1}: {collab.name}, Level: {repr(collab.level)}, Deleted_at: {repr(collab.deleted_at)}')
            
            # 尝试序列化
            schema_obj = ProjectSchema.from_orm(project)
            print(f'✅ ResearchProject {i+1} 序列化成功')
        except Exception as e:
            print(f'❌ ResearchProject {i+1} 序列化失败: {e}')
            import traceback
            traceback.print_exc()
    
    db.close()
except Exception as e:
    print(f'❌ 序列化测试失败: {e}')
    import traceback
    traceback.print_exc()

print('\\n=== 5.4 字段类型检查 ===')
try:
    from app.models.database import SessionLocal
    from sqlalchemy import inspect
    
    db = SessionLocal()
    inspector = inspect(db.bind)
    
    print('Collaborators表的实际字段类型:')
    for column in inspector.get_columns('collaborators'):
        print(f'  {column[\"name\"]}: {column[\"type\"]} (nullable: {column[\"nullable\"]})')
    
    print('\\nResearch_projects表的实际字段类型:')
    for column in inspector.get_columns('research_projects'):
        print(f'  {column[\"name\"]}: {column[\"type\"]} (nullable: {column[\"nullable\"]})')
    
    db.close()
except Exception as e:
    print(f'❌ 字段类型检查失败: {e}')
"

# 6. 手动API调用捕获错误
echo ""
echo "=== 6. 手动API调用错误捕获 ==="

echo "启动临时Python服务器来捕获详细错误:"
timeout 10 python3 -c "
import sys
sys.path.insert(0, '.')
from fastapi import FastAPI
from app.routes.research import router as research_router
from app.models.database import SessionLocal, get_db

app = FastAPI()
app.include_router(research_router, prefix='/api/research')

print('\\n=== 手动测试研究项目路由 ===')
try:
    from app.routes.research import get_projects
    db = SessionLocal()
    
    # 手动调用API函数
    result = get_projects(skip=0, limit=10, db=db)
    print(f'✅ get_projects调用成功，返回 {len(result)} 个项目')
    
    db.close()
except Exception as e:
    print(f'❌ get_projects调用失败: {e}')
    import traceback
    traceback.print_exc()
" 2>&1

# 7. 检查具体错误模式
echo ""
echo "=== 7. 错误模式分析 ==="

echo "检查是否有字段映射错误:"
sqlite3 data/research_dashboard_prod.db "SELECT 'Checking for level in deleted_at:', COUNT(*) FROM collaborators WHERE deleted_at = 'senior' OR deleted_at = 'junior';"

echo "检查是否有其他字段的值跑到了错误位置:"
sqlite3 data/research_dashboard_prod.db "SELECT 'Checking created_at:', id, created_at FROM collaborators WHERE created_at NOT LIKE '____-__-__ __:__:__' AND created_at NOT LIKE '____-__-__T__:__:__' LIMIT 5;"

echo "检查所有非标准的时间字段值:"
sqlite3 data/research_dashboard_prod.db "SELECT 'Non-standard timestamps:', id, name, created_at, updated_at, deleted_at FROM collaborators WHERE (created_at NOT LIKE '____-__-__%' OR updated_at NOT LIKE '____-__-__%' OR (deleted_at IS NOT NULL AND deleted_at != '' AND deleted_at NOT LIKE '____-__-__%')) LIMIT 10;"

echo ""
echo "=========================================="
echo "🎯 超级诊断完成!"
echo ""
echo "🔧 如果发现问题，按优先级处理:"
echo "1. 数据库字段映射错误 (最高优先级)"
echo "2. Pydantic序列化错误"
echo "3. API路由问题"
echo "4. 服务配置问题"