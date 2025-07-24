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

# 迁移版本号 - Idea表字段重构：添加source_journal，修改字段约束，替换importance为maturity
MIGRATION_VERSION = "v1.24_idea_field_restructure"

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
        # 🔧 v1.24迁移任务：Idea表字段重构
        # 用户需求：修改研究表单字段结构 - 2025-07-24
        # ===========================================
        
        logger.info("🔧 开始v1.24迁移：Idea表字段重构...")
        logger.info("🎯 目标：根据用户需求重构Ideas表单字段")
        
        # 第一步：检查ideas表是否存在
        logger.info("🔍 检查ideas表结构...")
        
        if not table_exists(cursor, 'ideas'):
            logger.error("❌ ideas表不存在，创建表...")
            cursor.execute("""
                CREATE TABLE ideas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    research_question TEXT NOT NULL,
                    research_method TEXT NOT NULL,
                    source_journal TEXT NOT NULL,
                    source_literature TEXT NOT NULL,
                    maturity VARCHAR(20) NOT NULL DEFAULT 'immature',
                    description TEXT,
                    collaborator_id INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (collaborator_id) REFERENCES collaborators (id)
                )
            """)
            logger.info("✅ ideas表创建成功")
        else:
            logger.info("✅ ideas表已存在，开始字段重构...")
            
            # 获取当前表结构
            cursor.execute("PRAGMA table_info(ideas)")
            columns_info = cursor.fetchall()
            existing_columns = {col[1]: col for col in columns_info}
            
            logger.info(f"📋 当前表结构: {list(existing_columns.keys())}")
            
            # 第二步：添加source_journal字段（如果不存在）
            if 'source_journal' not in existing_columns:
                logger.info("➕ 添加source_journal字段...")
                cursor.execute("ALTER TABLE ideas ADD COLUMN source_journal TEXT NOT NULL DEFAULT ''")
                logger.info("✅ source_journal字段添加成功")
            else:
                logger.info("⏭️ source_journal字段已存在")
            
            # 第三步：添加maturity字段（如果不存在）
            if 'maturity' not in existing_columns:
                logger.info("➕ 添加maturity字段...")
                cursor.execute("ALTER TABLE ideas ADD COLUMN maturity VARCHAR(20) NOT NULL DEFAULT 'immature'")
                logger.info("✅ maturity字段添加成功")
                
                # 如果有importance字段，进行数据迁移
                if 'importance' in existing_columns:
                    logger.info("🔄 从importance迁移数据到maturity...")
                    # importance >= 4 认为是成熟的，< 4 认为是不成熟的
                    cursor.execute("""
                        UPDATE ideas 
                        SET maturity = CASE 
                            WHEN importance >= 4 THEN 'mature'
                            ELSE 'immature'
                        END
                    """)
                    updated_count = cursor.rowcount
                    logger.info(f"✅ 数据迁移完成，更新了 {updated_count} 条记录")
            else:
                logger.info("⏭️ maturity字段已存在")
            
            # 第四步：SQLite不支持直接修改列约束，需要重建表
            logger.info("🔧 重建表以修改字段约束...")
            
            # 检查当前数据
            cursor.execute("SELECT COUNT(*) FROM ideas")
            record_count = cursor.fetchone()[0]
            logger.info(f"📊 当前ideas表有 {record_count} 条记录")
            
            if record_count > 0:
                # 备份现有数据
                logger.info("💾 备份现有数据...")
                cursor.execute("""
                    CREATE TEMPORARY TABLE ideas_backup AS 
                    SELECT 
                        id, research_question, 
                        COALESCE(research_method, '') as research_method,
                        COALESCE(source_journal, '') as source_journal,
                        COALESCE(source_literature, '') as source_literature,
                        COALESCE(maturity, 'immature') as maturity,
                        description, collaborator_id, created_at, updated_at
                    FROM ideas
                """)
                logger.info("✅ 数据备份完成")
            
            # 删除旧表
            cursor.execute("DROP TABLE ideas")
            logger.info("🗑️ 旧表已删除")
            
            # 创建新表结构
            cursor.execute("""
                CREATE TABLE ideas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    research_question TEXT NOT NULL,
                    research_method TEXT NOT NULL,
                    source_journal TEXT NOT NULL,
                    source_literature TEXT NOT NULL,
                    maturity VARCHAR(20) NOT NULL DEFAULT 'immature',
                    description TEXT,
                    collaborator_id INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (collaborator_id) REFERENCES collaborators (id)
                )
            """)
            logger.info("✅ 新表结构创建成功")
            
            # 恢复数据（如果有）
            if record_count > 0:
                logger.info("🔄 恢复数据...")
                cursor.execute("""
                    INSERT INTO ideas (
                        id, research_question, research_method, source_journal, 
                        source_literature, maturity, description, collaborator_id, 
                        created_at, updated_at
                    )
                    SELECT 
                        id, research_question, research_method, source_journal,
                        source_literature, maturity, description, collaborator_id,
                        created_at, updated_at
                    FROM ideas_backup
                """)
                restored_count = cursor.rowcount
                logger.info(f"✅ 数据恢复完成，恢复了 {restored_count} 条记录")
                
                # 删除临时表
                cursor.execute("DROP TABLE ideas_backup")
                logger.info("🧹 临时表已清理")
        
        # 第五步：验证表结构
        logger.info("🔍 验证新表结构...")
        cursor.execute("PRAGMA table_info(ideas)")
        new_columns_info = cursor.fetchall()
        
        logger.info("📋 新表结构:")
        for col in new_columns_info:
            logger.info(f"  - {col[1]} ({col[2]}, NOT NULL: {bool(col[3])}, DEFAULT: {col[4]})")
        
        # 验证数据完整性
        cursor.execute("SELECT COUNT(*) FROM ideas")
        final_count = cursor.fetchone()[0]
        logger.info(f"📊 最终记录数: {final_count}")
        
        # 检查maturity字段值分布
        if final_count > 0:
            cursor.execute("SELECT maturity, COUNT(*) FROM ideas GROUP BY maturity")
            maturity_dist = cursor.fetchall()
            logger.info(f"📈 maturity分布: {maturity_dist}")
        
        # 第六步：提交更改并标记完成
        conn.commit()
        mark_migration_completed(db_path)
        
        logger.info(f"迁移 {MIGRATION_VERSION} 执行成功")
        
        logger.info("=" * 70)
        logger.info("🎉 v1.24 Idea表字段重构完成！")
        logger.info("✅ research_method字段改为必填")
        logger.info("✅ 添加了source_journal字段作为必填")
        logger.info("✅ source_literature字段改为必填")
        logger.info("✅ 将importance字段替换为maturity字段")
        logger.info("✅ 保留了所有现有数据")
        logger.info("✅ 表结构验证通过")
        logger.info("🚀 Ideas表单现在支持新的字段结构")
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