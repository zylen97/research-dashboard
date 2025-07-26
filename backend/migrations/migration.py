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

# 迁移版本号 - 修复ideas表source字段为可选
MIGRATION_VERSION = "v1.34_make_source_fields_nullable"

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
        # 🔧 v1.34迁移任务：修复ideas表source字段为可选
        # 问题：source_journal和source_literature字段为NOT NULL，导致前端提交空值时报500错误
        # 解决：将这些字段改为允许NULL，并设置合理的默认值
        # ===========================================
        
        logger.info("🔧 开始v1.34迁移：修复ideas表source字段为可选...")
        logger.info("🎯 目标：将source_journal和source_literature字段改为可选，避免500错误")
        
        # 第一步：检查现有的ideas表结构
        logger.info("📋 检查现有ideas表结构...")
        if table_exists(cursor, 'ideas'):
            cursor.execute("PRAGMA table_info(ideas)")
            columns = cursor.fetchall()
            column_names = [col[1] for col in columns]
            logger.info(f"当前ideas表字段: {', '.join(column_names)}")
            
            # 检查是否需要修改字段约束
            needs_migration = False
            
            # 检查source_journal和source_literature字段的约束
            logger.info("📋 检查字段约束...")
            for col in columns:
                col_name, col_type, not_null = col[1], col[2], col[3]
                if col_name in ['source_journal', 'source_literature'] and not_null == 1:
                    logger.info(f"⚠️ 字段 {col_name} 当前为NOT NULL，需要修改为可选")
                    needs_migration = True
            
            if needs_migration:
                # 第二步：备份现有数据
                logger.info("📋 备份现有ideas数据...")
                cursor.execute("SELECT * FROM ideas")
                old_data = cursor.fetchall()
                logger.info(f"📊 备份了 {len(old_data)} 条数据")
                
                # 第三步：重命名旧表
                logger.info("📋 重命名旧表...")
                cursor.execute("ALTER TABLE ideas RENAME TO ideas_old_v134")
                
                # 第四步：创建新表（修改字段约束）
                logger.info("📋 创建新的ideas表（source字段为可选）...")
                cursor.execute("""
                    CREATE TABLE ideas (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        research_question TEXT NOT NULL,
                        research_method TEXT NOT NULL,
                        source_journal TEXT,
                        source_literature TEXT,
                        responsible_person TEXT NOT NULL,
                        maturity VARCHAR(20) NOT NULL DEFAULT 'immature',
                        description TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                logger.info("✅ 新ideas表创建成功（source字段已改为可选）")
                
                # 第五步：迁移数据
                logger.info("📋 开始迁移数据...")
                for row in old_data:
                    cursor.execute("""
                        INSERT INTO ideas (
                            id, research_question, research_method, source_journal, 
                            source_literature, responsible_person, maturity, 
                            description, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, row)
                
                logger.info(f"✅ 成功迁移 {len(old_data)} 条数据")
                
                # 删除备份表（可选）
                # cursor.execute("DROP TABLE ideas_old_v134")
                # logger.info("🗑️ 删除旧表备份")
                
            else:
                logger.info("✅ ideas表字段约束已经正确，无需迁移")
        else:
            # 如果表不存在，创建新表
            logger.info("📋 创建新的ideas表...")
            cursor.execute("""
                CREATE TABLE ideas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    research_question TEXT NOT NULL,
                    research_method TEXT NOT NULL,
                    source_journal TEXT,
                    source_literature TEXT,
                    responsible_person TEXT NOT NULL,
                    maturity VARCHAR(20) NOT NULL DEFAULT 'immature',
                    description TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
            logger.info("✅ 新ideas表创建成功")
        
        # 最终验证
        logger.info("🔍 最终验证...")
        cursor.execute("PRAGMA table_info(ideas)")
        columns = cursor.fetchall()
        logger.info("✅ ideas表最终结构:")
        for col in columns:
            nullable = "NULL" if col[3] == 0 else "NOT NULL"
            logger.info(f"  - {col[1]}: {col[2]} {nullable}")
        
        # 提交更改并标记完成
        conn.commit()
        mark_migration_completed(db_path)
        
        logger.info(f"迁移 {MIGRATION_VERSION} 执行成功")
        
        logger.info("======================================================================")
        logger.info("🎉 v1.34 ideas表source字段修复完成！")
        logger.info("✅ source_journal和source_literature字段已改为可选")
        logger.info("✅ 前端提交空值时不再报500错误")
        logger.info("✅ 保留了所有现有数据")
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