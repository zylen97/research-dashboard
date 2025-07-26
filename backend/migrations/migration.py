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

# 迁移版本号 - 为research_projects添加research_method和source字段
MIGRATION_VERSION = "v1.30_add_research_method_source"

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
        # 🔧 v1.30迁移任务：为Ideas到Projects转化功能添加新字段
        # 用户需求：实现Ideas到Projects的转化功能 - 2025-07-26
        # ===========================================
        
        logger.info("🔧 开始v1.30迁移：为research_projects表添加新字段...")
        logger.info("🎯 目标：添加research_method和source字段，支持Ideas转化")
        
        # 第一步：检查research_projects表结构
        logger.info("📋 检查research_projects表当前结构...")
        
        # 获取当前列信息
        cursor.execute("PRAGMA table_info(research_projects)")
        columns = cursor.fetchall()
        column_names = [col[1] for col in columns]
        logger.info(f"当前列: {', '.join(column_names)}")
        
        # 第二步：添加research_method字段（如果不存在）
        if 'research_method' not in column_names:
            logger.info("📋 添加research_method字段...")
            cursor.execute("""
                ALTER TABLE research_projects 
                ADD COLUMN research_method TEXT
            """)
            logger.info("✅ research_method字段添加成功")
        else:
            logger.info("ℹ️ research_method字段已存在，跳过")
        
        # 第三步：添加source字段（如果不存在）
        if 'source' not in column_names:
            logger.info("📋 添加source字段...")
            cursor.execute("""
                ALTER TABLE research_projects 
                ADD COLUMN source TEXT
            """)
            logger.info("✅ source字段添加成功")
        else:
            logger.info("ℹ️ source字段已存在，跳过")
        
        # 第四步：验证字段添加
        logger.info("🔍 验证字段添加结果...")
        cursor.execute("PRAGMA table_info(research_projects)")
        columns = cursor.fetchall()
        column_names = [col[1] for col in columns]
        
        if 'research_method' in column_names and 'source' in column_names:
            logger.info("✅ 所有字段添加成功")
            logger.info(f"✅ research_projects表当前列: {', '.join(column_names)}")
        else:
            logger.error("❌ 字段添加失败")
            raise Exception("字段添加失败")
        
        # 第五步：检查ideas表结构，为后续转化做准备
        logger.info("📋 检查ideas表结构...")
        cursor.execute("PRAGMA table_info(ideas)")
        ideas_columns = cursor.fetchall()
        ideas_column_names = [col[1] for col in ideas_columns]
        logger.info(f"✅ ideas表当前列: {', '.join(ideas_column_names)}")
        
        # 提交更改并标记完成
        conn.commit()
        mark_migration_completed(db_path)
        
        logger.info(f"迁移 {MIGRATION_VERSION} 执行成功")
        
        logger.info("=" * 70)
        logger.info("🎉 v1.30 Ideas转化功能数据库准备完成！")
        logger.info("✅ research_projects表新增research_method字段")
        logger.info("✅ research_projects表新增source字段")
        logger.info("✅ 数据库已准备好支持Ideas到Projects的转化")
        logger.info("✅ 保持向后兼容，新字段允许为空")
        logger.info("🚀 可以开始实现转化功能了")
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