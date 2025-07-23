#!/usr/bin/env python3
"""
用户独立待办功能数据库迁移
- 创建user_project_todos表
- 支持每个用户有自己独立的待办项目列表
"""

import sqlite3
import sys
import os
import logging
from datetime import datetime

# 导入迁移工具
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from migrations.migration_utils import setup_migration_logging, find_database_path, backup_database, get_table_columns, table_exists

logger = setup_migration_logging()

# 迁移版本号 - 添加用户独立待办功能  
MIGRATION_VERSION = "v1.14_user_todos"

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
        # 🔧 v1.14迁移任务：添加用户独立待办功能
        # ===========================================
        
        logger.info("开始添加用户独立待办功能...")
        
        # 步骤1：创建user_project_todos表
        if not table_exists(cursor, 'user_project_todos'):
            logger.info("创建user_project_todos表...")
            
            cursor.execute("""
                CREATE TABLE user_project_todos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    project_id INTEGER NOT NULL,
                    marked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    priority INTEGER DEFAULT 0,
                    notes TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (project_id) REFERENCES research_projects(id) ON DELETE CASCADE,
                    UNIQUE(user_id, project_id)
                )
            """)
            
            # 创建索引
            cursor.execute("CREATE INDEX idx_user_todos_user ON user_project_todos(user_id)")
            cursor.execute("CREATE INDEX idx_user_todos_project ON user_project_todos(project_id)")
            cursor.execute("CREATE INDEX idx_user_todos_marked ON user_project_todos(marked_at DESC)")
            
            logger.info("✅ user_project_todos表创建成功")
        else:
            logger.info("user_project_todos表已存在，跳过创建")
        
        # 步骤2：迁移现有的is_todo数据（如果有）
        logger.info("检查是否需要迁移现有待办数据...")
        
        # 检查research_projects表是否有is_todo字段
        project_columns = get_table_columns(cursor, 'research_projects')
        if 'is_todo' in project_columns:
            # 获取所有标记为待办的项目
            cursor.execute("""
                SELECT id, todo_marked_at 
                FROM research_projects 
                WHERE is_todo = 1
            """)
            todo_projects = cursor.fetchall()
            
            if todo_projects:
                logger.info(f"发现 {len(todo_projects)} 个待办项目需要迁移")
                
                # 获取第一个用户（假设是主用户）
                cursor.execute("SELECT id FROM users LIMIT 1")
                user_result = cursor.fetchone()
                
                if user_result:
                    user_id = user_result[0]
                    
                    # 为每个待办项目创建用户关联
                    for project_id, marked_at in todo_projects:
                        cursor.execute("""
                            INSERT OR IGNORE INTO user_project_todos 
                            (user_id, project_id, marked_at, priority) 
                            VALUES (?, ?, ?, ?)
                        """, (user_id, project_id, marked_at or datetime.utcnow(), 1))
                    
                    logger.info(f"✅ 成功迁移 {len(todo_projects)} 个待办项目")
                else:
                    logger.warning("未找到用户，跳过待办数据迁移")
            else:
                logger.info("没有需要迁移的待办数据")
        
        # 步骤3：验证表结构
        logger.info("验证user_project_todos表结构...")
        
        todos_columns = get_table_columns(cursor, 'user_project_todos')
        expected_columns = [
            'id', 'user_id', 'project_id', 'marked_at', 
            'priority', 'notes', 'created_at', 'updated_at'
        ]
        
        missing_columns = []
        for col in expected_columns:
            if col not in todos_columns:
                missing_columns.append(col)
        
        if missing_columns:
            logger.error(f"❌ user_project_todos表缺少必要列: {missing_columns}")
            raise Exception(f"数据库结构验证失败，缺少列: {missing_columns}")
        else:
            logger.info("✅ user_project_todos表结构验证成功")
        
        # 提交更改
        conn.commit()
        conn.close()
        
        # 标记迁移完成
        mark_migration_completed(db_path)
        
        logger.info(f"迁移 {MIGRATION_VERSION} 执行成功")
        
        # 输出迁移结果统计
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 统计数据
        cursor.execute("SELECT COUNT(*) FROM user_project_todos")
        todo_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(DISTINCT user_id) FROM user_project_todos")
        user_with_todos = cursor.fetchone()[0]
        
        conn.close()
        
        logger.info("=" * 60)
        logger.info("🎉 用户独立待办功能添加完成！")
        logger.info(f"📊 系统数据统计:")
        logger.info(f"   - 待办记录: {todo_count}")
        logger.info(f"   - 有待办的用户: {user_with_todos}")
        logger.info("✅ 用户现在可以拥有自己独立的待办项目列表")
        logger.info("✅ 待办数据将持久化存储，不会因清除缓存而丢失")
        logger.info("=" * 60)
        
        return True
        
    except Exception as e:
        logger.error(f"迁移执行失败: {e}")
        logger.info(f"数据库备份位于: {backup_path}")
        return False

if __name__ == "__main__":
    logger.info(f"迁移版本: {MIGRATION_VERSION}")
    success = run_migration()
    sys.exit(0 if success else 1)