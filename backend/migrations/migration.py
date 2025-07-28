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

# 迁移版本号 - 用户自定义项目开始时间
MIGRATION_VERSION = "v1.37_user_defined_start_date"

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
        # 🔧 v1.37迁移任务：用户自定义项目开始时间
        # 变更：允许用户在创建和编辑项目时设置开始时间
        # 说明：
        # - start_date字段已存在，无需修改表结构
        # - 更新API以支持用户输入start_date
        # - 前端添加日期选择器
        # - 删除预览中的时间信息显示
        # ===========================================
        
        logger.info("🔧 开始v1.37迁移：用户自定义项目开始时间...")
        logger.info("🎯 目标：允许用户设置项目开始时间，优化时间管理")
        
        # 第一步：检查research_projects表的start_date字段
        logger.info("📋 检查research_projects表的start_date字段...")
        
        if table_exists(cursor, 'research_projects'):
            cursor.execute("PRAGMA table_info(research_projects)")
            columns = cursor.fetchall()
            start_date_column = None
            for col in columns:
                if col[1] == 'start_date':
                    start_date_column = col
                    break
            
            if start_date_column:
                logger.info(f"✅ start_date字段存在，类型: {start_date_column[2]}")
                
                # 检查现有start_date的数据情况
                cursor.execute("""
                    SELECT COUNT(*) as total,
                           COUNT(CASE WHEN start_date = created_at THEN 1 END) as same_as_created
                    FROM research_projects
                """)
                result = cursor.fetchone()
                total_count = result[0]
                same_count = result[1]
                
                logger.info(f"📊 现有数据分析:")
                logger.info(f"  - 总项目数: {total_count}")
                logger.info(f"  - start_date等于created_at的项目数: {same_count}")
                logger.info(f"  - 已自定义start_date的项目数: {total_count - same_count}")
            else:
                logger.error("❌ research_projects表中没有start_date字段")
                return False
        else:
            logger.error("❌ research_projects表不存在")
            return False
        
        # 第二步：记录迁移说明
        logger.info("📋 功能更新说明:")
        logger.info("  - 用户可在创建项目时设置开始时间")
        logger.info("  - 用户可在编辑项目时修改开始时间")
        logger.info("  - 如不设置，默认使用当前时间")
        logger.info("  - 预览页面不再显示时间戳信息")
        logger.info("  - 列表页面不显示开始时间")
        
        # 提交更改并标记完成
        conn.commit()
        mark_migration_completed(db_path)
        
        logger.info(f"迁移 {MIGRATION_VERSION} 执行成功")
        
        logger.info("======================================================================")
        logger.info("🎉 v1.37 用户自定义项目开始时间完成！")
        logger.info("✅ start_date字段已存在，无需修改表结构")
        logger.info("✅ 用户可以自定义项目开始时间")
        logger.info("✅ 数据库结构保持兼容")
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