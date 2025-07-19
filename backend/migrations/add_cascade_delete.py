#!/usr/bin/env python3
"""
数据库迁移脚本：为 communication_logs 表添加级联删除约束
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

def migrate_cascade_delete():
    """执行迁移：添加级联删除约束"""
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'research_dashboard.db')
    
    if not os.path.exists(db_path):
        logger.error("找不到数据库文件")
        return False
    
    # 备份数据库
    backup_path = backup_database(db_path)
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 启用外键约束
        cursor.execute("PRAGMA foreign_keys = ON")
        
        logger.info("开始迁移")
        
        # 1. 创建新的 communication_logs 表，带有级联删除约束
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS communication_logs_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                collaborator_id INTEGER,
                communication_type VARCHAR(50),
                title VARCHAR(200) NOT NULL,
                content TEXT NOT NULL,
                outcomes TEXT,
                action_items TEXT,
                communication_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES research_projects(id) ON DELETE CASCADE,
                FOREIGN KEY (collaborator_id) REFERENCES collaborators(id) ON DELETE SET NULL
            )
        """)
        
        # 2. 复制数据到新表
        cursor.execute("""
            INSERT INTO communication_logs_new 
            SELECT * FROM communication_logs
        """)
        
        # 3. 删除旧表
        cursor.execute("DROP TABLE communication_logs")
        
        # 4. 重命名新表
        cursor.execute("ALTER TABLE communication_logs_new RENAME TO communication_logs")
        
        # 5. 重建索引
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_communication_logs_project_id ON communication_logs(project_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_communication_logs_collaborator_id ON communication_logs(collaborator_id)")
        
        # 提交更改
        conn.commit()
        
        logger.info("迁移成功完成")
        
        # 验证外键约束
        cursor.execute("PRAGMA foreign_key_list(communication_logs)")
        constraints = cursor.fetchall()
        logger.info("当前外键约束:")
        for constraint in constraints:
            logger.debug(f"  - {constraint}")
        
        conn.close()
        return True
        
    except Exception as e:
        logger.error(f"迁移失败: {str(e)}")
        logger.error(f"数据库已备份在: {backup_path}")
        if conn:
            conn.rollback()
            conn.close()
        return False

def verify_migration():
    """验证迁移结果"""
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'research_dashboard.db')
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 检查表结构
        cursor.execute("PRAGMA table_info(communication_logs)")
        columns = cursor.fetchall()
        logger.info("communication_logs 表结构:")
        for col in columns:
            logger.debug(f"  - {col[1]} {col[2]}")
        
        # 检查外键约束
        cursor.execute("PRAGMA foreign_key_list(communication_logs)")
        constraints = cursor.fetchall()
        logger.info("外键约束:")
        for constraint in constraints:
            logger.debug(f"  - {constraint}")
        
        # 检查数据完整性
        cursor.execute("SELECT COUNT(*) FROM communication_logs")
        count = cursor.fetchone()[0]
        logger.info(f"交流日志记录数: {count}")
        
        conn.close()
        return True
        
    except Exception as e:
        logger.error(f"验证失败: {str(e)}")
        return False

if __name__ == "__main__":
    logger.info("=== 数据库迁移：添加级联删除约束 ===")
    
    # 执行迁移
    if migrate_cascade_delete():
        logger.info("正在验证迁移结果")
        verify_migration()
    else:
        logger.error("迁移失败，请检查错误信息")