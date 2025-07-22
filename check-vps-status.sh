#!/bin/bash

# 🔍 检查VPS上的部署状态
echo "🔍 检查VPS部署状态"
echo "时间: $(date)"
echo "================================"

# 1. 检查数据库表
echo "1. 检查数据库表结构："
cd /var/www/research-dashboard/backend || exit 1

python3 -c "
import sqlite3
conn = sqlite3.connect('data/research_dashboard_prod.db')
cursor = conn.cursor()

# 列出所有表
cursor.execute(\"SELECT name FROM sqlite_master WHERE type='table'\")
tables = cursor.fetchall()
print('现有表：')
for table in tables:
    print(f'  - {table[0]}')

# 检查communication_logs表结构
cursor.execute(\"PRAGMA table_info(communication_logs)\")
columns = cursor.fetchall()
if columns:
    print('\\ncommunication_logs表结构：')
    for col in columns:
        print(f'  {col[1]} {col[2]}')
else:
    print('\\n❌ communication_logs表不存在！')

conn.close()
"

echo ""
echo "2. 测试API响应："
# 获取一个项目的详细信息
curl -s "http://localhost:8080/api/research/" | python3 -m json.tool | head -50

echo ""
echo "3. 检查前端构建版本："
cd /var/www/research-dashboard/frontend/build
echo "构建时间："
stat -c %y index.html 2>/dev/null || echo "无法获取构建时间"

echo ""
echo "4. 检查服务状态："
systemctl status research-backend --no-pager | grep Active

echo ""
echo "🏁 检查完成"