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

# 迁移版本号 - 期刊Tags系统
MIGRATION_VERSION = "v3.0_journal_tags_system"

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
        logger.info("🎯 目标: 创建Tags表和journal_tags关联表，删除category和impact_factor字段")
        logger.info("=" * 70)

        # ===========================================
        # 🔧 v3.0迁移任务：期刊Tags系统
        # 变更：
        # 1. 创建tags表（标签定义）
        # 2. 创建journal_tags表（多对多关联）
        # 3. 提取现有category创建标签
        # 4. 建立期刊-标签关联
        # 5. 重建journals表（删除category和impact_factor字段）
        # ===========================================

        # ============================
        # Step 1: 创建tags表和journal_tags表
        # ============================
        logger.info("\n📋 Step 1: 创建tags表和journal_tags表")

        if not table_exists(cursor, 'tags'):
            cursor.execute("""
                CREATE TABLE tags (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    description TEXT,
                    color TEXT DEFAULT 'blue',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
            logger.info("   ✅ 创建表: tags")

            # 创建索引
            cursor.execute("CREATE INDEX idx_tag_name ON tags(name)")
            logger.info("   ✅ 创建索引: idx_tag_name")
        else:
            logger.info("   ⏭️  表已存在: tags")

        if not table_exists(cursor, 'journal_tags'):
            cursor.execute("""
                CREATE TABLE journal_tags (
                    journal_id INTEGER NOT NULL,
                    tag_id INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (journal_id, tag_id),
                    FOREIGN KEY (journal_id) REFERENCES journals(id) ON DELETE CASCADE,
                    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
                )
            """)
            logger.info("   ✅ 创建表: journal_tags")

            # 创建索引
            cursor.execute("CREATE INDEX idx_journal_tags_journal ON journal_tags(journal_id)")
            cursor.execute("CREATE INDEX idx_journal_tags_tag ON journal_tags(tag_id)")
            logger.info("   ✅ 创建索引: journal_tags索引")
        else:
            logger.info("   ⏭️  表已存在: journal_tags")

        # ============================
        # Step 2: 提取现有category创建标签
        # ============================
        logger.info("\n📋 Step 2: 提取现有category创建标签")

        # 提取所有非空分类
        cursor.execute("""
            SELECT DISTINCT category
            FROM journals
            WHERE category IS NOT NULL AND category != ''
            ORDER BY category
        """)
        categories = cursor.fetchall()
        logger.info(f"   📊 发现 {len(categories)} 个不同的分类")

        # 创建标签并建立映射
        tag_mapping = {}
        for category_name, in categories:
            # 检查标签是否已存在
            cursor.execute("SELECT id FROM tags WHERE name = ?", (category_name,))
            existing_tag = cursor.fetchone()

            if existing_tag:
                tag_id = existing_tag[0]
                logger.info(f"   ⏭️  标签已存在: {category_name} (ID: {tag_id})")
            else:
                cursor.execute("""
                    INSERT INTO tags (name, description, color)
                    VALUES (?, ?, ?)
                """, (category_name, f'从旧分类"{category_name}"自动迁移', 'blue'))

                tag_id = cursor.lastrowid
                logger.info(f"   ✅ 创建标签: {category_name} (ID: {tag_id})")

            tag_mapping[category_name] = tag_id

        logger.info(f"   📊 共处理 {len(tag_mapping)} 个标签")

        # ============================
        # Step 3: 建立期刊-标签关联
        # ============================
        logger.info("\n📋 Step 3: 建立期刊-标签关联")

        # 查询所有有分类的期刊
        cursor.execute("""
            SELECT id, category
            FROM journals
            WHERE category IS NOT NULL AND category != ''
        """)
        journals_with_category = cursor.fetchall()
        logger.info(f"   📊 发现 {len(journals_with_category)} 个期刊有分类")

        # 创建关联
        association_count = 0
        for journal_id, category_name in journals_with_category:
            tag_id = tag_mapping.get(category_name)
            if tag_id:
                # 检查关联是否已存在
                cursor.execute("""
                    SELECT 1 FROM journal_tags
                    WHERE journal_id = ? AND tag_id = ?
                """, (journal_id, tag_id))

                if not cursor.fetchone():
                    cursor.execute("""
                        INSERT INTO journal_tags (journal_id, tag_id)
                        VALUES (?, ?)
                    """, (journal_id, tag_id))
                    association_count += 1

        logger.info(f"   ✅ 创建 {association_count} 个期刊-标签关联")

        # ============================
        # Step 4: 重建journals表（删除category和impact_factor字段）
        # ============================
        logger.info("\n📋 Step 4: 重建journals表（删除category和impact_factor字段）")

        # 读取现有数据（排除要删除的字段）
        cursor.execute("""
            SELECT id, name, language, notes, created_at, updated_at
            FROM journals
        """)
        journals_data = cursor.fetchall()
        logger.info(f"   📊 读取到 {len(journals_data)} 条期刊数据")

        # 备份旧表
        cursor.execute("DROP TABLE IF EXISTS journals_old")
        cursor.execute("ALTER TABLE journals RENAME TO journals_old")
        logger.info("   ✅ 备份旧表为 journals_old")

        # 创建新表（不含category和impact_factor）
        cursor.execute("""
            CREATE TABLE journals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                language TEXT NOT NULL DEFAULT 'zh',
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        logger.info("   ✅ 创建新表: journals（不含category和impact_factor字段）")

        # 删除旧索引（如果存在）
        old_indexes = ['idx_journal_name', 'idx_journal_language', 'idx_journal_category', 'idx_journal_language_category']
        for idx in old_indexes:
            try:
                cursor.execute(f"DROP INDEX IF EXISTS {idx}")
            except:
                pass

        # 创建索引
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_journal_name ON journals(name)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_journal_language ON journals(language)")
        logger.info("   ✅ 创建索引")

        # 迁移数据
        for row in journals_data:
            cursor.execute("""
                INSERT INTO journals (id, name, language, notes, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, row)
        logger.info(f"   ✅ 迁移 {len(journals_data)} 条数据到新表")

        # 删除旧表
        cursor.execute("DROP TABLE journals_old")
        logger.info("   ✅ 删除旧表 journals_old")

        # ============================
        # Step 5: 验证迁移结果
        # ============================
        logger.info("\n📋 Step 5: 验证迁移结果")

        # 验证tags表
        cursor.execute("SELECT COUNT(*) FROM tags")
        tags_count = cursor.fetchone()[0]
        logger.info(f"   ✅ tags表: {tags_count} 条记录")

        # 验证journal_tags表
        cursor.execute("SELECT COUNT(*) FROM journal_tags")
        associations_count = cursor.fetchone()[0]
        logger.info(f"   ✅ journal_tags关联: {associations_count} 条记录")

        # 验证journals表字段
        journals_columns = get_table_columns(cursor, 'journals')
        required_fields = ['id', 'name', 'language', 'notes', 'created_at', 'updated_at']
        removed_fields = ['category', 'impact_factor']

        all_fields_ok = True
        for field in required_fields:
            if field in journals_columns:
                logger.info(f"   ✅ journals表.{field} 存在")
            else:
                logger.error(f"   ❌ journals表.{field} 缺失！")
                all_fields_ok = False

        for field in removed_fields:
            if field not in journals_columns:
                logger.info(f"   ✅ journals表.{field} 已删除")
            else:
                logger.error(f"   ❌ journals表.{field} 仍然存在！")
                all_fields_ok = False

        if not all_fields_ok:
            conn.rollback()
            return False

        # 验证数据完整性
        cursor.execute("SELECT COUNT(*) FROM journals")
        journals_count = cursor.fetchone()[0]
        if journals_count == len(journals_data):
            logger.info(f"   ✅ 数据完整性验证通过（{journals_count}条数据）")
        else:
            logger.error(f"   ❌ 数据丢失！原始数据{len(journals_data)}条，现在{journals_count}条")
            conn.rollback()
            return False

        # 提交事务
        conn.commit()
        mark_migration_completed(db_path)

        logger.info("\n" + "=" * 70)
        logger.info("🎉 v3.0 期刊Tags系统创建完成！")
        logger.info(f"✅ 新增表: tags（{tags_count}条）")
        logger.info(f"✅ 新增表: journal_tags（{associations_count}条关联）")
        logger.info(f"✅ 删除字段: category、impact_factor")
        logger.info(f"✅ 保留数据: {journals_count} 条期刊")
        logger.info("⚠️  下一步: 更新后端API和前端UI")
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
