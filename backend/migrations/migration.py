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

# 迁移版本号 - 创建简化版ideas表
MIGRATION_VERSION = "v1.27_create_simple_ideas"

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
        # 🔧 v1.27迁移任务：创建简化版ideas管理表
        # 用户需求：简化ideas管理，负责人改为文本输入 - 2025-07-25
        # ===========================================
        
        logger.info("🔧 开始v1.27迁移：创建简化版ideas管理表...")
        logger.info("🎯 目标：创建独立的simple_ideas表，不与其他表关联")
        
        # 第一步：创建simple_ideas表
        logger.info("📋 创建simple_ideas表...")
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS simple_ideas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                research_question TEXT NOT NULL,
                research_method TEXT NOT NULL,
                source_journal TEXT NOT NULL,
                source_literature TEXT NOT NULL,
                responsible_person TEXT NOT NULL,
                maturity TEXT DEFAULT 'immature' CHECK(maturity IN ('mature', 'immature')),
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        logger.info("✅ simple_ideas表创建成功")
        
        # 第二步：创建更新时间触发器
        logger.info("📋 创建更新时间触发器...")
        
        cursor.execute("""
            CREATE TRIGGER IF NOT EXISTS update_simple_ideas_timestamp 
            AFTER UPDATE ON simple_ideas
            FOR EACH ROW
            BEGIN
                UPDATE simple_ideas SET updated_at = CURRENT_TIMESTAMP 
                WHERE id = NEW.id;
            END
        """)
        
        logger.info("✅ 触发器创建成功")
        
        # 第三步：从旧的ideas表迁移数据（如果存在）
        logger.info("🔍 检查是否需要迁移旧数据...")
        
        if table_exists(cursor, 'ideas'):
            cursor.execute("""
                SELECT COUNT(*) FROM ideas
            """)
            old_count = cursor.fetchone()[0]
            
            if old_count > 0:
                logger.info(f"📝 发现 {old_count} 条旧数据，开始迁移...")
                
                cursor.execute("""
                    INSERT INTO simple_ideas 
                    (research_question, research_method, source_journal, 
                     source_literature, responsible_person, maturity, 
                     description, created_at, updated_at)
                    SELECT 
                        i.research_question,
                        i.research_method,
                        i.source_journal,
                        i.source_literature,
                        COALESCE(c.name, '未分配') as responsible_person,
                        i.maturity,
                        i.description,
                        i.created_at,
                        i.updated_at
                    FROM ideas i
                    LEFT JOIN collaborators c ON i.collaborator_id = c.id
                """)
                
                logger.info(f"✅ 成功迁移 {old_count} 条数据")
            else:
                logger.info("ℹ️ 旧表没有数据，跳过迁移")
        else:
            logger.info("ℹ️ 没有找到旧的ideas表，跳过迁移")
        
        # 第四步：验证迁移结果
        logger.info("🔍 验证迁移结果...")
        cursor.execute("SELECT COUNT(*) FROM simple_ideas")
        count = cursor.fetchone()[0]
        logger.info(f"✅ simple_ideas表中有 {count} 条记录")
        
        # 提交更改并标记完成
        conn.commit()
        mark_migration_completed(db_path)
        
        logger.info(f"迁移 {MIGRATION_VERSION} 执行成功")
        
        logger.info("=" * 70)
        logger.info("🎉 v1.27 简化版ideas管理表创建完成！")
        logger.info("✅ 创建了simple_ideas表")
        logger.info("✅ 负责人改为文本字段")
        logger.info("✅ 成熟度只有成熟/不成熟两个选项")
        logger.info("✅ 完全独立，不依赖其他表")
        logger.info("🚀 Ideas管理更加简单直观")
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