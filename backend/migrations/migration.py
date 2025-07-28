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

# 迁移版本号 - 添加目标投稿期刊字段
MIGRATION_VERSION = "v1.38_add_target_journal"

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
        # 🔧 v1.38迁移任务：添加目标投稿期刊字段
        # 变更：为研究项目添加目标投稿期刊字段
        # 说明：
        # - 新增target_journal字段存储期刊信息
        # - 支持在创建和编辑时填写
        # - 仅在预览中显示，不在列表中显示
        # ===========================================
        
        logger.info("🔧 开始v1.38迁移：添加目标投稿期刊字段...")
        logger.info("🎯 目标：为研究项目添加(拟)投稿期刊信息")
        
        # 第一步：检查research_projects表
        logger.info("📋 检查research_projects表...")
        
        if table_exists(cursor, 'research_projects'):
            # 检查是否已有target_journal字段
            cursor.execute("PRAGMA table_info(research_projects)")
            columns = cursor.fetchall()
            has_target_journal = False
            
            for col in columns:
                if col[1] == 'target_journal':
                    has_target_journal = True
                    logger.info(f"✅ target_journal字段已存在，类型: {col[2]}")
                    break
            
            if not has_target_journal:
                # 添加target_journal字段
                logger.info("📋 添加target_journal字段...")
                cursor.execute("""
                    ALTER TABLE research_projects 
                    ADD COLUMN target_journal TEXT
                """)
                logger.info("✅ target_journal字段添加成功")
                
                # 统计项目数量
                cursor.execute("SELECT COUNT(*) FROM research_projects")
                project_count = cursor.fetchone()[0]
                logger.info(f"📊 现有项目总数: {project_count}")
        else:
            logger.error("❌ research_projects表不存在")
            return False
        
        # 第二步：记录迁移说明
        logger.info("📋 功能更新说明:")
        logger.info("  - 添加(拟)投稿期刊字段")
        logger.info("  - 用户可在创建和编辑项目时填写目标期刊")
        logger.info("  - 期刊信息仅在预览页面显示")
        logger.info("  - 列表页面不显示期刊信息")
        
        # 提交更改并标记完成
        conn.commit()
        mark_migration_completed(db_path)
        
        logger.info(f"迁移 {MIGRATION_VERSION} 执行成功")
        
        logger.info("======================================================================")
        logger.info("🎉 v1.38 添加目标投稿期刊字段完成！")
        logger.info("✅ 成功添加target_journal字段")
        logger.info("✅ 支持填写(拟)投稿期刊信息")
        logger.info("✅ 数据库结构更新完成")
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