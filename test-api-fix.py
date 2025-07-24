#!/usr/bin/env python3
"""测试API修复是否成功"""

import requests
import json

# 测试端点
BASE_URL = "http://localhost:8080"
ENDPOINTS = [
    "/",
    "/health",
    "/research/",
    "/collaborators/",
]

print("测试后端API路径修复...")
print("=" * 50)

for endpoint in ENDPOINTS:
    url = BASE_URL + endpoint
    try:
        response = requests.get(url, timeout=5)
        print(f"✅ {endpoint}: {response.status_code}")
        if response.status_code == 200:
            print(f"   响应: {response.json()}")
    except Exception as e:
        print(f"❌ {endpoint}: {str(e)}")

print("\n" + "=" * 50)
print("修复完成！请部署到VPS进行完整测试。")