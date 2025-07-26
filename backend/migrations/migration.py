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

# 迁移版本号 - Ideas管理完全重写
MIGRATION_VERSION = "v1.35_ideas_management_rewrite"

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
        # 🔧 v1.35迁移任务：Ideas管理完全重写
        # 变更：完全重新设计ideas表结构，简化字段，优化用户体验
        # 新结构：project_name, project_description, research_method, source, responsible_person, maturity
        # ===========================================
        
        logger.info("🔧 开始v1.35迁移：Ideas管理完全重写...")
        logger.info("🎯 目标：重新设计ideas表结构，简化字段设计，提升用户体验")
        
        # 第一步：检查现有的ideas表结构
        logger.info("📋 检查现有ideas表结构...")
        has_old_data = False
        old_data = []
        
        if table_exists(cursor, 'ideas'):
            cursor.execute("PRAGMA table_info(ideas)")
            columns = cursor.fetchall()
            column_names = [col[1] for col in columns]
            logger.info(f"当前ideas表字段: {', '.join(column_names)}")
            
            # 备份现有数据
            cursor.execute("SELECT * FROM ideas")
            old_data = cursor.fetchall()
            has_old_data = len(old_data) > 0
            logger.info(f"📊 发现 {len(old_data)} 条现有数据")
            
            # 重命名旧表
            logger.info("📋 重命名旧表...")
            cursor.execute("ALTER TABLE ideas RENAME TO ideas_backup_v135")
        
        # 第二步：创建新的ideas表结构
        logger.info("📋 创建新的ideas表（重新设计的结构）...")
        cursor.execute("""
            CREATE TABLE ideas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_name TEXT NOT NULL,
                project_description TEXT,
                research_method TEXT NOT NULL,
                source TEXT,
                responsible_person TEXT NOT NULL,
                maturity VARCHAR(20) NOT NULL DEFAULT 'immature',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # 创建索引
        cursor.execute("CREATE INDEX idx_ideas_maturity ON ideas(maturity)")
        cursor.execute("CREATE INDEX idx_ideas_responsible_person ON ideas(responsible_person)")
        cursor.execute("CREATE INDEX idx_ideas_created_at ON ideas(created_at)")
        
        logger.info("✅ 新ideas表创建成功（重新设计的结构）")
        
        # 第三步：迁移现有数据（如果有的话）
        if has_old_data:
            logger.info("📋 开始迁移现有数据...")
            
            # 获取旧表的列结构
            cursor.execute("PRAGMA table_info(ideas_backup_v135)")
            old_columns = {col[1]: i for i, col in enumerate(cursor.fetchall())}
            
            migrated_count = 0
            for row in old_data:
                try:
                    # 智能字段映射
                    project_name = ""
                    if 'project_name' in old_columns:
                        project_name = row[old_columns['project_name']] or ""
                    elif 'research_question' in old_columns:
                        project_name = row[old_columns['research_question']] or ""
                    elif 'title' in old_columns:
                        project_name = row[old_columns['title']] or ""
                    
                    project_description = ""
                    if 'project_description' in old_columns:
                        project_description = row[old_columns['project_description']]
                    elif 'description' in old_columns:
                        project_description = row[old_columns['description']]
                    
                    research_method = ""
                    if 'research_method' in old_columns:
                        research_method = row[old_columns['research_method']] or ""
                    
                    source = ""
                    if 'source' in old_columns:
                        source = row[old_columns['source']]
                    elif 'source_journal' in old_columns and 'source_literature' in old_columns:
                        journal = row[old_columns['source_journal']] or ""
                        literature = row[old_columns['source_literature']] or ""
                        source = f"{journal} {literature}".strip()
                    
                    responsible_person = ""
                    if 'responsible_person' in old_columns:
                        responsible_person = row[old_columns['responsible_person']] or ""
                    
                    maturity = "immature"
                    if 'maturity' in old_columns:
                        maturity = row[old_columns['maturity']] or "immature"
                    
                    created_at = datetime.now()
                    if 'created_at' in old_columns:
                        created_at = row[old_columns['created_at']] or datetime.now()
                    
                    updated_at = datetime.now()
                    if 'updated_at' in old_columns:
                        updated_at = row[old_columns['updated_at']] or datetime.now()
                    
                    # 只有当必填字段不为空时才插入
                    if project_name and research_method and responsible_person:
                        cursor.execute("""
                            INSERT INTO ideas (
                                project_name, project_description, research_method, 
                                source, responsible_person, maturity, 
                                created_at, updated_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            project_name, project_description, research_method,
                            source, responsible_person, maturity,
                            created_at, updated_at
                        ))
                        migrated_count += 1
                    else:
                        logger.warning(f"跳过数据行：必填字段缺失 - project_name: '{project_name}', research_method: '{research_method}', responsible_person: '{responsible_person}'")
                
                except Exception as e:
                    logger.error(f"迁移数据行失败: {e}")
                    continue
            
            logger.info(f"✅ 成功迁移 {migrated_count} 条数据（共 {len(old_data)} 条）")
        else:
            logger.info("ℹ️ 没有现有数据需要迁移")
        
        # 最终验证
        logger.info("🔍 最终验证...")
        cursor.execute("PRAGMA table_info(ideas)")
        columns = cursor.fetchall()
        logger.info("✅ ideas表最终结构:")
        for col in columns:
            nullable = "NULL" if col[3] == 0 else "NOT NULL"
            default = f" DEFAULT {col[4]}" if col[4] else ""
            logger.info(f"  - {col[1]}: {col[2]} {nullable}{default}")
        
        # 检查索引
        cursor.execute("PRAGMA index_list(ideas)")
        indexes = cursor.fetchall()
        logger.info(f"✅ 创建的索引: {', '.join([idx[1] for idx in indexes])}")
        
        # 提交更改并标记完成
        conn.commit()
        mark_migration_completed(db_path)
        
        logger.info(f"迁移 {MIGRATION_VERSION} 执行成功")
        
        logger.info("======================================================================")
        logger.info("🎉 v1.35 Ideas管理完全重写完成！")
        logger.info("✅ 新的简化表结构已创建")
        logger.info("✅ 字段映射：project_name, project_description, research_method, source, responsible_person, maturity")
        logger.info("✅ 现有数据已智能迁移")
        logger.info("✅ 索引已优化")
        logger.info("✅ 前后端代码已完全重写")
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