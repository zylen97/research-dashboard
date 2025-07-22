#!/usr/bin/env python3
"""
紧急修复脚本：修复user_id关联问题
"""

import sqlite3
import sys
import os

def fix_user_relations():
    """修复所有表的user_id关联"""
    
    # 检查所有可能的数据库路径
    db_paths = [
        'backend/data/research_dashboard_prod.db',
        'backend/data/research_dashboard_dev.db',
        'data/research_dashboard_prod.db',
        'data/research_dashboard_dev.db',
    ]
    
    db_path = None
    for path in db_paths:
        if os.path.exists(path):
            db_path = path
            break
    
    if not db_path:
        print("❌ 找不到数据库文件")
        return False
    
    print(f"使用数据库: {db_path}")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 获取第一个用户的ID
        cursor.execute("SELECT id FROM users ORDER BY id LIMIT 1")
        user = cursor.fetchone()
        if not user:
            print("❌ 没有找到用户")
            return False
            
        default_user_id = user[0]
        print(f"默认用户ID: {default_user_id}")
        
        # 修复research_projects表
        cursor.execute("UPDATE research_projects SET user_id = ? WHERE user_id IS NULL", (default_user_id,))
        affected = cursor.rowcount
        if affected > 0:
            print(f"✅ 修复了 {affected} 个research_projects记录")
        
        # 修复literature表
        cursor.execute("UPDATE literature SET user_id = ? WHERE user_id IS NULL", (default_user_id,))
        affected = cursor.rowcount
        if affected > 0:
            print(f"✅ 修复了 {affected} 个literature记录")
        
        # 修复ideas表
        cursor.execute("UPDATE ideas SET user_id = ? WHERE user_id IS NULL", (default_user_id,))
        affected = cursor.rowcount
        if affected > 0:
            print(f"✅ 修复了 {affected} 个ideas记录")
        
        # 检查是否有无效的user_id
        print("\n检查无效的user_id...")
        
        # 获取所有有效的用户ID
        cursor.execute("SELECT id FROM users")
        valid_user_ids = [row[0] for row in cursor.fetchall()]
        print(f"有效用户ID: {valid_user_ids}")
        
        # 修复无效的user_id
        for table in ['research_projects', 'literature', 'ideas']:
            cursor.execute(f"SELECT COUNT(*) FROM {table} WHERE user_id NOT IN ({','.join('?' * len(valid_user_ids))})", valid_user_ids)
            invalid_count = cursor.fetchone()[0]
            if invalid_count > 0:
                cursor.execute(f"UPDATE {table} SET user_id = ? WHERE user_id NOT IN ({','.join('?' * len(valid_user_ids))})", 
                             [default_user_id] + valid_user_ids)
                print(f"✅ 修复了 {table} 表中 {invalid_count} 个无效的user_id")
        
        conn.commit()
        
        # 显示统计
        print("\n📊 数据统计：")
        for table in ['users', 'research_projects', 'literature', 'ideas', 'collaborators']:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            print(f"  {table}: {count} 条记录")
        
        conn.close()
        print("\n✅ 修复完成！")
        return True
        
    except Exception as e:
        print(f"❌ 修复失败: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = fix_user_relations()
    sys.exit(0 if success else 1)