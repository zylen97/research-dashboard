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

# 迁移版本号 - 彻底移除用户系统
MIGRATION_VERSION = "v1.40_remove_user_system_completely"

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
        
        logger.info("=" * 70)
        logger.info(f"🚀 开始执行迁移: {MIGRATION_VERSION}")
        logger.info("🎯 目标: 彻底移除用户系统")
        logger.info("=" * 70)

        # ===========================================
        # 🔧 v1.40迁移任务：彻底移除用户系统
        # 变更：
        # 1. 重建 audit_logs 表（移除 user_id 字段）
        # 2. 重建 system_configs 表（移除 created_by_id, updated_by_id 字段）
        # 3. 删除 user_project_todos 表
        # 4. 删除 user_api_settings 表
        # 5. 删除 users 表
        # 说明：
        # - 保留所有审计日志历史记录（仅移除 user_id 字段）
        # - 保留所有系统配置（仅移除用户外键字段）
        # - 核心业务功能不受影响
        # ===========================================

        # ============================
        # Step 1: 重建 audit_logs 表
        # ============================
        logger.info("\n📋 Step 1: 重建 audit_logs 表（移除 user_id 字段）")

        if table_exists(cursor, 'audit_logs'):
            # 统计数据
            cursor.execute("SELECT COUNT(*) FROM audit_logs")
            audit_count = cursor.fetchone()[0]
            logger.info(f"   当前 audit_logs 有 {audit_count} 条记录")

            # 创建临时表（无 user_id）
            cursor.execute("""
                CREATE TABLE audit_logs_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    table_name VARCHAR(50) NOT NULL,
                    record_id INTEGER NOT NULL,
                    action VARCHAR(20) NOT NULL,
                    ip_address VARCHAR(45),
                    old_values TEXT,
                    new_values TEXT,
                    changes TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # 复制数据（排除 user_id）
            cursor.execute("""
                INSERT INTO audit_logs_new
                (id, table_name, record_id, action, ip_address, old_values, new_values, changes, created_at)
                SELECT id, table_name, record_id, action, ip_address, old_values, new_values, changes, created_at
                FROM audit_logs
            """)

            # 验证数据完整性
            cursor.execute("SELECT COUNT(*) FROM audit_logs_new")
            new_count = cursor.fetchone()[0]

            if new_count != audit_count:
                logger.error(f"   ❌ 数据迁移失败: 原{audit_count}条 -> 新{new_count}条")
                conn.rollback()
                return False

            # 删除旧表（这会自动删除关联的索引）
            cursor.execute("DROP TABLE audit_logs")

            # 重命名新表
            cursor.execute("ALTER TABLE audit_logs_new RENAME TO audit_logs")

            # 现在创建索引（旧索引已随旧表删除）
            cursor.execute("CREATE INDEX ix_audit_logs_id ON audit_logs (id)")

            logger.info(f"   ✅ audit_logs 重建成功，保留 {new_count} 条记录")
        else:
            logger.info("   ℹ️ audit_logs 表不存在，跳过")

        # ============================
        # Step 2: 重建 system_configs 表
        # ============================
        logger.info("\n📋 Step 2: 重建 system_configs 表（移除用户外键字段）")

        if table_exists(cursor, 'system_configs'):
            cursor.execute("SELECT COUNT(*) FROM system_configs")
            config_count = cursor.fetchone()[0]
            logger.info(f"   当前 system_configs 有 {config_count} 条记录")

            # 创建临时表
            cursor.execute("""
                CREATE TABLE system_configs_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    key VARCHAR(100) UNIQUE NOT NULL,
                    value TEXT NOT NULL,
                    category VARCHAR(50) NOT NULL DEFAULT 'general',
                    description VARCHAR(500),
                    is_encrypted BOOLEAN DEFAULT 0,
                    is_active BOOLEAN DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # 复制数据（排除用户外键字段）
            cursor.execute("""
                INSERT INTO system_configs_new
                (id, key, value, category, description, is_encrypted, is_active, created_at, updated_at)
                SELECT id, key, value, category, description, is_encrypted, is_active, created_at, updated_at
                FROM system_configs
            """)

            # 验证
            cursor.execute("SELECT COUNT(*) FROM system_configs_new")
            new_count = cursor.fetchone()[0]

            if new_count != config_count:
                logger.error(f"   ❌ 数据迁移失败: 原{config_count}条 -> 新{new_count}条")
                conn.rollback()
                return False

            # 删除旧表（这会自动删除关联的索引）
            cursor.execute("DROP TABLE system_configs")

            # 重命名新表
            cursor.execute("ALTER TABLE system_configs_new RENAME TO system_configs")

            # 现在创建索引（旧索引已随旧表删除）
            cursor.execute("CREATE INDEX idx_config_category_active ON system_configs(category, is_active)")
            cursor.execute("CREATE INDEX idx_config_encrypted_active ON system_configs(is_encrypted, is_active)")
            cursor.execute("CREATE INDEX idx_config_key ON system_configs(key)")
            cursor.execute("CREATE INDEX idx_config_created_at ON system_configs(created_at)")

            logger.info(f"   ✅ system_configs 重建成功，保留 {new_count} 条记录")
        else:
            logger.info("   ℹ️ system_configs 表不存在，跳过")

        # ============================
        # Step 3: 删除用户关联表
        # ============================
        logger.info("\n📋 Step 3: 删除用户关联表")

        if table_exists(cursor, 'user_project_todos'):
            cursor.execute("SELECT COUNT(*) FROM user_project_todos")
            count = cursor.fetchone()[0]
            cursor.execute("DROP TABLE user_project_todos")
            logger.info(f"   ✅ user_project_todos 删除成功（原有 {count} 条记录）")
        else:
            logger.info("   ℹ️ user_project_todos 表不存在，跳过")

        if table_exists(cursor, 'user_api_settings'):
            cursor.execute("SELECT COUNT(*) FROM user_api_settings")
            count = cursor.fetchone()[0]
            cursor.execute("DROP TABLE user_api_settings")
            logger.info(f"   ✅ user_api_settings 删除成功（原有 {count} 条记录）")
        else:
            logger.info("   ℹ️ user_api_settings 表不存在，跳过")

        # ============================
        # Step 4: 删除 users 表
        # ============================
        logger.info("\n📋 Step 4: 删除 users 主表")

        if table_exists(cursor, 'users'):
            cursor.execute("SELECT COUNT(*) FROM users")
            count = cursor.fetchone()[0]
            cursor.execute("DROP TABLE users")
            logger.info(f"   ✅ users 表删除成功（原有 {count} 条用户记录）")
        else:
            logger.info("   ℹ️ users 表不存在，跳过")

        # ============================
        # Step 5: 验证核心表完整性
        # ============================
        logger.info("\n📋 Step 5: 验证核心表完整性")

        required_tables = ['research_projects', 'collaborators', 'ideas', 'audit_logs', 'system_configs']
        all_valid = True
        for table in required_tables:
            if not table_exists(cursor, table):
                logger.error(f"   ❌ 核心表 {table} 不存在！")
                all_valid = False
            else:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                count = cursor.fetchone()[0]
                logger.info(f"   ✅ {table}: {count} 条记录")

        if not all_valid:
            logger.error("核心表完整性验证失败！")
            conn.rollback()
            return False

        # 提交事务
        conn.commit()
        mark_migration_completed(db_path)

        logger.info("\n" + "=" * 70)
        logger.info("🎉 v1.40 用户系统移除完成！")
        logger.info("✅ 已删除表: users, user_project_todos, user_api_settings")
        logger.info("✅ 已移除字段: audit_logs.user_id, system_configs.created_by_id/updated_by_id")
        logger.info("✅ 核心业务表完好，数据完整")
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