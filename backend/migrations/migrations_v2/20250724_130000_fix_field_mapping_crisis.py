#!/usr/bin/env python3
"""
Migration: Fix Critical Field Mapping Crisis
Created: 2025-07-24T13:00:00
Version: 20250724_130000

🚨 紧急修复：数据库字段映射危机
问题：created_at/updated_at字段存储了'senior'/'junior'字符串，导致Pydantic解析失败

这个迁移将：
1. 备份受影响的数据
2. 修复所有错误的时间字段
3. 清理垃圾数据
4. 验证数据完整性
"""

import sqlite3
from datetime import datetime
import sys
import os

# 添加父目录到路径
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from migration_system_v2 import BaseMigration


class Migration20250724130000(BaseMigration):
    """
    修复关键字段映射危机
    """
    
    def __init__(self):
        super().__init__(version="20250724_130000", name="Fix Critical Field Mapping Crisis")
        # 这是第一个新格式的迁移，不依赖其他迁移
        self.dependencies = []
    
    def up(self, cursor: sqlite3.Cursor) -> None:
        """向前迁移 - 修复字段映射错误"""
        
        # 步骤1：创建紧急备份表
        cursor.execute("DROP TABLE IF EXISTS collaborators_crisis_backup")
        cursor.execute("""
            CREATE TABLE collaborators_crisis_backup AS 
            SELECT * FROM collaborators
        """)
        
        cursor.execute("DROP TABLE IF EXISTS research_projects_crisis_backup")
        cursor.execute("""
            CREATE TABLE research_projects_crisis_backup AS 
            SELECT * FROM research_projects
        """)
        
        cursor.execute("DROP TABLE IF EXISTS ideas_crisis_backup")
        cursor.execute("""
            CREATE TABLE ideas_crisis_backup AS 
            SELECT * FROM ideas
        """)
        
        # 步骤2：修复collaborators表的字段映射错误
        
        # 修复created_at字段中的错误数据
        cursor.execute("""
            UPDATE collaborators 
            SET created_at = datetime('now')
            WHERE created_at IN ('senior', 'junior') 
               OR created_at NOT LIKE '____-__-__%' 
               OR created_at IS NULL
        """)
        
        # 修复updated_at字段中的错误数据
        cursor.execute("""
            UPDATE collaborators 
            SET updated_at = datetime('now')
            WHERE updated_at IN ('senior', 'junior') 
               OR updated_at NOT LIKE '____-__-__%' 
               OR updated_at IS NULL
        """)
        
        # 修复deleted_at字段（清理垃圾数据）
        cursor.execute("""
            UPDATE collaborators 
            SET deleted_at = NULL
            WHERE deleted_at IN ('senior', 'junior', '')
        """)
        
        # 确保is_deleted字段与deleted_at一致
        cursor.execute("""
            UPDATE collaborators 
            SET is_deleted = 0
            WHERE deleted_at IS NULL AND is_deleted = 1
        """)
        
        cursor.execute("""
            UPDATE collaborators 
            SET is_deleted = 1, deleted_at = datetime('now')
            WHERE is_deleted = 1 AND deleted_at IS NULL
        """)
        
        # 步骤3：修复research_projects表
        cursor.execute("""
            UPDATE research_projects 
            SET created_at = datetime('now')
            WHERE created_at NOT LIKE '____-__-__%' 
               OR created_at IS NULL
        """)
        
        cursor.execute("""
            UPDATE research_projects 
            SET updated_at = datetime('now')
            WHERE updated_at NOT LIKE '____-__-__%' 
               OR updated_at IS NULL
        """)
        
        # 修复todo_marked_at字段
        cursor.execute("""
            UPDATE research_projects 
            SET todo_marked_at = datetime('now')
            WHERE is_todo = 1 AND (todo_marked_at IS NULL OR todo_marked_at NOT LIKE '____-__-__%')
        """)
        
        cursor.execute("""
            UPDATE research_projects 
            SET todo_marked_at = NULL
            WHERE is_todo = 0 AND todo_marked_at IS NOT NULL
        """)
        
        # 步骤4：修复ideas表
        cursor.execute("""
            UPDATE ideas 
            SET created_at = datetime('now')
            WHERE created_at NOT LIKE '____-__-__%' 
               OR created_at IS NULL
        """)
        
        cursor.execute("""
            UPDATE ideas 
            SET updated_at = datetime('now')
            WHERE updated_at NOT LIKE '____-__-__%' 
               OR updated_at IS NULL
        """)
        
        # 步骤5：数据完整性验证
        
        # 验证collaborators表修复结果
        cursor.execute("""
            SELECT COUNT(*) FROM collaborators
            WHERE created_at NOT LIKE '____-__-__%' 
               OR updated_at NOT LIKE '____-__-__%'
        """)
        remaining_errors = cursor.fetchone()[0]
        
        if remaining_errors > 0:
            raise Exception(f"修复后仍有 {remaining_errors} 条记录存在时间格式错误")
        
        # 验证数据数量没有丢失
        cursor.execute("SELECT COUNT(*) FROM collaborators")
        final_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM collaborators_crisis_backup")
        original_count = cursor.fetchone()[0]
        
        if final_count != original_count:
            raise Exception(f"数据丢失：原有 {original_count} 条，修复后 {final_count} 条")
        
        # 步骤6：优化数据库
        cursor.execute("ANALYZE")
        
        print(f"✅ 字段映射危机修复完成")
        print(f"✅ 修复了 collaborators 表的时间字段错误")
        print(f"✅ 修复了 research_projects 表的时间字段错误")
        print(f"✅ 修复了 ideas 表的时间字段错误")
        print(f"✅ 保持了数据完整性：{final_count} 条 collaborators 记录")
        print(f"✅ API 应该恢复正常工作")
    
    def down(self, cursor: sqlite3.Cursor) -> None:
        """向后迁移 - 恢复到修复前的状态"""
        
        # 从备份表恢复数据
        cursor.execute("DROP TABLE IF EXISTS collaborators")
        cursor.execute("""
            CREATE TABLE collaborators AS 
            SELECT * FROM collaborators_crisis_backup
        """)
        
        cursor.execute("DROP TABLE IF EXISTS research_projects")
        cursor.execute("""
            CREATE TABLE research_projects AS 
            SELECT * FROM research_projects_crisis_backup
        """)
        
        cursor.execute("DROP TABLE IF EXISTS ideas")
        cursor.execute("""
            CREATE TABLE ideas AS 
            SELECT * FROM ideas_crisis_backup
        """)
        
        # 删除备份表
        cursor.execute("DROP TABLE IF EXISTS collaborators_crisis_backup")
        cursor.execute("DROP TABLE IF EXISTS research_projects_crisis_backup")
        cursor.execute("DROP TABLE IF EXISTS ideas_crisis_backup")
        
        print("⚠️ 已回滚到字段映射错误状态")
        print("⚠️ API将重新出现Pydantic解析错误")


# 导出迁移类
migration = Migration20250724130000()