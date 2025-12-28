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

# 迁移版本号 - 删除action_items字段
MIGRATION_VERSION = "v2.3_remove_action_items"

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
        logger.info("🎯 目标: 从communication_logs表删除action_items字段")
        logger.info("=" * 70)

        # ===========================================
        # 🔧 v2.3迁移任务：删除action_items字段
        # 变更：
        # 1. 从 communication_logs 表删除 action_items 字段
        # 2. 保留其他所有字段
        # 说明：
        # - SQLite不支持DROP COLUMN，需要重建表
        # - 必须明确列出字段映射，防止数据错位（教训：2025-07-24）
        # ===========================================

        # ============================
        # Step 1: 获取迁移前的统计数据
        # ============================
        logger.info("\n📋 Step 1: 获取迁移前统计数据")

        cursor.execute("SELECT COUNT(*) FROM communication_logs")
        original_log_count = cursor.fetchone()[0]
        logger.info(f"   交流日志总数: {original_log_count}")

        # ============================
        # Step 2: 重建 communication_logs 表（删除action_items）
        # ============================
        logger.info("\n📋 Step 2: 重建 communication_logs 表，删除 action_items 字段")

        # 2.1 创建新表（不包含action_items字段）
        logger.info("   创建新表 communication_logs_new...")
        cursor.execute("""
            CREATE TABLE communication_logs_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                collaborator_id INTEGER,
                communication_type VARCHAR(50),
                title VARCHAR(200) NOT NULL,
                content TEXT NOT NULL,
                outcomes TEXT,
                communication_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES research_projects(id) ON DELETE CASCADE,
                FOREIGN KEY (collaborator_id) REFERENCES collaborators(id)
            )
        """)

        # 2.2 复制数据（明确字段映射，跳过action_items字段）
        logger.info("   复制数据到新表（明确字段映射，跳过action_items字段）...")
        cursor.execute("""
            INSERT INTO communication_logs_new (
                id, project_id, collaborator_id, communication_type,
                title, content, outcomes,
                communication_date, created_at, updated_at
            )
            SELECT
                id, project_id, collaborator_id, communication_type,
                title, content, outcomes,
                communication_date, created_at, updated_at
            FROM communication_logs
        """)

        copied_log_count = cursor.rowcount
        logger.info(f"   ✅ 已复制 {copied_log_count} 条交流日志记录")

        # 2.3 删除旧表
        logger.info("   删除旧表...")
        cursor.execute("DROP TABLE communication_logs")

        # 2.4 重命名新表
        logger.info("   重命名新表...")
        cursor.execute("ALTER TABLE communication_logs_new RENAME TO communication_logs")

        # 2.5 重建索引
        logger.info("   重建索引...")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_communication_logs_id ON communication_logs(id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_communication_logs_project ON communication_logs(project_id)")

        logger.info("   ✅ communication_logs 表重建完成")
        logger.info("   ✅ 已删除字段: action_items")

        # ============================
        # Step 3: 验证数据完整性
        # ============================
        logger.info("\n📋 Step 3: 验证数据完整性")

        # 验证记录数量
        cursor.execute("SELECT COUNT(*) FROM communication_logs")
        new_log_count = cursor.fetchone()[0]
        logger.info(f"   迁移后日志总数: {new_log_count}")

        if new_log_count != original_log_count:
            logger.error(f"   ❌ 记录数不匹配！迁移前: {original_log_count}, 迁移后: {new_log_count}")
            conn.rollback()
            return False
        else:
            logger.info(f"   ✅ 记录数一致: {new_log_count}")

        # 验证表字段
        log_columns = get_table_columns(cursor, 'communication_logs')

        # 验证action_items字段已删除
        if 'action_items' not in log_columns:
            logger.info("   ✅ action_items 字段已成功删除")
        else:
            logger.error("   ❌ action_items 字段仍然存在！")
            conn.rollback()
            return False

        # 验证必需字段存在
        required_fields = ['id', 'project_id', 'title', 'content', 'outcomes', 'communication_date']
        for field in required_fields:
            if field in log_columns:
                logger.info(f"   ✅ {field} 字段已保留")
            else:
                logger.error(f"   ❌ {field} 字段丢失！")
                conn.rollback()
                return False

        # 显示字段列表
        logger.info(f"\n   Communication_logs表最终字段: {', '.join(log_columns)}")

        # 显示示例数据（防止字段错位）
        logger.info("\n   前3条交流日志记录示例:")
        cursor.execute("""
            SELECT id, project_id, title, content, outcomes, communication_date
            FROM communication_logs
            LIMIT 3
        """)
        for row in cursor.fetchall():
            title = row[2][:30] + '...' if len(row[2]) > 30 else row[2]
            content_preview = (row[3][:30] + '...') if row[3] and len(row[3]) > 30 else (row[3] or '-')
            outcomes_preview = (row[4][:30] + '...') if row[4] and len(row[4]) > 30 else (row[4] or '-')
            logger.info(f"     ID={row[0]}, ProjectID={row[1]}")
            logger.info(f"       Title={title}")
            logger.info(f"       Content={content_preview}")
            logger.info(f"       Outcomes={outcomes_preview}")
            logger.info(f"       Date={row[5]}")

        # 提交事务
        conn.commit()
        mark_migration_completed(db_path)

        logger.info("\n" + "=" * 70)
        logger.info("🎉 v2.3 交流日志系统简化完成！")
        logger.info("✅ 已删除: action_items 字段（从 communication_logs）")
        logger.info(f"✅ 共处理: {new_log_count} 条交流日志")
        logger.info("⚠️  重要: 项目级 is_todo 功能未受影响，继续保留")
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
