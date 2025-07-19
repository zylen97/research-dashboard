"""
数据清理和初始化脚本
执行以下任务：
1. 清理合作者名称中的'srtp'字符串
2. 创建新合作者：张哲、赵雅琦、郑冬杰
3. 创建SRTP小组和创新小组
"""
import requests
import json
import logging
from datetime import datetime

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

API_BASE_URL = "http://localhost:8080/api"

def clean_collaborator_names():
    """清理合作者名称中的srtp字符串"""
    logger.info("清理合作者名称中的'srtp'字符串")
    
    response = requests.post(f"{API_BASE_URL}/collaborators/clean-names?keyword=srtp")
    
    if response.status_code == 200:
        result = response.json()
        logger.info(f"{result['message']}")
        logger.info(f"总共找到: {result['total_found']} 个")
        logger.info(f"已清理: {result['cleaned_count']} 个")
    else:
        logger.error(f"清理失败: {response.text}")

def create_new_collaborators():
    """创建新的合作者"""
    logger.info("创建新合作者")
    
    new_collaborators = [
        {"name": "张哲"},
        {"name": "赵雅琦"},
        {"name": "郑冬杰"}
    ]
    
    response = requests.post(
        f"{API_BASE_URL}/collaborators/create-batch",
        json=new_collaborators,
        headers={"Content-Type": "application/json"}
    )
    
    if response.status_code == 200:
        result = response.json()
        logger.info(f"{result['message']}")
    else:
        logger.error(f"创建失败: {response.text}")

def create_groups():
    """创建合作者组"""
    logger.info("创建合作者组")
    
    groups = [
        {
            "name": "SRTP小组",
            "members": ["周佳祺", "庄晶涵", "范佳伟", "周子弋", "朱彦智"]
        },
        {
            "name": "创新小组", 
            "members": ["田超", "王昊", "李思佳", "凌文杰"]
        }
    ]
    
    for group in groups:
        response = requests.post(
            f"{API_BASE_URL}/collaborators/create-group",
            json={
                "group_name": group["name"],
                "member_names": group["members"]
            },
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            result = response.json()
            logger.info(f"创建{group['name']}: {result['message']}")
            if result['not_found']:
                logger.warning(f"未找到的成员: {', '.join(result['not_found'])}")
        else:
            logger.error(f"创建{group['name']}失败: {response.text}")

def main():
    """主函数"""
    logger.info(f"开始数据清理和初始化 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("=" * 60)
    
    # 执行清理任务
    clean_collaborator_names()
    
    # 创建新合作者
    create_new_collaborators()
    
    # 创建合作者组
    create_groups()
    
    logger.info("数据清理和初始化完成")

if __name__ == "__main__":
    main()