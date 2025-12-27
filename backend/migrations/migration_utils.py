#!/usr/bin/env python3
"""
数据库迁移工具库

这个模块提供数据库迁移脚本的通用功能，目的是：
1. 减少迁移脚本之间的代码重复
2. 统一数据库操作的错误处理和日志记录
3. 提供安全的数据库结构修改函数
4. 简化多环境数据库路径管理

主要功能：
- 自动查找数据库文件路径
- 统一的日志配置
- 安全的表结构修改（添加列、创建索引等）
- 数据库备份功能
- 表和列存在性检查

使用示例：
    from migration_utils import setup_migration_logging, find_database_path
    
    logger = setup_migration_logging()
    db_path = find_database_path()
    
    if db_path:
        # 执行迁移操作
        pass
"""

import sqlite3
import os
import logging
from datetime import datetime
from typing import Optional, List

def setup_migration_logging():
    """配置迁移日志"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )
    return logging.getLogger(__name__)

def find_database_path(environment: Optional[str] = None) -> Optional[str]:
    """
    查找数据库文件路径（简化版 - 单一数据库）

    Args:
        environment: 保留参数用于兼容性，实际不使用

    Returns:
        数据库文件路径，如果找不到返回None
    """
    base_dir = os.path.dirname(os.path.dirname(__file__))
    data_dir = os.path.join(base_dir, 'data')
    db_path = os.path.join(data_dir, 'research_dashboard.db')

    if os.path.exists(db_path):
        return db_path

    return None

def backup_database(db_path: str, backup_dir: str = None) -> str:
    """
    创建数据库备份到统一备份目录

    Args:
        db_path: 数据库文件路径
        backup_dir: 备份目录（默认使用 backups/）

    Returns:
        备份文件路径
    """
    if backup_dir is None:
        base_dir = os.path.dirname(os.path.dirname(__file__))
        backup_dir = os.path.join(base_dir, 'backups')

    os.makedirs(backup_dir, exist_ok=True)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_folder = os.path.join(backup_dir, timestamp)
    os.makedirs(backup_folder, exist_ok=True)

    backup_path = os.path.join(backup_folder, os.path.basename(db_path))

    import shutil
    shutil.copy2(db_path, backup_path)

    # 创建备份信息文件
    info_file = os.path.join(backup_folder, 'backup_info.txt')
    with open(info_file, 'w') as f:
        f.write(f"Backup created at: {datetime.now()}\n")
        f.write(f"Source: {db_path}\n")
        f.write(f"Database size: {os.path.getsize(db_path)} bytes\n")

    return backup_path

def get_table_columns(cursor: sqlite3.Cursor, table_name: str) -> List[str]:
    """
    获取表的所有列名
    
    Args:
        cursor: 数据库游标
        table_name: 表名
        
    Returns:
        列名列表
    """
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = cursor.fetchall()
    return [col[1] for col in columns]

def table_exists(cursor: sqlite3.Cursor, table_name: str) -> bool:
    """
    检查表是否存在
    
    Args:
        cursor: 数据库游标
        table_name: 表名
        
    Returns:
        表是否存在
    """
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?", 
        (table_name,)
    )
    return cursor.fetchone() is not None

def safe_add_column(cursor: sqlite3.Cursor, table_name: str, column_name: str, 
                   column_definition: str, logger) -> bool:
    """
    安全地添加列（如果不存在）
    
    Args:
        cursor: 数据库游标
        table_name: 表名
        column_name: 列名
        column_definition: 列定义（如：'BOOLEAN DEFAULT FALSE'）
        logger: 日志记录器
        
    Returns:
        是否添加了新列
    """
    columns = get_table_columns(cursor, table_name)
    
    if column_name not in columns:
        cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_definition}")
        logger.info(f"✅ 已为表 {table_name} 添加列 {column_name}")
        return True
    else:
        logger.info(f"✓ 表 {table_name} 的列 {column_name} 已存在，跳过")
        return False

def safe_create_index(cursor: sqlite3.Cursor, index_name: str, table_name: str, 
                     columns: str, logger) -> bool:
    """
    安全地创建索引（如果不存在）
    
    Args:
        cursor: 数据库游标
        index_name: 索引名
        table_name: 表名
        columns: 列定义（如：'column1, column2'）
        logger: 日志记录器
        
    Returns:
        是否创建了新索引
    """
    try:
        cursor.execute(f"CREATE INDEX IF NOT EXISTS {index_name} ON {table_name}({columns})")
        logger.info(f"✅ 已创建索引 {index_name}")
        return True
    except Exception as e:
        logger.info(f"✓ 索引 {index_name} 可能已存在: {e}")
        return False