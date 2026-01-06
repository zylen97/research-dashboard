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
MIGRATION_VERSION = "v4.8_prompts_table"

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
        logger.info('🎯 目标: 创建提示词管理表，支持科研提示词分类管理')
        logger.info("=" * 70)

        # ===========================================
        # 🔧 v4.8迁移任务：提示词管理表
        # 变更：
        # 1. 创建 prompts 表
        # 2. 创建 prompt_tags 关联表
        # 3. 创建索引优化查询
        # ===========================================

        # ============================
        # Step 1: 创建 prompts 表
        # ============================
        logger.info("\n📋 Step 1: 创建 prompts 表")

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS prompts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title VARCHAR(200) NOT NULL,
                content TEXT NOT NULL,
                category VARCHAR(50) NOT NULL,
                description TEXT,
                variables TEXT,
                usage_count INTEGER DEFAULT 0,
                is_favorite BOOLEAN DEFAULT 0,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        logger.info("   ✅ prompts 表创建成功")

        # ============================
        # Step 2: 创建 prompt_tags 关联表
        # ============================
        logger.info("\n📋 Step 2: 创建 prompt_tags 关联表")

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS prompt_tags (
                prompt_id INTEGER NOT NULL,
                tag_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (prompt_id, tag_id),
                FOREIGN KEY(prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
                FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
            )
        """)
        logger.info("   ✅ prompt_tags 关联表创建成功")

        # ============================
        # Step 3: 创建索引优化查询
        # ============================
        logger.info("\n📋 Step 3: 创建索引")

        cursor.execute("CREATE INDEX IF NOT EXISTS idx_prompts_category ON prompts(category)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_prompts_favorite ON prompts(is_favorite)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_prompts_usage ON prompts(usage_count DESC)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_prompts_active ON prompts(is_active)")
        logger.info("   ✅ 索引创建成功")

        # ============================
        # Step 4: 导入初始提示词数据（可选）
        # ============================
        logger.info("\n📋 Step 4: 准备导入初始数据")
        logger.info("   ℹ️  提示词数据将在后续通过 init_prompts.py 导入")

        # 提交事务
        conn.commit()
        mark_migration_completed(db_path)

        logger.info("\n" + "=" * 70)
        logger.info("🎉 v4.8 提示词表迁移完成！")
        logger.info(f"✅ 创建 prompts 表")
        logger.info(f"✅ 创建 prompt_tags 关联表")
        logger.info(f"✅ 创建查询索引")
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
