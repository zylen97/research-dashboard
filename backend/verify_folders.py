#!/usr/bin/env python3
"""
验证文件夹功能是否正确配置
"""

import sys
import os

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def check_folders_setup():
    print("=== 文件夹功能验证 ===\n")
    
    # 1. 检查模型定义
    print("1. 检查数据库模型...")
    try:
        from app.models.database import LiteratureFolder
        print("   ✓ LiteratureFolder模型已定义")
    except ImportError as e:
        print(f"   ✗ LiteratureFolder模型导入失败: {e}")
        return False
    
    # 2. 检查Schema定义
    print("\n2. 检查Schema定义...")
    try:
        from app.models.schemas import (
            LiteratureFolder as LiteratureFolderSchema,
            LiteratureFolderCreate,
            LiteratureFolderUpdate,
            FolderTreeNode
        )
        print("   ✓ 所有文件夹Schema已定义")
    except ImportError as e:
        print(f"   ✗ Schema导入失败: {e}")
        return False
    
    # 3. 检查路由模块
    print("\n3. 检查路由模块...")
    try:
        from app.routes import folders
        print("   ✓ folders路由模块存在")
        
        # 检查路由是否有router对象
        if hasattr(folders, 'router'):
            print("   ✓ folders.router对象存在")
        else:
            print("   ✗ folders.router对象不存在")
            return False
            
    except ImportError as e:
        print(f"   ✗ folders路由导入失败: {e}")
        return False
    
    # 4. 检查main.py中的导入
    print("\n4. 检查main.py导入...")
    try:
        import main
        # 检查app对象
        if hasattr(main, 'app'):
            print("   ✓ FastAPI app对象存在")
        else:
            print("   ✗ FastAPI app对象不存在")
            return False
    except ImportError as e:
        print(f"   ✗ main模块导入失败: {e}")
        return False
    
    # 5. 检查数据库表
    print("\n5. 检查数据库表...")
    from app.models.database import engine
    from sqlalchemy import inspect
    
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    if 'literature_folders' in tables:
        print("   ✓ literature_folders表存在")
        
        # 获取列信息
        columns = inspector.get_columns('literature_folders')
        print(f"   ✓ 表包含 {len(columns)} 个列")
        
    else:
        print("   ✗ literature_folders表不存在")
        print("   现有表:", tables)
    
    print("\n=== 验证完成 ===")
    return True

if __name__ == "__main__":
    check_folders_setup()