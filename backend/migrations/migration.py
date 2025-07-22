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

# 迁移版本号 - 创建communication_logs表
MIGRATION_VERSION = "v1.9_create_communication_logs_table"

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
        # 🔧 v1.9迁移任务：创建communication_logs表
        # ===========================================
        
        logger.info("开始创建communication_logs表...")
        
        # 检查表是否已存在
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='communication_logs'")
        if cursor.fetchone():
            logger.info("communication_logs表已存在，跳过创建")
        else:
            # 创建communication_logs表
            cursor.execute("""
                CREATE TABLE communication_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_id INTEGER NOT NULL,
                    collaborator_id INTEGER,
                    communication_type VARCHAR(50),
                    title VARCHAR(200) NOT NULL,
                    content TEXT NOT NULL,
                    outcomes TEXT,
                    action_items TEXT,
                    communication_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (project_id) REFERENCES research_projects(id) ON DELETE CASCADE,
                    FOREIGN KEY (collaborator_id) REFERENCES collaborators(id)
                )
            """)
            logger.info("✅ communication_logs表创建成功")
            
            # 创建索引以提高查询性能
            cursor.execute("CREATE INDEX idx_communication_logs_project_id ON communication_logs(project_id)")
            cursor.execute("CREATE INDEX idx_communication_logs_collaborator_id ON communication_logs(collaborator_id)")
            cursor.execute("CREATE INDEX idx_communication_logs_communication_date ON communication_logs(communication_date)")
            logger.info("✅ communication_logs表索引创建成功")
        
        # 提交更改
        conn.commit()
        conn.close()
        
        # 标记迁移完成
        mark_migration_completed(db_path)
        
        logger.info(f"迁移 {MIGRATION_VERSION} 执行成功")
        
        # 输出修复结果
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM research_projects")
        project_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM collaborators")
        collaborator_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]
        
        # 检查communication_logs表
        cursor.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='communication_logs'")
        comm_logs_exists = cursor.fetchone()[0] > 0
        comm_count = 0
        if comm_logs_exists:
            cursor.execute("SELECT COUNT(*) FROM communication_logs")
            comm_count = cursor.fetchone()[0]
        
        conn.close()
        
        logger.info("=" * 50)
        logger.info("🎉 数据库迁移完成！")
        logger.info(f"📊 数据统计:")
        logger.info(f"   - 用户: {user_count}")
        logger.info(f"   - 项目: {project_count}")
        logger.info(f"   - 合作者: {collaborator_count}")
        
        if comm_logs_exists:
            logger.info(f"   - 交流记录: {comm_count}")
            logger.info("✅ communication_logs表已创建，交流进度功能已就绪")
        
        logger.info("=" * 50)
        
        return True
        
    except Exception as e:
        logger.error(f"迁移执行失败: {e}")
        logger.info(f"数据库备份位于: {backup_path}")
        return False

if __name__ == "__main__":
    logger.info(f"迁移版本: {MIGRATION_VERSION}")
    success = run_migration()
    sys.exit(0 if success else 1)