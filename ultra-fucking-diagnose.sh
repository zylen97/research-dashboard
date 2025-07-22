#!/bin/bash

# 🔥🔥🔥 ULTRA FUCKING DIAGNOSE - 彻底找出为什么交流进度不显示
echo "🔥🔥🔥 ULTRA FUCKING DIAGNOSE"
echo "时间: $(date)"
echo "========================================"

cd /var/www/research-dashboard || exit 1

echo "🖕 1. 检查你妈的前端构建时间"
echo "------------------------------"
echo "前端构建时间:"
ls -la frontend/build/index.html
echo ""
echo "后端代码更新时间:"
ls -la backend/app/models/schemas.py
echo ""
echo "Git最新提交:"
git log --oneline -1

echo ""
echo "🖕 2. 检查前端到底用的什么狗屁代码"
echo "-----------------------------------"
echo "检查build里的projectColumns代码:"
cd frontend/build/static/js
for file in *.js; do
    if grep -q "communication_logs" "$file"; then
        echo "在 $file 中找到communication_logs处理:"
        # 查找交流进度相关代码
        grep -o ".communication_logs.*暂无交流记录" "$file" | head -5
        echo ""
    fi
done

echo ""
echo "🖕 3. 测试你妈的API到底返回了什么"
echo "----------------------------------"
cd /var/www/research-dashboard
# 登录
token=$(curl -s -X POST "http://localhost:8080/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "zl", "password": "123"}' | \
  python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])")

echo "获取项目列表原始响应:"
response=$(curl -s -H "Authorization: Bearer $token" "http://localhost:8080/api/research/")
echo "$response" | python3 -m json.tool | head -100

echo ""
echo "🖕 4. 检查数据库里到底有没有数据"
echo "---------------------------------"
python3 -c "
import sqlite3
conn = sqlite3.connect('backend/data/research_dashboard_prod.db')
cursor = conn.cursor()

print('communication_logs表数据:')
cursor.execute('SELECT * FROM communication_logs ORDER BY id DESC LIMIT 5')
for row in cursor.fetchall():
    print(row)

print('\\n检查关联:')
cursor.execute('''
    SELECT rp.id, rp.title, COUNT(cl.id) as log_count
    FROM research_projects rp
    LEFT JOIN communication_logs cl ON rp.id = cl.project_id
    GROUP BY rp.id, rp.title
    LIMIT 5
''')
for row in cursor.fetchall():
    print(f'项目{row[0]}: {row[1][:30]}... - {row[2]}条记录')

conn.close()
"

echo ""
echo "🖕 5. 检查后端ORM到底加载了什么"
echo "--------------------------------"
python3 -c "
import sys
sys.path.append('backend')
from app.models.database import engine, ResearchProject, CommunicationLog
from sqlalchemy.orm import sessionmaker, joinedload

Session = sessionmaker(bind=engine)
db = Session()

# 直接查询
projects = db.query(ResearchProject).options(
    joinedload(ResearchProject.communication_logs)
).limit(3).all()

for p in projects:
    print(f'\\n项目: {p.title[:30]}...')
    print(f'  has communication_logs attr: {hasattr(p, \"communication_logs\")}')
    if hasattr(p, 'communication_logs'):
        logs = p.communication_logs
        print(f'  logs type: {type(logs)}')
        print(f'  logs count: {len(logs) if logs else 0}')
        if logs:
            print(f'  first log: {logs[0].title}')
    else:
        print('  ❌ 没有communication_logs属性!')

db.close()
"

echo ""
echo "🖕 6. 直接测试后端API路由"
echo "-------------------------"
echo "测试项目详情API:"
curl -s -H "Authorization: Bearer $token" \
  "http://localhost:8080/api/research/1" | python3 -m json.tool

echo ""
echo "🖕 7. 检查Nginx是否缓存了旧文件"
echo "--------------------------------"
echo "Nginx配置:"
grep -E "(location|root|try_files|expires)" /etc/nginx/sites-available/research-dashboard

echo ""
echo "🖕 8. 对比源码和构建文件"
echo "------------------------"
echo "源码中的处理逻辑:"
grep -A10 -B5 "communication_logs" /var/www/research-dashboard/frontend/src/components/research-dashboard/table-columns/projectColumns.tsx | head -30

echo ""
echo "💀 9. 终极结论"
echo "--------------"
echo "可能的问题:"
echo "1. 前端构建是旧的 - 需要npm run build"
echo "2. 后端没重启 - systemctl restart research-backend"
echo "3. Nginx缓存 - 需要清理缓存"
echo "4. 浏览器缓存 - Ctrl+F5强制刷新"
echo "5. API没有返回communication_logs字段"

echo ""
echo "🏁 诊断完成！把这个输出全部贴给我！"
echo "========================================"