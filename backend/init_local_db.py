#!/usr/bin/env python3
"""
本地数据库初始化脚本
用于创建新的用户（zl, zz, yq, dz）
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.utils.db_init import init_database, init_users
from app.models.database import SessionLocal, User

def clean_and_init():
    """清理并重新初始化数据库"""
    db = SessionLocal()
    
    try:
        # 删除所有现有用户
        print("清理现有用户...")
        db.query(User).delete()
        db.commit()
        
        # 初始化新用户
        print("初始化新用户...")
        init_users()
        
        # 验证用户创建
        users = db.query(User).all()
        print(f"\n✅ 成功创建 {len(users)} 个用户:")
        for user in users:
            print(f"   - {user.username} ({user.display_name})")
        
    finally:
        db.close()

if __name__ == "__main__":
    print("🔄 本地数据库初始化开始...")
    init_database()  # 确保表结构存在
    clean_and_init()  # 清理并创建新用户
    print("\n✅ 初始化完成！")
    print("📝 新的登录信息：")
    print("   用户名: zl, zz, yq, dz")
    print("   密码: 123")