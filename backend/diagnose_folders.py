#!/usr/bin/env python3
"""
诊断文件夹API问题
"""

import requests
import json

def check_folders_api():
    base_url = "http://45.149.156.216:3001"
    
    print("=== 文件夹API诊断 ===\n")
    
    # 1. 检查根路径
    print("1. 检查API根路径...")
    try:
        response = requests.get(f"{base_url}/")
        print(f"   状态码: {response.status_code}")
        print(f"   响应: {response.text[:100]}...")
    except Exception as e:
        print(f"   错误: {e}")
    
    # 2. 检查文档（如果开启）
    print("\n2. 检查API文档...")
    try:
        response = requests.get(f"{base_url}/docs")
        print(f"   状态码: {response.status_code}")
    except Exception as e:
        print(f"   错误: {e}")
    
    # 3. 登录获取token
    print("\n3. 登录获取认证token...")
    try:
        login_data = {
            "username": "zl",
            "password": "123"
        }
        response = requests.post(f"{base_url}/api/auth/login", json=login_data)
        print(f"   状态码: {response.status_code}")
        
        if response.status_code == 200:
            token_data = response.json()
            print(f"   登录响应: {json.dumps(token_data, indent=2)[:200]}...")
            
            # 根据实际响应格式获取token
            if "data" in token_data:
                token = token_data["data"]["access_token"]
            elif "access_token" in token_data:
                token = token_data["access_token"]
            else:
                print(f"   无法从响应中获取token")
                return
                
            print(f"   Token获取成功!")
            
            # 4. 测试文件夹API
            headers = {
                "Authorization": f"Bearer {token}"
            }
            
            print("\n4. 测试文件夹API端点...")
            
            # 测试获取文件夹列表
            print("\n   a) GET /api/folders/")
            try:
                response = requests.get(f"{base_url}/api/folders/", headers=headers)
                print(f"      状态码: {response.status_code}")
                if response.status_code != 404:
                    print(f"      响应: {response.json()}")
            except Exception as e:
                print(f"      错误: {e}")
            
            # 测试获取文件夹树
            print("\n   b) GET /api/folders/tree")
            try:
                response = requests.get(f"{base_url}/api/folders/tree", headers=headers)
                print(f"      状态码: {response.status_code}")
                if response.status_code != 404:
                    print(f"      响应: {response.json()}")
            except Exception as e:
                print(f"      错误: {e}")
                
            # 测试其他API（对比）
            print("\n5. 对比测试其他API...")
            print("\n   a) GET /api/literature/")
            try:
                response = requests.get(f"{base_url}/api/literature/", headers=headers)
                print(f"      状态码: {response.status_code}")
            except Exception as e:
                print(f"      错误: {e}")
                
        else:
            print(f"   登录失败: {response.json()}")
            
    except Exception as e:
        print(f"   错误: {e}")
    
    print("\n=== 诊断完成 ===")

if __name__ == "__main__":
    check_folders_api()