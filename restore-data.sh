#!/bin/bash

echo "📊 数据恢复脚本"
echo "==============="
echo ""
echo "请在VPS上执行以下命令查看备份："
echo ""
echo "ssh root@45.149.156.216"
echo ""
echo "# 1. 查看所有数据库备份"
echo "cd /var/www/research-dashboard/backend"
echo "ls -la *.backup_*"
echo ""
echo "# 2. 选择一个备份文件恢复（替换下面的日期）"
echo "cp research_dashboard.db.backup_YYYYMMDD_HHMMSS research_dashboard.db"
echo ""
echo "# 3. 更新用户密码为新的（保留原有数据）"
echo "python3 -c \"
from app.models.database import SessionLocal, User
from app.utils.auth import get_password_hash

db = SessionLocal()

# 更新现有用户密码
users_to_update = {
    'user1': ('zl', '123'),
    'user2': ('zz', '123'),
    'user3': ('yq', '123'),
    'user4': ('dz', '123')
}

for old_username, (new_username, new_password) in users_to_update.items():
    user = db.query(User).filter(User.username == old_username).first()
    if user:
        user.username = new_username
        user.display_name = new_username.upper()
        user.password_hash = get_password_hash(new_password)
        print(f'Updated {old_username} -> {new_username}')

db.commit()
db.close()
print('✅ 用户更新完成')
\""
echo ""
echo "# 4. 重启服务"
echo "sudo systemctl restart research-backend"