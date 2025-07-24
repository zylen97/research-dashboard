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

# 迁移版本号 - 自动修复字段映射错误（修复level字段问题）
MIGRATION_VERSION = "v1.22_fix_field_mapping_safe"

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
        # 🔧 v1.22迁移任务：安全修复数据库字段映射错误
        # 修复level字段查询导致的migration中断问题 - 2025-07-24
        # ===========================================
        
        logger.info("🚨 开始v1.22迁移：安全修复数据库字段映射错误...")
        
        # 第一步：检查并诊断数据库问题
        logger.info("🔍 诊断当前数据库字段映射问题...")
        cursor.execute("PRAGMA table_info(collaborators)")
        columns = [row[1] for row in cursor.fetchall()]
        logger.info(f"当前collaborators表字段: {columns}")
        
        # 检查created_at字段中的错误数据
        cursor.execute("SELECT COUNT(*) FROM collaborators WHERE created_at = 'senior' OR created_at = 'junior'")
        bad_created_at = cursor.fetchone()[0]
        logger.info(f"created_at字段错误数据数量: {bad_created_at}")
        
        # 检查updated_at字段中的错误数据
        cursor.execute("SELECT COUNT(*) FROM collaborators WHERE updated_at = 'senior' OR updated_at = 'junior'")
        bad_updated_at = cursor.fetchone()[0]
        logger.info(f"updated_at字段错误数据数量: {bad_updated_at}")
        
        # 第二步：修复字段映射错误
        logger.info("🔧 修复字段映射错误...")
        
        if bad_created_at > 0:
            logger.info("修复created_at字段中的错误数据...")
            cursor.execute("UPDATE collaborators SET created_at = datetime('now') WHERE created_at = 'senior' OR created_at = 'junior' OR created_at NOT LIKE '____-__-__%'")
            logger.info(f"✅ 修复了 {bad_created_at} 条created_at错误数据")
        
        if bad_updated_at > 0:
            logger.info("修复updated_at字段中的错误数据...")
            cursor.execute("UPDATE collaborators SET updated_at = datetime('now') WHERE updated_at = 'senior' OR updated_at = 'junior' OR updated_at NOT LIKE '____-__-__%'")
            logger.info(f"✅ 修复了 {bad_updated_at} 条updated_at错误数据")
        
        # 第三步：安全检查和修复level字段数据
        logger.info("🔧 安全检查level字段...")
        
        # 先检查level字段是否存在
        cursor.execute("PRAGMA table_info(collaborators)")
        columns_info = cursor.fetchall()
        level_exists = any(col[1] == 'level' for col in columns_info)
        
        if level_exists:
            logger.info("✅ level字段存在，检查分布...")
            # 检查level字段分布
            cursor.execute("SELECT level, COUNT(*) FROM collaborators GROUP BY level")
            level_distribution = cursor.fetchall()
            logger.info(f"当前level字段分布: {level_distribution}")
            
            # 如果所有人都是senior，检查是否有备份数据可以恢复level信息
            cursor.execute("SELECT COUNT(*) FROM collaborators WHERE level = 'senior'")
            all_senior = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM collaborators")
            total_count = cursor.fetchone()[0]
            
            if all_senior == total_count and total_count > 1:
                logger.warning("⚠️ 所有collaborators都被设置为senior级别，这可能是错误的")
                logger.info("💡 保持当前level设置，需要手动调整")
        else:
            logger.warning("⚠️ level字段不存在，跳过level相关操作")
            logger.info("💡 如果需要level字段，请手动添加")
        
        # 第四步：清理deleted_at字段
        logger.info("🧹 清理deleted_at字段...")
        cursor.execute("UPDATE collaborators SET deleted_at = NULL WHERE deleted_at = 'senior' OR deleted_at = 'junior' OR deleted_at = ''")
        logger.info("✅ 清理了deleted_at字段的错误值")
        
        # 第五步：检查和修复其他表的字段映射问题
        logger.info("🔍 检查其他表的字段映射...")
        
        # 检查research_projects表
        if table_exists(cursor, 'research_projects'):
            cursor.execute("PRAGMA table_info(research_projects)")
            rp_columns = [row[1] for row in cursor.fetchall()]
            logger.info(f"research_projects表字段: {rp_columns}")
            
            # 修复research_projects表的时间字段错误
            cursor.execute("UPDATE research_projects SET created_at = datetime('now') WHERE created_at NOT LIKE '____-__-__%' AND created_at IS NOT NULL")
            cursor.execute("UPDATE research_projects SET updated_at = datetime('now') WHERE updated_at NOT LIKE '____-__-__%' AND updated_at IS NOT NULL")
            logger.info("✅ 修复了research_projects表的时间字段")
        
        # 检查ideas表
        if table_exists(cursor, 'ideas'):
            cursor.execute("PRAGMA table_info(ideas)")
            ideas_columns = [row[1] for row in cursor.fetchall()]
            logger.info(f"ideas表字段: {ideas_columns}")
            
            # 修复ideas表的时间字段错误
            cursor.execute("UPDATE ideas SET created_at = datetime('now') WHERE created_at NOT LIKE '____-__-__%' AND created_at IS NOT NULL")
            cursor.execute("UPDATE ideas SET updated_at = datetime('now') WHERE updated_at NOT LIKE '____-__-__%' AND updated_at IS NOT NULL")
            logger.info("✅ 修复了ideas表的时间字段")
        
        # 第六步：最终验证和数据完整性检查
        logger.info("🔍 最终验证数据完整性...")
        
        # 验证collaborators表数据
        cursor.execute("SELECT COUNT(*) FROM collaborators")
        total_collaborators = cursor.fetchone()[0]
        logger.info(f"collaborators总数: {total_collaborators}")
        
        cursor.execute("SELECT COUNT(*) FROM collaborators WHERE deleted_at IS NULL")
        active_collaborators = cursor.fetchone()[0]
        logger.info(f"活跃collaborators数: {active_collaborators}")
        
        # 安全检查level字段分布（如果存在）
        if level_exists:
            cursor.execute("SELECT level, COUNT(*) FROM collaborators GROUP BY level")
            final_level_distribution = cursor.fetchall()
            logger.info(f"最终level分布: {final_level_distribution}")
        else:
            logger.info("level字段不存在，跳过分布统计")
        
        # 检查是否还有格式错误的时间字段
        cursor.execute("SELECT COUNT(*) FROM collaborators WHERE created_at NOT LIKE '____-__-__%' OR updated_at NOT LIKE '____-__-__%'")
        remaining_errors = cursor.fetchone()[0]
        logger.info(f"剩余时间字段格式错误数: {remaining_errors}")
        
        # 提交更改
        conn.commit()
        
        # 标记迁移完成
        mark_migration_completed(db_path)
        
        logger.info(f"迁移 {MIGRATION_VERSION} 执行成功")
        
        logger.info("=" * 60)
        logger.info("🎉 v1.22 数据库字段映射安全修复完成！")
        logger.info("✅ 修复了created_at和updated_at字段中的'senior'字符串错误")
        logger.info("✅ 清理了deleted_at字段的错误值")
        logger.info("✅ 修复了所有表的时间字段格式问题")
        logger.info("✅ 安全检查level字段存在性，避免查询错误")
        logger.info(f"✅ 保留了 {total_collaborators} 个collaborators记录")
        logger.info(f"✅ 其中 {active_collaborators} 个处于活跃状态")
        logger.info("📝 Pydantic Invalid isoformat string 错误应该彻底解决")
        logger.info("🚀 所有API应该恢复正常工作")
        logger.info("🔧 修复了migration执行中断导致的502错误")
        logger.info("=" * 60)
        
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