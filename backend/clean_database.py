#!/usr/bin/env python3
"""
数据库清理脚本
- 备份当前数据库
- 创建全新的数据库结构（无team_id）
- 初始化四个用户账号
"""
import os
import sys
from pathlib import Path

# 添加项目路径
sys.path.append(str(Path(__file__).parent))

from sqlalchemy import create_engine, text
from app.models.database import Base, User, SQLITE_DATABASE_URL
from app.utils.auth import get_password_hash
from app.utils.backup_manager import BackupManager
import logging

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def clean_database():
    """清理并重建数据库"""
    
    # 1. 创建备份
    logger.info("步骤 1: 备份当前数据库")
    backup_manager = BackupManager()
    backup_path = backup_manager.create_backup("before_clean")
    
    if backup_path:
        logger.info(f"备份已创建: {backup_path}")
    
    # 2. 删除旧数据库文件
    db_path = Path(__file__).parent / "research_dashboard.db"
    if db_path.exists():
        logger.info("步骤 2: 删除旧数据库文件")
        os.remove(db_path)
        logger.info("旧数据库已删除")
    
    # 3. 创建新数据库和表结构
    logger.info("步骤 3: 创建新数据库结构")
    engine = create_engine(SQLITE_DATABASE_URL, echo=False)
    
    # 创建所有表
    Base.metadata.create_all(bind=engine)
    logger.info("数据库表结构已创建")
    
    # 4. 验证表结构（确保没有team_id）
    logger.info("步骤 4: 验证表结构")
    with engine.connect() as conn:
        # 检查collaborators表的结构
        result = conn.execute(text("PRAGMA table_info(collaborators)"))
        columns = [row[1] for row in result]
        
        if 'team_id' in columns:
            logger.error("错误：collaborators表仍包含team_id字段！")
            return False
        else:
            logger.info("✓ collaborators表结构正确（无team_id）")
    
    # 5. 初始化用户数据
    logger.info("步骤 5: 初始化四个用户账号")
    from sqlalchemy.orm import sessionmaker
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        users_data = [
            {
                "username": "user1",
                "email": "user1@example.com",
                "display_name": "用户一",
                "password": "password123"
            },
            {
                "username": "user2", 
                "email": "user2@example.com",
                "display_name": "用户二",
                "password": "password123"
            },
            {
                "username": "user3",
                "email": "user3@example.com", 
                "display_name": "用户三",
                "password": "password123"
            },
            {
                "username": "user4",
                "email": "user4@example.com",
                "display_name": "用户四", 
                "password": "password123"
            }
        ]
        
        for user_data in users_data:
            user = User(
                username=user_data["username"],
                email=user_data["email"],
                display_name=user_data["display_name"],
                password_hash=get_password_hash(user_data["password"]),
                is_active=True
            )
            db.add(user)
            logger.info(f"✓ 创建用户: {user_data['username']}")
        
        db.commit()
        logger.info("所有用户账号创建完成")
        
        # 验证用户创建
        user_count = db.query(User).count()
        logger.info(f"数据库中共有 {user_count} 个用户")
        
    except Exception as e:
        logger.error(f"创建用户时出错: {e}")
        db.rollback()
        return False
    finally:
        db.close()
    
    logger.info("\n✨ 数据库清理和初始化完成！")
    logger.info("\n用户登录信息：")
    logger.info("- user1 / password123 (用户一)")
    logger.info("- user2 / password123 (用户二)")
    logger.info("- user3 / password123 (用户三)")
    logger.info("- user4 / password123 (用户四)")
    
    return True


if __name__ == "__main__":
    success = clean_database()
    sys.exit(0 if success else 1)