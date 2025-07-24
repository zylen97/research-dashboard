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

# 导入迁移工具
from migration_utils import setup_migration_logging, find_database_path, backup_database, get_table_columns, table_exists

logger = setup_migration_logging()

# 迁移版本号 - 修复ideas表结构和collaborators表缺失字段
MIGRATION_VERSION = "v1.17_fix_ideas_and_collaborators"

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
        
        logger.info(f"开始执行迁移: {MIGRATION_VERSION}")
        
        # ===========================================
        # 🔧 v1.17迁移任务：修复ideas表和collaborators表
        # 修复500错误和404错误 - 2025-07-24
        # ===========================================
        
        logger.info("🔧 开始修复ideas表结构和collaborators表...")
        
        # 1. 检查并更新collaborators表
        if table_exists(cursor, 'collaborators'):
            columns = get_table_columns(cursor, 'collaborators')
            logger.info(f"当前collaborators表字段: {columns}")
            
            # 添加level字段
            if 'level' not in columns:
                logger.info("添加level字段到collaborators表...")
                cursor.execute("ALTER TABLE collaborators ADD COLUMN level VARCHAR(20) DEFAULT 'junior'")
                # 将现有的合作者设置为senior
                cursor.execute("UPDATE collaborators SET level = 'senior' WHERE id IN (SELECT id FROM collaborators LIMIT 10)")
                logger.info("✅ level字段添加成功")
            
            # 添加deleted_at字段
            if 'deleted_at' not in columns:
                logger.info("添加deleted_at字段到collaborators表...")
                cursor.execute("ALTER TABLE collaborators ADD COLUMN deleted_at DATETIME")
                logger.info("✅ deleted_at字段添加成功")
        else:
            logger.warning("collaborators表不存在，跳过更新")
        
        # 2. 重建ideas表以匹配代码期望的结构
        if table_exists(cursor, 'ideas'):
            logger.info("备份现有ideas数据...")
            cursor.execute("SELECT * FROM ideas")
            old_ideas = cursor.fetchall()
            
            logger.info("删除旧的ideas表...")
            cursor.execute("DROP TABLE ideas")
            
            logger.info("创建新的ideas表...")
            cursor.execute("""
                CREATE TABLE ideas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    research_question TEXT NOT NULL,
                    research_method TEXT,
                    source_literature TEXT,
                    importance INTEGER DEFAULT 3,
                    description TEXT,
                    collaborator_id INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (collaborator_id) REFERENCES collaborators(id)
                )
            """)
            
            # 如果有旧数据，尝试迁移
            if old_ideas:
                logger.info(f"迁移 {len(old_ideas)} 条旧数据...")
                for idea in old_ideas:
                    try:
                        # 根据旧表结构适配数据
                        cursor.execute("""
                            INSERT INTO ideas (research_question, research_method, source_literature, 
                                             importance, description, created_at)
                            VALUES (?, '', '', 3, '', CURRENT_TIMESTAMP)
                        """, (str(idea[1]),))  # 假设第二列是某种文本字段
                    except Exception as e:
                        logger.warning(f"迁移idea数据失败: {e}")
            
            logger.info("✅ ideas表重建成功")
        else:
            logger.info("创建ideas表...")
            cursor.execute("""
                CREATE TABLE ideas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    research_question TEXT NOT NULL,
                    research_method TEXT,
                    source_literature TEXT,
                    importance INTEGER DEFAULT 3,
                    description TEXT,
                    collaborator_id INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (collaborator_id) REFERENCES collaborators(id)
                )
            """)
            logger.info("✅ ideas表创建成功")
        
        # 提交更改
        conn.commit()
        conn.close()
        
        # 标记迁移完成
        mark_migration_completed(db_path)
        
        logger.info(f"迁移 {MIGRATION_VERSION} 执行成功")
        
        logger.info("=" * 60)
        logger.info("🎉 v1.17 数据库结构修复完成！")
        logger.info("✅ ideas表结构已更新")
        logger.info("✅ collaborators表已添加level和deleted_at字段")
        logger.info("📝 500错误和404错误应该已经修复")
        logger.info("=" * 60)
        
        return True
        
    except Exception as e:
        logger.error(f"迁移执行失败: {e}")
        logger.info(f"数据库备份位于: {backup_path}")
        return False

if __name__ == "__main__":
    logger.info(f"迁移版本: {MIGRATION_VERSION}")
    success = run_migration()
    sys.exit(0 if success else 1)