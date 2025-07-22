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

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 迁移版本号 - 每次修改此文件时递增
MIGRATION_VERSION = "v1.6_add_todo_fields_to_research_projects"

def backup_database(db_path):
    """创建数据库备份"""
    backup_path = f"{db_path}.backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    import shutil
    shutil.copy2(db_path, backup_path)
    logger.info(f"数据库已备份到: {backup_path}")
    return backup_path

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
    # 检查所有可能的数据库路径（按优先级排序）
    db_paths = [
        os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'research_dashboard_prod.db'),  # 生产环境
        os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'research_dashboard_dev.db'),   # 开发环境
        os.path.join(os.path.dirname(os.path.dirname(__file__)), 'research_dashboard.db')              # 默认
    ]
    
    db_path = None
    for path in db_paths:
        if os.path.exists(path):
            db_path = path
            break
    
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
        # 🔧 当前迁移任务：为research_projects表添加is_todo和todo_marked_at字段
        # ===========================================
        
        # 1. 处理literature表
        cursor.execute("PRAGMA table_info(literature)")
        columns = cursor.fetchall()
        has_literature_user_id = any(col[1] == 'user_id' for col in columns)
        
        if not has_literature_user_id:
            logger.info("为literature表添加user_id字段...")
            cursor.execute("ALTER TABLE literature ADD COLUMN user_id INTEGER")
            logger.info("literature表的user_id字段已添加")
            
            # 获取4个用户的ID
            cursor.execute("SELECT id, username FROM users WHERE username IN ('zl', 'zz', 'yq', 'dj') ORDER BY username")
            users = cursor.fetchall()
            
            if users:
                # 获取现有文献数量
                cursor.execute("SELECT COUNT(*) FROM literature WHERE user_id IS NULL")
                literature_count = cursor.fetchone()[0]
                
                if literature_count > 0:
                    logger.info(f"找到{literature_count}条文献需要分配给用户")
                    
                    # 平均分配给4个用户
                    cursor.execute("SELECT id FROM literature WHERE user_id IS NULL ORDER BY id")
                    literature_ids = [row[0] for row in cursor.fetchall()]
                    
                    for i, lit_id in enumerate(literature_ids):
                        user_id = users[i % len(users)][0]
                        cursor.execute("UPDATE literature SET user_id = ? WHERE id = ?", (user_id, lit_id))
                    
                    logger.info("已将现有文献平均分配给4个用户")
            
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_literature_user_id ON literature(user_id)")
            logger.info("已创建literature表的user_id索引")
        else:
            logger.info("literature表已经有user_id字段，跳过此步骤")
        
        # 2. 处理ideas表
        cursor.execute("PRAGMA table_info(ideas)")
        columns = cursor.fetchall()
        has_ideas_user_id = any(col[1] == 'user_id' for col in columns)
        
        if not has_ideas_user_id:
            logger.info("为ideas表添加user_id字段...")
            cursor.execute("ALTER TABLE ideas ADD COLUMN user_id INTEGER")
            logger.info("ideas表的user_id字段已添加")
            
            # 获取4个用户的ID
            cursor.execute("SELECT id, username FROM users WHERE username IN ('zl', 'zz', 'yq', 'dj') ORDER BY username")
            users = cursor.fetchall()
            
            if users:
                # 获取现有ideas数量
                cursor.execute("SELECT COUNT(*) FROM ideas WHERE user_id IS NULL")
                ideas_count = cursor.fetchone()[0]
                
                if ideas_count > 0:
                    logger.info(f"找到{ideas_count}条ideas需要分配给用户")
                    
                    # 对于从文献转换来的ideas，使用文献的user_id
                    cursor.execute("""
                        UPDATE ideas 
                        SET user_id = (
                            SELECT l.user_id 
                            FROM literature l 
                            WHERE l.id = ideas.source_literature_id
                        )
                        WHERE source_literature_id IS NOT NULL 
                        AND user_id IS NULL
                        AND EXISTS (
                            SELECT 1 FROM literature l 
                            WHERE l.id = ideas.source_literature_id 
                            AND l.user_id IS NOT NULL
                        )
                    """)
                    
                    # 对于其他ideas，平均分配
                    cursor.execute("SELECT id FROM ideas WHERE user_id IS NULL ORDER BY id")
                    remaining_ideas = [row[0] for row in cursor.fetchall()]
                    
                    for i, idea_id in enumerate(remaining_ideas):
                        user_id = users[i % len(users)][0]
                        cursor.execute("UPDATE ideas SET user_id = ? WHERE id = ?", (user_id, idea_id))
                    
                    logger.info("已将现有ideas合理分配给4个用户")
            
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_ideas_user_id ON ideas(user_id)")
            logger.info("已创建ideas表的user_id索引")
        else:
            logger.info("ideas表已经有user_id字段，跳过此步骤")
        
        # ===========================================
        # 🔧 验证迁移结果
        # ===========================================
        
        # 验证literature表
        cursor.execute("SELECT COUNT(*) FROM literature WHERE user_id IS NULL")
        null_lit_count = cursor.fetchone()[0]
        if null_lit_count > 0:
            logger.warning(f"警告：还有{null_lit_count}条文献没有user_id")
        
        # 验证ideas表
        cursor.execute("SELECT COUNT(*) FROM ideas WHERE user_id IS NULL")
        null_idea_count = cursor.fetchone()[0]
        if null_idea_count > 0:
            logger.warning(f"警告：还有{null_idea_count}条ideas没有user_id")
        
        # 显示分配结果
        cursor.execute("""
            SELECT u.username, COUNT(l.id) as literature_count
            FROM users u
            LEFT JOIN literature l ON u.id = l.user_id
            WHERE u.username IN ('zl', 'zz', 'yq', 'dj')
            GROUP BY u.username
        """)
        lit_stats = cursor.fetchall()
        logger.info("文献分配统计：")
        for username, count in lit_stats:
            logger.info(f"  {username}: {count}条文献")
        
        cursor.execute("""
            SELECT u.username, COUNT(i.id) as idea_count
            FROM users u
            LEFT JOIN ideas i ON u.id = i.user_id
            WHERE u.username IN ('zl', 'zz', 'yq', 'dj')
            GROUP BY u.username
        """)
        idea_stats = cursor.fetchall()
        logger.info("Ideas分配统计：")
        for username, count in idea_stats:
            logger.info(f"  {username}: {count}条ideas")
        
        # ===========================================
        # 🔧 创建system_configs表
        # ===========================================
        
        # 检查system_configs表是否存在
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='system_configs'
        """)
        if not cursor.fetchone():
            logger.info("创建system_configs表...")
            cursor.execute("""
                CREATE TABLE system_configs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    key VARCHAR(100) UNIQUE NOT NULL,
                    value TEXT NOT NULL,
                    category VARCHAR(50) NOT NULL DEFAULT 'general',
                    description VARCHAR(500),
                    is_encrypted BOOLEAN DEFAULT FALSE,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    created_by_id INTEGER,
                    updated_by_id INTEGER,
                    FOREIGN KEY (created_by_id) REFERENCES users (id),
                    FOREIGN KEY (updated_by_id) REFERENCES users (id)
                )
            """)
            logger.info("system_configs表创建成功")
            
            # 创建索引
            cursor.execute("CREATE INDEX idx_system_configs_key ON system_configs(key)")
            cursor.execute("CREATE INDEX idx_system_configs_category ON system_configs(category)")
            logger.info("system_configs表索引创建成功")
            
            # 插入一些默认配置
            cursor.execute("SELECT id FROM users WHERE username = 'zl' LIMIT 1")
            admin_user = cursor.fetchone()
            if admin_user:
                admin_id = admin_user[0]
                cursor.execute("""
                    INSERT INTO system_configs (key, value, category, description, created_by_id, updated_by_id)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, ('system_name', 'USTS科研管理系统', 'system', '系统名称', admin_id, admin_id))
                logger.info("添加了默认系统配置")
        else:
            logger.info("system_configs表已存在，跳过创建")
        
        # 提交更改
        conn.commit()
        
        # 验证更改
        cursor.execute("PRAGMA table_info(ideas)")
        columns = cursor.fetchall()
        has_user_id = any(col[1] == 'user_id' for col in columns)
        if has_user_id:
            logger.info("验证成功: ideas表已包含user_id字段")
            
            # 检查是否有ideas记录以及它们的user_id
            cursor.execute("SELECT COUNT(*) FROM ideas WHERE user_id IS NOT NULL")
            count = cursor.fetchone()[0]
            logger.info(f"已有 {count} 条ideas记录设置了user_id")
        
        # 标记迁移完成
        mark_migration_completed(db_path)
        
        conn.close()
        logger.info(f"迁移 {MIGRATION_VERSION} 执行成功")
        return True
        
    except Exception as e:
        logger.error(f"迁移执行失败: {str(e)}")
        logger.error(f"数据库已备份在: {backup_path}")
        if conn:
            conn.rollback()
            conn.close()
        return False

if __name__ == "__main__":
    logger.info("=== 数据库迁移工具 ===")
    logger.info(f"迁移版本: {MIGRATION_VERSION}")
    
    success = run_migration()
    
    if success:
        logger.info("迁移完成")
    else:
        logger.error("迁移失败")
        sys.exit(1)