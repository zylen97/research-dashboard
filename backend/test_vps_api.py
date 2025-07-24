#!/usr/bin/env python3
"""测试VPS上的待办API"""

import requests
import json

VPS_URL = "http://45.149.156.216:3001"

def test_vps_api():
    print("=" * 50)
    print("测试VPS上的待办API")
    print("=" * 50)
    
    # 1. 直接测试待办API（不带认证）
    print("\n1. 测试待办API（不带认证）...")
    try:
        response = requests.get(f"{VPS_URL}/api/research/todos", timeout=5)
        print(f"响应状态码: {response.status_code}")
        print(f"响应头: {dict(response.headers)}")
        
        if response.status_code == 422:
            print("响应内容:")
            print(json.dumps(response.json(), indent=2, ensure_ascii=False))
        else:
            print(f"响应内容: {response.text[:500]}...")
    except Exception as e:
        print(f"请求失败: {e}")
    
    # 2. 测试其他API端点
    print("\n2. 测试其他API端点...")
    
    # 测试根路径
    try:
        response = requests.get(f"{VPS_URL}/api/research/", timeout=5)
        print(f"GET /api/research/ 状态码: {response.status_code}")
    except Exception as e:
        print(f"请求失败: {e}")
    
    # 测试带project_id的路径
    try:
        response = requests.get(f"{VPS_URL}/api/research/123", timeout=5)
        print(f"GET /api/research/123 状态码: {response.status_code}")
    except Exception as e:
        print(f"请求失败: {e}")
    
    # 3. 测试认证端点
    print("\n3. 测试认证端点...")
    try:
        response = requests.get(f"{VPS_URL}/api/auth/me", timeout=5)
        print(f"GET /api/auth/me 状态码: {response.status_code}")
        if response.status_code == 403:
            print("响应内容:")
            print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"请求失败: {e}")

if __name__ == "__main__":
    test_vps_api()