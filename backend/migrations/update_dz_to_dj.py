#!/usr/bin/env python3
"""
数据库迁移脚本：将用户名dz更新为dj
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

# 添加项目根目录到 Python 路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def backup_database(db_path):
    """创建数据库备份"""
    backup_path = f"{db_path}.backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    import shutil
    shutil.copy2(db_path, backup_path)
    logger.info(f"数据库已备份到: {backup_path}")
    return backup_path

def update_user_dz_to_dj():
    """将用户名dz更新为dj"""
    # 检查两个可能的数据库路径
    db_paths = [
        os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'research_dashboard_dev.db'),
        os.path.join(os.path.dirname(os.path.dirname(__file__)), 'research_dashboard.db')
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
    
    # 备份数据库
    backup_path = backup_database(db_path)
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        logger.info("开始更新用户信息")
        
        # 检查是否存在dz用户
        cursor.execute("SELECT * FROM users WHERE username = 'dz'")
        dz_user = cursor.fetchone()
        
        if dz_user:
            logger.info("找到dz用户，开始更新...")
            
            # 更新用户信息
            cursor.execute("""
                UPDATE users 
                SET username = 'dj', 
                    email = 'dj@example.com', 
                    display_name = 'DJ'
                WHERE username = 'dz'
            """)
            
            logger.info("用户信息已更新: dz -> dj")
        else:
            logger.info("未找到dz用户，可能已经更新过或不存在")
        
        # 提交更改
        conn.commit()
        logger.info("用户名更新完成")
        
        # 验证更改
        cursor.execute("SELECT username, email, display_name FROM users WHERE username = 'dj'")
        dj_user = cursor.fetchone()
        if dj_user:
            logger.info(f"验证成功: {dj_user}")
        else:
            logger.warning("验证失败: 未找到dj用户")
        
        conn.close()
        return True
        
    except Exception as e:
        logger.error(f"更新用户名失败: {str(e)}")
        logger.error(f"数据库已备份在: {backup_path}")
        if conn:
            conn.rollback()
            conn.close()
        return False

if __name__ == "__main__":
    logger.info("=== 数据库迁移：将用户名dz更新为dj ===")
    
    # 执行迁移
    success = update_user_dz_to_dj()
    
    if success:
        logger.info("迁移完成")
    else:
        logger.error("迁移失败")
        sys.exit(1)