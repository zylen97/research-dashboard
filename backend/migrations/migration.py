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

# 迁移版本号 - 拆分source字段
MIGRATION_VERSION = "v2.7_split_source_field"


# ============================
# 数据拆分算法
# ============================
def split_source_field(source_text):
    """
    拆分来源字段为（参考论文，参考期刊）

    规则：
    1. 查找书名号《》内的内容作为期刊
    2. 查找中文逗号，前面的内容作为论文
    3. 如果没有逗号，整个文本作为论文
    4. 如果格式不规范（太短），返回(None, None)保留原source

    示例：
    - "论文标题，《期刊》" -> ("论文标题", "期刊")
    - "只有论文标题" -> ("只有论文标题", None)
    - "123" -> (None, None)  # 不规范，保留原source
    - "" -> (None, None)

    Args:
        source_text: 原始来源文本

    Returns:
        (paper, journal): 参考论文和参考期刊的元组
    """
    if not source_text or not isinstance(source_text, str):
        return (None, None)

    source_text = source_text.strip()

    # 如果太短（如"123"），认为不规范
    if len(source_text) < 5:
        return (None, None)

    # 查找期刊（书名号内的内容）
    journal_match = re.search(r'《([^》]+)》', source_text)
    journal = journal_match.group(1).strip() if journal_match else None

    # 查找论文（中文逗号前的内容）
    if '，' in source_text:
        # 分割并取逗号前的部分
        parts = source_text.split('，', 1)
        paper = parts[0].strip()

        # 如果逗号前面是空的，不规范
        if not paper:
            return (None, None)
    elif ',' in source_text:
        # 也支持英文逗号
        parts = source_text.split(',', 1)
        paper = parts[0].strip()
        if not paper:
            return (None, None)
    else:
        # 没有逗号，整个文本作为论文标题
        # 但如果有书名号，去掉书名号部分
        if journal_match:
            paper = source_text.replace(journal_match.group(0), '').strip()
        else:
            paper = source_text

    # 验证：至少要有论文或期刊之一
    if not paper and not journal:
        return (None, None)

    return (paper or None, journal or None)

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
        logger.info("🎯 目标: 拆分source字段为reference_paper和reference_journal")
        logger.info("=" * 70)

        # ===========================================
        # 🔧 v2.7迁移任务：拆分source字段
        # 变更：
        # 1. Ideas表和ResearchProject表都添加新字段：
        #    - reference_paper TEXT NULL
        #    - reference_journal TEXT NULL
        # 2. 迁移现有source数据到新字段
        # 3. 保留source字段（向后兼容）
        # ===========================================

        # ============================
        # Step 1: 添加新字段到Ideas表
        # ============================
        logger.info("\n📋 Step 1: 为Ideas表添加新字段")

        ideas_columns = get_table_columns(cursor, 'ideas')

        if 'reference_paper' not in ideas_columns:
            cursor.execute("ALTER TABLE ideas ADD COLUMN reference_paper TEXT")
            logger.info("   ✅ 添加字段: reference_paper")
        else:
            logger.info("   ⏭️  字段已存在: reference_paper")

        if 'reference_journal' not in ideas_columns:
            cursor.execute("ALTER TABLE ideas ADD COLUMN reference_journal TEXT")
            logger.info("   ✅ 添加字段: reference_journal")
        else:
            logger.info("   ⏭️  字段已存在: reference_journal")

        # ============================
        # Step 2: 添加新字段到ResearchProject表
        # ============================
        logger.info("\n📋 Step 2: 为ResearchProject表添加新字段")

        projects_columns = get_table_columns(cursor, 'research_projects')

        if 'reference_paper' not in projects_columns:
            cursor.execute("ALTER TABLE research_projects ADD COLUMN reference_paper TEXT")
            logger.info("   ✅ 添加字段: reference_paper")
        else:
            logger.info("   ⏭️  字段已存在: reference_paper")

        if 'reference_journal' not in projects_columns:
            cursor.execute("ALTER TABLE research_projects ADD COLUMN reference_journal TEXT")
            logger.info("   ✅ 添加字段: reference_journal")
        else:
            logger.info("   ⏭️  字段已存在: reference_journal")

        # ============================
        # Step 3: 迁移Ideas表数据
        # ============================
        logger.info("\n📋 Step 3: 迁移Ideas表source数据")

        cursor.execute("SELECT id, source FROM ideas WHERE source IS NOT NULL AND source != ''")
        ideas_rows = cursor.fetchall()

        logger.info(f"   发现 {len(ideas_rows)} 条有source数据的记录")

        success_count = 0
        failed_count = 0

        for row in ideas_rows:
            idea_id, source_text = row
            paper, journal = split_source_field(source_text)

            if paper is not None or journal is not None:
                # 拆分成功
                cursor.execute("""
                    UPDATE ideas
                    SET reference_paper = ?, reference_journal = ?
                    WHERE id = ?
                """, (paper, journal, idea_id))
                paper_preview = (paper[:30] + '...') if paper and len(paper) > 30 else paper
                logger.info(f"   ✅ [ID={idea_id}] 拆分成功: paper='{paper_preview}', journal='{journal}'")
                success_count += 1
            else:
                # 拆分失败，保留原source
                logger.warning(f"   ⚠️  [ID={idea_id}] 拆分失败，保留原source: '{source_text}'")
                failed_count += 1

        logger.info(f"   Ideas表迁移完成: 成功={success_count}, 失败={failed_count}")

        # ============================
        # Step 4: 迁移ResearchProject表数据
        # ============================
        logger.info("\n📋 Step 4: 迁移ResearchProject表source数据")

        cursor.execute("SELECT id, source FROM research_projects WHERE source IS NOT NULL AND source != ''")
        project_rows = cursor.fetchall()

        logger.info(f"   发现 {len(project_rows)} 条有source数据的记录")

        success_count = 0
        failed_count = 0

        for row in project_rows:
            project_id, source_text = row
            paper, journal = split_source_field(source_text)

            if paper is not None or journal is not None:
                cursor.execute("""
                    UPDATE research_projects
                    SET reference_paper = ?, reference_journal = ?
                    WHERE id = ?
                """, (paper, journal, project_id))
                paper_preview = (paper[:30] + '...') if paper and len(paper) > 30 else paper
                logger.info(f"   ✅ [ID={project_id}] 拆分成功: paper='{paper_preview}', journal='{journal}'")
                success_count += 1
            else:
                logger.warning(f"   ⚠️  [ID={project_id}] 拆分失败，保留原source: '{source_text}'")
                failed_count += 1

        logger.info(f"   ResearchProject表迁移完成: 成功={success_count}, 失败={failed_count}")

        # ============================
        # Step 5: 验证迁移结果
        # ============================
        logger.info("\n📋 Step 5: 验证迁移结果")

        # 验证字段
        ideas_columns_new = get_table_columns(cursor, 'ideas')
        projects_columns_new = get_table_columns(cursor, 'research_projects')

        required_fields = ['source', 'reference_paper', 'reference_journal']

        for field in required_fields:
            if field in ideas_columns_new:
                logger.info(f"   ✅ Ideas表.{field} 存在")
            else:
                logger.error(f"   ❌ Ideas表.{field} 缺失！")
                conn.rollback()
                return False

            if field in projects_columns_new:
                logger.info(f"   ✅ ResearchProject表.{field} 存在")
            else:
                logger.error(f"   ❌ ResearchProject表.{field} 缺失！")
                conn.rollback()
                return False

        # 提交事务
        conn.commit()
        mark_migration_completed(db_path)

        logger.info("\n" + "=" * 70)
        logger.info("🎉 v2.7 Source字段拆分完成！")
        logger.info("✅ 新增字段: reference_paper, reference_journal")
        logger.info("✅ 保留字段: source (向后兼容)")
        logger.info("✅ 数据迁移: 规范数据已拆分，不规范数据保留在source")
        logger.info("⚠️  重要: 前端需要更新为使用新字段")
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
