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

# 迁移版本号 - 添加Ideas管理功能  
MIGRATION_VERSION = "v1.13_add_ideas_management"

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
        # 🔧 v1.13迁移任务：添加Ideas管理功能
        # ===========================================
        
        logger.info("开始添加Ideas管理功能...")
        
        # 步骤1：处理ideas表
        if table_exists(cursor, 'ideas'):
            logger.info("发现旧的ideas表，准备重建...")
            
            # 备份旧数据（如果需要的话）
            cursor.execute("SELECT COUNT(*) FROM ideas")
            old_ideas_count = cursor.fetchone()[0]
            logger.info(f"旧ideas表包含 {old_ideas_count} 条记录")
            
            # 删除旧表
            cursor.execute("DROP TABLE ideas")
            logger.info("✅ 旧ideas表已删除")
        
        logger.info("创建新的ideas表...")
        
        cursor.execute("""
            CREATE TABLE ideas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                research_question TEXT NOT NULL,
                research_method TEXT,
                source_literature TEXT,
                importance INTEGER DEFAULT 3 CHECK(importance >= 1 AND importance <= 5),
                description TEXT,
                collaborator_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (collaborator_id) REFERENCES collaborators(id)
            )
        """)
        
        # 创建索引以优化查询
        cursor.execute("CREATE INDEX idx_ideas_importance ON ideas(importance)")
        cursor.execute("CREATE INDEX idx_ideas_collaborator ON ideas(collaborator_id)")
        cursor.execute("CREATE INDEX idx_ideas_created ON ideas(created_at)")
        
        logger.info("✅ 新ideas表创建成功")
        
        # 步骤2：验证表结构
        logger.info("验证ideas表结构...")
        
        ideas_columns = get_table_columns(cursor, 'ideas')
        expected_columns = [
            'id', 'research_question', 'research_method', 'source_literature', 
            'importance', 'description', 'collaborator_id', 'created_at', 'updated_at'
        ]
        
        missing_columns = []
        for col in expected_columns:
            if col not in ideas_columns:
                missing_columns.append(col)
        
        if missing_columns:
            logger.error(f"❌ ideas表缺少必要列: {missing_columns}")
            raise Exception(f"数据库结构验证失败，缺少列: {missing_columns}")
        else:
            logger.info("✅ ideas表结构验证成功")
        
        # 步骤3：验证外键约束
        logger.info("验证外键约束...")
        if table_exists(cursor, 'collaborators'):
            logger.info("✅ collaborators表存在，外键约束有效")
        else:
            logger.warning("⚠️ collaborators表不存在，外键约束可能无效")
        
        # 提交更改
        conn.commit()
        conn.close()
        
        # 标记迁移完成
        mark_migration_completed(db_path)
        
        logger.info(f"迁移 {MIGRATION_VERSION} 执行成功")
        
        # 输出迁移结果统计
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 安全地获取表数据统计
        project_count = 0
        collaborator_count = 0
        user_count = 0
        ideas_count = 0
        
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
            
        try:
            cursor.execute("SELECT COUNT(*) FROM ideas")
            ideas_count = cursor.fetchone()[0]
        except:
            pass
        
        # 验证ideas表是否成功创建
        ideas_table_created = table_exists(cursor, 'ideas')
        
        conn.close()
        
        logger.info("=" * 60)
        logger.info("🎉 Ideas管理功能添加完成！")
        logger.info(f"📊 系统数据统计:")
        logger.info(f"   - 用户: {user_count}")
        logger.info(f"   - 项目: {project_count}")
        logger.info(f"   - 合作者: {collaborator_count}")
        logger.info(f"   - Ideas: {ideas_count}")
        
        if ideas_table_created:
            logger.info("✅ ideas表创建成功")
        else:
            logger.error("❌ ideas表创建失败")
        
        logger.info("✅ Ideas管理功能已成功添加")
        logger.info("✅ 用户现在可以创建和管理研究想法")
        logger.info("✅ 支持重要性评级和负责人分配")
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