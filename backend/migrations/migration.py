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
MIGRATION_VERSION = "v3.9_idea_multiple_responsible_persons"

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
        logger.info('🎯 目标: Idea 支持多选负责人')
        logger.info("=" * 70)

        # ===========================================
        # 🔧 v3.9迁移任务：Idea 多选负责人
        # 变更：
        # 1. 创建 idea_responsible_persons 中间表
        # 2. 迁移现有 responsible_person_id 数据到新表
        # 3. responsible_person_id 改为可选
        # ===========================================

        # ============================
        # Step 1: 检查 ideas 表是否存在
        # ============================
        logger.info("\n📋 Step 1: 检查 ideas 表")

        if not table_exists(cursor, 'ideas'):
            logger.error("   ❌ ideas表不存在！无法继续迁移。")
            conn.rollback()
            return False
        else:
            logger.info("   ✅ ideas表存在")

        # ============================
        # Step 2: 创建 idea_responsible_persons 中间表
        # ============================
        logger.info("\n📋 Step 2: 创建 idea_responsible_persons 中间表")

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS idea_responsible_persons (
                idea_id INTEGER NOT NULL,
                collaborator_id INTEGER NOT NULL,
                PRIMARY KEY (idea_id, collaborator_id),
                FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE,
                FOREIGN KEY (collaborator_id) REFERENCES collaborators(id)
            )
        """)
        logger.info("   ✅ idea_responsible_persons 表已创建")

        # ============================
        # Step 3: 统计当前有负责人的 Ideas
        # ============================
        logger.info("\n📋 Step 3: 统计当前有负责人的 Ideas")

        cursor.execute("SELECT COUNT(*) FROM ideas WHERE responsible_person_id IS NOT NULL")
        ideas_with_responsible_count = cursor.fetchone()[0]

        logger.info(f"   当前有负责人的 Ideas: {ideas_with_responsible_count} 个")

        # ============================
        # Step 4: 迁移现有数据到新表
        # ============================
        logger.info("\n📋 Step 4: 迁移现有数据到新表")

        if ideas_with_responsible_count > 0:
            cursor.execute("""
                INSERT OR IGNORE INTO idea_responsible_persons (idea_id, collaborator_id)
                SELECT id, responsible_person_id
                FROM ideas
                WHERE responsible_person_id IS NOT NULL
            """)
            migrated_count = cursor.rowcount
            logger.info(f"   ✅ 已迁移 {migrated_count} 条负责人关系到新表")
        else:
            logger.info("   ✓ 没有需要迁移的数据")

        # ============================
        # Step 5: 将 responsible_person_id 改为可选
        # ============================
        logger.info("\n📋 Step 5: 确保 responsible_person_id 可为 NULL")

        # SQLite 不直接支持 ALTER COLUMN，但我们可以通过重建表来达到目的
        # 但由于我们在创建表时已经定义为 nullable，所以这里只需要确认一下
        cursor.execute("PRAGMA table_info(ideas)")
        columns = cursor.fetchall()
        for col in columns:
            if col[1] == 'responsible_person_id':
                if col[3] == 0:  # 0 表示 not null
                    logger.warning("   ⚠️  responsible_person_id 字段为 NOT NULL，建议手动修改")
                else:
                    logger.info("   ✅ responsible_person_id 已支持 NULL")
                break

        # 提交事务
        conn.commit()
        mark_migration_completed(db_path)

        logger.info("\n" + "=" * 70)
        logger.info("🎉 v3.9 Idea 多选负责人迁移完成！")
        logger.info(f"✅ 创建中间表: idea_responsible_persons")
        logger.info(f"✅ 迁移数据: {ideas_with_responsible_count} 条")
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
