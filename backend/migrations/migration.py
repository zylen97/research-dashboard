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

# 迁移版本号 - 删除AI提供商选项，简化AI配置
MIGRATION_VERSION = "v1.25_remove_ai_provider_option"

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
        # 🔧 v1.25迁移任务：删除AI提供商选项
        # 用户需求：简化AI配置，删除provider字段 - 2025-07-25
        # ===========================================
        
        logger.info("🔧 开始v1.25迁移：删除AI提供商选项...")
        logger.info("🎯 目标：简化AI配置，删除provider字段")
        
        # 第一步：检查system_config表是否存在
        logger.info("🔍 检查system_config表...")
        
        if not table_exists(cursor, 'system_config'):
            logger.warning("⚠️ system_config表不存在，跳过AI配置迁移")
        else:
            logger.info("✅ system_config表已存在，开始处理AI配置...")
            
            # 查找AI配置
            cursor.execute("""
                SELECT id, value 
                FROM system_config 
                WHERE key = 'main_ai_config' AND category = 'ai_config'
            """)
            ai_config_row = cursor.fetchone()
            
            if ai_config_row:
                config_id, config_value = ai_config_row
                logger.info(f"📋 找到AI配置，ID: {config_id}")
                
                try:
                    # 解析JSON配置
                    import json
                    config = json.loads(config_value)
                    logger.info(f"🔍 当前配置: {list(config.keys())}")
                    
                    # 删除provider字段
                    if 'provider' in config:
                        logger.info(f"🗑️ 删除provider字段: {config['provider']}")
                        del config['provider']
                        
                        # 更新配置
                        new_config_value = json.dumps(config)
                        cursor.execute("""
                            UPDATE system_config 
                            SET value = ?, updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                        """, (new_config_value, config_id))
                        
                        logger.info("✅ AI配置已更新，删除了provider字段")
                    else:
                        logger.info("⏭️ AI配置中没有provider字段，无需更新")
                    
                    logger.info(f"📋 更新后配置: {list(config.keys())}")
                    
                except json.JSONDecodeError as e:
                    logger.error(f"❌ 解析AI配置失败: {e}")
                except Exception as e:
                    logger.error(f"❌ 处理AI配置失败: {e}")
            else:
                logger.info("ℹ️ 没有找到AI配置，无需更新")
        
        # 验证迁移结果
        logger.info("🔍 验证迁移结果...")
        cursor.execute("""
            SELECT value 
            FROM system_config 
            WHERE key = 'main_ai_config' AND category = 'ai_config'
        """)
        final_config = cursor.fetchone()
        if final_config:
            try:
                import json
                config = json.loads(final_config[0])
                if 'provider' not in config:
                    logger.info("✅ 验证成功：provider字段已删除")
                else:
                    logger.warning("⚠️ 验证失败：provider字段仍然存在")
            except:
                logger.warning("⚠️ 无法验证配置")
        
        # 第六步：提交更改并标记完成
        conn.commit()
        mark_migration_completed(db_path)
        
        logger.info(f"迁移 {MIGRATION_VERSION} 执行成功")
        
        logger.info("=" * 70)
        logger.info("🎉 v1.25 AI配置简化完成！")
        logger.info("✅ 删除了AI提供商选项")
        logger.info("✅ 简化了AI配置界面")
        logger.info("✅ 保留了API密钥、地址和模型设置")
        logger.info("✅ 所有现有配置保持不变")
        logger.info("🚀 AI配置现在更加简洁和直观")
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