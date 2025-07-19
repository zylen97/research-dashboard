#!/usr/bin/env python3
"""
为合作者表添加软删除功能的迁移脚本
"""
import sqlite3
import os
import logging
from datetime import datetime

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def add_soft_delete_to_collaborators(db_path):
    """为合作者表添加软删除字段"""
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 检查字段是否已存在
        cursor.execute("PRAGMA table_info(collaborators)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'is_deleted' not in columns:
            logger.info("添加 is_deleted 字段到 collaborators 表")
            cursor.execute("""
                ALTER TABLE collaborators 
                ADD COLUMN is_deleted BOOLEAN DEFAULT 0
            """)
            
            logger.info("添加 deleted_at 字段到 collaborators 表")
            cursor.execute("""
                ALTER TABLE collaborators 
                ADD COLUMN deleted_at DATETIME
            """)
            
            conn.commit()
            logger.info("软删除字段添加成功")
        else:
            logger.warning("is_deleted 字段已存在")
        
        conn.close()
        return True
        
    except Exception as e:
        logger.error(f"添加软删除字段失败: {str(e)}")
        if conn:
            conn.rollback()
            conn.close()
        return False

def main():
    db_path = "./research_dashboard.db"
    
    if not os.path.exists(db_path):
        logger.error(f"数据库文件不存在: {db_path}")
        return
    
    logger.info("开始添加软删除功能")
    success = add_soft_delete_to_collaborators(db_path)
    
    if success:
        logger.info("软删除功能添加成功")

if __name__ == "__main__":
    main()