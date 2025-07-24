#!/bin/bash
# 重置所有用户密码为123

echo "========================================="
echo "🔑 重置所有用户密码为 123"
echo "========================================="

cd /var/www/research-dashboard/backend

python3 -c "
import sqlite3
import sys
sys.path.append('/var/www/research-dashboard/backend')
from app.utils.auth import get_password_hash

conn = sqlite3.connect('data/research_dashboard_prod.db')
cursor = conn.cursor()

# 获取所有用户
cursor.execute('SELECT id, username FROM users')
users = cursor.fetchall()

# 为所有用户设置密码为123
password_hash = get_password_hash('123')

for user_id, username in users:
    cursor.execute('UPDATE users SET password_hash = ? WHERE id = ?', (password_hash, user_id))
    print(f'✅ 用户 {username} 密码已重置为: 123')

conn.commit()
conn.close()

print('')
print('✅ 所有用户密码已重置为 123')
print('现在可以使用任意用户名 + 密码 123 登录')
"

# 重启后端服务
echo -e "\n重启后端服务..."
systemctl restart research-backend

echo -e "\n========================================="
echo "✅ 完成！现在可以用密码 123 登录了"
echo "========================================="