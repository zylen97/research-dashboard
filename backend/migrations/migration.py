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

# 迁移版本号 - 移除is_senior字段
MIGRATION_VERSION = "v3.3_remove_is_senior_field"

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
        logger.info('🎯 目标: 移除is_senior字段，简化合作者管理')
        logger.info("=" * 70)

        # ===========================================
        # 🔧 v3.3迁移任务：移除is_senior字段
        # 变更：
        # 1. 重建collaborators表（删除is_senior字段）
        # 2. 验证数据完整性
        # ===========================================

        # ============================
        # Step 1: 重建collaborators表（删除is_senior字段）
        # ============================
        logger.info("\n📋 Step 1: 重建collaborators表（删除is_senior字段）")

        # 读取现有数据（排除is_senior字段）
        cursor.execute("""
            SELECT id, name, background, is_deleted, deleted_at, created_at, updated_at
            FROM collaborators
        """)
        collaborators_data = cursor.fetchall()
        logger.info(f"   📊 读取到 {len(collaborators_data)} 条合作者数据")

        # 备份旧表
        cursor.execute("DROP TABLE IF EXISTS collaborators_old")
        cursor.execute("ALTER TABLE collaborators RENAME TO collaborators_old")
        logger.info("   ✅ 备份旧表为 collaborators_old")

        # 创建新表（不含is_senior字段）
        cursor.execute("""
            CREATE TABLE collaborators (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                background TEXT NOT NULL,
                is_deleted INTEGER DEFAULT 0,
                deleted_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        logger.info("   ✅ 创建新表: collaborators（不含is_senior字段）")

        # 创建索引
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_collaborators_name ON collaborators(name)")
        logger.info("   ✅ 创建索引")

        # 迁移数据
        for row in collaborators_data:
            cursor.execute("""
                INSERT INTO collaborators (id, name, background, is_deleted, deleted_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, row)
        logger.info(f"   ✅ 迁移 {len(collaborators_data)} 条数据到新表")

        # 重建project_collaborators表（修复外键引用）
        logger.info("   🔧 重建 project_collaborators 表以修复外键引用...")

        # 读取现有的project_collaborators数据
        cursor.execute("SELECT project_id, collaborator_id FROM project_collaborators")
        project_collaborators_data = cursor.fetchall()
        logger.info(f"   📊 读取到 {len(project_collaborators_data)} 条project_collaborators关联数据")

        # 删除旧的project_collaborators表
        cursor.execute("DROP TABLE IF EXISTS project_collaborators")

        # 重新创建project_collaborators表（正确的外键引用）
        cursor.execute("""
            CREATE TABLE project_collaborators (
                project_id INTEGER NOT NULL,
                collaborator_id INTEGER NOT NULL,
                PRIMARY KEY (project_id, collaborator_id),
                FOREIGN KEY(project_id) REFERENCES research_projects (id),
                FOREIGN KEY(collaborator_id) REFERENCES collaborators (id)
            )
        """)
        logger.info("   ✅ 重建 project_collaborators 表（外键指向collaborators）")

        # 迁移project_collaborators数据
        for row in project_collaborators_data:
            cursor.execute("""
                INSERT INTO project_collaborators (project_id, collaborator_id)
                VALUES (?, ?)
            """, row)
        logger.info(f"   ✅ 迁移 {len(project_collaborators_data)} 条project_collaborators数据")

        # 重建ideas表的外键引用
        logger.info("   🔧 更新 ideas 表的外键引用...")

        # 读取现有的ideas数据
        cursor.execute("SELECT id, project_name, project_description, research_method, source, reference_paper, reference_journal, target_journal, responsible_person_id, maturity, created_at, updated_at FROM ideas")
        ideas_data = cursor.fetchall()
        logger.info(f"   📊 读取到 {len(ideas_data)} 条ideas数据")

        # 删除旧的ideas表
        cursor.execute("DROP TABLE IF EXISTS ideas")

        # 重新创建ideas表
        cursor.execute("""
            CREATE TABLE ideas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_name TEXT NOT NULL,
                project_description TEXT NOT NULL,
                research_method TEXT NOT NULL,
                source TEXT,
                reference_paper TEXT,
                reference_journal TEXT,
                target_journal TEXT,
                responsible_person_id INTEGER NOT NULL,
                maturity TEXT NOT NULL DEFAULT 'immature',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(responsible_person_id) REFERENCES collaborators (id)
            )
        """)
        logger.info("   ✅ 重建 ideas 表（外键指向collaborators）")

        # 创建索引
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_ideas_maturity ON ideas(maturity)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_ideas_responsible_person_id ON ideas(responsible_person_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_ideas_created_at ON ideas(created_at)")
        logger.info("   ✅ 创建ideas索引")

        # 迁移ideas数据
        for row in ideas_data:
            cursor.execute("""
                INSERT INTO ideas (id, project_name, project_description, research_method, source, reference_paper, reference_journal, target_journal, responsible_person_id, maturity, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, row)
        logger.info(f"   ✅ 迁移 {len(ideas_data)} 条ideas数据")

        # 重建communication_logs表的外键引用
        logger.info("   🔧 更新 communication_logs 表的外键引用...")

        # 读取现有的communication_logs数据
        cursor.execute("SELECT id, project_id, collaborator_id, communication_type, title, content, outcomes, communication_date, created_at, updated_at FROM communication_logs")
        comm_logs_data = cursor.fetchall()
        logger.info(f"   📊 读取到 {len(comm_logs_data)} 条communication_logs数据")

        # 删除旧的communication_logs表
        cursor.execute("DROP TABLE IF EXISTS communication_logs")

        # 重新创建communication_logs表
        cursor.execute("""
            CREATE TABLE communication_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                collaborator_id INTEGER,
                communication_type TEXT,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                outcomes TEXT,
                communication_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(project_id) REFERENCES research_projects (id),
                FOREIGN KEY(collaborator_id) REFERENCES collaborators (id)
            )
        """)
        logger.info("   ✅ 重建 communication_logs 表（外键指向collaborators）")

        # 迁移communication_logs数据
        for row in comm_logs_data:
            cursor.execute("""
                INSERT INTO communication_logs (id, project_id, collaborator_id, communication_type, title, content, outcomes, communication_date, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, row)
        logger.info(f"   ✅ 迁移 {len(comm_logs_data)} 条communication_logs数据")

        # 删除旧表
        cursor.execute("DROP TABLE IF EXISTS collaborators_old")
        logger.info("   ✅ 删除旧表 collaborators_old")

        # ============================
        # Step 2: 验证迁移结果
        # ============================
        logger.info("\n📋 Step 2: 验证迁移结果")

        # 验证collaborators表字段
        collaborators_columns = get_table_columns(cursor, 'collaborators')
        required_fields = ['id', 'name', 'background', 'is_deleted', 'deleted_at', 'created_at', 'updated_at']
        removed_fields = ['is_senior']

        all_fields_ok = True
        for field in required_fields:
            if field in collaborators_columns:
                logger.info(f"   ✅ collaborators表.{field} 存在")
            else:
                logger.error(f"   ❌ collaborators表.{field} 缺失！")
                all_fields_ok = False

        for field in removed_fields:
            if field not in collaborators_columns:
                logger.info(f"   ✅ collaborators表.{field} 已删除")
            else:
                logger.error(f"   ❌ collaborators表.{field} 仍然存在！")
                all_fields_ok = False

        if not all_fields_ok:
            conn.rollback()
            return False

        # 验证数据完整性
        cursor.execute("SELECT COUNT(*) FROM collaborators")
        collaborators_count = cursor.fetchone()[0]
        if collaborators_count == len(collaborators_data):
            logger.info(f"   ✅ 数据完整性验证通过（{collaborators_count}条合作者数据）")
        else:
            logger.error(f"   ❌ 数据丢失！原始数据{len(collaborators_data)}条，现在{collaborators_count}条")
            conn.rollback()
            return False

        # 验证外键约束
        cursor.execute("SELECT COUNT(*) FROM project_collaborators")
        pc_count = cursor.fetchone()[0]
        logger.info(f"   ✅ project_collaborators关联: {pc_count} 条")

        cursor.execute("SELECT COUNT(*) FROM ideas")
        ideas_count = cursor.fetchone()[0]
        logger.info(f"   ✅ ideas数据: {ideas_count} 条")

        cursor.execute("SELECT COUNT(*) FROM communication_logs")
        comm_count = cursor.fetchone()[0]
        logger.info(f"   ✅ communication_logs数据: {comm_count} 条")

        # 提交事务
        conn.commit()
        mark_migration_completed(db_path)

        logger.info("\n" + "=" * 70)
        logger.info("🎉 v3.3 is_senior字段迁移完成！")
        logger.info(f"✅ 删除字段: is_senior")
        logger.info(f"✅ 保留数据: {collaborators_count} 条合作者")
        logger.info(f"✅ 外键更新: project_collaborators({pc_count}), ideas({ideas_count}), communication_logs({comm_count})")
        logger.info("⚠️  下一步: 更新后端模型和前端UI")
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
