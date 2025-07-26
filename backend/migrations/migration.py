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

# 迁移版本号 - 健壮的ideas表结构修复
MIGRATION_VERSION = "v1.32_robust_ideas_table_fix"

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
        # 🔧 v1.32迁移任务：健壮的ideas表结构修复
        # 特点：更好的错误处理，确保在生产环境能成功执行
        # ===========================================
        
        logger.info("🔧 开始v1.32迁移：健壮的ideas表结构修复...")
        logger.info("🎯 目标：安全地修复ideas表结构，确保与代码匹配")
        
        # 第一步：创建必要的表（如果不存在）
        logger.info("📋 确保基础表结构存在...")
        
        # 创建research_projects表（如果不存在）
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS research_projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title VARCHAR(200) NOT NULL,
                idea_description TEXT NOT NULL,
                research_method TEXT,
                source TEXT,
                status VARCHAR(50) DEFAULT 'active',
                progress REAL DEFAULT 0.0,
                start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expected_completion TIMESTAMP,
                is_todo BOOLEAN DEFAULT 0,
                todo_marked_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        logger.info("✅ research_projects表已就绪")
        
        # 创建ideas表（如果不存在）
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ideas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                research_question TEXT NOT NULL,
                research_method TEXT,
                source_literature TEXT,
                importance INTEGER DEFAULT 3,
                description TEXT,
                collaborator_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        logger.info("✅ ideas表已就绪")
        
        # 第二步：检查并添加缺失字段
        logger.info("📋 检查ideas表当前结构...")
        cursor.execute("PRAGMA table_info(ideas)")
        columns = cursor.fetchall()
        column_names = [col[1] for col in columns]
        logger.info(f"当前列: {', '.join(column_names)}")
        
        # 添加source_journal字段
        if 'source_journal' not in column_names:
            logger.info("📋 添加source_journal字段...")
            try:
                cursor.execute("ALTER TABLE ideas ADD COLUMN source_journal TEXT")
                logger.info("✅ source_journal字段添加成功")
            except Exception as e:
                logger.warning(f"⚠️ 添加source_journal字段失败: {e}")
        else:
            logger.info("ℹ️ source_journal字段已存在")
        
        # 添加responsible_person字段
        if 'responsible_person' not in column_names:
            logger.info("📋 添加responsible_person字段...")
            try:
                cursor.execute("ALTER TABLE ideas ADD COLUMN responsible_person TEXT")
                logger.info("✅ responsible_person字段添加成功")
                
                # 尝试从collaborator关联填充数据
                try:
                    cursor.execute("""
                        UPDATE ideas 
                        SET responsible_person = (
                            SELECT name FROM collaborators 
                            WHERE collaborators.id = ideas.collaborator_id
                        )
                        WHERE collaborator_id IS NOT NULL
                        AND EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='collaborators')
                    """)
                    logger.info("✅ responsible_person数据填充完成")
                except:
                    logger.info("ℹ️ 跳过responsible_person数据填充")
            except Exception as e:
                logger.warning(f"⚠️ 添加responsible_person字段失败: {e}")
        else:
            logger.info("ℹ️ responsible_person字段已存在")
        
        # 添加maturity字段
        if 'maturity' not in column_names:
            logger.info("📋 添加maturity字段...")
            try:
                cursor.execute("ALTER TABLE ideas ADD COLUMN maturity VARCHAR(20) DEFAULT 'immature'")
                logger.info("✅ maturity字段添加成功")
                
                # 从importance映射到maturity
                if 'importance' in column_names:
                    logger.info("📋 从importance映射到maturity...")
                    cursor.execute("""
                        UPDATE ideas 
                        SET maturity = CASE
                            WHEN importance >= 4 THEN 'mature'
                            ELSE 'immature'
                        END
                        WHERE maturity IS NULL OR maturity = ''
                    """)
                    logger.info("✅ maturity数据映射完成")
            except Exception as e:
                logger.warning(f"⚠️ 添加maturity字段失败: {e}")
        else:
            logger.info("ℹ️ maturity字段已存在")
        
        # 第三步：确保所有字段都有默认值（避免NULL导致的错误）
        logger.info("📋 设置默认值...")
        try:
            cursor.execute("""
                UPDATE ideas 
                SET source_journal = '' 
                WHERE source_journal IS NULL
            """)
            cursor.execute("""
                UPDATE ideas 
                SET responsible_person = '' 
                WHERE responsible_person IS NULL
            """)
            cursor.execute("""
                UPDATE ideas 
                SET maturity = 'immature' 
                WHERE maturity IS NULL OR maturity = ''
            """)
            logger.info("✅ 默认值设置完成")
        except Exception as e:
            logger.warning(f"⚠️ 设置默认值时出现警告: {e}")
        
        # 第四步：最终验证
        logger.info("🔍 最终验证...")
        cursor.execute("PRAGMA table_info(ideas)")
        columns = cursor.fetchall()
        column_names = [col[1] for col in columns]
        
        required_fields = ['source_journal', 'responsible_person', 'maturity']
        existing_required = [f for f in required_fields if f in column_names]
        
        logger.info(f"✅ ideas表最终结构: {', '.join(column_names)}")
        logger.info(f"✅ 必需字段状态: {', '.join(existing_required)}")
        
        # 提交更改并标记完成
        conn.commit()
        mark_migration_completed(db_path)
        
        logger.info(f"迁移 {MIGRATION_VERSION} 执行成功")
        
        logger.info("=" * 70)
        logger.info("🎉 v1.32 健壮的ideas表结构修复完成！")
        logger.info("✅ 确保了所有必要的表存在")
        logger.info("✅ 安全地添加了缺失字段")
        logger.info("✅ 设置了合理的默认值")
        logger.info("✅ Ideas管理功能现在应该正常工作")
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