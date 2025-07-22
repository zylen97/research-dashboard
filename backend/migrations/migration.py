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

# 迁移版本号 - 修复缺失的字段（数据共享模式）- 强制执行
MIGRATION_VERSION = "v1.8_force_fix_missing_fields_500_errors"

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
        # 🔧 v1.7迁移任务：修复缺失的字段（数据共享模式）
        # ===========================================
        
        # 1. 修复research_projects表 - 添加缺失的字段
        logger.info("检查research_projects表结构...")
        cursor.execute("PRAGMA table_info(research_projects)")
        columns = cursor.fetchall()
        existing_columns = [col[1] for col in columns]
        
        # 添加缺失的字段
        if 'user_id' not in existing_columns:
            logger.info("为research_projects表添加user_id字段...")
            cursor.execute("ALTER TABLE research_projects ADD COLUMN user_id INTEGER")
            logger.info("✅ user_id字段已添加")
        else:
            logger.info("research_projects表已有user_id字段")
            
        if 'is_todo' not in existing_columns:
            logger.info("为research_projects表添加is_todo字段...")
            cursor.execute("ALTER TABLE research_projects ADD COLUMN is_todo BOOLEAN DEFAULT 0")
            logger.info("✅ is_todo字段已添加")
        else:
            logger.info("research_projects表已有is_todo字段")
            
        if 'todo_marked_at' not in existing_columns:
            logger.info("为research_projects表添加todo_marked_at字段...")
            cursor.execute("ALTER TABLE research_projects ADD COLUMN todo_marked_at DATETIME")
            logger.info("✅ todo_marked_at字段已添加")
        else:
            logger.info("research_projects表已有todo_marked_at字段")
        
        # 为现有项目设置合理的user_id（用于前端分类展示，不是权限控制）
        cursor.execute("SELECT COUNT(*) FROM research_projects WHERE user_id IS NULL")
        null_projects = cursor.fetchone()[0]
        
        if null_projects > 0:
            logger.info(f"为{null_projects}个项目设置默认user_id（用于前端分类展示）...")
            # 获取用户ID
            cursor.execute("SELECT id FROM users WHERE username = 'zl'")
            zl_user_result = cursor.fetchone()
            if zl_user_result:
                zl_user_id = zl_user_result[0]
                cursor.execute("UPDATE research_projects SET user_id = ? WHERE user_id IS NULL", (zl_user_id,))
                logger.info(f"✅ 已将{null_projects}个项目设置为zl用户分类（数据仍然共享）")
            else:
                logger.warning("未找到zl用户，设置user_id为1")
                cursor.execute("UPDATE research_projects SET user_id = 1 WHERE user_id IS NULL")
        
        # 2. 修复collaborators表 - 添加缺失的字段
        logger.info("检查collaborators表结构...")
        cursor.execute("PRAGMA table_info(collaborators)")
        columns = cursor.fetchall()
        existing_columns = [col[1] for col in columns]
        
        if 'class_info' not in existing_columns:
            logger.info("为collaborators表添加class_info字段...")
            cursor.execute("ALTER TABLE collaborators ADD COLUMN class_info VARCHAR(100)")
            logger.info("✅ class_info字段已添加")
        else:
            logger.info("collaborators表已有class_info字段")
            
        if 'is_senior' not in existing_columns:
            logger.info("为collaborators表添加is_senior字段...")
            cursor.execute("ALTER TABLE collaborators ADD COLUMN is_senior BOOLEAN DEFAULT 0")
            logger.info("✅ is_senior字段已添加")
        else:
            logger.info("collaborators表已有is_senior字段")
        
        # 为现有合作者设置默认值
        cursor.execute("SELECT COUNT(*) FROM collaborators WHERE class_info IS NULL")
        null_collaborators = cursor.fetchone()[0]
        
        if null_collaborators > 0:
            logger.info(f"为{null_collaborators}个合作者设置默认class_info...")
            cursor.execute("UPDATE collaborators SET class_info = '未分类' WHERE class_info IS NULL OR class_info = ''")
            logger.info(f"✅ 已为{null_collaborators}个合作者设置默认班级信息")
        
        # 3. 确保literature和ideas表有user_id字段（如果不存在）
        logger.info("检查literature表结构...")
        cursor.execute("PRAGMA table_info(literature)")
        columns = cursor.fetchall()
        if not any(col[1] == 'user_id' for col in columns):
            logger.info("为literature表添加user_id字段...")
            cursor.execute("ALTER TABLE literature ADD COLUMN user_id INTEGER")
            cursor.execute("UPDATE literature SET user_id = 1 WHERE user_id IS NULL")  # 设置默认分类
            logger.info("✅ literature表user_id字段已添加")
        else:
            logger.info("literature表已有user_id字段")
        
        logger.info("检查ideas表结构...")
        cursor.execute("PRAGMA table_info(ideas)")
        columns = cursor.fetchall()
        if not any(col[1] == 'user_id' for col in columns):
            logger.info("为ideas表添加user_id字段...")
            cursor.execute("ALTER TABLE ideas ADD COLUMN user_id INTEGER")
            cursor.execute("UPDATE ideas SET user_id = 1 WHERE user_id IS NULL")  # 设置默认分类
            logger.info("✅ ideas表user_id字段已添加")
        else:
            logger.info("ideas表已有user_id字段")
        
        # 4. 创建必要的索引
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_research_projects_user_id ON research_projects(user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_literature_user_id ON literature(user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_ideas_user_id ON ideas(user_id)")
        logger.info("✅ 索引创建完成")
        
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
        
        conn.close()
        
        logger.info("=" * 50)
        logger.info("🎉 数据库修复完成！")
        logger.info(f"📊 数据统计:")
        logger.info(f"   - 用户: {user_count}")
        logger.info(f"   - 项目: {project_count}")
        logger.info(f"   - 合作者: {collaborator_count}")
        logger.info("📝 注意: 所有数据现在都是共享的，user_id仅用于前端分类展示")
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