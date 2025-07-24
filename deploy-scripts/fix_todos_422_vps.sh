#!/bin/bash
# 修复VPS上的待办功能422错误 - VPS版本

echo "========================================="
echo "🔧 修复待办功能422错误"
echo "========================================="

# 设置正确的项目路径
PROJECT_DIR="/var/www/research-dashboard"
BACKEND_DIR="$PROJECT_DIR/backend"

# 1. 检查数据库表
echo -e "\n1. 检查数据库表..."
cd $BACKEND_DIR
python3 -c "
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

# 检查user_project_todos表结构
cursor.execute(\"PRAGMA table_info(user_project_todos)\")
columns = cursor.fetchall()
if columns:
    print('\\nuser_project_todos表结构:')
    for col in columns:
        print(f'  - {col[1]} ({col[2]})')

conn.close()
"

# 2. 运行数据库迁移
echo -e "\n2. 运行数据库迁移..."
cd $BACKEND_DIR
if [ -f "migrations/migration.py" ]; then
    python3 migrations/migration.py
else
    echo "❌ 迁移脚本不存在"
fi

# 3. 创建测试用户（如果不存在）
echo -e "\n3. 检查/创建测试用户..."
cd $BACKEND_DIR
python3 -c "
import sqlite3
from datetime import datetime
import sys
sys.path.append('$BACKEND_DIR')
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
    # 显示用户列表
    cursor.execute('SELECT id, username, email FROM users LIMIT 5')
    users = cursor.fetchall()
    for user in users:
        print(f'  - ID:{user[0]}, 用户名:{user[1]}, 邮箱:{user[2]}')

conn.close()
"

# 4. 检查422错误详情
echo -e "\n4. 检查最近的422错误详情..."
journalctl -u research-backend -n 50 | grep -A 5 -B 5 "422"

# 5. 检查路由定义顺序
echo -e "\n5. 检查路由定义顺序..."
grep -n "@router.get" $BACKEND_DIR/app/routes/research.py | head -20

# 6. 检查get_current_user函数
echo -e "\n6. 检查认证函数..."
grep -A 10 "def get_current_user" $BACKEND_DIR/app/utils/auth.py

# 7. 测试API（使用curl）
echo -e "\n7. 测试API端点..."
echo "测试未认证请求..."
curl -s -w "\nHTTP状态码: %{http_code}\n" http://localhost:8080/api/research/todos

echo -e "\n测试根路径..."
curl -s -w "\nHTTP状态码: %{http_code}\n" http://localhost:8080/api/research/

# 8. 重启服务
echo -e "\n8. 重启后端服务..."
systemctl restart research-backend
sleep 2
systemctl status research-backend | head -10

echo -e "\n========================================="
echo "✅ 检查完成！"
echo ""
echo "从日志看，422错误表示请求验证失败。"
echo "可能的原因："
echo "1. 路由 /todos 被错误地解析为 /{project_id}"
echo "2. 认证token格式问题"
echo "3. 依赖注入问题"
echo "========================================="