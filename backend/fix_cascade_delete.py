#!/usr/bin/env python3
"""
修复数据库级联删除问题的迁移脚本
"""
import sqlite3
import os
import logging
from datetime import datetime

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def backup_database(db_path):
    """创建数据库备份"""
    backup_path = f"{db_path}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    logger.info(f"创建数据库备份: {backup_path}")
    
    # 复制数据库文件
    import shutil
    shutil.copy2(db_path, backup_path)
    return backup_path

def fix_cascade_delete(db_path):
    """修复级联删除约束"""
    # 创建备份
    backup_path = backup_database(db_path)
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 启用外键约束
        cursor.execute("PRAGMA foreign_keys = ON")
        
        # 1. 创建新的交流日志表（带有正确的级联删除）
        logger.info("创建新的交流日志表")
        cursor.execute("""
            CREATE TABLE communication_logs_new (
                id INTEGER NOT NULL PRIMARY KEY,
                project_id INTEGER,
                collaborator_id INTEGER,
                communication_type VARCHAR(50),
                title VARCHAR(200) NOT NULL,
                content TEXT NOT NULL,
                outcomes TEXT,
                action_items TEXT,
                communication_date DATETIME,
                created_at DATETIME,
                updated_at DATETIME,
                FOREIGN KEY(project_id) REFERENCES research_projects(id) ON DELETE CASCADE,
                FOREIGN KEY(collaborator_id) REFERENCES collaborators(id) ON DELETE SET NULL
            )
        """)
        
        # 2. 复制数据到新表
        logger.info("复制数据到新表")
        cursor.execute("""
            INSERT INTO communication_logs_new 
            SELECT * FROM communication_logs
        """)
        
        # 3. 删除旧表
        logger.info("删除旧表")
        cursor.execute("DROP TABLE communication_logs")
        
        # 4. 重命名新表
        logger.info("重命名新表")
        cursor.execute("ALTER TABLE communication_logs_new RENAME TO communication_logs")
        
        # 5. 重建索引
        logger.info("重建索引")
        cursor.execute("CREATE INDEX ix_communication_logs_project_id ON communication_logs (project_id)")
        cursor.execute("CREATE INDEX ix_communication_logs_collaborator_id ON communication_logs (collaborator_id)")
        
        # 6. 同样处理项目-合作者关联表
        logger.info("修复项目-合作者关联表")
        cursor.execute("""
            CREATE TABLE project_collaborators_new (
                project_id INTEGER,
                collaborator_id INTEGER,
                FOREIGN KEY(project_id) REFERENCES research_projects(id) ON DELETE CASCADE,
                FOREIGN KEY(collaborator_id) REFERENCES collaborators(id) ON DELETE CASCADE,
                PRIMARY KEY (project_id, collaborator_id)
            )
        """)
        
        cursor.execute("""
            INSERT INTO project_collaborators_new 
            SELECT * FROM project_collaborators
        """)
        
        cursor.execute("DROP TABLE project_collaborators")
        cursor.execute("ALTER TABLE project_collaborators_new RENAME TO project_collaborators")
        
        # 提交更改
        conn.commit()
        logger.info("数据库迁移成功完成")
        
        # 验证外键约束
        cursor.execute("PRAGMA foreign_key_list(communication_logs)")
        fk_info = cursor.fetchall()
        logger.info("外键约束信息:")
        for fk in fk_info:
            logger.info(f"  - {fk}")
        
        conn.close()
        return True
        
    except Exception as e:
        logger.error(f"迁移失败: {str(e)}")
        logger.error(f"请从备份恢复: {backup_path}")
        if conn:
            conn.rollback()
            conn.close()
        return False

def main():
    db_path = "./research_dashboard.db"
    
    if not os.path.exists(db_path):
        logger.error(f"数据库文件不存在: {db_path}")
        return
    
    logger.info("开始修复数据库级联删除问题")
    success = fix_cascade_delete(db_path)
    
    if success:
        logger.info("数据库修复成功")
        logger.info("现在删除研究项目时，相关的交流日志将自动删除")
    else:
        logger.error("数据库修复失败，请检查错误信息")

if __name__ == "__main__":
    main()