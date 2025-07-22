#!/usr/bin/env python3
"""
专门用于添加is_todo字段的数据库迁移脚本
"""

import sqlite3
import sys
import os
import logging
from datetime import datetime

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def migrate_todo_fields():
    """添加is_todo和todo_marked_at字段到research_projects表"""
    
    # 确定数据库路径
    data_dir = os.path.join(os.path.dirname(__file__), '..', 'data')
    db_paths = [
        os.path.join(data_dir, 'research_dashboard_prod.db'),
        os.path.join(data_dir, 'research_dashboard_dev.db'),
        'research_dashboard.db'
    ]
    
    db_path = None
    for path in db_paths:
        if os.path.exists(path):
            db_path = path
            break
    
    if not db_path:
        logger.error("找不到数据库文件")
        return False
    
    logger.info(f"使用数据库文件: {db_path}")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 1. 检查research_projects表结构
        cursor.execute("PRAGMA table_info(research_projects)")
        columns = cursor.fetchall()
        column_names = [col[1] for col in columns]
        
        # 2. 添加is_todo字段
        if 'is_todo' not in column_names:
            logger.info("为research_projects表添加is_todo字段...")
            cursor.execute("ALTER TABLE research_projects ADD COLUMN is_todo BOOLEAN DEFAULT FALSE")
            logger.info("✓ is_todo字段已添加")
        else:
            logger.info("✓ is_todo字段已存在，跳过")
        
        # 3. 添加todo_marked_at字段
        if 'todo_marked_at' not in column_names:
            logger.info("为research_projects表添加todo_marked_at字段...")
            cursor.execute("ALTER TABLE research_projects ADD COLUMN todo_marked_at DATETIME")
            logger.info("✓ todo_marked_at字段已添加")
        else:
            logger.info("✓ todo_marked_at字段已存在，跳过")
        
        # 4. 为is_todo字段创建索引（提高查询性能）
        try:
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_research_projects_is_todo ON research_projects(is_todo)")
            logger.info("✓ 为is_todo字段创建索引")
        except Exception as e:
            logger.info(f"索引可能已存在: {e}")
        
        # 5. 验证迁移结果
        cursor.execute("PRAGMA table_info(research_projects)")
        columns = cursor.fetchall()
        new_column_names = [col[1] for col in columns]
        
        success = True
        if 'is_todo' in new_column_names:
            logger.info("✓ is_todo字段验证成功")
        else:
            logger.error("✗ is_todo字段验证失败")
            success = False
        
        if 'todo_marked_at' in new_column_names:
            logger.info("✓ todo_marked_at字段验证成功")
        else:
            logger.error("✗ todo_marked_at字段验证失败")
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