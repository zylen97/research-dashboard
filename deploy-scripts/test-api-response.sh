#!/bin/bash

# 🔍 API响应测试脚本
echo "🔍 API响应深度测试..."
echo "时间: $(date)"
echo ""

cd /var/www/research-dashboard/backend || exit 1

echo "=== 1. 确保服务运行 ==="
systemctl start research-backend
sleep 3
echo "服务状态: $(systemctl is-active research-backend)"

if ! systemctl is-active research-backend >/dev/null; then
    echo "❌ 服务启动失败，查看错误日志:"
    journalctl -u research-backend -n 10 --no-pager
    exit 1
fi

echo ""
echo "=== 2. 端口监听检查 ==="
netstat -tlnp | grep 8080 || echo "❌ 8080端口未监听"

echo ""
echo "=== 3. 无认证API测试 ==="
echo "测试基础API:"
curl -s -w "\nHTTP状态: %{http_code}\n" "http://localhost:8080/api/collaborators/" | head -50

echo ""
echo "=== 4. 带认证的API测试 ==="
echo "首先获取认证token..."

# 获取登录token
LOGIN_RESPONSE=$(curl -s -X POST "http://localhost:8080/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"zl","password":"123"}')

echo "登录响应: $LOGIN_RESPONSE"

# 提取token
TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('access_token', ''))
except:
    print('')
")

if [ -n "$TOKEN" ]; then
    echo "✅ 获取到token: ${TOKEN:0:20}..."
    
    echo ""
    echo "使用token测试collaborators API:"
    curl -s -w "\nHTTP状态: %{http_code}\n" \
      -H "Authorization: Bearer $TOKEN" \
      "http://localhost:8080/api/collaborators/" | head -100
    
    echo ""
    echo "测试带参数的API调用:"
    curl -s -w "\nHTTP状态: %{http_code}\n" \
      -H "Authorization: Bearer $TOKEN" \
      "http://localhost:8080/api/collaborators/?skip=0&limit=100&include_deleted=false"
    
else
    echo "❌ 无法获取认证token，可能登录失败"
fi

echo ""
echo "=== 5. 直接数据库查询对比 ==="
echo "数据库中的collaborators (前10个):"
sqlite3 data/research_dashboard_prod.db "
SELECT 
    id, 
    name, 
    email,
    level,
    CASE WHEN deleted_at IS NULL THEN 'active' ELSE 'deleted' END as status,
    created_at
FROM collaborators 
ORDER BY id 
LIMIT 10;
"

echo ""
echo "=== 6. 检查API路由中的查询逻辑 ==="
echo "手动执行Python代码测试序列化:"
python3 -c "
import sys
sys.path.insert(0, '.')

try:
    from app.models.database import SessionLocal, Collaborator
    from app.models.schemas import Collaborator as CollaboratorSchema
    
    db = SessionLocal()
    
    # 模拟API查询逻辑
    print('=== 模拟API查询 ===')
    query = db.query(Collaborator)
    
    # 默认过滤条件 (只显示未删除的)
    collaborators = query.filter(Collaborator.deleted_at.is_(None)).all()
    print(f'查询到 {len(collaborators)} 个未删除的collaborators')
    
    if collaborators:
        print('前5个collaborators:')
        for i, collab in enumerate(collaborators[:5]):
            print(f'  {i+1}. ID:{collab.id}, Name:{collab.name}, Level:{collab.level}, Deleted:{collab.deleted_at}')
        
        print('\\n=== 测试序列化 ===')
        try:
            # 测试第一个collaborator的序列化
            first_collab = collaborators[0]
            schema_obj = CollaboratorSchema.from_orm(first_collab)
            print(f'✅ 序列化成功: {schema_obj.name}')
            
            # 测试全部序列化
            serialized = [CollaboratorSchema.from_orm(c) for c in collaborators]
            print(f'✅ 全部序列化成功，共 {len(serialized)} 条记录')
            
        except Exception as e:
            print(f'❌ 序列化失败: {e}')
            import traceback
            traceback.print_exc()
    else:
        print('❌ 没有查询到任何collaborators')
    
    db.close()
    
except Exception as e:
    print(f'❌ Python测试失败: {e}')
    import traceback
    traceback.print_exc()
"

echo ""
echo "=== 7. 检查前端请求 ==="
echo "检查nginx日志中的API请求:"
tail -20 /var/log/nginx/access.log | grep "collaborators" | tail -5

echo ""
echo "=== 测试完成 ==="
echo "🔧 如果API返回空数组但数据库有数据，可能原因:"
echo "1. 认证token无效或过期"
echo "2. API查询条件有误"
echo "3. 序列化过程出错"
echo "4. 前端请求参数错误"