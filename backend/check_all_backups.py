#!/usr/bin/env python3
"""
检查所有备份文件的内容
"""
import os
import sqlite3
from datetime import datetime

# 查找所有备份文件
backup_files = [f for f in os.listdir('.') if f.startswith('research_dashboard.db.backup_')]
backup_files.sort()

print(f"📂 找到 {len(backup_files)} 个备份文件\n")

for backup_file in backup_files:
    try:
        conn = sqlite3.connect(backup_file)
        cursor = conn.cursor()
        
        # 查询数据统计
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM research_projects")
        project_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM collaborators")
        collaborator_count = cursor.fetchone()[0]
        
        file_size = os.path.getsize(backup_file) / 1024  # KB
        
        print(f"📄 {backup_file} ({file_size:.1f} KB)")
        print(f"   用户: {user_count}, 项目: {project_count}, 合作者: {collaborator_count}")
        
        if project_count > 0 or collaborator_count > 0:
            print("   ⭐ 这个备份包含数据！")
            
            # 显示一些项目信息
            cursor.execute("SELECT title FROM research_projects LIMIT 3")
            projects = cursor.fetchall()
            if projects:
                print("   项目示例:")
                for p in projects:
                    print(f"     - {p[0]}")
        
        print()
        conn.close()
        
    except Exception as e:
        print(f"❌ 无法读取 {backup_file}: {e}\n")