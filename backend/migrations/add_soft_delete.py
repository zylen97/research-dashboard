#!/usr/bin/env python3
"""
数据库迁移脚本：为合作者表添加软删除功能
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

# 添加项目根目录到 Python 路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def backup_database(db_path):
    """创建数据库备份"""
    backup_path = f"{db_path}.backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    import shutil
    shutil.copy2(db_path, backup_path)
    logger.info(f"数据库已备份到: {backup_path}")
    return backup_path

def add_soft_delete_to_collaborators():
    """为合作者表添加软删除字段"""
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'research_dashboard.db')
    
    if not os.path.exists(db_path):
        logger.error("找不到数据库文件")
        return False
    
    # 备份数据库
    backup_path = backup_database(db_path)
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        logger.info("开始添加软删除功能")
        
        # 检查是否已经有 is_deleted 字段
        cursor.execute("PRAGMA table_info(collaborators)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'is_deleted' not in columns:
            # 添加 is_deleted 字段
            cursor.execute("""
                ALTER TABLE collaborators 
                ADD COLUMN is_deleted BOOLEAN DEFAULT 0
            """)
            logger.info("已添加 is_deleted 字段")
        else:
            logger.warning("is_deleted 字段已存在")
        
        if 'deleted_at' not in columns:
            # 添加 deleted_at 字段
            cursor.execute("""
                ALTER TABLE collaborators 
                ADD COLUMN deleted_at DATETIME
            """)
            logger.info("已添加 deleted_at 字段")
        else:
            logger.warning("deleted_at 字段已存在")
        
        # 创建索引以优化查询性能
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_collaborators_is_deleted 
            ON collaborators(is_deleted)
        """)
        
        # 提交更改
        conn.commit()
        logger.info("软删除功能添加成功")
        
        # 验证更改
        cursor.execute("PRAGMA table_info(collaborators)")
        columns = cursor.fetchall()
        logger.info("更新后的 collaborators 表结构:")
        for col in columns:
            logger.debug(f"  - {col[1]} {col[2]}")
        
        conn.close()
        return True
        
    except Exception as e:
        logger.error(f"添加软删除功能失败: {str(e)}")
        logger.error(f"数据库已备份在: {backup_path}")
        if conn:
            conn.rollback()
            conn.close()
        return False

if __name__ == "__main__":
    logger.info("=== 数据库迁移：添加软删除功能 ===")
    
    # 执行迁移
    add_soft_delete_to_collaborators()