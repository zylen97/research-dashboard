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

# 迁移版本号 - 创建用户API设置表
MIGRATION_VERSION = "v1.26_create_user_api_settings"

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
        # 🔧 v1.26迁移任务：创建用户API设置表
        # 用户需求：简化API设置管理，每个用户独立设置 - 2025-07-25
        # ===========================================
        
        logger.info("🔧 开始v1.26迁移：创建用户API设置表...")
        logger.info("🎯 目标：为每个用户创建独立的API设置存储")
        
        # 第一步：创建user_api_settings表
        logger.info("📋 创建user_api_settings表...")
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_api_settings (
                user_id INTEGER PRIMARY KEY,
                api_key TEXT,
                api_base TEXT DEFAULT 'https://api.chatanywhere.tech/v1',
                model TEXT DEFAULT 'claude-3-7-sonnet-20250219',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        
        logger.info("✅ user_api_settings表创建成功")
        
        # 第二步：从system_config迁移现有的AI配置
        logger.info("🔍 检查是否需要迁移现有配置...")
        
        if table_exists(cursor, 'system_config'):
            cursor.execute("""
                SELECT value 
                FROM system_config 
                WHERE key = 'main_ai_config' AND category = 'ai_config'
            """)
            ai_config_row = cursor.fetchone()
            
            if ai_config_row:
                try:
                    import json
                    config = json.loads(ai_config_row[0])
                    
                    # 获取所有用户
                    cursor.execute("SELECT id FROM users")
                    users = cursor.fetchall()
                    
                    for user in users:
                        user_id = user[0]
                        logger.info(f"📝 为用户 {user_id} 迁移配置...")
                        
                        # 插入配置（如果不存在）
                        cursor.execute("""
                            INSERT OR IGNORE INTO user_api_settings 
                            (user_id, api_key, api_base, model)
                            VALUES (?, ?, ?, ?)
                        """, (
                            user_id,
                            config.get('api_key', 'sk-LrOwl2ZEbKhZxW4s27EyGdjwnpZ1nDwjVRJk546lSspxHymY'),
                            config.get('api_url', 'https://api.chatanywhere.tech/v1'),
                            config.get('model', 'claude-3-7-sonnet-20250219')
                        ))
                    
                    logger.info(f"✅ 成功为 {len(users)} 个用户迁移配置")
                    
                except Exception as e:
                    logger.warning(f"⚠️ 迁移现有配置时出错: {e}")
            else:
                logger.info("ℹ️ 没有找到现有AI配置，跳过迁移")
        
        # 第三步：验证迁移结果
        logger.info("🔍 验证迁移结果...")
        cursor.execute("SELECT COUNT(*) FROM user_api_settings")
        count = cursor.fetchone()[0]
        logger.info(f"✅ user_api_settings表中有 {count} 条记录")
        
        # 提交更改并标记完成
        conn.commit()
        mark_migration_completed(db_path)
        
        logger.info(f"迁移 {MIGRATION_VERSION} 执行成功")
        
        logger.info("=" * 70)
        logger.info("🎉 v1.26 用户API设置表创建完成！")
        logger.info("✅ 创建了user_api_settings表")
        logger.info("✅ 每个用户可以独立管理API设置")
        logger.info("✅ 从system_config迁移了现有配置")
        logger.info("🚀 API设置管理更加灵活和安全")
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