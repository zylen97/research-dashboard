#!/bin/bash

# 🔍 生产环境综合诊断脚本
echo "🔍 USTS Research Dashboard 生产环境诊断"
echo "时间: $(date)"
echo "========================================"

cd /var/www/research-dashboard/backend || exit 1

echo "📊 1. 数据库表检查"
echo "-------------------"
python3 -c "
import sqlite3
import json

conn = sqlite3.connect('data/research_dashboard_prod.db')
cursor = conn.cursor()

# 检查所有表
cursor.execute(\"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name\")
tables = cursor.fetchall()
print('现有数据表:')
for table in tables:
    print(f'  ✓ {table[0]}')

# 重点检查communication_logs表
print('\\n📋 communication_logs表详情:')
cursor.execute(\"SELECT name FROM sqlite_master WHERE type='table' AND name='communication_logs'\")
if cursor.fetchone():
    print('  ✅ 表存在')
    
    # 表结构
    cursor.execute('PRAGMA table_info(communication_logs)')
    columns = cursor.fetchall()
    print('  字段结构:')
    for col in columns:
        print(f'    - {col[1]} ({col[2]})')
    
    # 记录数量
    cursor.execute('SELECT COUNT(*) FROM communication_logs')
    count = cursor.fetchone()[0]
    print(f'  记录数: {count}')
    
    # 如果有记录，显示示例
    if count > 0:
        cursor.execute('SELECT * FROM communication_logs LIMIT 2')
        records = cursor.fetchall()
        print('  示例记录:')
        for r in records:
            print(f'    {r}')
else:
    print('  ❌ 表不存在！')

# 检查项目表中的数据
print('\\n📊 项目数据检查:')
cursor.execute('SELECT id, title FROM research_projects LIMIT 3')
projects = cursor.fetchall()
for proj in projects:
    print(f'\\n项目 {proj[0]}: {proj[1]}')
    cursor.execute('SELECT COUNT(*) FROM communication_logs WHERE project_id = ?', (proj[0],))
    comm_count = cursor.fetchone()[0]
    print(f'  交流记录数: {comm_count}')

conn.close()
"

echo ""
echo "🌐 2. API响应测试"
echo "-----------------"
echo "测试获取项目列表API:"
response=$(curl -s "http://localhost:8080/api/research/")
if [ $? -eq 0 ]; then
    echo "$response" | python3 -c "
import sys
import json
try:
    data = json.load(sys.stdin)
    print(f'返回项目数: {len(data)}')
    if data:
        proj = data[0]
        print(f'\\n第一个项目结构:')
        print(f'  ID: {proj.get(\"id\")}')
        print(f'  标题: {proj.get(\"title\")}')
        print(f'  communication_logs字段存在: {\"communication_logs\" in proj}')
        if \"communication_logs\" in proj:
            logs = proj.get(\"communication_logs\", [])
            print(f'  communication_logs类型: {type(logs)}')
            print(f'  communication_logs数量: {len(logs) if logs else 0}')
            if logs:
                print(f'  第一条记录: {logs[0]}')
        else:
            print('  ❌ API响应中没有communication_logs字段！')
except Exception as e:
    print(f'解析API响应失败: {e}')
    print('原始响应:')
    print(sys.stdin.read()[:500])
"
else
    echo "❌ API调用失败"
fi

echo ""
echo "🔧 3. 后端服务状态"
echo "------------------"
systemctl status research-backend --no-pager | grep -E "(Active|Main PID|Memory)"

echo ""
echo "📦 4. 前端构建信息"
echo "------------------"
cd /var/www/research-dashboard/frontend/build
if [ -f "index.html" ]; then
    echo "构建时间: $(stat -c %y index.html)"
    echo "文件大小: $(du -sh .)"
    
    # 检查前端代码中是否包含communication_logs
    echo ""
    echo "检查前端代码中的communication_logs引用:"
    grep -r "communication_logs" static/js/*.js 2>/dev/null | head -5 | cut -c1-100
else
    echo "❌ 前端构建不存在"
fi

echo ""
echo "🔄 5. 最近的Git提交"
echo "-------------------"
cd /var/www/research-dashboard
git log --oneline -5

echo ""
echo "📝 6. 迁移历史"
echo "--------------"
cd /var/www/research-dashboard/backend
python3 -c "
import sqlite3
conn = sqlite3.connect('data/research_dashboard_prod.db')
cursor = conn.cursor()
cursor.execute(\"SELECT name FROM sqlite_master WHERE type='table' AND name='migration_history'\")
if cursor.fetchone():
    cursor.execute('SELECT version, executed_at FROM migration_history ORDER BY executed_at DESC LIMIT 5')
    migrations = cursor.fetchall()
    print('最近的迁移:')
    for m in migrations:
        print(f'  {m[0]} - {m[1]}')
else:
    print('❌ 没有迁移历史表')
conn.close()
"

echo ""
echo "🏁 诊断完成！"
echo "========================================"