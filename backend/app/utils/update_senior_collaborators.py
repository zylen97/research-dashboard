"""
更新高级合作者和性别信息
"""
import logging
from sqlalchemy import text
from ..models.database import SessionLocal, Collaborator

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def update_senior_collaborators():
    """更新高级合作者标记和性别信息"""
    db = SessionLocal()
    
    try:
        # 首先添加is_senior列（如果不存在）
        try:
            db.execute(text("ALTER TABLE collaborators ADD COLUMN is_senior BOOLEAN DEFAULT 0"))
            db.commit()
            logger.info("成功添加is_senior列")
        except Exception as e:
            if "duplicate column name" in str(e).lower():
                logger.info("is_senior列已存在")
            else:
                logger.warning(f"添加列时出错: {e}")
            db.rollback()
        
        # 更新张哲的信息
        zhang_zhe = db.query(Collaborator).filter(Collaborator.name == "张哲").first()
        if zhang_zhe:
            zhang_zhe.gender = "男"
            zhang_zhe.is_senior = True
            logger.info("更新张哲为高级合作者（男）")
        else:
            logger.warning("未找到合作者：张哲")
        
        # 更新赵雅琦的信息
        zhao_yaqi = db.query(Collaborator).filter(Collaborator.name == "赵雅琦").first()
        if zhao_yaqi:
            zhao_yaqi.gender = "女"
            zhao_yaqi.is_senior = True
            logger.info("更新赵雅琦为高级合作者（女）")
        else:
            logger.warning("未找到合作者：赵雅琦")
        
        # 更新郑冬杰的信息
        zheng_dongjie = db.query(Collaborator).filter(Collaborator.name == "郑冬杰").first()
        if zheng_dongjie:
            zheng_dongjie.gender = "男"
            zheng_dongjie.is_senior = True
            logger.info("更新郑冬杰为高级合作者（男）")
        else:
            logger.warning("未找到合作者：郑冬杰")
        
        db.commit()
        logger.info("高级合作者更新完成")
        
        # 显示所有高级合作者
        senior_collaborators = db.query(Collaborator).filter(Collaborator.is_senior == True).all()
        logger.info(f"当前高级合作者（{len(senior_collaborators)}人）:")
        for sc in senior_collaborators:
            logger.info(f"   - {sc.name} ({sc.gender})")
        
    except Exception as e:
        logger.error(f"更新失败: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    update_senior_collaborators()