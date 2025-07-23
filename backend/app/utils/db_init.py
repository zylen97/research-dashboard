"""
数据库初始化工具
"""
import logging
from ..models.database import create_tables, engine, SessionLocal, User
from ..models import Collaborator, ResearchProject, CommunicationLog
from ..utils.auth import get_password_hash

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def init_database():
    """初始化数据库表"""
    logger.info("Creating database tables")
    create_tables()
    logger.info("Database tables created successfully")

def init_users():
    """初始化用户账号"""
    db = SessionLocal()
    
    try:
        # 四个用户的信息
        users_data = [
            {
                "username": "zl",
                "email": "zl@example.com",
                "display_name": "ZL",
                "password": "123"
            },
            {
                "username": "zz", 
                "email": "zz@example.com",
                "display_name": "ZZ",
                "password": "123"
            },
            {
                "username": "yq",
                "email": "yq@example.com", 
                "display_name": "YQ",
                "password": "123"
            },
            {
                "username": "dj",
                "email": "dj@example.com",
                "display_name": "DJ", 
                "password": "123"
            }
        ]
        
        # 检查并创建用户
        for user_data in users_data:
            existing_user = db.query(User).filter(
                (User.username == user_data["username"]) | 
                (User.email == user_data["email"])
            ).first()
            
            if not existing_user:
                new_user = User(
                    username=user_data["username"],
                    email=user_data["email"],
                    display_name=user_data["display_name"],
                    password_hash=get_password_hash(user_data["password"]),
                    is_active=True
                )
                db.add(new_user)
                logger.info(f"Created user: {user_data['username']}")
            else:
                logger.info(f"User already exists: {user_data['username']}")
        
        db.commit()
        logger.info("User initialization completed")
        
    except Exception as e:
        logger.error(f"Error initializing users: {e}")
        db.rollback()
    finally:
        db.close()

def create_sample_data():
    """创建示例数据"""
    db = SessionLocal()
    
    try:
        # 检查是否已有数据
        if db.query(Collaborator).first():
            logger.warning("Sample data already exists, skipping")
            return
        
        logger.info("Creating sample data")
        
        # 创建示例合作者
        collaborators = [
            Collaborator(
                name="张三",
                gender="男",
                class_name="计算机科学与技术2021级1班",
                future_plan="继续深造，攻读研究生学位",
                background="对机器学习和数据挖掘有浓厚兴趣",
                contact_info="zhangsan@email.com"
            ),
            Collaborator(
                name="李四",
                gender="女", 
                class_name="软件工程2021级2班",
                future_plan="毕业后从事软件开发工作",
                background="有丰富的前端开发经验",
                contact_info="lisi@email.com"
            ),
            Collaborator(
                name="王五",
                gender="男",
                class_name="数据科学2020级1班",
                future_plan="希望在数据分析领域发展",
                background="熟悉Python和R语言",
                contact_info="wangwu@email.com"
            )
        ]
        
        for collaborator in collaborators:
            db.add(collaborator)
        
        db.commit()
        
        # 创建示例研究项目
        project = ResearchProject(
            title="基于深度学习的文本情感分析研究",
            idea_description="利用BERT等预训练模型进行中文文本情感分析，提高分类准确率",
            status="active",
            progress=25.0
        )
        
        # 添加合作者到项目
        project.collaborators = collaborators[:2]  # 张三和李四
        
        db.add(project)
        db.commit()
        
        # 创建示例交流日志
        log = CommunicationLog(
            project_id=project.id,
            collaborator_id=collaborators[0].id,
            communication_type="meeting",
            title="项目启动会议",
            content="讨论了项目的总体目标和时间安排，确定了各自的分工",
            outcomes="明确了项目里程碑和deliverables",
            action_items="张三负责数据收集，李四负责模型训练"
        )
        
        db.add(log)
        
        
        db.commit()
        logger.info("Sample data created successfully")
        
    except Exception as e:
        logger.error(f"Error creating sample data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_database()
    create_sample_data()