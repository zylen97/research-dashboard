#!/usr/bin/env python3
"""
检查Ideas表是否存在于数据库中
"""

import sqlite3
import os

# 查找数据库文件
db_paths = [
    'data/research_dashboard_prod.db',
    'data/research_dashboard_dev.db',
    'research_dashboard.db'
]

for db_path in db_paths:
    if os.path.exists(db_path):
        print(f"\n检查数据库: {db_path}")
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            # 获取所有表
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
            tables = cursor.fetchall()
            print(f"数据库中的表: {[t[0] for t in tables]}")
            
            # 检查ideas表
            if 'ideas' in [t[0] for t in tables]:
                print("✅ ideas表存在")
                # 获取表结构
                cursor.execute("PRAGMA table_info(ideas);")
                columns = cursor.fetchall()
                print("ideas表结构:")
                for col in columns:
                    print(f"  - {col[1]} ({col[2]})")
            else:
                print("❌ ideas表不存在！")
            
            conn.close()
        except Exception as e:
            print(f"错误: {e}")
    else:
        print(f"数据库文件不存在: {db_path}")