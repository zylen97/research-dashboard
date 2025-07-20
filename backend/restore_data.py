#!/usr/bin/env python3
"""
恢复数据库并更新用户
"""
import os
import shutil
import sqlite3
from datetime import datetime

# 查找最大的备份文件
backup_files = [f for f in os.listdir('.') if f.startswith('research_dashboard.db.backup_')]
if not backup_files:
    print("❌ 没有找到备份文件")
    exit(1)

# 按文件大小排序，选择最大的
backup_files_with_size = [(f, os.path.getsize(f)) for f in backup_files]
backup_files_with_size.sort(key=lambda x: x[1], reverse=True)
largest_backup = backup_files_with_size[0][0]
backup_size = backup_files_with_size[0][1] / 1024  # KB

print(f"📂 找到 {len(backup_files)} 个备份文件")
print(f"✅ 选择最大的备份: {largest_backup} ({backup_size:.1f} KB)")

# 备份当前数据库
if os.path.exists('research_dashboard.db'):
    current_backup = f"research_dashboard.db.before_restore_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    shutil.copy2('research_dashboard.db', current_backup)
    print(f"📋 当前数据库已备份到: {current_backup}")

# 恢复备份
shutil.copy2(largest_backup, 'research_dashboard.db')
print(f"✅ 已恢复备份: {largest_backup}")

# 检查数据
conn = sqlite3.connect('research_dashboard.db')
cursor = conn.cursor()

# 查询数据统计
cursor.execute("SELECT COUNT(*) FROM users")
user_count = cursor.fetchone()[0]

cursor.execute("SELECT COUNT(*) FROM research_projects")
project_count = cursor.fetchone()[0]

cursor.execute("SELECT COUNT(*) FROM collaborators")
collaborator_count = cursor.fetchone()[0]

print(f"\n📊 数据库内容:")
print(f"   - 用户数量: {user_count}")
print(f"   - 研究项目: {project_count}")
print(f"   - 合作者: {collaborator_count}")

conn.close()

# 更新用户信息
print("\n🔄 更新用户信息...")
from app.models.database import SessionLocal, User
from app.utils.auth import get_password_hash

db = SessionLocal()

updates = [
    ("user1", "zl", "ZL", "123"),
    ("user2", "zz", "ZZ", "123"),
    ("user3", "yq", "YQ", "123"),
    ("user4", "dz", "DZ", "123")
]

for old_name, new_name, display, password in updates:
    user = db.query(User).filter(User.username == old_name).first()
    if user:
        user.username = new_name
        user.display_name = display
        user.password_hash = get_password_hash(password)
        print(f"   ✅ Updated {old_name} -> {new_name}")

db.commit()
db.close()

print("\n✅ 数据恢复完成！")
print("📝 新的登录信息：")
print("   用户名: zl, zz, yq, dz")
print("   密码: 123")