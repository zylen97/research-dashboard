#!/usr/bin/env python3
"""测试API响应中是否包含communication_logs字段"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.models import SessionLocal, ResearchProject, CommunicationLog
import json

client = TestClient(app)

def test_api_response():
    """测试/api/research/接口返回的数据结构"""
    
    # 1. 首先确保有测试数据
    db = SessionLocal()
    project_count = db.query(ResearchProject).count()
    print(f"数据库中的项目数量: {project_count}")
    
    if project_count == 0:
        print("没有项目数据，请先运行 test_communication_logs.py 创建测试数据")
        db.close()
        return
    
    # 2. 直接从数据库查询第一个项目，检查ORM数据
    project = db.query(ResearchProject).options(
        db.query(ResearchProject).options().joinedload(ResearchProject.communication_logs)
    ).first()
    
    print(f"\n[ORM查询结果]")
    print(f"项目: {project.title}")
    print(f"有communication_logs属性: {hasattr(project, 'communication_logs')}")
    if hasattr(project, 'communication_logs'):
        print(f"communication_logs数量: {len(project.communication_logs)}")
    
    db.close()
    
    # 3. 测试API响应
    print(f"\n[API测试]")
    response = client.get("/api/research/")
    
    print(f"响应状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"返回的项目数量: {len(data)}")
        
        if data:
            # 检查第一个项目
            first_project = data[0]
            print(f"\n第一个项目的结构:")
            print(f"- 标题: {first_project.get('title')}")
            print(f"- 包含的字段: {list(first_project.keys())}")
            print(f"- 是否有communication_logs字段: {'communication_logs' in first_project}")
            
            if 'communication_logs' in first_project:
                logs = first_project['communication_logs']
                print(f"- communication_logs数量: {len(logs)}")
                if logs:
                    print(f"- 第一条日志: {logs[0]}")
            else:
                print("\n⚠️ 警告: API响应中没有communication_logs字段!")
                print("这可能是Pydantic序列化的问题")
            
            # 打印完整的第一个项目数据（格式化）
            print(f"\n完整的第一个项目数据:")
            print(json.dumps(first_project, indent=2, ensure_ascii=False))
    else:
        print(f"API调用失败: {response.text}")
    
    # 4. 测试单个项目的API
    print(f"\n[测试单个项目API]")
    response_single = client.get("/api/research/1")
    if response_single.status_code == 200:
        single_project = response_single.json()
        print(f"单个项目API是否包含communication_logs: {'communication_logs' in single_project}")
        if 'communication_logs' in single_project:
            print(f"communication_logs数量: {len(single_project['communication_logs'])}")

if __name__ == "__main__":
    print("=== 测试API响应结构 ===")
    test_api_response()