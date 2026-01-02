#!/usr/bin/env python3
"""
清理期刊大小写重复迁移脚本
- 删除全大写名称的重复期刊（无论文引用）
- 这些重复是由于批量导入API未使用 to_title_case() 导致的
- 批量导入API已在 journals.py 中修复
"""

import sqlite3
import sys
import os
import logging

# 修复模块路径问题
sys.path.insert(0, os.path.dirname(__file__))

# 导入迁移工具
from migration_utils import setup_migration_logging, find_database_path, backup_database

logger = setup_migration_logging()

# 迁移版本号
MIGRATION_VERSION = "v3.8_cleanup_duplicate_journals"

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

def get_duplicate_journals(cursor):
    """查找大小写重复的期刊"""
    cursor.execute("""
        WITH lower_name_groups AS (
          SELECT
            id,
            name,
            LOWER(name) AS lower_name,
            COUNT(*) OVER (PARTITION BY LOWER(name)) AS count
          FROM journals
          ORDER BY LOWER(name), name
        )
        SELECT
          lower_name,
          GROUP_CONCAT(name, ' | ') AS duplicate_names,
          GROUP_CONCAT(id, ', ') AS ids,
          COUNT(*) AS duplicate_count
        FROM lower_name_groups
        GROUP BY lower_name
        HAVING COUNT(*) > 1
        ORDER BY duplicate_count DESC, lower_name
    """)
    return cursor.fetchall()

def check_journal_references(cursor, journal_ids):
    """检查期刊是否被论文引用"""
    placeholders = ','.join('?' for _ in journal_ids)
    cursor.execute(f"""
        SELECT
          j.id,
          j.name,
          COUNT(p.id) AS paper_count
        FROM journals j
        LEFT JOIN papers p ON p.journal_id = j.id
        WHERE j.id IN ({placeholders})
        GROUP BY j.id, j.name
        ORDER BY j.id
    """, journal_ids)
    return {row[0]: {"name": row[1], "paper_count": row[2]} for row in cursor.fetchall()}

def cleanup_duplicate_journals():
    """清理大小写重复的期刊"""
    db_path = find_database_path()
    logger.info(f"数据库路径: {db_path}")

    # 检查迁移是否已完成
    if check_if_migration_completed(db_path):
        logger.info(f"迁移 {MIGRATION_VERSION} 已执行过，跳过")
        return

    # 备份数据库
    backup_path = backup_database(db_path, MIGRATION_VERSION)
    logger.info(f"数据库已备份至: {backup_path}")

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # 1. 查找重复期刊
        logger.info("正在查找大小写重复的期刊...")
        duplicates = get_duplicate_journals(cursor)

        if not duplicates:
            logger.info("未发现重复期刊")
            conn.close()
            return

        logger.info(f"发现 {len(duplicates)} 对重复期刊:")
        for lower_name, dup_names, ids_str, count in duplicates:
            logger.info(f"  - {lower_name}: {dup_names} (IDs: {ids_str})")

        # 2. 检查每个重复期刊的引用情况
        all_journal_ids = []
        for _, _, ids_str, _ in duplicates:
            all_journal_ids.extend([int(id) for id in ids_str.split(', ')])

        references = check_journal_references(cursor, all_journal_ids)

        # 3. 确定要删除的期刊（全大写名称且无论文引用）
        journals_to_delete = []
        for journal_id, info in references.items():
            name = info["name"]
            paper_count = info["paper_count"]

            # 如果是全大写名称且无论文引用，可以安全删除
            if name.isupper() and paper_count == 0:
                journals_to_delete.append(journal_id)
                logger.info(f"  标记删除: ID {journal_id} - '{name}' (无论文引用)")
            elif name.isupper() and paper_count > 0:
                logger.warning(f"  警告: ID {journal_id} - '{name}' 是全大写但有 {paper_count} 篇论文引用，跳过")
            else:
                logger.info(f"  保留: ID {journal_id} - '{name}' ({paper_count} 篇论文)")

        if not journals_to_delete:
            logger.info("没有需要删除的期刊")
            conn.close()
            return

        # 4. 执行删除
        logger.info(f"即将删除 {len(journals_to_delete)} 个重复期刊...")
        placeholders = ','.join('?' for _ in journals_to_delete)
        cursor.execute(f"DELETE FROM journals WHERE id IN ({placeholders})", journals_to_delete)
        deleted_count = cursor.rowcount

        # 5. 记录迁移历史
        cursor.execute(
            "INSERT INTO migration_history (version) VALUES (?)",
            (MIGRATION_VERSION,)
        )

        conn.commit()
        conn.close()

        logger.info(f"✅ 迁移完成！删除了 {deleted_count} 个重复期刊")
        logger.info(f"被删除的期刊ID: {journals_to_delete}")

    except Exception as e:
        logger.error(f"迁移失败: {e}")
        logger.info(f"如需恢复，请使用备份: {backup_path}")
        raise

if __name__ == "__main__":
    cleanup_duplicate_journals()
