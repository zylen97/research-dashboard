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

# 迁移版本号 - 移除语言字段，用标签代替
MIGRATION_VERSION = "v3.1_remove_language_field"

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
        logger.info('🎯 目标: 移除language字段，用"中文"和"英文"标签代替')
        logger.info("=" * 70)

        # ===========================================
        # 🔧 v3.1迁移任务：移除language字段
        # 变更：
        # 1. 创建"中文"和"英文"语言标签
        # 2. 将现有language字段映射为标签关联
        # 3. 重建journals表（删除language字段）
        # 4. 验证数据完整性
        # ===========================================

        # ============================
        # Step 1: 创建语言标签
        # ============================
        logger.info("\n📋 Step 1: 创建语言标签")

        # 创建"中文"标签
        cursor.execute("SELECT id FROM tags WHERE name = '中文'")
        tag_zh = cursor.fetchone()
        if tag_zh:
            tag_id_zh = tag_zh[0]
            logger.info(f"   ⏭️  标签已存在: 中文 (ID: {tag_id_zh})")
        else:
            cursor.execute("""
                INSERT INTO tags (name, description, color, created_at, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """, ('中文', '中文期刊', 'blue'))
            tag_id_zh = cursor.lastrowid
            logger.info(f"   ✅ 创建标签: 中文 (ID: {tag_id_zh})")

        # 创建"英文"标签
        cursor.execute("SELECT id FROM tags WHERE name = '英文'")
        tag_en = cursor.fetchone()
        if tag_en:
            tag_id_en = tag_en[0]
            logger.info(f"   ⏭️  标签已存在: 英文 (ID: {tag_id_en})")
        else:
            cursor.execute("""
                INSERT INTO tags (name, description, color, created_at, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """, ('英文', '英文期刊', 'green'))
            tag_id_en = cursor.lastrowid
            logger.info(f"   ✅ 创建标签: 英文 (ID: {tag_id_en})")

        # ============================
        # Step 2: 迁移language字段到标签
        # ============================
        logger.info("\n📋 Step 2: 迁移language字段到标签")

        # 查询所有期刊
        cursor.execute("SELECT id, name, language FROM journals")
        journals = cursor.fetchall()
        logger.info(f"   📊 发现 {len(journals)} 个期刊需要迁移")

        # 为每个期刊创建语言标签关联
        migration_count = 0
        for journal_id, journal_name, language in journals:
            # 确定标签ID
            if language == 'zh':
                tag_id = tag_id_zh
            elif language == 'en':
                tag_id = tag_id_en
            else:
                # 处理异常情况，默认为中文
                logger.warning(f"   ⚠️  期刊 {journal_name} (ID: {journal_id}) language值异常: '{language}'，默认设为中文")
                tag_id = tag_id_zh

            # 检查关联是否已存在
            cursor.execute("""
                SELECT 1 FROM journal_tags
                WHERE journal_id = ? AND tag_id = ?
            """, (journal_id, tag_id))

            if not cursor.fetchone():
                cursor.execute("""
                    INSERT INTO journal_tags (journal_id, tag_id, created_at)
                    VALUES (?, ?, CURRENT_TIMESTAMP)
                """, (journal_id, tag_id))
                migration_count += 1

        logger.info(f"   ✅ 成功创建 {migration_count} 个期刊-语言标签关联")

        # ============================
        # Step 3: 重建journals表（删除language字段）
        # ============================
        logger.info("\n📋 Step 3: 重建journals表（删除language字段）")

        # 读取现有数据（排除language字段）
        cursor.execute("""
            SELECT id, name, notes, created_at, updated_at
            FROM journals
        """)
        journals_data = cursor.fetchall()
        logger.info(f"   📊 读取到 {len(journals_data)} 条期刊数据")

        # 备份旧表
        cursor.execute("DROP TABLE IF EXISTS journals_old")
        cursor.execute("ALTER TABLE journals RENAME TO journals_old")
        logger.info("   ✅ 备份旧表为 journals_old")

        # 创建新表（不含language字段）
        cursor.execute("""
            CREATE TABLE journals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        logger.info("   ✅ 创建新表: journals（不含language字段）")

        # 创建索引
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_journal_name ON journals(name)")
        logger.info("   ✅ 创建索引")

        # 迁移数据
        for row in journals_data:
            cursor.execute("""
                INSERT INTO journals (id, name, notes, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
            """, row)
        logger.info(f"   ✅ 迁移 {len(journals_data)} 条数据到新表")

        # 重建journal_tags表（修复外键引用）
        logger.info("   🔧 重建 journal_tags 表以修复外键引用...")

        # 读取现有的journal_tags数据
        cursor.execute("SELECT journal_id, tag_id, created_at FROM journal_tags")
        journal_tags_data = cursor.fetchall()
        logger.info(f"   📊 读取到 {len(journal_tags_data)} 条journal_tags关联数据")

        # 删除旧的journal_tags表
        cursor.execute("DROP TABLE IF EXISTS journal_tags")

        # 重新创建journal_tags表（正确的外键引用）
        cursor.execute("""
            CREATE TABLE journal_tags (
                journal_id INTEGER NOT NULL,
                tag_id INTEGER NOT NULL,
                created_at DATETIME,
                PRIMARY KEY (journal_id, tag_id),
                FOREIGN KEY(journal_id) REFERENCES journals (id) ON DELETE CASCADE,
                FOREIGN KEY(tag_id) REFERENCES tags (id) ON DELETE CASCADE
            )
        """)
        logger.info("   ✅ 重建 journal_tags 表（外键指向journals）")

        # 迁移journal_tags数据
        for row in journal_tags_data:
            cursor.execute("""
                INSERT INTO journal_tags (journal_id, tag_id, created_at)
                VALUES (?, ?, ?)
            """, row)
        logger.info(f"   ✅ 迁移 {len(journal_tags_data)} 条journal_tags数据")

        # 删除旧表
        cursor.execute("DROP TABLE IF EXISTS journals_old")
        logger.info("   ✅ 删除旧表 journals_old")

        # ============================
        # Step 4: 验证迁移结果
        # ============================
        logger.info("\n📋 Step 4: 验证迁移结果")

        # 验证journals表字段
        journals_columns = get_table_columns(cursor, 'journals')
        required_fields = ['id', 'name', 'notes', 'created_at', 'updated_at']
        removed_fields = ['language']

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

        # 验证语言标签关联数量
        cursor.execute("""
            SELECT COUNT(*) FROM journal_tags jt
            JOIN tags t ON jt.tag_id = t.id
            WHERE t.name IN ('中文', '英文')
        """)
        language_tag_count = cursor.fetchone()[0]
        logger.info(f"   ✅ 语言标签关联: {language_tag_count} 条记录")

        # 验证每个期刊都有语言标签
        cursor.execute("""
            SELECT COUNT(*) FROM journals j
            WHERE NOT EXISTS (
                SELECT 1 FROM journal_tags jt
                JOIN tags t ON jt.tag_id = t.id
                WHERE jt.journal_id = j.id AND t.name IN ('中文', '英文')
            )
        """)
        journals_without_language = cursor.fetchone()[0]
        if journals_without_language > 0:
            logger.error(f"   ❌ 发现 {journals_without_language} 个期刊没有语言标签！")
            all_fields_ok = False
        else:
            logger.info(f"   ✅ 所有期刊都有语言标签")

        # 验证没有期刊有多个语言标签
        cursor.execute("""
            SELECT journal_id, COUNT(*) as count FROM journal_tags jt
            JOIN tags t ON jt.tag_id = t.id
            WHERE t.name IN ('中文', '英文')
            GROUP BY journal_id
            HAVING COUNT(*) > 1
        """)
        journals_with_multiple_languages = cursor.fetchall()
        if journals_with_multiple_languages:
            logger.error(f"   ❌ 发现 {len(journals_with_multiple_languages)} 个期刊有多个语言标签！")
            all_fields_ok = False
        else:
            logger.info(f"   ✅ 没有期刊有多个语言标签")

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
        logger.info("🎉 v3.1 语言字段迁移完成！")
        logger.info(f"✅ 创建语言标签: 中文(ID:{tag_id_zh}), 英文(ID:{tag_id_en})")
        logger.info(f"✅ 迁移语言关联: {language_tag_count} 条")
        logger.info(f"✅ 删除字段: language")
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
