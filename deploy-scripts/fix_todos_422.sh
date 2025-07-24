#!/bin/bash
# 修复VPS上的待办功能422错误

echo "========================================="
echo "🔧 修复待办功能422错误"
echo "========================================="

# 1. 检查数据库表
echo -e "\n1. 检查数据库表..."
cd /root/research-dashboard/backend
python -c "
import sqlite3
conn = sqlite3.connect('data/research_dashboard_prod.db')
cursor = conn.cursor()

# 检查表
tables = ['users', 'research_projects', 'user_project_todos']
for table in tables:
    cursor.execute(f\"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'\")
    if cursor.fetchone():
        cursor.execute(f\"SELECT COUNT(*) FROM {table}\")
        count = cursor.fetchone()[0]
        print(f'✅ {table}表存在，记录数: {count}')
    else:
        print(f'❌ {table}表不存在')

conn.close()
"

# 2. 运行数据库迁移
echo -e "\n2. 运行数据库迁移..."
cd /root/research-dashboard/backend
python migrations/migration.py

# 3. 创建测试用户（如果不存在）
echo -e "\n3. 检查/创建测试用户..."
python -c "
import sqlite3
from datetime import datetime
import sys
sys.path.append('/root/research-dashboard/backend')
from app.utils.auth import get_password_hash

conn = sqlite3.connect('data/research_dashboard_prod.db')
cursor = conn.cursor()

# 检查是否有用户
cursor.execute('SELECT COUNT(*) FROM users')
user_count = cursor.fetchone()[0]

if user_count == 0:
    print('创建测试用户...')
    password_hash = get_password_hash('admin123')
    cursor.execute('''
        INSERT INTO users (username, email, password_hash, display_name, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', ('admin', 'admin@example.com', password_hash, '管理员', 1, datetime.utcnow(), datetime.utcnow()))
    conn.commit()
    print('✅ 创建用户: admin / admin123')
else:
    print(f'✅ 已有 {user_count} 个用户')

conn.close()
"

# 4. 测试API
echo -e "\n4. 测试API端点..."
cd /root/research-dashboard/backend

# 启动测试服务器
python -c "
import requests
import json

BASE_URL = 'http://localhost:8000'

print('测试登录...')
try:
    # 登录
    login_data = {'username': 'admin', 'password': 'admin123'}
    resp = requests.post(f'{BASE_URL}/api/auth/login', data=login_data)
    print(f'登录状态: {resp.status_code}')
    
    if resp.status_code == 200:
        token = resp.json()['access_token']
        print('✅ 登录成功')
        
        # 测试待办API
        headers = {'Authorization': f'Bearer {token}'}
        resp = requests.get(f'{BASE_URL}/api/research/todos', headers=headers)
        print(f'待办API状态: {resp.status_code}')
        
        if resp.status_code == 200:
            print('✅ 待办API正常')
        else:
            print(f'❌ 待办API错误: {resp.text}')
    else:
        print(f'❌ 登录失败: {resp.text}')
        
except Exception as e:
    print(f'❌ 测试失败: {e}')
" &

# 等待服务启动
sleep 3

# 5. 检查后端日志
echo -e "\n5. 检查后端日志..."
journalctl -u research-backend -n 30 | grep -E "(422|todos|ERROR|WARNING)"

# 6. 检查路由定义
echo -e "\n6. 检查路由定义顺序..."
grep -n "@router.get" /root/research-dashboard/backend/app/routes/research.py | head -20

# 7. 重启服务
echo -e "\n7. 重启后端服务..."
systemctl restart research-backend
sleep 2
systemctl status research-backend | head -10

echo -e "\n========================================="
echo "✅ 检查完成！"
echo "========================================="