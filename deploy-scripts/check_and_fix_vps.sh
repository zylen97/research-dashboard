#!/bin/bash
# 检查和修复VPS上的待办功能问题

echo "========================================="
echo "🔍 检查VPS上的待办功能问题"
echo "========================================="

# SSH连接信息
SSH_HOST="root@45.149.156.216"
SSH_PORT="26700"

# 远程检查和修复命令
ssh -p $SSH_PORT $SSH_HOST << 'EOF'
echo "1. 检查数据库表是否存在..."
cd /root/research-dashboard/backend
python -c "
import sqlite3
conn = sqlite3.connect('data/research_dashboard_prod.db')
cursor = conn.cursor()

# 检查user_project_todos表
cursor.execute(\"SELECT name FROM sqlite_master WHERE type='table' AND name='user_project_todos'\")
if cursor.fetchone():
    print('✅ user_project_todos表存在')
    
    # 检查表结构
    cursor.execute(\"PRAGMA table_info(user_project_todos)\")
    columns = cursor.fetchall()
    print('表结构:')
    for col in columns:
        print(f'  - {col[1]} ({col[2]})')
else:
    print('❌ user_project_todos表不存在')
    print('需要运行迁移脚本...')

conn.close()
"

echo -e "\n2. 运行数据库迁移..."
cd /root/research-dashboard/backend
python migrations/migration.py

echo -e "\n3. 检查后端服务状态..."
systemctl status research-backend | head -n 10

echo -e "\n4. 查看后端错误日志..."
journalctl -u research-backend -n 20 --no-pager | grep -E "(ERROR|WARNING|422)"

echo -e "\n5. 重启后端服务..."
systemctl restart research-backend
sleep 3

echo -e "\n6. 检查服务是否正常运行..."
systemctl is-active research-backend

echo -e "\n7. 测试待办API..."
# 如果有测试token，可以在这里测试API
echo "完成！"
EOF

echo "========================================="
echo "✅ 检查完成"
echo "========================================="