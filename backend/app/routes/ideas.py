from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from typing import List, Optional
from app.models.database import get_db
from app.models import (
    Idea, IdeaCreate, IdeaUpdate, IdeaSchema,
    Collaborator, CollaboratorSchema
)
from app.utils.auth import get_current_user
from app.models.schemas import User

router = APIRouter()

@router.get("/", response_model=List[IdeaSchema])
async def get_ideas(
    skip: int = 0,
    limit: int = 100,
    importance_filter: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取Ideas列表，支持重要性筛选"""
    query = db.query(Idea).options(joinedload(Idea.collaborator))
    
    # 按重要性筛选
    if importance_filter is not None and 1 <= importance_filter <= 5:
        query = query.filter(Idea.importance == importance_filter)
    
    # 按创建时间倒序排列
    ideas = query.order_by(desc(Idea.created_at)).offset(skip).limit(limit).all()
    return ideas

@router.get("/{idea_id}", response_model=IdeaSchema)
async def get_idea(
    idea_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取单个Idea详情"""
    idea = db.query(Idea).options(joinedload(Idea.collaborator)).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea不存在")
    return idea

@router.post("/", response_model=IdeaSchema)
async def create_idea(
    idea_data: IdeaCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """创建新的Idea"""
    # 验证负责人是否存在且为高级合作者
    if idea_data.collaborator_id:
        collaborator = db.query(Collaborator).filter(
            Collaborator.id == idea_data.collaborator_id,
            Collaborator.is_senior == True,
            Collaborator.is_deleted == False
        ).first()
        if not collaborator:
            raise HTTPException(status_code=400, detail="负责人不存在或非高级合作者")
    
    # 创建Idea
    db_idea = Idea(**idea_data.dict())
    db.add(db_idea)
    db.commit()
    db.refresh(db_idea)
    
    # 加载关联的collaborator数据
    idea_with_collaborator = db.query(Idea).options(joinedload(Idea.collaborator)).filter(Idea.id == db_idea.id).first()
    return idea_with_collaborator

@router.put("/{idea_id}", response_model=IdeaSchema)
async def update_idea(
    idea_id: int,
    idea_data: IdeaUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """更新Idea"""
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea不存在")
    
    # 验证负责人是否存在且为高级合作者
    if idea_data.collaborator_id is not None:
        if idea_data.collaborator_id:  # 不为None且不为空
            collaborator = db.query(Collaborator).filter(
                Collaborator.id == idea_data.collaborator_id,
                Collaborator.is_senior == True,
                Collaborator.is_deleted == False
            ).first()
            if not collaborator:
                raise HTTPException(status_code=400, detail="负责人不存在或非高级合作者")
    
    # 更新字段
    update_data = idea_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(idea, field, value)
    
    db.commit()
    db.refresh(idea)
    
    # 加载关联的collaborator数据
    idea_with_collaborator = db.query(Idea).options(joinedload(Idea.collaborator)).filter(Idea.id == idea.id).first()
    return idea_with_collaborator

@router.delete("/{idea_id}")
async def delete_idea(
    idea_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """删除Idea"""
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea不存在")
    
    db.delete(idea)
    db.commit()
    
    return {"message": "Idea删除成功"}

@router.get("/collaborators/senior", response_model=List[CollaboratorSchema])
async def get_senior_collaborators(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取高级合作者列表供选择"""
    senior_collaborators = db.query(Collaborator).filter(
        Collaborator.is_senior == True,
        Collaborator.is_deleted == False
    ).order_by(Collaborator.name).all()
    
    return senior_collaborators