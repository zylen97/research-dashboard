#!/usr/bin/env python3
"""
生产环境 Folders API 验证脚本
检查 folders 功能是否正确部署到生产环境
"""

import requests
import json
import time
from datetime import datetime
import os

# 禁用代理
os.environ['NO_PROXY'] = '*'
os.environ['no_proxy'] = '*'

# 生产环境配置
PROD_URL = "http://45.149.156.216:8080"
PROD_FRONTEND = "http://45.149.156.216:3001"

# 测试账号
TEST_USER = "zl"
TEST_PASSWORD = "123"

def colored_print(message, color='normal'):
    colors = {
        'green': '\033[92m',
        'yellow': '\033[93m',
        'red': '\033[91m',
        'blue': '\033[94m',
        'normal': '\033[0m'
    }
    print(f"{colors.get(color, '')}{message}{colors['normal']}")

def check_folders_api():
    """检查生产环境的 folders API"""
    print("=== 生产环境 Folders API 验证 ===")
    print(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"目标: {PROD_URL}")
    print()
    
    # 1. 检查 API 根路径
    print("1. 检查API根路径...")
    try:
        resp = requests.get(f"{PROD_URL}/", timeout=5)
        colored_print(f"   状态码: {resp.status_code}", 'green' if resp.status_code == 200 else 'red')
    except Exception as e:
        colored_print(f"   错误: {e}", 'red')
        return
    
    # 2. 登录获取 token
    print("\n2. 登录获取认证token...")
    try:
        login_data = {
            "username": TEST_USER,
            "password": TEST_PASSWORD
        }
        resp = requests.post(f"{PROD_URL}/api/auth/login", json=login_data, timeout=5)
        if resp.status_code == 200:
            token = resp.json()["access_token"]
            colored_print("   登录成功!", 'green')
        else:
            colored_print(f"   登录失败: {resp.status_code} - {resp.text}", 'red')
            return
    except Exception as e:
        colored_print(f"   错误: {e}", 'red')
        return
    
    # 3. 测试 folders API
    print("\n3. 测试 Folders API 端点...")
    headers = {"Authorization": f"Bearer {token}"}
    
    endpoints = [
        ("GET", "/api/folders/", "获取文件夹列表"),
        ("GET", "/api/folders/tree", "获取文件夹树"),
    ]
    
    for method, endpoint, desc in endpoints:
        print(f"\n   {method} {endpoint} - {desc}")
        try:
            if method == "GET":
                resp = requests.get(f"{PROD_URL}{endpoint}", headers=headers, timeout=5)
            
            status_color = 'green' if resp.status_code == 200 else 'red'
            colored_print(f"      状态码: {resp.status_code}", status_color)
            
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list):
                    colored_print(f"      返回数据: {len(data)} 个文件夹", 'blue')
                    if data:
                        print(f"      第一个文件夹: {data[0].get('name', 'N/A')}")
                else:
                    colored_print(f"      返回数据类型: {type(data).__name__}", 'blue')
            else:
                colored_print(f"      错误: {resp.text[:100]}", 'red')
                
        except Exception as e:
            colored_print(f"      错误: {e}", 'red')
    
    # 4. 检查前端访问
    print("\n4. 检查前端访问...")
    try:
        resp = requests.get(PROD_FRONTEND, timeout=5)
        if resp.status_code == 200:
            colored_print(f"   前端访问正常 (状态码: {resp.status_code})", 'green')
        else:
            colored_print(f"   前端访问异常 (状态码: {resp.status_code})", 'red')
    except Exception as e:
        colored_print(f"   错误: {e}", 'red')
    
    # 5. 检查 prompts API
    print("\n5. 检查 Prompts API...")
    try:
        resp = requests.get(f"{PROD_URL}/api/literature/prompts", headers=headers, timeout=5)
        status_color = 'green' if resp.status_code == 200 else 'yellow'
        colored_print(f"   状态码: {resp.status_code}", status_color)
        if resp.status_code == 200:
            prompts = resp.json()
            colored_print(f"   返回 {len(prompts)} 个提示词模板", 'blue')
    except Exception as e:
        colored_print(f"   错误: {e}", 'red')
    
    print("\n=== 验证完成 ===")
    print("\n建议:")
    print("- 如果 folders API 仍返回 404，请等待 1-2 分钟后重试")
    print("- 强制更新已触发，GitHub Actions 正在部署")
    print("- 可访问 https://github.com/zylen97/research-dashboard/actions 查看部署状态")

if __name__ == "__main__":
    check_folders_api()