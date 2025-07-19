"""
真实数据导入脚本
导入苏科大学生情况.xlsx中的真实研究数据
"""
import pandas as pd
import os
import re
import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from ..models.database import SessionLocal, Collaborator, ResearchProject, CommunicationLog
from ..models.database import project_collaborators, engine

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def clean_database():
    """清理现有示例数据"""
    db = SessionLocal()
    try:
        logger.info("清理现有示例数据")
        
        # 删除所有关联关系
        db.execute(project_collaborators.delete())
        
        # 删除所有记录
        db.query(CommunicationLog).delete()
        db.query(ResearchProject).delete()
        db.query(Collaborator).delete()
        
        db.commit()
        logger.info("示例数据清理完成")
        
    except Exception as e:
        logger.error(f"清理数据失败: {e}")
        db.rollback()
    finally:
        db.close()

def parse_communication_logs(progress_text, project_id, collaborator_id=None):
    """解析交流进度文本，提取交流记录"""
    logs = []
    if not progress_text or pd.isna(progress_text):
        return logs
    
    # 使用正则表达式匹配日期和内容
    # 格式如：01，2025年7月6日，发了团队感知虚拟性的论文让他看
    pattern = r'(\d+)，([\d年月日]+)，([^0-9]+?)(?=\d+，|$)'
    matches = re.findall(pattern, progress_text)
    
    for seq, date_str, content in matches:
        try:
            # 解析日期
            date_match = re.search(r'(\d{4})年(\d{1,2})月(\d{1,2})日', date_str)
            if date_match:
                year, month, day = map(int, date_match.groups())
                communication_date = datetime(year, month, day)
            else:
                # 如果日期解析失败，使用当前时间减去一些天数
                communication_date = datetime.now() - timedelta(days=30)
            
            log = {
                'project_id': project_id,
                'collaborator_id': collaborator_id,
                'communication_type': 'meeting',
                'title': f'第{seq}次交流',
                'content': content.strip(),
                'communication_date': communication_date
            }
            logs.append(log)
            
        except Exception as e:
            logger.warning(f"解析交流记录失败: {e}, 内容: {content}")
            continue
    
    return logs

def import_real_data():
    """导入真实数据"""
    db = SessionLocal()
    
    try:
        logger.info("开始导入真实数据")
        
        # 读取CSV文件
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
        csv_path = os.path.join(project_root, "苏科大学生情况.csv")
        
        if not os.path.exists(csv_path):
            raise FileNotFoundError(f"找不到数据文件: {csv_path}")
        
        df = pd.read_csv(csv_path)
        logger.info(f"读取到 {len(df)} 行数据")
        
        # 过滤有效数据行（有姓名且不是分组标题）
        valid_rows = df[
            df['名字'].notna() & 
            df['名字'].str.strip().ne('') &
            ~df['名字'].str.contains('组|团队|大创|创新', na=False) &
            ~df['班级年级'].str.contains('自己带|其他情况', na=False)
        ]
        
        logger.info(f"找到 {len(valid_rows)} 个有效合作者记录")
        
        collaborators_created = 0
        projects_created = 0
        logs_created = 0
        
        # 导入合作者数据
        for _, row in valid_rows.iterrows():
            try:
                # 创建合作者
                collaborator_data = {
                    'name': row['名字'].strip(),
                    'gender': row['性别'] if pd.notna(row['性别']) else None,
                    'class_name': row['班级年级'] if pd.notna(row['班级年级']) else None,
                    'future_plan': row['未来规划'] if pd.notna(row['未来规划']) else None,
                    'background': row['具体情况和背景'] if pd.notna(row['具体情况和背景']) else None,
                }
                
                collaborator = Collaborator(**collaborator_data)
                db.add(collaborator)
                db.flush()  # 获取ID
                collaborators_created += 1
                
                logger.debug(f"创建合作者: {collaborator.name}")
                
                # 如果有分配的idea，创建研究项目
                if pd.notna(row['分配idea']) and row['分配idea'].strip():
                    idea_text = row['分配idea'].strip()
                    
                    # 处理多个idea的情况（用换行或数字分隔）
                    ideas = re.split(r'\n+|\d+\.', idea_text)
                    ideas = [idea.strip() for idea in ideas if idea.strip()]
                    
                    for i, idea in enumerate(ideas):
                        if idea:
                            project_data = {
                                'title': idea[:200],  # 限制标题长度
                                'idea_description': idea,
                                'status': 'active',
                                'progress': 20.0 if pd.notna(row['交流进度']) else 5.0
                            }
                            
                            project = ResearchProject(**project_data)
                            db.add(project)
                            db.flush()  # 获取ID
                            
                            # 建立合作者关系
                            project.collaborators.append(collaborator)
                            projects_created += 1
                            
                            logger.debug(f"创建项目: {project.title[:50]}...")
                            
                            # 解析并创建交流记录
                            logs = parse_communication_logs(
                                row['交流进度'], 
                                project.id, 
                                collaborator.id
                            )
                            
                            for log_data in logs:
                                log = CommunicationLog(**log_data)
                                db.add(log)
                                logs_created += 1
                                logger.debug(f"创建交流记录: {log.title}")
                
            except Exception as e:
                logger.warning(f"处理行数据失败: {e}, 学生: {row.get('名字', 'Unknown')}")
                continue
        
        # 创建几个团队项目
        team_projects = [
            {
                'title': '数字化能力扎根理论研究',
                'idea_description': '基于扎根理论方法，研究企业数字化能力的形成机制和演化路径',
                'status': 'active',
                'progress': 15.0,
                'team_members': ['周佳祺', '庄晶涵', '范佳伟']  # 从数据中选择
            },
            {
                'title': '数字化转型悬浮数据项目',
                'idea_description': '研究数字化转型过程中的数据悬浮现象及其对企业的影响',
                'status': 'active',
                'progress': 10.0,
                'team_members': ['田超', '王昊']  # 模拟团队成员
            }
        ]
        
        for team_data in team_projects:
            team_members = team_data.pop('team_members')
            project = ResearchProject(**team_data)
            db.add(project)
            db.flush()
            
            # 查找并添加团队成员
            for member_name in team_members:
                member = db.query(Collaborator).filter(Collaborator.name == member_name).first()
                if member:
                    project.collaborators.append(member)
            
            projects_created += 1
            logger.debug(f"创建团队项目: {project.title}")
        
        db.commit()
        
        logger.info("数据导入完成")
        logger.info(f"合作者: {collaborators_created} 个")
        logger.info(f"研究项目: {projects_created} 个")
        logger.info(f"交流记录: {logs_created} 条")
        
    except Exception as e:
        logger.error(f"数据导入失败: {e}")
        db.rollback()
        raise
    finally:
        db.close()

def main():
    """主函数"""
    logger.info("开始真实数据导入流程")
    
    # 步骤1: 清理现有数据
    clean_database()
    
    # 步骤2: 导入真实数据
    import_real_data()
    
    logger.info("真实数据导入完成")

if __name__ == "__main__":
    main()