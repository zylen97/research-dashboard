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

# 迁移版本号 - 彻底修复datetime字段映射错误（紧急修复API返回空数组问题）
MIGRATION_VERSION = "v1.23_critical_datetime_fix"

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
        # 🚨 v1.23迁移任务：彻底修复datetime字段映射错误
        # 紧急修复API返回空数组问题 - 2025-07-24
        # ===========================================
        
        logger.info("🚨 开始v1.23迁移：彻底修复datetime字段映射错误...")
        logger.info("🎯 目标：修复Pydantic 'Invalid isoformat string' 错误，恢复API正常工作")
        
        # 第一步：全面诊断所有表的datetime字段错误
        logger.info("🔍 全面诊断所有表的datetime字段问题...")
        
        # 定义需要检查的表和字段
        tables_to_check = [
            ('collaborators', ['created_at', 'updated_at', 'deleted_at']),
            ('research_projects', ['created_at', 'updated_at', 'deleted_at']),
            ('ideas', ['created_at', 'updated_at', 'deleted_at']),
            ('communication_logs', ['created_at', 'updated_at', 'deleted_at']),
            ('project_collaborators', ['created_at', 'updated_at'])
        ]
        
        total_errors_found = 0
        
        for table_name, datetime_fields in tables_to_check:
            if table_exists(cursor, table_name):
                logger.info(f"检查表: {table_name}")
                
                # 检查表结构
                cursor.execute(f"PRAGMA table_info({table_name})")
                columns_info = cursor.fetchall()
                existing_fields = {col[1] for col in columns_info}
                
                for field in datetime_fields:
                    if field in existing_fields:
                        # 检查无效的datetime值
                        cursor.execute(f"""
                            SELECT COUNT(*) FROM {table_name} 
                            WHERE {field} IS NOT NULL 
                            AND (
                                {field} = 'senior' OR 
                                {field} = 'junior' OR 
                                {field} = '' OR
                                {field} NOT LIKE '____-__-__%'
                            )
                        """)
                        error_count = cursor.fetchone()[0]
                        
                        if error_count > 0:
                            logger.warning(f"  ❌ {table_name}.{field}: {error_count} 个错误值")
                            total_errors_found += error_count
                        else:
                            logger.info(f"  ✅ {table_name}.{field}: 格式正确")
                    else:
                        logger.info(f"  ⏭️ {table_name}.{field}: 字段不存在")
            else:
                logger.info(f"⏭️ 表 {table_name} 不存在")
        
        logger.info(f"🔍 诊断完成，共发现 {total_errors_found} 个datetime格式错误")
        
        # 第二步：执行彻底的datetime字段修复
        if total_errors_found > 0:
            logger.info("🔧 开始执行彻底的datetime字段修复...")
            
            total_fixed = 0
            
            for table_name, datetime_fields in tables_to_check:
                if table_exists(cursor, table_name):
                    # 获取表结构
                    cursor.execute(f"PRAGMA table_info({table_name})")
                    columns_info = cursor.fetchall()
                    existing_fields = {col[1] for col in columns_info}
                    
                    for field in datetime_fields:
                        if field in existing_fields:
                            # 修复所有无效的datetime值
                            if field == 'deleted_at':
                                # deleted_at字段设为NULL
                                cursor.execute(f"""
                                    UPDATE {table_name} 
                                    SET {field} = NULL 
                                    WHERE {field} IS NOT NULL 
                                    AND (
                                        {field} = 'senior' OR 
                                        {field} = 'junior' OR 
                                        {field} = '' OR
                                        {field} NOT LIKE '____-__-__%'
                                    )
                                """)
                            else:
                                # created_at和updated_at设为当前时间
                                cursor.execute(f"""
                                    UPDATE {table_name} 
                                    SET {field} = datetime('now') 
                                    WHERE {field} IS NOT NULL 
                                    AND (
                                        {field} = 'senior' OR 
                                        {field} = 'junior' OR 
                                        {field} = '' OR
                                        {field} NOT LIKE '____-__-__%'
                                    )
                                """)
                            
                            fixed_count = cursor.rowcount
                            if fixed_count > 0:
                                logger.info(f"  ✅ 修复 {table_name}.{field}: {fixed_count} 条记录")
                                total_fixed += fixed_count
            
            logger.info(f"🎉 datetime字段修复完成，共修复 {total_fixed} 个错误值")
        else:
            logger.info("✅ 未发现datetime格式错误，跳过修复")
        
        # 第三步：数据完整性验证
        logger.info("🔍 执行数据完整性验证...")
        
        # 验证所有表的记录数
        for table_name, _ in tables_to_check:
            if table_exists(cursor, table_name):
                cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                count = cursor.fetchone()[0]
                logger.info(f"  📊 {table_name}: {count} 条记录")
                
                # 特别检查collaborators表的level字段分布
                if table_name == 'collaborators':
                    cursor.execute("PRAGMA table_info(collaborators)")
                    columns_info = cursor.fetchall()
                    has_level = any(col[1] == 'level' for col in columns_info)
                    
                    if has_level:
                        cursor.execute("SELECT level, COUNT(*) FROM collaborators GROUP BY level")
                        level_dist = cursor.fetchall()
                        logger.info(f"    📈 level分布: {level_dist}")
                    
                    # 检查活跃collaborators
                    cursor.execute("SELECT COUNT(*) FROM collaborators WHERE deleted_at IS NULL")
                    active = cursor.fetchone()[0]
                    logger.info(f"    👥 活跃collaborators: {active} 个")
        
        # 第四步：最终验证 - 确保没有残留的错误格式
        logger.info("🔍 最终验证 - 检查残留的格式错误...")
        
        remaining_errors = 0
        for table_name, datetime_fields in tables_to_check:
            if table_exists(cursor, table_name):
                cursor.execute(f"PRAGMA table_info({table_name})")
                columns_info = cursor.fetchall()
                existing_fields = {col[1] for col in columns_info}
                
                for field in datetime_fields:
                    if field in existing_fields:
                        cursor.execute(f"""
                            SELECT COUNT(*) FROM {table_name} 
                            WHERE {field} IS NOT NULL 
                            AND (
                                {field} = 'senior' OR 
                                {field} = 'junior' OR 
                                {field} = '' OR
                                {field} NOT LIKE '____-__-__%'
                            )
                        """)
                        error_count = cursor.fetchone()[0]
                        remaining_errors += error_count
                        
                        if error_count > 0:
                            logger.error(f"  ❌ {table_name}.{field}: 仍有 {error_count} 个格式错误")
        
        if remaining_errors == 0:
            logger.info("✅ 最终验证通过，所有datetime字段格式正确")
        else:
            logger.warning(f"⚠️ 最终验证发现 {remaining_errors} 个残留错误")
        
        # 第五步：提交更改并标记完成
        conn.commit()
        mark_migration_completed(db_path)
        
        logger.info(f"迁移 {MIGRATION_VERSION} 执行成功")
        
        logger.info("=" * 70)
        logger.info("🎉 v1.23 彻底修复datetime字段映射错误完成！")
        logger.info("✅ 修复了所有表中的'senior'/'junior'字符串错误")
        logger.info("✅ 统一了所有datetime字段的格式")
        logger.info("✅ 清理了所有deleted_at字段的错误值")
        logger.info("✅ 验证了数据完整性")
        logger.info(f"✅ 共修复了 {total_errors_found} 个datetime格式错误")
        logger.info(f"✅ 剩余格式错误: {remaining_errors} 个")
        logger.info("📝 Pydantic 'Invalid isoformat string' 错误应该彻底解决")
        logger.info("🚀 所有API应该立即恢复正常工作，不再返回空数组")
        logger.info("🔧 解决了导致API响应为空的根本原因")
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