from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from ..models.database import get_db, Idea, Collaborator, User
from ..models.schemas import IdeaCreate, IdeaUpdate, IdeaSchema, Collaborator as CollaboratorSchema
from ..utils.auth import get_current_user
from ..utils.response import success_response, error_response

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
    collaborators = db.query(Collaborator).filter(
        Collaborator.level == "senior",
        Collaborator.deleted_at.is_(None)
    ).all()
    return collaborators