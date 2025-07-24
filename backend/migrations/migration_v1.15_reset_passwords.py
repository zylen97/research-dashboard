#!/usr/bin/env python3
"""
重置所有用户密码为123
"""

import sqlite3
import sys
import os
from datetime import datetime

# 导入迁移工具
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from migrations.migration_utils import setup_migration_logging, find_database_path, backup_database

logger = setup_migration_logging()

# 迁移版本号
MIGRATION_VERSION = "v1.15_reset_passwords"

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
    # 使用工具函数查找数据库路径
    db_path = find_database_path()
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
        # 🔧 v1.15迁移任务：重置所有用户密码为123
        # ===========================================
        
        logger.info("开始重置所有用户密码...")
        
        # 导入密码加密函数
        sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from app.utils.auth import get_password_hash
        
        # 获取所有用户
        cursor.execute("SELECT id, username FROM users")
        users = cursor.fetchall()
        
        if not users:
            logger.warning("没有找到任何用户")
            return True
        
        # 生成密码123的hash
        password_hash = get_password_hash('123')
        
        # 更新所有用户的密码
        updated_count = 0
        for user_id, username in users:
            cursor.execute('UPDATE users SET password_hash = ? WHERE id = ?', (password_hash, user_id))
            logger.info(f"✅ 用户 {username} 密码已重置为: 123")
            updated_count += 1
        
        # 提交更改
        conn.commit()
        conn.close()
        
        # 标记迁移完成
        mark_migration_completed(db_path)
        
        logger.info(f"迁移 {MIGRATION_VERSION} 执行成功")
        
        logger.info("=" * 60)
        logger.info(f"🎉 密码重置完成！")
        logger.info(f"📊 重置统计:")
        logger.info(f"   - 重置用户数: {updated_count}")
        logger.info(f"✅ 所有用户现在都可以使用密码 123 登录")
        logger.info("=" * 60)
        
        return True
        
    except Exception as e:
        logger.error(f"迁移执行失败: {e}")
        logger.info(f"数据库备份位于: {backup_path}")
        return False

if __name__ == "__main__":
    logger.info(f"迁移版本: {MIGRATION_VERSION}")
    success = run_migration()
    sys.exit(0 if success else 1)