#!/usr/bin/env python3
"""测试通信日志是否正确包含在项目查询中"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.models import SessionLocal, ResearchProject, CommunicationLog
from sqlalchemy.orm import joinedload
import json
from datetime import datetime

def test_communication_logs():
    """测试项目查询是否包含通信日志"""
    db = SessionLocal()
    
    try:
        # 1. 首先检查是否有项目
        projects_count = db.query(ResearchProject).count()
        print(f"总项目数: {projects_count}")
        
        if projects_count == 0:
            print("没有项目，创建测试项目...")
            # 创建测试项目
            test_project = ResearchProject(
                title="测试项目 - 通信日志测试",
                idea_description="这是一个用于测试通信日志的项目"
            )
            db.add(test_project)
            db.commit()
            db.refresh(test_project)
            
            # 创建测试通信日志
            test_log = CommunicationLog(
                project_id=test_project.id,
                communication_type="meeting",
                title="第一次会议",
                content="讨论项目启动事项",
                communication_date=datetime.now()
            )
            db.add(test_log)
            db.commit()
            
            print(f"创建了测试项目 ID: {test_project.id}")
        
        # 2. 查询项目（使用joinedload）
        print("\n使用 joinedload 查询项目...")
        projects = db.query(ResearchProject).options(
            joinedload(ResearchProject.communication_logs)
        ).limit(5).all()
        
        for project in projects:
            print(f"\n项目: {project.title} (ID: {project.id})")
            print(f"  - 是否有 communication_logs 属性: {hasattr(project, 'communication_logs')}")
            
            if hasattr(project, 'communication_logs'):
                logs = project.communication_logs
                print(f"  - 通信日志数量: {len(logs)}")
                
                if logs:
                    print("  - 通信日志列表:")
                    for log in logs[:3]:  # 只显示前3条
                        print(f"    * [{log.communication_type}] {log.title} ({log.communication_date})")
            
            # 3. 检查序列化
            print("  - 尝试序列化项目...")
            try:
                # 模拟 Pydantic 序列化
                project_dict = {
                    'id': project.id,
                    'title': project.title,
                    'idea_description': project.idea_description,
                    'status': project.status,
                    'progress': project.progress,
                    'communication_logs': []
                }
                
                if hasattr(project, 'communication_logs'):
                    for log in project.communication_logs:
                        log_dict = {
                            'id': log.id,
                            'project_id': log.project_id,
                            'communication_type': log.communication_type,
                            'title': log.title,
                            'content': log.content,
                            'communication_date': log.communication_date.isoformat() if log.communication_date else None
                        }
                        project_dict['communication_logs'].append(log_dict)
                
                print(f"  - 序列化成功，包含 {len(project_dict['communication_logs'])} 条日志")
                
            except Exception as e:
                print(f"  - 序列化失败: {str(e)}")
        
        # 4. 直接查询通信日志数量
        print("\n\n直接查询通信日志统计:")
        logs_count = db.query(CommunicationLog).count()
        print(f"总通信日志数: {logs_count}")
        
        # 按项目分组统计
        from sqlalchemy import func
        log_stats = db.query(
            CommunicationLog.project_id,
            func.count(CommunicationLog.id).label('log_count')
        ).group_by(CommunicationLog.project_id).all()
        
        print("\n各项目的通信日志数量:")
        for stat in log_stats[:10]:  # 只显示前10个
            project = db.query(ResearchProject).get(stat.project_id)
            if project:
                print(f"  - {project.title}: {stat.log_count} 条日志")
        
    except Exception as e:
        print(f"\n错误: {str(e)}")
        import traceback
        traceback.print_exc()
    
    finally:
        db.close()

if __name__ == "__main__":
    print("=== 测试通信日志查询 ===")
    test_communication_logs()