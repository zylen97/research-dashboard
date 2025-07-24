#!/usr/bin/env python3
"""
测试 GET /api/research/todos 端点
"""
import requests
import json

# 测试配置
# BASE_URL = "http://localhost:8080"  # 本地测试
BASE_URL = "http://45.149.156.216:8001"  # 生产环境

# 测试账号
test_user = {
    "username": "zl",
    "password": "123"
}

def test_todos_api():
    print("=" * 60)
    print("测试 GET /api/research/todos 端点")
    print("=" * 60)
    
    # 1. 登录获取token
    print("\n1. 登录获取token...")
    login_response = requests.post(
        f"{BASE_URL}/api/auth/login", 
        json=test_user
    )
    
    if login_response.status_code != 200:
        print(f"❌ 登录失败: {login_response.status_code}")
        print(f"响应: {login_response.text}")
        return
    
    login_data = login_response.json()
    token = login_data.get("access_token")
    print(f"✅ 登录成功，获取到token: {token[:20]}...")
    
    # 2. 测试获取待办列表
    print("\n2. 测试获取待办列表...")
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    todos_response = requests.get(
        f"{BASE_URL}/api/research/todos",
        headers=headers
    )
    
    print(f"状态码: {todos_response.status_code}")
    
    if todos_response.status_code == 422:
        print("❌ 422 Unprocessable Entity 错误")
        try:
            error_detail = todos_response.json()
            print(f"错误详情: {json.dumps(error_detail, indent=2, ensure_ascii=False)}")
        except:
            print(f"响应文本: {todos_response.text}")
    elif todos_response.status_code == 200:
        print("✅ 成功获取待办列表")
        todos = todos_response.json()
        print(f"待办数量: {len(todos)}")
        if todos:
            print("前3个待办项目:")
            for i, todo in enumerate(todos[:3]):
                print(f"  {i+1}. {todo.get('name', 'Unknown')}")
    else:
        print(f"❌ 其他错误: {todos_response.status_code}")
        print(f"响应: {todos_response.text}")
    
    # 3. 测试不带token的请求
    print("\n3. 测试不带token的请求...")
    no_auth_response = requests.get(f"{BASE_URL}/api/research/todos")
    print(f"状态码: {no_auth_response.status_code}")
    if no_auth_response.status_code == 403:
        print("✅ 正确拒绝了未认证请求")
    else:
        print(f"响应: {no_auth_response.text}")

if __name__ == "__main__":
    test_todos_api()