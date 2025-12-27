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

# 迁移版本号 - 删除Idea发掘与AI配置相关表
MIGRATION_VERSION = "v1.39_remove_idea_discovery_and_prompts"

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
        # 🔧 v1.39迁移任务：删除Idea发掘与AI配置相关表
        # 变更：删除prompts表，保留ideas表
        # 说明：
        # - 删除prompts表及其所有数据
        # - 保留ideas表和Ideas管理功能
        # - 保留Idea转化为项目功能
        # ===========================================

        logger.info("🔧 开始v1.39迁移：删除Idea发掘与AI配置相关表...")
        logger.info("🎯 目标：删除prompts表，保留ideas表和所有其他功能")

        # 第一步：检查prompts表是否存在
        logger.info("📋 检查prompts表...")

        if table_exists(cursor, 'prompts'):
            # 统计数据
            cursor.execute("SELECT COUNT(*) FROM prompts")
            prompt_count = cursor.fetchone()[0]
            logger.info(f"📊 prompts表中有 {prompt_count} 条记录")

            # 删除prompts表
            logger.info("🗑️ 删除prompts表...")
            cursor.execute("DROP TABLE IF EXISTS prompts")
            logger.info("✅ prompts表删除成功")
        else:
            logger.info("ℹ️ prompts表不存在，跳过删除")

        # 第二步：确认ideas表仍然存在（安全检查）
        logger.info("🔍 确认ideas表完整性...")
        if table_exists(cursor, 'ideas'):
            cursor.execute("SELECT COUNT(*) FROM ideas")
            idea_count = cursor.fetchone()[0]
            logger.info(f"✅ ideas表完好，包含 {idea_count} 条记录")
        else:
            logger.error("❌ 错误：ideas表不存在！")
            conn.rollback()
            conn.close()
            return False

        # 第三步：验证其他核心表
        logger.info("🔍 验证核心表完整性...")
        required_tables = ['research_projects', 'collaborators', 'audit_logs']
        for table in required_tables:
            if not table_exists(cursor, table):
                logger.error(f"❌ 错误：{table}表不存在！")
                conn.rollback()
                conn.close()
                return False
        logger.info("✅ 所有核心表完好")

        # 提交更改并标记完成
        conn.commit()
        mark_migration_completed(db_path)

        logger.info(f"迁移 {MIGRATION_VERSION} 执行成功")

        logger.info("======================================================================")
        logger.info("🎉 v1.39 删除Idea发掘与AI配置完成！")
        logger.info("✅ prompts表已删除")
        logger.info("✅ ideas表和Ideas管理功能保持完好")
        logger.info("✅ 研究项目管理功能不受影响")
        logger.info("✅ 合作者管理功能不受影响")
        logger.info("======================================================================")
        
        
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