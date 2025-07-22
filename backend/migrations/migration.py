#!/usr/bin/env python3
"""
通用数据库迁移脚本
- 每次数据库修改时，更新此文件内容
- 执行完成后自动标记为已完成
- 下次部署时如无新迁移则跳过
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

# 迁移版本号 - 每次修改此文件时递增
MIGRATION_VERSION = "v1.0_update_dz_to_dj"

def backup_database(db_path):
    """创建数据库备份"""
    backup_path = f"{db_path}.backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    import shutil
    shutil.copy2(db_path, backup_path)
    logger.info(f"数据库已备份到: {backup_path}")
    return backup_path

def check_if_migration_completed(db_path):
    """检查迁移是否已完成"""
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 创建迁移记录表（如果不存在）
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS migration_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                version TEXT UNIQUE,
                executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # 检查当前版本是否已执行
        cursor.execute("SELECT version FROM migration_history WHERE version = ?", (MIGRATION_VERSION,))
        result = cursor.fetchone()
        
        conn.close()
        return result is not None
    except Exception as e:
        logger.error(f"检查迁移状态失败: {e}")
        return False

def mark_migration_completed(db_path):
    """标记迁移为已完成"""
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("INSERT OR IGNORE INTO migration_history (version) VALUES (?)", (MIGRATION_VERSION,))
        conn.commit()
        conn.close()
        logger.info(f"迁移版本 {MIGRATION_VERSION} 已标记为完成")
    except Exception as e:
        logger.error(f"标记迁移完成失败: {e}")

def run_migration():
    """执行当前迁移任务"""
    # 检查两个可能的数据库路径
    db_paths = [
        os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'research_dashboard_dev.db'),
        os.path.join(os.path.dirname(os.path.dirname(__file__)), 'research_dashboard.db')
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
    
    # 检查是否已执行过
    if check_if_migration_completed(db_path):
        logger.info(f"迁移 {MIGRATION_VERSION} 已执行过，跳过")
        return True
    
    # 备份数据库
    backup_path = backup_database(db_path)
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        logger.info(f"开始执行迁移: {MIGRATION_VERSION}")
        
        # ===========================================
        # 🔧 当前迁移任务：将用户名dz更新为dj
        # ===========================================
        
        # 检查是否存在dz用户
        cursor.execute("SELECT * FROM users WHERE username = 'dz'")
        dz_user = cursor.fetchone()
        
        if dz_user:
            logger.info("找到dz用户，开始更新...")
            
            # 更新用户信息
            cursor.execute("""
                UPDATE users 
                SET username = 'dj', 
                    email = 'dj@example.com', 
                    display_name = 'DJ'
                WHERE username = 'dz'
            """)
            
            logger.info("用户信息已更新: dz -> dj")
        else:
            logger.info("未找到dz用户，可能已经更新过或不存在")
        
        # ===========================================
        # 🔧 在这里添加其他迁移任务...
        # ===========================================
        
        # 提交更改
        conn.commit()
        
        # 验证更改
        cursor.execute("SELECT username, email, display_name FROM users WHERE username = 'dj'")
        dj_user = cursor.fetchone()
        if dj_user:
            logger.info(f"验证成功: {dj_user}")
        
        # 标记迁移完成
        mark_migration_completed(db_path)
        
        conn.close()
        logger.info(f"迁移 {MIGRATION_VERSION} 执行成功")
        return True
        
    except Exception as e:
        logger.error(f"迁移执行失败: {str(e)}")
        logger.error(f"数据库已备份在: {backup_path}")
        if conn:
            conn.rollback()
            conn.close()
        return False

if __name__ == "__main__":
    logger.info("=== 数据库迁移工具 ===")
    logger.info(f"迁移版本: {MIGRATION_VERSION}")
    
    success = run_migration()
    
    if success:
        logger.info("迁移完成")
    else:
        logger.error("迁移失败")
        sys.exit(1)