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

# 修复模块路径问题
sys.path.insert(0, os.path.dirname(__file__))

# 导入迁移工具
from migration_utils import setup_migration_logging, find_database_path, backup_database, get_table_columns, table_exists

logger = setup_migration_logging()

# 迁移版本号 - 重建Ideas表以对齐模型定义
MIGRATION_VERSION = "v2.4_rebuild_ideas_table"

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
        logger.info("🎯 目标: 重建 Ideas 表以对齐模型定义")
        logger.info("=" * 70)

        # ===========================================
        # 🔧 v2.4迁移任务：重建Ideas表
        # 变更：
        # 1. 删除旧的 ideas 表（字段：research_question, source_literature等）
        # 2. 创建新的 ideas 表（字段：project_name, project_description等）
        # 说明：
        # - Ideas表当前为空，可以安全重建
        # - 新表结构对齐 database.py 中的 Idea 模型定义
        # - 教训：2025-07-24 数据库表结构必须与模型定义一致
        # ===========================================

        # ============================
        # Step 1: 验证 Ideas 表为空（安全检查）
        # ============================
        logger.info("\n📋 Step 1: 验证 Ideas 表为空")

        cursor.execute("SELECT COUNT(*) FROM ideas")
        ideas_count = cursor.fetchone()[0]
        logger.info(f"   Ideas 表当前记录数: {ideas_count}")

        if ideas_count > 0:
            logger.error(f"   ❌ Ideas 表有 {ideas_count} 条数据，迁移中止！")
            logger.error("   ⚠️  有数据时不能重建表，会导致数据丢失")
            conn.rollback()
            return False

        logger.info("   ✅ Ideas 表为空，可以安全重建")

        # ============================
        # Step 2: 删除旧 Ideas 表
        # ============================
        logger.info("\n📋 Step 2: 删除旧 Ideas 表")

        # 获取旧表结构信息（用于记录）
        old_columns = get_table_columns(cursor, 'ideas')
        logger.info(f"   旧表字段: {', '.join(old_columns)}")

        cursor.execute("DROP TABLE IF EXISTS ideas")
        logger.info("   ✅ 旧表已删除")

        # ============================
        # Step 3: 创建新 Ideas 表（对齐模型定义）
        # ============================
        logger.info("\n📋 Step 3: 创建新 Ideas 表（对齐 database.py 模型）")

        cursor.execute("""
            CREATE TABLE ideas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_name TEXT NOT NULL,
                project_description TEXT,
                research_method TEXT NOT NULL,
                source TEXT,
                responsible_person VARCHAR(100) NOT NULL,
                maturity VARCHAR(20) NOT NULL DEFAULT 'immature',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        logger.info("   ✅ 新表已创建")

        # ============================
        # Step 4: 创建索引
        # ============================
        logger.info("\n📋 Step 4: 创建索引")

        cursor.execute("CREATE INDEX idx_ideas_maturity ON ideas(maturity)")
        logger.info("   ✅ 索引 idx_ideas_maturity 已创建")

        cursor.execute("CREATE INDEX idx_ideas_responsible_person ON ideas(responsible_person)")
        logger.info("   ✅ 索引 idx_ideas_responsible_person 已创建")

        cursor.execute("CREATE INDEX idx_ideas_created_at ON ideas(created_at)")
        logger.info("   ✅ 索引 idx_ideas_created_at 已创建")

        # ============================
        # Step 5: 验证表结构
        # ============================
        logger.info("\n📋 Step 5: 验证表结构")

        # 获取新表字段
        new_columns = get_table_columns(cursor, 'ideas')
        logger.info(f"   新表字段: {', '.join(new_columns)}")

        # 验证所有必需字段
        required_fields = {
            'id': 'INTEGER',
            'project_name': 'TEXT',
            'project_description': 'TEXT',
            'research_method': 'TEXT',
            'source': 'TEXT',
            'responsible_person': 'VARCHAR(100)',
            'maturity': 'VARCHAR(20)',
            'created_at': 'DATETIME',
            'updated_at': 'DATETIME'
        }

        all_fields_ok = True
        for field in required_fields:
            if field in new_columns:
                logger.info(f"   ✅ {field} 字段已创建")
            else:
                logger.error(f"   ❌ {field} 字段缺失！")
                all_fields_ok = False

        if not all_fields_ok:
            logger.error("   ❌ 表结构验证失败！")
            conn.rollback()
            return False

        logger.info("   ✅ 表结构验证通过")

        # 验证索引
        cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='ideas'")
        indexes = [row[0] for row in cursor.fetchall()]
        logger.info(f"   创建的索引: {', '.join(indexes)}")

        # 提交事务
        conn.commit()
        mark_migration_completed(db_path)

        logger.info("\n" + "=" * 70)
        logger.info("🎉 v2.4 Ideas 表重建完成！")
        logger.info("✅ 旧表字段: research_question, source_literature, collaborator_id 等")
        logger.info("✅ 新表字段: project_name, project_description, responsible_person 等")
        logger.info("✅ 表结构已对齐 database.py Idea 模型定义")
        logger.info("⚠️  重要: Ideas 表现在可以正常使用，不会出现字段错位问题")
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
