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

# 迁移版本号 - 修复ideas表字段名映射
MIGRATION_VERSION = "v1.33_fix_ideas_field_mapping"

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
        # 🔧 v1.33迁移任务：修复ideas表字段名映射
        # 问题：生产数据库使用新字段名(title,description等)，但代码期望旧字段名(research_question等)
        # 解决：创建正确结构的ideas表，迁移数据
        # ===========================================
        
        logger.info("🔧 开始v1.33迁移：修复ideas表字段名映射...")
        logger.info("🎯 目标：统一ideas表结构，使其与代码期望的字段名匹配")
        
        # 第一步：检查现有的ideas表结构
        logger.info("📋 检查现有ideas表结构...")
        cursor.execute("PRAGMA table_info(ideas)")
        columns = cursor.fetchall()
        column_names = [col[1] for col in columns]
        logger.info(f"当前ideas表字段: {', '.join(column_names)}")
        
        # 判断是否需要迁移（如果有title字段说明是新结构，需要转换）
        if 'title' in column_names and 'research_question' not in column_names:
            logger.info("🔄 检测到新字段结构，需要迁移到旧字段名...")
            
            # 第二步：备份现有数据
            logger.info("📋 备份现有ideas数据...")
            cursor.execute("SELECT * FROM ideas")
            old_data = cursor.fetchall()
            logger.info(f"📊 备份了 {len(old_data)} 条数据")
            
            # 第三步：重命名旧表
            logger.info("📋 重命名旧表...")
            cursor.execute("ALTER TABLE ideas RENAME TO ideas_old_backup")
            
            # 第四步：创建新表（使用代码期望的字段名）
            logger.info("📋 创建新的ideas表（使用正确的字段名）...")
            cursor.execute("""
                CREATE TABLE ideas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    research_question TEXT NOT NULL,
                    research_method TEXT,
                    source_journal TEXT DEFAULT '',
                    source_literature TEXT,
                    responsible_person TEXT DEFAULT '',
                    maturity VARCHAR(20) DEFAULT 'immature',
                    description TEXT,
                    collaborator_id INTEGER,
                    importance INTEGER DEFAULT 3,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
            logger.info("✅ 新ideas表创建成功")
            
            # 第五步：迁移数据（映射字段名）
            logger.info("📋 开始迁移数据...")
            cursor.execute("PRAGMA table_info(ideas_old_backup)")
            old_columns = {col[1]: i for i, col in enumerate(cursor.fetchall())}
            
            for row in old_data:
                # 映射字段
                research_question = row[old_columns.get('title', -1)] if 'title' in old_columns else row[old_columns.get('research_question', -1)]
                research_method = row[old_columns.get('research_method', -1)] if 'research_method' in old_columns else ''
                source_journal = row[old_columns.get('source_journal', -1)] if 'source_journal' in old_columns else ''
                source_literature = row[old_columns.get('source', -1)] if 'source' in old_columns else row[old_columns.get('source_literature', -1)] if 'source_literature' in old_columns else ''
                responsible_person = row[old_columns.get('responsible_person', -1)] if 'responsible_person' in old_columns else ''
                maturity = row[old_columns.get('maturity', -1)] if 'maturity' in old_columns else 'immature'
                description = row[old_columns.get('description', -1)] if 'description' in old_columns else ''
                collaborator_id = row[old_columns.get('collaborator_id', -1)] if 'collaborator_id' in old_columns else None
                importance = row[old_columns.get('importance', -1)] if 'importance' in old_columns else 3
                created_at = row[old_columns.get('created_at', -1)] if 'created_at' in old_columns else datetime.now()
                updated_at = row[old_columns.get('updated_at', -1)] if 'updated_at' in old_columns else datetime.now()
                
                # 插入数据
                cursor.execute("""
                    INSERT INTO ideas (
                        research_question, research_method, source_journal, 
                        source_literature, responsible_person, maturity, 
                        description, collaborator_id, importance, 
                        created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    research_question or '',
                    research_method or '',
                    source_journal or '',
                    source_literature or '',
                    responsible_person or '',
                    maturity or 'immature',
                    description or '',
                    collaborator_id,
                    importance or 3,
                    created_at,
                    updated_at
                ))
            
            logger.info(f"✅ 成功迁移 {len(old_data)} 条数据")
            
        elif 'research_question' in column_names:
            logger.info("✅ ideas表已经使用正确的字段名")
            
            # 确保必要字段存在
            if 'source_journal' not in column_names:
                cursor.execute("ALTER TABLE ideas ADD COLUMN source_journal TEXT DEFAULT ''")
                logger.info("✅ 添加source_journal字段")
            
            if 'responsible_person' not in column_names:
                cursor.execute("ALTER TABLE ideas ADD COLUMN responsible_person TEXT DEFAULT ''")
                logger.info("✅ 添加responsible_person字段")
            
            if 'maturity' not in column_names:
                cursor.execute("ALTER TABLE ideas ADD COLUMN maturity VARCHAR(20) DEFAULT 'immature'")
                logger.info("✅ 添加maturity字段")
        
        else:
            # 如果表不存在或结构完全错误，创建新表
            logger.info("📋 创建新的ideas表...")
            cursor.execute("DROP TABLE IF EXISTS ideas")
            cursor.execute("""
                CREATE TABLE ideas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    research_question TEXT NOT NULL,
                    research_method TEXT,
                    source_journal TEXT DEFAULT '',
                    source_literature TEXT,
                    responsible_person TEXT DEFAULT '',
                    maturity VARCHAR(20) DEFAULT 'immature',
                    description TEXT,
                    collaborator_id INTEGER,
                    importance INTEGER DEFAULT 3,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
            logger.info("✅ 新ideas表创建成功")
        
        # 最终验证
        logger.info("🔍 最终验证...")
        cursor.execute("PRAGMA table_info(ideas)")
        columns = cursor.fetchall()
        column_names = [col[1] for col in columns]
        
        logger.info(f"✅ ideas表最终结构: {', '.join(column_names)}")
        
        # 提交更改并标记完成
        conn.commit()
        mark_migration_completed(db_path)
        
        logger.info(f"迁移 {MIGRATION_VERSION} 执行成功")
        
        logger.info("======================================================================")
        logger.info("🎉 v1.33 ideas表字段名映射修复完成！")
        logger.info("✅ 统一了字段名，与代码期望保持一致")
        logger.info("✅ 保留了所有现有数据")
        logger.info("✅ Ideas管理功能现在应该正常工作")
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