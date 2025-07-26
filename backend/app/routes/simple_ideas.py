"""
优化后的简化版Ideas管理路由
使用ORM和CRUDBase替代原始SQL
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from ..models import get_db, Idea, ResearchProject, IdeaCreate, IdeaUpdate, IdeaSchema
from ..models.database import Collaborator
from ..services.audit import AuditService
from ..utils.crud_base import CRUDBase
from ..utils.response import success_response

router = APIRouter()

# 使用统一的schema模型

# 创建CRUD实例
idea_crud = CRUDBase[Idea, IdeaCreate, IdeaUpdate](Idea)

@router.get("/", response_model=List[IdeaSchema])
async def get_ideas(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    maturity: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """获取Ideas列表"""
    filters = {}
    if maturity:
        filters['maturity'] = maturity
    
    ideas = idea_crud.get_multi(
        db,
        skip=skip,
        limit=limit,
        filters=filters
    )
    
    # 按创建时间倒序排序
    ideas.sort(key=lambda x: x.created_at, reverse=True)
    
    return ideas

@router.get("/{idea_id}", response_model=IdeaSchema)
async def get_idea(
    idea_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """获取单个Idea详情"""
    idea = idea_crud.get(db, id=idea_id)
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    return idea

@router.post("/", response_model=IdeaSchema)
async def create_idea(
    idea: IdeaCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    """创建新的Idea"""
    # 验证maturity值
    if idea.maturity not in ['mature', 'immature']:
        raise HTTPException(status_code=400, detail="Maturity must be 'mature' or 'immature'")
    
    # 使用CRUD基类创建
    new_idea = idea_crud.create(db, obj_in=idea)
    
    # 记录审计日志
    audit_service = AuditService(db)
    audit_service.log_action(
        table_name="ideas",
        action="CREATE",
        record_id=new_idea.id,
        new_values=idea.model_dump(),
        user_id=getattr(request.state, "user_id", None)
    )
    
    return new_idea

@router.put("/{idea_id}", response_model=IdeaSchema)
async def update_idea(
    idea_id: int,
    idea_update: IdeaUpdate,
    request: Request,
    db: Session = Depends(get_db)
):
    """更新Idea"""
    # 获取现有记录
    db_idea = idea_crud.get(db, id=idea_id)
    if not db_idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    
    # 验证maturity值（如果提供）
    if idea_update.maturity and idea_update.maturity not in ['mature', 'immature']:
        raise HTTPException(status_code=400, detail="Maturity must be 'mature' or 'immature'")
    
    # 记录原始值用于审计
    old_values = {
        "research_question": db_idea.research_question,
        "research_method": db_idea.research_method,
        "source_journal": db_idea.source_journal,
        "source_literature": db_idea.source_literature,
        "responsible_person": db_idea.responsible_person,
        "maturity": db_idea.maturity,
        "description": db_idea.description
    }
    
    # 使用CRUD基类更新
    updated_idea = idea_crud.update(db, db_obj=db_idea, obj_in=idea_update)
    
    # 记录审计日志
    audit_service = AuditService(db)
    audit_service.log_action(
        table_name="ideas",
        action="UPDATE",
        record_id=idea_id,
        old_values=old_values,
        new_values=idea_update.model_dump(exclude_unset=True),
        user_id=getattr(request.state, "user_id", None)
    )
    
    return updated_idea

@router.delete("/{idea_id}")
async def delete_idea(
    idea_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """删除Idea"""
    # 获取要删除的记录
    db_idea = idea_crud.get(db, id=idea_id)
    if not db_idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    
    # 记录原始值用于审计
    old_values = {
        "research_question": db_idea.research_question,
        "research_method": db_idea.research_method,
        "source_journal": db_idea.source_journal,
        "source_literature": db_idea.source_literature,
        "responsible_person": db_idea.responsible_person,
        "maturity": db_idea.maturity,
        "description": db_idea.description
    }
    
    # 使用CRUD基类删除
    idea_crud.remove(db, id=idea_id)
    
    # 记录审计日志
    audit_service = AuditService(db)
    audit_service.log_action(
        table_name="ideas",
        action="DELETE",
        record_id=idea_id,
        old_values=old_values,
        user_id=getattr(request.state, "user_id", None)
    )
    
    return success_response(message="Idea deleted successfully")

@router.post("/{idea_id}/convert-to-project")
async def convert_to_project(
    idea_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """将Idea转化为研究项目"""
    # 获取Idea
    idea = idea_crud.get(db, id=idea_id)
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    
    # 创建新的研究项目
    new_project = ResearchProject(
        title=idea.research_question,
        idea_description=idea.description or idea.research_question,
        research_method=idea.research_method,
        source=f"期刊: {idea.source_journal} | 文献: {idea.source_literature}",
        status="active",
        progress=0.0
    )
    
    # 如果负责人是现有合作者，建立关联
    if idea.responsible_person:
        collaborator = db.query(Collaborator).filter(
            Collaborator.name == idea.responsible_person,
            Collaborator.is_deleted == False
        ).first()
        
        if collaborator:
            new_project.collaborators.append(collaborator)
    
    db.add(new_project)
    
    # 删除已转化的Idea
    idea_crud.remove(db, id=idea_id)
    
    db.commit()
    
    # 记录审计日志
    audit_service = AuditService(db)
    audit_service.log_action(
        table_name="ideas",
        action="CONVERT",
        record_id=idea_id,
        new_values={"converted_to_project_id": new_project.id},
        user_id=getattr(request.state, "user_id", None)
    )
    
    return {
        "message": "Idea successfully converted to research project",
        "project_id": new_project.id
    }