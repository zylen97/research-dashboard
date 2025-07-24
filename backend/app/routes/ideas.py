from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import logging

from ..models.database import get_db, Idea, Collaborator, User
from ..models.schemas import IdeaCreate, IdeaUpdate, IdeaSchema, Collaborator as CollaboratorSchema
from ..utils.auth import get_current_user
from ..utils.response import success_response, error_response

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/", response_model=List[IdeaSchema])
async def get_ideas(
    skip: int = 0,
    limit: int = 100,
    importance_filter: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取Ideas列表"""
    query = db.query(Idea)
    
    if importance_filter is not None:
        query = query.filter(Idea.importance == importance_filter)
    
    ideas = query.offset(skip).limit(limit).all()
    return ideas

@router.get("/{idea_id}", response_model=IdeaSchema)
async def get_idea(
    idea_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取单个Idea详情"""
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    return idea

@router.post("/", response_model=IdeaSchema)
async def create_idea(
    idea: IdeaCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """创建新的Idea"""
    db_idea = Idea(**idea.dict())
    db.add(db_idea)
    db.commit()
    db.refresh(db_idea)
    return db_idea

@router.put("/{idea_id}", response_model=IdeaSchema)
async def update_idea(
    idea_id: int,
    idea_update: IdeaUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """更新Idea"""
    db_idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not db_idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    
    update_data = idea_update.dict(exclude_unset=True)
    update_data['updated_at'] = datetime.utcnow()
    
    for field, value in update_data.items():
        setattr(db_idea, field, value)
    
    db.commit()
    db.refresh(db_idea)
    return db_idea

@router.delete("/{idea_id}")
async def delete_idea(
    idea_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """删除Idea"""
    db_idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not db_idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    
    db.delete(db_idea)
    db.commit()
    return {"message": "Idea deleted successfully"}

@router.get("/collaborators/senior", response_model=List[CollaboratorSchema])
async def get_senior_collaborators(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取高级合作者列表（senior级别）"""
    try:
        # 使用is_senior字段而不是level字段
        collaborators = db.query(Collaborator).filter(
            Collaborator.is_senior == True,
            Collaborator.is_deleted == False
        ).all()
        return collaborators
    except Exception as e:
        # 如果查询失败，返回所有未删除的合作者作为fallback
        logger.warning(f"Senior collaborator query failed: {e}")
        try:
            # Fallback: 返回所有未删除的合作者
            collaborators = db.query(Collaborator).filter(
                Collaborator.is_deleted == False
            ).all()
            return collaborators
        except Exception as e2:
            logger.error(f"Fallback query also failed: {e2}")
            raise HTTPException(status_code=500, detail="Database schema error - please run migration")

@router.get("/health")
async def health_check():
    """健康检查端点 - 不需要认证，不依赖注入"""
    from sqlalchemy import text
    from ..models.database import SessionLocal
    
    logger.info("Health check endpoint called - starting execution")
    
    # 直接创建数据库会话，避免依赖注入导致的认证问题
    db = SessionLocal()
    
    try:
        logger.info("Step 1: Testing database connection")
        # 检查数据库连接 - 修复SQLAlchemy版本兼容性
        db.execute(text("SELECT 1"))
        logger.info("Step 1: Database connection successful")
        
        logger.info("Step 2: Checking table structure")
        # 检查collaborators表结构
        result = db.execute(text("PRAGMA table_info(collaborators)")).fetchall()
        columns = [row[1] for row in result]
        has_is_senior = 'is_senior' in columns
        has_is_deleted = 'is_deleted' in columns
        logger.info(f"Step 2: Table columns found: {columns}")
        
        logger.info("Step 3: Counting senior collaborators")
        # 检查是否有senior collaborators
        try:
            senior_count = db.execute(text("SELECT COUNT(*) FROM collaborators WHERE is_senior = 1 AND is_deleted = 0")).fetchone()[0]
            logger.info(f"Step 3: Senior count successful: {senior_count}")
        except Exception as e:
            logger.error(f"Step 3: Senior count failed: {e}")
            senior_count = 0
        
        logger.info("Step 4: Preparing response")
        response = {
            "status": "healthy",
            "database": "connected",
            "collaborators_table": {
                "exists": True,
                "has_is_senior_field": has_is_senior,
                "has_is_deleted_field": has_is_deleted,
                "senior_collaborators_count": senior_count
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        logger.info(f"Step 4: Response prepared: {response}")
        return response
        
    except Exception as e:
        logger.error(f"Health check failed with exception: {e}")
        logger.error(f"Exception type: {type(e).__name__}")
        logger.error(f"Exception details: {str(e)}")
        
        error_response = {
            "status": "unhealthy",
            "error": str(e),
            "error_type": type(e).__name__,
            "timestamp": datetime.utcnow().isoformat()
        }
        logger.error(f"Returning error response: {error_response}")
        return error_response
    finally:
        # 确保关闭数据库连接
        db.close()