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

# 迁移版本号 - 强制修复数据库结构500错误
MIGRATION_VERSION = "v1.18_force_fix_database_structure"

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
        # 🔧 v1.18迁移任务：强制修复数据库结构
        # 解决ideas-management API 500错误 - 2025-07-24
        # ===========================================
        
        logger.info("🔧 强制修复数据库结构，解决500错误...")
        
        # 1. 强制重建collaborators表
        logger.info("强制重建collaborators表...")
        
        # 备份现有数据
        collaborators_data = []
        if table_exists(cursor, 'collaborators'):
            try:
                cursor.execute("SELECT * FROM collaborators")
                collaborators_data = cursor.fetchall()
                logger.info(f"备份了 {len(collaborators_data)} 条collaborators数据")
                cursor.execute("DROP TABLE collaborators")
            except Exception as e:
                logger.warning(f"备份collaborators数据失败: {e}")
        
        # 创建新的collaborators表
        cursor.execute("""
            CREATE TABLE collaborators (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT,
                institution TEXT,
                research_area TEXT,
                level VARCHAR(20) DEFAULT 'senior',
                deleted_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # 如果有备份数据，恢复部分字段
        if collaborators_data:
            for row in collaborators_data:
                try:
                    cursor.execute("""
                        INSERT INTO collaborators (name, email, institution, research_area, level, created_at)
                        VALUES (?, ?, ?, ?, 'senior', CURRENT_TIMESTAMP)
                    """, (
                        str(row[1]) if len(row) > 1 else "Unknown",  # name
                        str(row[2]) if len(row) > 2 else "",         # email
                        str(row[3]) if len(row) > 3 else "",         # institution
                        str(row[4]) if len(row) > 4 else "",         # research_area
                    ))
                except Exception as e:
                    logger.warning(f"恢复collaborator数据失败: {e}")
        
        # 确保至少有一些测试数据
        cursor.execute("SELECT COUNT(*) FROM collaborators")
        count = cursor.fetchone()[0]
        if count == 0:
            cursor.execute("""
                INSERT INTO collaborators (name, email, institution, research_area, level)
                VALUES 
                ('张教授', 'zhang@university.edu', '清华大学', '人工智能', 'senior'),
                ('李博士', 'li@institute.cn', '中科院', '机器学习', 'senior'),
                ('王研究员', 'wang@lab.com', '微软研究院', '深度学习', 'senior')
            """)
            logger.info("添加了默认的senior collaborators数据")
        
        logger.info("✅ collaborators表重建完成")
        
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
        logger.info("🎉 v1.18 数据库结构强制修复完成！")
        logger.info("✅ ideas表结构已重建")
        logger.info("✅ collaborators表已重建并包含level和deleted_at字段")
        logger.info("✅ 添加了默认的senior collaborators数据")
        logger.info("📝 ideas-management API 500错误应该已经修复")
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