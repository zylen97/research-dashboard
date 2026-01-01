#!/usr/bin/env python3
"""
v3.5 迁移: 为papers表添加翻译字段
- link: 文献预览URL
- title_translation: 标题翻译
- abstract_translation: 摘要翻译
- abstract_summary: 摘要总结
"""

import sqlite3
import sys
import os
import logging
from datetime import datetime

# 修复模块路径问题
sys.path.insert(0, os.path.dirname(__file__))

# 导入迁移工具
from migration_utils import setup_migration_logging, find_database_path, backup_database, get_table_columns, table_exists

logger = setup_migration_logging()

# 迁移版本号
MIGRATION_VERSION = "v3.5_add_paper_translation_fields"

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
        logger.info('🎯 目标: 为papers表添加翻译字段以支持知网Excel导入')
        logger.info("=" * 70)

        # ============================
        # Step 1: 检查papers表是否存在
        # ============================
        logger.info("\n📋 Step 1: 检查papers表是否存在")

        if not table_exists(cursor, 'papers'):
            logger.error("   ❌ papers表不存在！请先运行v3.4迁移创建papers表")
            conn.rollback()
            return False

        logger.info("   ✅ papers表存在")

        # ============================
        # Step 2: 添加新字段
        # ============================
        logger.info("\n📋 Step 2: 添加翻译字段到papers表")

        papers_columns = get_table_columns(cursor, 'papers')

        # 添加link字段
        if 'link' not in papers_columns:
            cursor.execute("ALTER TABLE papers ADD COLUMN link TEXT")
            logger.info("   ✅ 已添加link字段")
        else:
            logger.info("   ✓ link字段已存在，跳过")

        # 添加title_translation字段
        if 'title_translation' not in papers_columns:
            cursor.execute("ALTER TABLE papers ADD COLUMN title_translation TEXT")
            logger.info("   ✅ 已添加title_translation字段")
        else:
            logger.info("   ✓ title_translation字段已存在，跳过")

        # 添加abstract_translation字段
        if 'abstract_translation' not in papers_columns:
            cursor.execute("ALTER TABLE papers ADD COLUMN abstract_translation TEXT")
            logger.info("   ✅ 已添加abstract_translation字段")
        else:
            logger.info("   ✓ abstract_translation字段已存在，跳过")

        # 添加abstract_summary字段
        if 'abstract_summary' not in papers_columns:
            cursor.execute("ALTER TABLE papers ADD COLUMN abstract_summary TEXT")
            logger.info("   ✅ 已添加abstract_summary字段")
        else:
            logger.info("   ✓ abstract_summary字段已存在，跳过")

        # ============================
        # Step 3: 验证迁移结果
        # ============================
        logger.info("\n📋 Step 3: 验证迁移结果")

        papers_columns = get_table_columns(cursor, 'papers')
        new_fields = ['link', 'title_translation', 'abstract_translation', 'abstract_summary']

        all_fields_ok = True
        for field in new_fields:
            if field in papers_columns:
                logger.info(f"   ✅ papers表.{field} 存在")
            else:
                logger.error(f"   ❌ papers表.{field} 缺失！")
                all_fields_ok = False

        if not all_fields_ok:
            conn.rollback()
            return False

        # 统计数据
        cursor.execute("SELECT COUNT(*) FROM papers")
        papers_count = cursor.fetchone()[0]
        logger.info(f"   ✅ 现有papers数据: {papers_count} 条")

        # 提交事务
        conn.commit()
        mark_migration_completed(db_path)

        logger.info("\n" + "=" * 70)
        logger.info("🎉 v3.5 翻译字段迁移完成！")
        logger.info(f"✅ 添加字段: papers.link")
        logger.info(f"✅ 添加字段: papers.title_translation")
        logger.info(f"✅ 添加字段: papers.abstract_translation")
        logger.info(f"✅ 添加字段: papers.abstract_summary")
        logger.info(f"✅ 现有数据: papers({papers_count}) 条")
        logger.info("⚠️  下一步: 更新后端模型和Excel导入服务")
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
            print("Migration v3.5 completed successfully")
            sys.exit(0)
        else:
            logger.error("❌ 迁移执行失败")
            print("Migration v3.5 failed")
            sys.exit(1)

    except KeyboardInterrupt:
        logger.warning("迁移被用户中断")
        print("Migration interrupted by user")
        sys.exit(1)

    except Exception as e:
        logger.error(f"未预期的错误: {e}")
        print(f"Unexpected error: {e}")
        sys.exit(1)
