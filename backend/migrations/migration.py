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
MIGRATION_VERSION = "v4.3_remove_completed_status_and_other_author"

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
        logger.info('🎯 目标: 删除completed状态和other_author角色')
        logger.info("=" * 70)

        # ===========================================
        # 🔧 v4.3迁移任务：简化状态和角色
        # 变更：
        # 1. completed → published (已完成 → 已发表)
        # 2. other_author → first_author (其他作者 → 第一作者)
        # 最终状态系统：writing, submitting, published
        # 最终角色系统：first_author, corresponding_author
        # ===========================================

        # ============================
        # Step 1: 检查 research_projects 表是否存在
        # ============================
        logger.info("\n📋 Step 1: 检查 research_projects 表")

        if not table_exists(cursor, 'research_projects'):
            logger.error("   ❌ research_projects表不存在！无法继续迁移。")
            conn.rollback()
            return False
        else:
            logger.info("   ✅ research_projects表存在")

        # ============================
        # Step 2: 统计当前数据分布
        # ============================
        logger.info("\n📋 Step 2: 统计当前数据分布")

        # 状态分布
        cursor.execute("""
            SELECT status, COUNT(*) as count
            FROM research_projects
            GROUP BY status
            ORDER BY status
        """)
        status_counts = cursor.fetchall()
        logger.info("   当前项目状态分布:")
        for status, count in status_counts:
            logger.info(f"     - {status}: {count} 个")

        # 角色分布
        cursor.execute("""
            SELECT my_role, COUNT(*) as count
            FROM research_projects
            GROUP BY my_role
            ORDER BY my_role
        """)
        role_counts = cursor.fetchall()
        logger.info("   当前角色分布:")
        for role, count in role_counts:
            logger.info(f"     - {role}: {count} 个")

        # ============================
        # Step 3: 执行状态迁移
        # ============================
        logger.info("\n📋 Step 3: 执行状态迁移")

        # completed → published
        cursor.execute("""
            UPDATE research_projects
            SET status = 'published'
            WHERE status = 'completed'
        """)
        completed_count = cursor.rowcount
        logger.info(f"   ✅ completed → published: {completed_count} 个项目")

        # writing 保持不变
        cursor.execute("SELECT COUNT(*) FROM research_projects WHERE status = 'writing'")
        writing_count = cursor.fetchone()[0]
        logger.info(f"   ✓ writing 保持不变: {writing_count} 个项目")

        # submitting 保持不变
        cursor.execute("SELECT COUNT(*) FROM research_projects WHERE status = 'submitting'")
        submitting_count = cursor.fetchone()[0]
        logger.info(f"   ✓ submitting 保持不变: {submitting_count} 个项目")

        # published 保持不变（包括刚转换的）
        cursor.execute("SELECT COUNT(*) FROM research_projects WHERE status = 'published'")
        published_count = cursor.fetchone()[0]
        logger.info(f"   ✓ published 总数: {published_count} 个项目")

        # ============================
        # Step 4: 执行角色迁移
        # ============================
        logger.info("\n📋 Step 4: 执行角色迁移")

        # other_author → first_author
        cursor.execute("""
            UPDATE research_projects
            SET my_role = 'first_author'
            WHERE my_role = 'other_author'
        """)
        other_author_count = cursor.rowcount
        logger.info(f"   ✅ other_author → first_author: {other_author_count} 个项目")

        # first_author 保持不变
        cursor.execute("SELECT COUNT(*) FROM research_projects WHERE my_role = 'first_author'")
        first_author_count = cursor.fetchone()[0]
        logger.info(f"   ✓ first_author 总数: {first_author_count} 个项目")

        # corresponding_author 保持不变
        cursor.execute("SELECT COUNT(*) FROM research_projects WHERE my_role = 'corresponding_author'")
        corresponding_author_count = cursor.fetchone()[0]
        logger.info(f"   ✓ corresponding_author 保持不变: {corresponding_author_count} 个项目")

        # 提交事务
        conn.commit()
        mark_migration_completed(db_path)

        logger.info("\n" + "=" * 70)
        logger.info("🎉 v4.3 简化迁移完成！")
        logger.info(f"✅ 状态简化: completed→published")
        logger.info(f"✅ 角色简化: other_author→first_author")
        logger.info(f"✅ 最终状态系统: writing, submitting, published")
        logger.info(f"✅ 最终角色系统: first_author, corresponding_author")
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
