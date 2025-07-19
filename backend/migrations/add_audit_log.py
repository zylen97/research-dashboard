#!/usr/bin/env python3
"""
数据库迁移脚本：添加审计日志表
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

def create_audit_log_table():
    """创建审计日志表"""
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'research_dashboard.db')
    
    if not os.path.exists(db_path):
        logger.error("找不到数据库文件")
        return False
    
    # 备份数据库
    backup_path = backup_database(db_path)
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        logger.info("开始创建审计日志表")
        
        # 创建审计日志表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                table_name VARCHAR(50) NOT NULL,
                record_id INTEGER NOT NULL,
                action VARCHAR(20) NOT NULL,
                user_id VARCHAR(100),
                ip_address VARCHAR(45),
                old_values TEXT,
                new_values TEXT,
                changes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # 创建索引
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record 
            ON audit_logs(table_name, record_id)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_audit_logs_action 
            ON audit_logs(action)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at 
            ON audit_logs(created_at)
        """)
        
        # 提交更改
        conn.commit()
        logger.info("审计日志表创建成功")
        
        # 验证表结构
        cursor.execute("PRAGMA table_info(audit_logs)")
        columns = cursor.fetchall()
        logger.info("audit_logs 表结构:")
        for col in columns:
            logger.debug(f"  - {col[1]} {col[2]}")
        
        conn.close()
        return True
        
    except Exception as e:
        logger.error(f"创建审计日志表失败: {str(e)}")
        logger.error(f"数据库已备份在: {backup_path}")
        if conn:
            conn.rollback()
            conn.close()
        return False

if __name__ == "__main__":
    logger.info("=== 数据库迁移：添加审计日志表 ===")
    
    # 执行迁移
    create_audit_log_table()