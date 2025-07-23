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

# 迁移版本号 - 删除文献管理功能  
MIGRATION_VERSION = "v1.12_remove_literature_system"

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
        # 🔧 v1.12迁移任务：删除文献管理功能
        # ===========================================
        
        logger.info("开始删除文献管理功能...")
        
        # 步骤1：删除literature表
        if table_exists(cursor, 'literature'):
            logger.info("发现literature表，准备删除...")
            
            # 先获取文献数据统计
            cursor.execute("SELECT COUNT(*) FROM literature")
            literature_count = cursor.fetchone()[0]
            
            # 删除literature表
            cursor.execute("DROP TABLE IF EXISTS literature")
            logger.info(f"✅ literature表删除成功 (包含{literature_count}条记录)")
        else:
            logger.info("literature表不存在，跳过删除")
        
        # 步骤2：删除literature_folders表
        if table_exists(cursor, 'literature_folders'):
            logger.info("发现literature_folders表，准备删除...")
            
            # 先获取文件夹数据统计
            cursor.execute("SELECT COUNT(*) FROM literature_folders")
            folder_count = cursor.fetchone()[0]
            
            # 删除literature_folders表
            cursor.execute("DROP TABLE IF EXISTS literature_folders")
            logger.info(f"✅ literature_folders表删除成功 (包含{folder_count}条记录)")
        else:
            logger.info("literature_folders表不存在，跳过删除")
        
        # 步骤3：清理其他文献相关数据（如果有的话）
        logger.info("清理其他可能的文献相关数据...")
        
        # 删除可能存在的文献相关索引（SQLite会自动删除表时删除索引，这里只是确保）
        logger.info("✅ 所有文献相关的索引已随表删除")
        
        # 步骤4：验证清理结果
        remaining_literature_tables = []
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%literature%'")
        results = cursor.fetchall()
        for (table_name,) in results:
            remaining_literature_tables.append(table_name)
        
        if remaining_literature_tables:
            logger.warning(f"⚠️ 发现残留的文献相关表: {remaining_literature_tables}")
        else:
            logger.info("✅ 所有文献相关表已成功删除")
        
        # 提交更改
        conn.commit()
        conn.close()
        
        # 标记迁移完成
        mark_migration_completed(db_path)
        
        logger.info(f"迁移 {MIGRATION_VERSION} 执行成功")
        
        # 输出迁移结果统计
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 安全地获取表数据
        project_count = 0
        collaborator_count = 0
        user_count = 0
        
        try:
            cursor.execute("SELECT COUNT(*) FROM research_projects")
            project_count = cursor.fetchone()[0]
        except:
            pass
            
        try:
            cursor.execute("SELECT COUNT(*) FROM collaborators")
            collaborator_count = cursor.fetchone()[0]
        except:
            pass
            
        try:
            cursor.execute("SELECT COUNT(*) FROM users")
            user_count = cursor.fetchone()[0]
        except:
            pass
        
        # 验证文献相关表确实被删除
        remaining_tables = []
        try:
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND (name = 'literature' OR name = 'literature_folders')")
            remaining_tables = [row[0] for row in cursor.fetchall()]
        except:
            pass
        
        conn.close()
        
        logger.info("=" * 60)
        logger.info("🎉 文献管理功能删除完成！")
        logger.info(f"📊 系统数据统计:")
        logger.info(f"   - 用户: {user_count}")
        logger.info(f"   - 项目: {project_count}")
        logger.info(f"   - 合作者: {collaborator_count}")
        
        if remaining_tables:
            logger.warning(f"⚠️ 发现未删除的文献相关表: {remaining_tables}")
        else:
            logger.info("✅ 所有文献相关表已成功删除")
        
        logger.info("✅ 文献管理功能已完全移除")
        logger.info("✅ 系统现专注于Idea管理和发掘功能")
        logger.info("✅ 数据库结构已优化，减少了存储开销")
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