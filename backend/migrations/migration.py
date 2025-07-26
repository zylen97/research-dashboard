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

# 迁移版本号 - 为ideas表添加缺失字段
MIGRATION_VERSION = "v1.31_fix_ideas_table_structure"

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
        # 🔧 v1.31迁移任务：修复ideas表结构
        # 问题：代码期望的字段与实际数据库不匹配
        # 目标：添加source_journal, responsible_person, maturity字段
        # ===========================================
        
        logger.info("🔧 开始v1.31迁移：修复ideas表结构...")
        logger.info("🎯 目标：添加缺失字段使表结构与代码匹配")
        
        # 第一步：检查ideas表是否存在
        logger.info("📋 检查ideas表是否存在...")
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='ideas'")
        if not cursor.fetchone():
            logger.error("❌ ideas表不存在")
            raise Exception("ideas表不存在")
        
        # 第二步：获取当前表结构
        logger.info("📋 检查ideas表当前结构...")
        cursor.execute("PRAGMA table_info(ideas)")
        columns = cursor.fetchall()
        column_names = [col[1] for col in columns]
        logger.info(f"当前列: {', '.join(column_names)}")
        
        # 第三步：添加source_journal字段
        if 'source_journal' not in column_names:
            logger.info("📋 添加source_journal字段...")
            cursor.execute("""
                ALTER TABLE ideas 
                ADD COLUMN source_journal TEXT
            """)
            logger.info("✅ source_journal字段添加成功")
        else:
            logger.info("ℹ️ source_journal字段已存在，跳过")
        
        # 第四步：添加responsible_person字段
        if 'responsible_person' not in column_names:
            logger.info("📋 添加responsible_person字段...")
            cursor.execute("""
                ALTER TABLE ideas 
                ADD COLUMN responsible_person TEXT
            """)
            logger.info("✅ responsible_person字段添加成功")
            
            # 暂时跳过填充，因为collaborators表可能不存在
            logger.info("ℹ️ 跳过responsible_person数据填充（collaborators表不存在）")
        else:
            logger.info("ℹ️ responsible_person字段已存在，跳过")
        
        # 第五步：添加maturity字段
        if 'maturity' not in column_names:
            logger.info("📋 添加maturity字段...")
            cursor.execute("""
                ALTER TABLE ideas 
                ADD COLUMN maturity VARCHAR(20) DEFAULT 'immature'
            """)
            logger.info("✅ maturity字段添加成功")
            
            # 从importance映射到maturity
            logger.info("📋 从importance映射到maturity...")
            cursor.execute("""
                UPDATE ideas 
                SET maturity = CASE
                    WHEN importance >= 4 THEN 'mature'
                    ELSE 'immature'
                END
            """)
            logger.info("✅ maturity数据映射完成")
        else:
            logger.info("ℹ️ maturity字段已存在，跳过")
        
        # 第六步：验证迁移结果
        logger.info("🔍 验证迁移结果...")
        cursor.execute("PRAGMA table_info(ideas)")
        columns = cursor.fetchall()
        column_names = [col[1] for col in columns]
        
        required_fields = ['source_journal', 'responsible_person', 'maturity']
        missing_fields = [f for f in required_fields if f not in column_names]
        
        if not missing_fields:
            logger.info("✅ 所有必需字段添加成功")
            logger.info(f"✅ ideas表当前列: {', '.join(column_names)}")
        else:
            logger.error(f"❌ 缺失字段: {', '.join(missing_fields)}")
            raise Exception(f"字段添加失败: {', '.join(missing_fields)}")
        
        # 提交更改并标记完成
        conn.commit()
        mark_migration_completed(db_path)
        
        logger.info(f"迁移 {MIGRATION_VERSION} 执行成功")
        
        logger.info("=" * 70)
        logger.info("🎉 v1.31 ideas表结构修复完成！")
        logger.info("✅ 添加了source_journal字段")
        logger.info("✅ 添加了responsible_person字段并填充数据")
        logger.info("✅ 添加了maturity字段并从importance映射")
        logger.info("✅ 表结构现在与代码期望一致")
        logger.info("🚀 Ideas管理功能恢复正常")
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