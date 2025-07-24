#!/usr/bin/env python3
"""测试待办API功能"""

import requests
import json

# 测试配置
BASE_URL = "http://localhost:8000"
# VPS_URL = "http://45.149.156.216:3001"

def test_todos_api():
    print("=" * 50)
    print("测试待办API功能")
    print("=" * 50)
    
    # 1. 测试登录
    print("\n1. 测试登录...")
    login_data = {
        "username": "admin",
        "password": "admin123"
    }
    
    response = requests.post(f"{BASE_URL}/api/auth/login", data=login_data)
    print(f"登录响应状态: {response.status_code}")
    
    if response.status_code == 200:
        token_data = response.json()
        token = token_data.get("access_token")
        print(f"✅ 登录成功，获取到token")
        
        # 2. 测试获取待办列表（带认证）
        print("\n2. 测试获取待办列表（带认证）...")
        headers = {
            "Authorization": f"Bearer {token}"
        }
        
        response = requests.get(f"{BASE_URL}/api/research/todos", headers=headers)
        print(f"待办列表响应状态: {response.status_code}")
        
        if response.status_code == 200:
            todos = response.json()
            print(f"✅ 成功获取待办列表，共 {len(todos)} 个项目")
        else:
            print(f"❌ 获取失败: {response.text}")
            
        # 3. 测试不带认证的请求
        print("\n3. 测试不带认证的请求...")
        response = requests.get(f"{BASE_URL}/api/research/todos")
        print(f"未认证响应状态: {response.status_code}")
        print(f"响应内容: {response.text[:200]}...")
        
    else:
        print(f"❌ 登录失败: {response.text}")
        
        # 如果登录失败，检查是否没有用户
        print("\n检查数据库中是否有用户...")
        import sqlite3
        conn = sqlite3.connect("data/research_dashboard_prod.db")
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]
        print(f"用户数量: {user_count}")
        
        if user_count == 0:
            print("\n创建默认管理员用户...")
            from app.utils.auth import get_password_hash
            from datetime import datetime
            
            password_hash = get_password_hash("admin123")
            cursor.execute("""
                INSERT INTO users (username, email, password_hash, display_name, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, ("admin", "admin@example.com", password_hash, "管理员", 1, datetime.utcnow(), datetime.utcnow()))
            conn.commit()
            print("✅ 默认管理员用户创建成功")
            
        conn.close()

if __name__ == "__main__":
    # 先启动后端服务
    print("请确保后端服务正在运行...")
    print("如果没有运行，请在另一个终端执行: cd backend && python main.py")
    print()
    
    test_todos_api()