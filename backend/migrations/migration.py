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

# 迁移版本号 - 为ideas表添加group字段
MIGRATION_VERSION = "v1.10_add_group_to_ideas"

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
        # 🔧 v1.10迁移任务：创建ideas表并添加group字段
        # ===========================================
        
        logger.info("开始检查ideas表...")
        
        # 检查ideas表是否存在
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='ideas'")
        if not cursor.fetchone():
            logger.info("ideas表不存在，开始创建...")
            
            # 创建ideas表
            cursor.execute("""
                CREATE TABLE ideas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title VARCHAR(200) NOT NULL,
                    description TEXT NOT NULL,
                    source VARCHAR(100),
                    source_literature_id INTEGER,
                    user_id INTEGER NOT NULL,
                    group_name VARCHAR(50),
                    difficulty_level VARCHAR(20),
                    estimated_duration VARCHAR(50),
                    required_skills VARCHAR(500),
                    potential_impact VARCHAR(20),
                    status VARCHAR(50) DEFAULT 'pool',
                    priority VARCHAR(20) DEFAULT 'medium',
                    tags VARCHAR(500),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (source_literature_id) REFERENCES literature(id),
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            """)
            logger.info("✅ ideas表创建成功")
            
            # 创建索引
            cursor.execute("CREATE INDEX idx_ideas_title ON ideas(title)")
            cursor.execute("CREATE INDEX idx_ideas_source ON ideas(source)")
            cursor.execute("CREATE INDEX idx_ideas_source_literature ON ideas(source_literature_id)")
            cursor.execute("CREATE INDEX idx_ideas_user_id ON ideas(user_id)")
            cursor.execute("CREATE INDEX idx_ideas_group_name ON ideas(group_name)")
            cursor.execute("CREATE INDEX idx_ideas_difficulty_level ON ideas(difficulty_level)")
            cursor.execute("CREATE INDEX idx_ideas_potential_impact ON ideas(potential_impact)")
            cursor.execute("CREATE INDEX idx_ideas_status ON ideas(status)")
            cursor.execute("CREATE INDEX idx_ideas_priority ON ideas(priority)")
            cursor.execute("CREATE INDEX idx_ideas_created_at ON ideas(created_at)")
            
            # 复合索引
            cursor.execute("CREATE INDEX idx_ideas_user_status ON ideas(user_id, status)")
            cursor.execute("CREATE INDEX idx_ideas_user_priority ON ideas(user_id, priority)")
            cursor.execute("CREATE INDEX idx_ideas_difficulty_impact ON ideas(difficulty_level, potential_impact)")
            cursor.execute("CREATE INDEX idx_ideas_created_user ON ideas(created_at, user_id)")
            cursor.execute("CREATE INDEX idx_ideas_group_status ON ideas(group_name, status)")
            cursor.execute("CREATE INDEX idx_ideas_group_priority ON ideas(group_name, priority)")
            
            logger.info("✅ ideas表的所有索引创建成功")
        else:
            logger.info("ideas表已存在，检查group_name字段...")
            
            # 检查group字段是否已存在
            cursor.execute("PRAGMA table_info(ideas)")
            columns = cursor.fetchall()
            column_names = [col[1] for col in columns]
            
            if 'group_name' in column_names:
                logger.info("ideas表的group_name字段已存在，跳过添加")
            else:
                # 添加group_name字段
                cursor.execute("""
                    ALTER TABLE ideas ADD COLUMN group_name VARCHAR(50) DEFAULT NULL
                """)
                logger.info("✅ ideas表的group_name字段添加成功")
                
                # 创建group_name的索引以提高查询性能
                cursor.execute("CREATE INDEX idx_ideas_group_name ON ideas(group_name)")
                cursor.execute("CREATE INDEX idx_ideas_group_status ON ideas(group_name, status)")
                cursor.execute("CREATE INDEX idx_ideas_group_priority ON ideas(group_name, priority)")
                logger.info("✅ ideas表的group_name索引创建成功")
                
                # 为现有数据设置默认分组(根据user_id)
                cursor.execute("""
                    UPDATE ideas 
                    SET group_name = CASE 
                        WHEN user_id = 1 THEN 'zl'
                        WHEN user_id = 2 THEN 'zz'
                        WHEN user_id = 3 THEN 'yq'
                        WHEN user_id = 4 THEN 'dj'
                        ELSE NULL
                    END
                    WHERE group_name IS NULL
                """)
                logger.info("✅ 已为现有ideas数据设置默认分组")
        
        # 提交更改
        conn.commit()
        conn.close()
        
        # 标记迁移完成
        mark_migration_completed(db_path)
        
        logger.info(f"迁移 {MIGRATION_VERSION} 执行成功")
        
        # 输出修复结果
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 安全地获取表数据
        project_count = 0
        collaborator_count = 0
        user_count = 0
        idea_count = 0
        group_counts = []
        
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
            # 检查ideas表
            cursor.execute("SELECT COUNT(*) FROM ideas")
            idea_count = cursor.fetchone()[0]
            
            # 检查各组的ideas数量
            cursor.execute("SELECT group_name, COUNT(*) FROM ideas WHERE group_name IS NOT NULL GROUP BY group_name")
            group_counts = cursor.fetchall()
        except:
            pass
        
        conn.close()
        
        logger.info("=" * 50)
        logger.info("🎉 数据库迁移完成！")
        logger.info(f"📊 数据统计:")
        logger.info(f"   - 用户: {user_count}")
        logger.info(f"   - 项目: {project_count}")
        logger.info(f"   - 合作者: {collaborator_count}")
        logger.info(f"   - Ideas: {idea_count}")
        
        if group_counts:
            logger.info("📊 Ideas分组统计:")
            for group_name, count in group_counts:
                logger.info(f"   - {group_name}: {count}")
        
        logger.info("✅ ideas表的group_name字段已添加，4个子面板功能已就绪")
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