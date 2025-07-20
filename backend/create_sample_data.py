#!/usr/bin/env python3
"""
创建示例数据
"""
from datetime import datetime, timedelta
from app.models.database import SessionLocal, User, Collaborator, ResearchProject, Literature, Idea
from app.utils.auth import get_password_hash
import random

db = SessionLocal()

# 1. 创建合作者
print("📝 创建合作者...")
collaborators_data = [
    {"name": "张三", "gender": "男", "class_name": "计算机科学", "future_plan": "继续深造", "background": "本科计算机专业", "contact_info": "zhangsan@example.com"},
    {"name": "李四", "gender": "女", "class_name": "数据科学", "future_plan": "工业界", "background": "统计学背景", "contact_info": "lisi@example.com"},
    {"name": "王五", "gender": "男", "class_name": "人工智能", "future_plan": "创业", "background": "机器学习方向", "contact_info": "wangwu@example.com"},
    {"name": "AI Lab", "is_group": True, "background": "人工智能实验室", "contact_info": "ailab@university.edu"},
]

created_collaborators = []
for data in collaborators_data:
    collaborator = Collaborator(**data)
    db.add(collaborator)
    created_collaborators.append(collaborator)
    print(f"  ✅ {data['name']}")

db.commit()

# 2. 创建研究项目
print("\n📚 创建研究项目...")
projects_data = [
    {
        "title": "基于深度学习的图像识别系统",
        "idea_description": "使用CNN进行图像分类，提高识别准确率",
        "status": "active",
        "progress": 60,
        "start_date": datetime.now() - timedelta(days=30),
        "expected_completion": datetime.now() + timedelta(days=60)
    },
    {
        "title": "自然语言处理在客服系统中的应用",
        "idea_description": "利用NLP技术自动回答客户问题",
        "status": "active",
        "progress": 40,
        "start_date": datetime.now() - timedelta(days=20),
        "expected_completion": datetime.now() + timedelta(days=90)
    },
    {
        "title": "推荐系统算法优化",
        "idea_description": "改进协同过滤算法，提升推荐准确度",
        "status": "completed",
        "progress": 100,
        "start_date": datetime.now() - timedelta(days=90),
        "expected_completion": datetime.now() - timedelta(days=10)
    },
]

for i, data in enumerate(projects_data):
    project = ResearchProject(**data)
    # 添加合作者
    project.collaborators.append(created_collaborators[i % len(created_collaborators)])
    if i == 0:  # 第一个项目添加团队
        project.collaborators.append(created_collaborators[-1])
    db.add(project)
    print(f"  ✅ {data['title']}")

db.commit()

# 3. 创建文献
print("\n📖 创建文献...")
literature_data = [
    {
        "title": "Deep Learning for Computer Vision: A Brief Review",
        "authors": "John Doe, Jane Smith",
        "journal": "Computer Vision Review",
        "year": 2023,
        "doi": "10.1234/cvr.2023.001",
        "abstract": "This paper reviews recent advances in deep learning for computer vision...",
        "keywords": "deep learning, computer vision, CNN",
        "citation_count": 150
    },
    {
        "title": "Transformer Models in NLP: State of the Art",
        "authors": "Alice Brown, Bob Wilson",
        "journal": "NLP Quarterly",
        "year": 2024,
        "doi": "10.5678/nlp.2024.042",
        "abstract": "We survey the latest transformer architectures and their applications...",
        "keywords": "transformer, NLP, BERT, GPT",
        "citation_count": 230
    },
]

for data in literature_data:
    lit = Literature(**data)
    db.add(lit)
    print(f"  ✅ {data['title']}")

db.commit()

# 4. 创建想法
print("\n💡 创建想法...")
ideas_data = [
    {
        "title": "结合图像和文本的多模态学习",
        "description": "探索视觉和语言模型的融合方法",
        "source": "文献启发",
        "difficulty_level": "hard",
        "estimated_duration": "6个月",
        "potential_impact": "high",
        "priority": "high"
    },
    {
        "title": "轻量级模型压缩技术",
        "description": "研究如何在保持性能的同时减小模型大小",
        "source": "实际需求",
        "difficulty_level": "medium",
        "estimated_duration": "3个月",
        "potential_impact": "medium",
        "priority": "medium"
    },
]

for data in ideas_data:
    idea = Idea(**data)
    db.add(idea)
    print(f"  ✅ {data['title']}")

db.commit()

print("\n✅ 示例数据创建完成！")
print("📊 数据统计：")
print(f"   - 合作者: {len(collaborators_data)} 个")
print(f"   - 研究项目: {len(projects_data)} 个")
print(f"   - 文献: {len(literature_data)} 篇")
print(f"   - 想法: {len(ideas_data)} 个")