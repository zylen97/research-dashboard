#!/usr/bin/env python3
"""
专门用于添加is_todo字段的数据库迁移脚本
"""

import sqlite3
import sys
from migration_utils import (
    setup_migration_logging, find_database_path, 
    safe_add_column, safe_create_index, get_table_columns
)

logger = setup_migration_logging()

def migrate_todo_fields():
    """添加is_todo和todo_marked_at字段到research_projects表"""
    
    # 查找数据库文件
    db_path = find_database_path()
    if not db_path:
        logger.error("找不到数据库文件")
        return False
    
    logger.info(f"使用数据库文件: {db_path}")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 添加字段
        safe_add_column(cursor, 'research_projects', 'is_todo', 'BOOLEAN DEFAULT FALSE', logger)
        safe_add_column(cursor, 'research_projects', 'todo_marked_at', 'DATETIME', logger)
        
        # 创建索引
        safe_create_index(cursor, 'idx_research_projects_is_todo', 'research_projects', 'is_todo', logger)
        
        # 验证迁移结果
        columns = get_table_columns(cursor, 'research_projects')
        
        success = True
        for field in ['is_todo', 'todo_marked_at']:
            if field in columns:
                logger.info(f"✓ {field}字段验证成功")
            else:
                logger.error(f"✗ {field}字段验证失败")
                success = False
        
        # 6. 统计现有项目数量
        cursor.execute("SELECT COUNT(*) FROM research_projects")
        total_projects = cursor.fetchone()[0]
        logger.info(f"现有项目总数: {total_projects}")
        
        # 7. 统计待办项目数量（应该都是0，因为默认值是FALSE）
        cursor.execute("SELECT COUNT(*) FROM research_projects WHERE is_todo = 1")
        todo_projects = cursor.fetchone()[0]
        logger.info(f"待办项目数量: {todo_projects}")
        
        conn.commit()
        logger.info("✓ 迁移完成！")
        
        return success
        
    except Exception as e:
        logger.error(f"迁移失败: {str(e)}")
        if 'conn' in locals():
            conn.rollback()
        return False
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    logger.info("开始执行is_todo字段迁移...")
    success = migrate_todo_fields()
    if success:
        logger.info("🎉 迁移成功完成！")
        sys.exit(0)
    else:
        logger.error("💥 迁移失败！")
        sys.exit(1)