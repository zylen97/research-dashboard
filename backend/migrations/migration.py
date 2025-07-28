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

# 迁移版本号 - 研究项目状态更新
MIGRATION_VERSION = "v1.36_research_status_update"

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
        # 🔧 v1.36迁移任务：研究项目状态更新
        # 变更：添加新的项目状态支持（审稿中、返修中）
        # 说明：
        # - 现有状态保持不变：active（撰写中）、paused（暂停）、completed（存档）
        # - 新增状态：reviewing（审稿中）、revising（返修中）
        # - 数据库结构无需修改，status字段已支持字符串类型
        # - 主要更新验证逻辑和前端显示
        # ===========================================
        
        logger.info("🔧 开始v1.36迁移：研究项目状态更新...")
        logger.info("🎯 目标：添加新的项目状态（审稿中、返修中），优化状态管理")
        
        # 第一步：检查research_projects表的status字段
        logger.info("📋 检查research_projects表的status字段...")
        
        if table_exists(cursor, 'research_projects'):
            cursor.execute("PRAGMA table_info(research_projects)")
            columns = cursor.fetchall()
            status_column = None
            for col in columns:
                if col[1] == 'status':
                    status_column = col
                    break
            
            if status_column:
                logger.info(f"✅ status字段存在，类型: {status_column[2]}")
                
                # 检查现有状态值分布
                cursor.execute("""
                    SELECT status, COUNT(*) as count 
                    FROM research_projects 
                    GROUP BY status
                """)
                status_distribution = cursor.fetchall()
                logger.info("📊 现有状态分布:")
                for status, count in status_distribution:
                    logger.info(f"  - {status}: {count} 个项目")
            else:
                logger.error("❌ research_projects表中没有status字段")
                return False
        else:
            logger.error("❌ research_projects表不存在")
            return False
        
        # 第二步：记录迁移说明
        logger.info("📋 状态映射说明:")
        logger.info("  - active → 撰写中")
        logger.info("  - paused → 暂停")
        logger.info("  - completed → 存档")
        logger.info("  - reviewing → 审稿中（新增）")
        logger.info("  - revising → 返修中（新增）")
        
        # 第三步：创建状态验证表（用于记录允许的状态值）
        logger.info("📋 创建状态验证表...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS project_status_types (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                status_code VARCHAR(50) UNIQUE NOT NULL,
                status_name_cn VARCHAR(50) NOT NULL,
                display_order INTEGER DEFAULT 0,
                color_tag VARCHAR(20),
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # 插入状态定义
        status_definitions = [
            ('active', '撰写中', 1, 'processing', 1),
            ('paused', '暂停', 2, 'warning', 1),
            ('reviewing', '审稿中', 3, 'purple', 1),
            ('revising', '返修中', 4, 'error', 1),
            ('completed', '存档', 5, 'default', 1)
        ]
        
        for status_code, name_cn, order, color, is_active in status_definitions:
            cursor.execute("""
                INSERT OR IGNORE INTO project_status_types 
                (status_code, status_name_cn, display_order, color_tag, is_active) 
                VALUES (?, ?, ?, ?, ?)
            """, (status_code, name_cn, order, color, is_active))
        
        logger.info("✅ 状态定义表创建成功")
        
        # 最终验证
        logger.info("🔍 最终验证...")
        cursor.execute("SELECT * FROM project_status_types ORDER BY display_order")
        statuses = cursor.fetchall()
        logger.info("✅ 支持的状态类型:")
        for status in statuses:
            logger.info(f"  - {status[1]} ({status[2]}): 颜色={status[4]}, 顺序={status[3]}")
        
        # 提交更改并标记完成
        conn.commit()
        mark_migration_completed(db_path)
        
        logger.info(f"迁移 {MIGRATION_VERSION} 执行成功")
        
        logger.info("======================================================================")
        logger.info("🎉 v1.36 研究项目状态更新完成！")
        logger.info("✅ 新增状态支持：审稿中(reviewing)、返修中(revising)")
        logger.info("✅ 状态中文映射：撰写中、暂停、审稿中、返修中、存档")
        logger.info("✅ 创建了状态类型定义表")
        logger.info("✅ 数据库结构保持兼容，仅需更新验证逻辑")
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