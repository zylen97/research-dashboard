#!/usr/bin/env python3
"""
清理多余的预设文件夹，只保留根文件夹
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

def cleanup_folders():
    """清理多余的文件夹，只保留根文件夹"""
    
    # 数据库路径
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'research_dashboard_prod.db')
    
    if not os.path.exists(db_path):
        logger.error(f"数据库文件不存在: {db_path}")
        return False
    
    # 备份数据库
    backup_path = f"{db_path}.backup.cleanup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    import shutil
    shutil.copy2(db_path, backup_path)
    logger.info(f"数据库已备份到: {backup_path}")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        logger.info("开始清理多余的文件夹...")
        
        # 1. 获取所有用户
        cursor.execute("SELECT id, username FROM users")
        users = cursor.fetchall()
        
        for user_id, username in users:
            logger.info(f"处理用户 {username} 的文件夹...")
            
            # 2. 检查该用户的根文件夹
            cursor.execute("""
                SELECT id, name FROM literature_folders 
                WHERE user_id = ? AND is_root = 1
                ORDER BY id
            """, (user_id,))
            root_folders = cursor.fetchall()
            
            if len(root_folders) > 1:
                # 如果有多个根文件夹，只保留第一个
                logger.info(f"  发现 {len(root_folders)} 个根文件夹，保留第一个")
                for i in range(1, len(root_folders)):
                    cursor.execute("DELETE FROM literature_folders WHERE id = ?", (root_folders[i][0],))
            
            # 3. 删除预设的分类文件夹
            if root_folders:
                root_id = root_folders[0][0]
                
                # 删除预设分类（待阅读、已阅读、重要文献、参考文献）
                preset_names = ['待阅读', '已阅读', '重要文献', '参考文献']
                for name in preset_names:
                    cursor.execute("""
                        DELETE FROM literature_folders 
                        WHERE parent_id = ? AND name = ?
                    """, (root_id, name))
                    
                    if cursor.rowcount > 0:
                        logger.info(f"  删除预设文件夹: {name}")
        
        # 4. 提交更改
        conn.commit()
        
        # 5. 显示清理后的统计
        cursor.execute("SELECT COUNT(*) FROM literature_folders")
        total_folders = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM literature_folders WHERE is_root = 1")
        root_folders = cursor.fetchone()[0]
        
        logger.info(f"\n清理完成！")
        logger.info(f"当前文件夹总数: {total_folders}")
        logger.info(f"根文件夹数: {root_folders}")
        
        # 显示每个用户的文件夹情况
        cursor.execute("""
            SELECT u.username, COUNT(lf.id) as folder_count
            FROM users u
            LEFT JOIN literature_folders lf ON u.id = lf.user_id
            GROUP BY u.id, u.username
            ORDER BY u.username
        """)
        user_stats = cursor.fetchall()
        
        logger.info("\n用户文件夹统计:")
        for username, count in user_stats:
            logger.info(f"  {username}: {count} 个文件夹")
        
        conn.close()
        return True
        
    except Exception as e:
        logger.error(f"清理失败: {e}")
        logger.info(f"数据库备份位于: {backup_path}")
        return False

if __name__ == "__main__":
    logger.info("=== 清理多余的预设文件夹 ===")
    success = cleanup_folders()
    if success:
        logger.info("\n✅ 清理完成！请重启服务：")
        logger.info("   systemctl restart research-backend")
    else:
        logger.info("\n❌ 清理失败")