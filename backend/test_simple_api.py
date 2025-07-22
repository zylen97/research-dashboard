#!/usr/bin/env python3
"""
简单API测试 - 直接查询数据库
"""

import sqlite3
import sys
import os

def test_simple_queries():
    """测试最简单的数据库查询"""
    
    # 数据库路径
    db_path = 'data/research_dashboard_prod.db'
    if not os.path.exists(db_path):
        print(f"❌ 数据库文件不存在: {db_path}")
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("📊 数据库基本查询测试：")
        
        # 测试users表
        cursor.execute("SELECT COUNT(*) FROM users")
        users_count = cursor.fetchone()[0]
        print(f"✅ Users: {users_count} 条记录")
        
        # 测试research_projects表
        try:
            cursor.execute("SELECT COUNT(*) FROM research_projects")
            projects_count = cursor.fetchone()[0]
            print(f"✅ Research Projects: {projects_count} 条记录")
            
            # 查看前几条记录的结构
            cursor.execute("SELECT id, title, user_id FROM research_projects LIMIT 3")
            projects = cursor.fetchall()
            for project in projects:
                print(f"   项目: {project}")
                
        except Exception as e:
            print(f"❌ Research Projects查询失败: {e}")
        
        # 测试literature表
        try:
            cursor.execute("SELECT COUNT(*) FROM literature")
            lit_count = cursor.fetchone()[0]
            print(f"✅ Literature: {lit_count} 条记录")
        except Exception as e:
            print(f"❌ Literature查询失败: {e}")
        
        # 测试ideas表
        try:
            cursor.execute("SELECT COUNT(*) FROM ideas")
            ideas_count = cursor.fetchone()[0]
            print(f"✅ Ideas: {ideas_count} 条记录")
        except Exception as e:
            print(f"❌ Ideas查询失败: {e}")
        
        # 测试collaborators表
        try:
            cursor.execute("SELECT COUNT(*) FROM collaborators")
            collab_count = cursor.fetchone()[0]
            print(f"✅ Collaborators: {collab_count} 条记录")
        except Exception as e:
            print(f"❌ Collaborators查询失败: {e}")
        
        conn.close()
        print("\n📋 所有基础查询完成")
        return True
        
    except Exception as e:
        print(f"❌ 数据库连接失败: {e}")
        return False

if __name__ == "__main__":
    success = test_simple_queries()
    sys.exit(0 if success else 1)