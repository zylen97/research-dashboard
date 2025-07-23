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

# 迁移版本号 - 添加文献文件夹功能
MIGRATION_VERSION = "v1.11_add_literature_folders"

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
    # 如果设置了ENVIRONMENT环境变量，优先使用对应的数据库
    environment = os.environ.get('ENVIRONMENT', 'production')
    if environment == 'development':
        db_paths = [
            os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'research_dashboard_dev.db'),   # 开发环境
            os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'research_dashboard_prod.db'),  # 生产环境
            os.path.join(os.path.dirname(os.path.dirname(__file__)), 'research_dashboard.db')              # 默认
        ]
    else:
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
        # 🔧 v1.11迁移任务：添加文献文件夹功能
        # ===========================================
        
        logger.info("开始添加文献文件夹功能...")
        
        # 步骤1：检查并创建literature_folders表
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='literature_folders'")
        if not cursor.fetchone():
            logger.info("literature_folders表不存在，开始创建...")
            
            # 创建literature_folders表
            cursor.execute("""
                CREATE TABLE literature_folders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(100) NOT NULL,
                    parent_id INTEGER,
                    user_id INTEGER NOT NULL,
                    group_name VARCHAR(50),
                    description TEXT,
                    is_root BOOLEAN DEFAULT FALSE,
                    sort_order INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (parent_id) REFERENCES literature_folders(id),
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            """)
            logger.info("✅ literature_folders表创建成功")
            
            # 创建literature_folders表的索引
            cursor.execute("CREATE INDEX idx_folder_name ON literature_folders(name)")
            cursor.execute("CREATE INDEX idx_folder_parent_id ON literature_folders(parent_id)")
            cursor.execute("CREATE INDEX idx_folder_user_id ON literature_folders(user_id)")
            cursor.execute("CREATE INDEX idx_folder_group_name ON literature_folders(group_name)")
            cursor.execute("CREATE INDEX idx_folder_is_root ON literature_folders(is_root)")
            cursor.execute("CREATE INDEX idx_folder_created_at ON literature_folders(created_at)")
            
            # 复合索引
            cursor.execute("CREATE INDEX idx_folder_user_group ON literature_folders(user_id, group_name)")
            cursor.execute("CREATE INDEX idx_folder_parent_order ON literature_folders(parent_id, sort_order)")
            cursor.execute("CREATE INDEX idx_folder_group_root ON literature_folders(group_name, is_root)")
            
            logger.info("✅ literature_folders表的所有索引创建成功")
        else:
            logger.info("literature_folders表已存在，跳过创建")
        
        # 步骤2：为literature表添加folder_id字段
        logger.info("检查literature表的folder_id字段...")
        
        # 检查literature表是否存在folder_id字段
        cursor.execute("PRAGMA table_info(literature)")
        columns = cursor.fetchall()
        column_names = [col[1] for col in columns]
        
        if 'folder_id' not in column_names:
            logger.info("literature表缺少folder_id字段，开始添加...")
            
            # 添加folder_id字段
            cursor.execute("""
                ALTER TABLE literature ADD COLUMN folder_id INTEGER DEFAULT NULL
            """)
            logger.info("✅ literature表的folder_id字段添加成功")
            
            # 为folder_id字段创建索引
            cursor.execute("CREATE INDEX idx_literature_folder_id ON literature(folder_id)")
            cursor.execute("CREATE INDEX idx_literature_folder_user ON literature(folder_id, user_id)")
            
            logger.info("✅ literature表的folder_id索引创建成功")
        else:
            logger.info("literature表的folder_id字段已存在，跳过添加")
        
        # 步骤3：为每个用户创建默认根文件夹
        logger.info("开始为用户创建默认根文件夹...")
        
        # 获取所有用户
        cursor.execute("SELECT id, username FROM users")
        users = cursor.fetchall()
        
        for user_id, username in users:
            # 检查用户是否已有根文件夹
            cursor.execute("""
                SELECT id FROM literature_folders 
                WHERE user_id = ? AND is_root = 1
            """, (user_id,))
            
            if not cursor.fetchone():
                # 创建默认根文件夹
                cursor.execute("""
                    INSERT INTO literature_folders (name, user_id, group_name, is_root, description, sort_order)
                    VALUES (?, ?, ?, 1, '默认根文件夹', 0)
                """, (f"{username}的文献", user_id, username))
                
                logger.info(f"✅ 已为用户 {username} 创建根文件夹")
        
        # 步骤4：创建一些基础分类文件夹
        logger.info("开始创建基础分类文件夹...")
        
        # 为每个用户创建常用的分类文件夹
        basic_categories = [
            ("待阅读", "新导入的文献，等待阅读"),
            ("已阅读", "已经阅读完成的文献"),
            ("重要文献", "标记为重要的文献"),
            ("参考文献", "用作参考的文献")
        ]
        
        for user_id, username in users:
            # 获取根文件夹ID
            cursor.execute("""
                SELECT id FROM literature_folders 
                WHERE user_id = ? AND is_root = 1 
                LIMIT 1
            """, (user_id,))
            
            root_folder = cursor.fetchone()
            if root_folder:
                root_folder_id = root_folder[0]
                
                for i, (category_name, category_desc) in enumerate(basic_categories):
                    # 检查分类文件夹是否已存在
                    cursor.execute("""
                        SELECT id FROM literature_folders 
                        WHERE parent_id = ? AND name = ?
                    """, (root_folder_id, category_name))
                    
                    if not cursor.fetchone():
                        cursor.execute("""
                            INSERT INTO literature_folders 
                            (name, parent_id, user_id, group_name, description, sort_order)
                            VALUES (?, ?, ?, ?, ?, ?)
                        """, (category_name, root_folder_id, user_id, username, category_desc, i + 1))
                
                logger.info(f"✅ 已为用户 {username} 创建基础分类文件夹")
        
        # 提交更改
        conn.commit()
        conn.close()
        
        # 标记迁移完成
        mark_migration_completed(db_path)
        
        logger.info(f"迁移 {MIGRATION_VERSION} 执行成功")
        
        # 输出迁移结果统计
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 安全地获取表数据
        project_count = 0
        collaborator_count = 0
        user_count = 0
        literature_count = 0
        folder_count = 0
        folder_stats = []
        
        try:
            cursor.execute("SELECT COUNT(*) FROM research_projects")
            project_count = cursor.fetchone()[0]
        except:
            pass
            
        try:
            cursor.execute("SELECT COUNT(*) FROM collaborators")
            collaborator_count = cursor.fetchone()[0]
        except:
            pass
            
        try:
            cursor.execute("SELECT COUNT(*) FROM users")
            user_count = cursor.fetchone()[0]
        except:
            pass
        
        try:
            cursor.execute("SELECT COUNT(*) FROM literature")
            literature_count = cursor.fetchone()[0]
        except:
            pass
        
        try:
            # 检查文件夹统计
            cursor.execute("SELECT COUNT(*) FROM literature_folders")
            folder_count = cursor.fetchone()[0]
            
            # 各用户的文件夹统计
            cursor.execute("""
                SELECT u.username, COUNT(lf.id) as folder_count,
                       SUM(CASE WHEN lf.is_root = 1 THEN 1 ELSE 0 END) as root_folders
                FROM users u
                LEFT JOIN literature_folders lf ON u.id = lf.user_id
                GROUP BY u.id, u.username
                ORDER BY u.username
            """)
            folder_stats = cursor.fetchall()
        except:
            pass
        
        conn.close()
        
        logger.info("=" * 60)
        logger.info("🎉 文献文件夹功能迁移完成！")
        logger.info(f"📊 系统数据统计:")
        logger.info(f"   - 用户: {user_count}")
        logger.info(f"   - 项目: {project_count}")
        logger.info(f"   - 合作者: {collaborator_count}")
        logger.info(f"   - 文献: {literature_count}")
        logger.info(f"   - 文件夹: {folder_count}")
        
        if folder_stats:
            logger.info("📁 文件夹分布统计:")
            for username, folder_count, root_folders in folder_stats:
                logger.info(f"   - {username}: {folder_count}个文件夹 (包含{root_folders}个根文件夹)")
        
        logger.info("✅ 文献文件夹功能已就绪，支持层级组织和分组管理")
        logger.info("✅ 每个用户已自动创建根文件夹和基础分类文件夹")
        logger.info("✅ literature表已支持文件夹关联")
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