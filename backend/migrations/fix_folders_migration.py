#!/usr/bin/env python3
"""
紧急修复：添加literature_folders表和folder_id字段
"""

import os
import sys
import sqlite3
from datetime import datetime

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def run_migration():
    """执行文件夹功能的数据库迁移"""
    
    # 数据库路径
    db_path = "data/research_dashboard_prod.db"
    
    if not os.path.exists(db_path):
        print(f"❌ 数据库文件不存在: {db_path}")
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("🔍 检查数据库状态...")
        
        # 1. 检查literature_folders表是否存在
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='literature_folders'
        """)
        folders_table_exists = cursor.fetchone() is not None
        
        if not folders_table_exists:
            print("📦 创建 literature_folders 表...")
            cursor.execute("""
                CREATE TABLE literature_folders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    parent_id INTEGER,
                    user_id INTEGER NOT NULL,
                    group_name VARCHAR(50),
                    is_root BOOLEAN DEFAULT 0,
                    sort_order INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (parent_id) REFERENCES literature_folders(id),
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            """)
            print("✅ literature_folders 表创建成功")
        else:
            print("✅ literature_folders 表已存在")
        
        # 2. 检查literature表是否有folder_id字段
        cursor.execute("PRAGMA table_info(literature)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'folder_id' not in columns:
            print("📦 为 literature 表添加 folder_id 字段...")
            cursor.execute("""
                ALTER TABLE literature 
                ADD COLUMN folder_id INTEGER REFERENCES literature_folders(id)
            """)
            print("✅ folder_id 字段添加成功")
        else:
            print("✅ folder_id 字段已存在")
        
        # 3. 为每个用户创建默认根文件夹
        cursor.execute("SELECT id, username FROM users")
        users = cursor.fetchall()
        
        for user_id, username in users:
            # 检查是否已有根文件夹
            cursor.execute("""
                SELECT id FROM literature_folders 
                WHERE user_id = ? AND is_root = 1
            """, (user_id,))
            
            if not cursor.fetchone():
                print(f"📁 为用户 {username} 创建根文件夹...")
                cursor.execute("""
                    INSERT INTO literature_folders 
                    (name, description, user_id, group_name, is_root, sort_order)
                    VALUES (?, ?, ?, ?, 1, 0)
                """, (f"{username}的文献", "默认根文件夹", user_id, username))
                
                root_folder_id = cursor.lastrowid
                
                # 创建默认子文件夹
                default_folders = [
                    ("待阅读", "新导入的文献，等待阅读", 1),
                    ("已阅读", "已经阅读完成的文献", 2),
                    ("重要文献", "标记为重要的文献", 3),
                    ("参考文献", "用作参考的文献", 4)
                ]
                
                for folder_name, folder_desc, sort_order in default_folders:
                    cursor.execute("""
                        INSERT INTO literature_folders 
                        (name, description, parent_id, user_id, group_name, is_root, sort_order)
                        VALUES (?, ?, ?, ?, ?, 0, ?)
                    """, (folder_name, folder_desc, root_folder_id, user_id, username, sort_order))
                
                print(f"✅ 用户 {username} 的文件夹结构创建完成")
        
        # 4. 提交更改
        conn.commit()
        print("\n🎉 数据库迁移成功完成！")
        
        # 5. 显示统计信息
        cursor.execute("SELECT COUNT(*) FROM literature_folders")
        folder_count = cursor.fetchone()[0]
        print(f"📊 共创建 {folder_count} 个文件夹")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"\n❌ 迁移失败: {str(e)}")
        if conn:
            conn.rollback()
            conn.close()
        return False

if __name__ == "__main__":
    print("=== Literature Folders 数据库迁移 ===")
    print(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("")
    
    success = run_migration()
    
    if success:
        print("\n✅ 迁移完成！请重启服务：")
        print("   systemctl restart research-backend")
    else:
        print("\n❌ 迁移失败，请检查错误信息")