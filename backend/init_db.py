#!/usr/bin/env python3
"""
简单的数据库初始化脚本，供部署时使用
"""
import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.models.database import Base, engine
from app.utils.db_init import init_database, init_users

if __name__ == "__main__":
    print("Initializing database...")
    init_database()
    print("Creating users...")
    init_users()
    print("Database initialization complete!")