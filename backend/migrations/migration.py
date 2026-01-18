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
import re
from datetime import datetime

# 修复模块路径问题
sys.path.insert(0, os.path.dirname(__file__))

# 导入迁移工具
from migration_utils import setup_migration_logging, find_database_path, backup_database, get_table_columns, table_exists

logger = setup_migration_logging()

# 迁移版本号
MIGRATION_VERSION = "v5.3_add_online_first_tracking"

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

        logger.info("=" * 70)
        logger.info(f"🚀 开始执行迁移: {MIGRATION_VERSION}")
        logger.info('🎯 目标: 创建journal_online_first_tracking表')
        logger.info("=" * 70)

        # ===========================================
        # 🔧 v5.3迁移任务：创建网络首发追踪表
        # 变更：
        # 1. 创建journal_online_first_tracking表
        # ===========================================

        # ============================
        # Step 1: 创建journal_online_first_tracking表
        # ============================
        logger.info("\n📋 Step 1: 创建journal_online_first_tracking表")

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS journal_online_first_tracking (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                journal_id INTEGER NOT NULL,
                tracked_date DATE NOT NULL,
                tracked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                notes TEXT,
                FOREIGN KEY (journal_id) REFERENCES journals(id) ON DELETE CASCADE
            )
        """)
        logger.info("   ✅ 表结构创建完成")

        # ============================
        # Step 2: 创建索引
        # ============================
        logger.info("\n📋 Step 2: 创建索引")

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_online_first_tracking_journal_id
            ON journal_online_first_tracking(journal_id)
        """)
        logger.info("   ✅ journal_id索引创建完成")

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_online_first_tracking_tracked_date
            ON journal_online_first_tracking(tracked_date DESC)
        """)
        logger.info("   ✅ tracked_date索引创建完成")

        # ============================
        # Step 3: 验证表创建
        # ============================
        logger.info("\n📋 Step 3: 验证表创建")

        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='journal_online_first_tracking'
        """)
        if cursor.fetchone():
            logger.info("   ✅ journal_online_first_tracking表已创建")
        else:
            raise Exception("表创建失败")

        # 提交事务
        conn.commit()
        mark_migration_completed(db_path)

        logger.info("\n" + "=" * 70)
        logger.info("🎉 v5.3 网络首发追踪表创建完成！")
        logger.info("✅ journal_online_first_tracking表已创建")
        logger.info("=" * 70)

        conn.close()

        return True

    except Exception as e:
        logger.error(f"迁移执行失败: {e}")
        logger.error(f"错误类型: {type(e).__name__}")
        logger.error(f"详细错误信息: {str(e)}")

        # 尝试回滚事务
        try:
            conn.rollback()
            logger.info("事务已回滚")
        except:
            logger.error("无法回滚事务")

        # 关闭连接
        try:
            conn.close()
        except:
            pass

        logger.info(f"数据库备份位于: {backup_path}")
        logger.error("建议从备份恢复数据库")
        return False

if __name__ == "__main__":
    logger.info(f"开始执行迁移版本: {MIGRATION_VERSION}")
    logger.info(f"执行时间: {datetime.now()}")

    try:
        success = run_migration()

        if success:
            logger.info("✅ 迁移执行成功")
            print("Migration completed successfully")
            sys.exit(0)
        else:
            logger.error("❌ 迁移执行失败")
            print("Migration failed")
            sys.exit(1)

    except KeyboardInterrupt:
        logger.warning("迁移被用户中断")
        print("Migration interrupted by user")
        sys.exit(1)

    except Exception as e:
        logger.error(f"未预期的错误: {e}")
        print(f"Unexpected error: {e}")
        sys.exit(1)
