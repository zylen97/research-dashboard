"""
Ideas管理路由 - 重新设计版本
简化的表单设计：项目名称、项目描述、研究方法、来源、负责人、成熟度
包含转化为研究项目功能
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from ..models import get_db, Idea, ResearchProject, IdeaCreate, IdeaUpdate, IdeaSchema
from ..services.audit import AuditService
from ..utils.crud_base import CRUDBase
from ..utils.response import success_response

router = APIRouter()

# 创建CRUD实例
idea_crud = CRUDBase[Idea, IdeaCreate, IdeaUpdate](Idea)

@router.get("/", response_model=List[IdeaSchema])
async def get_ideas(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    maturity: Optional[str] = None,
    responsible_person: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """获取Ideas列表"""
    try:
        filters = {}
        if maturity:
            filters['maturity'] = maturity
        if responsible_person:
            filters['responsible_person'] = responsible_person
        
        ideas = idea_crud.get_multi(
            db,
            skip=skip,
            limit=limit,
            filters=filters
        )
        
        # 按创建时间倒序排序
        ideas.sort(key=lambda x: x.created_at, reverse=True)
        
        return ideas
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取Ideas列表失败: {str(e)}")

@router.get("/{idea_id}", response_model=IdeaSchema)
async def get_idea(
    idea_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """获取单个Idea详情"""
    try:
        idea = idea_crud.get(db, id=idea_id)
        if not idea:
            raise HTTPException(status_code=404, detail="Idea not found")
        return idea
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取Idea详情失败: {str(e)}")

@router.post("/", response_model=IdeaSchema)
async def create_idea(
    idea: IdeaCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    """创建新的Idea"""
    try:
        # 验证maturity值
        if idea.maturity not in ['mature', 'immature']:
            raise HTTPException(status_code=400, detail="Maturity must be 'mature' or 'immature'")
        
        # 使用CRUD基类创建
        new_idea = idea_crud.create(db, obj_in=idea)
        
        # 记录审计日志
        try:
            audit_service = AuditService(db)
            audit_service.log_action(
                table_name="ideas",
                action="CREATE",
                record_id=new_idea.id,
                new_values=idea.model_dump()
            )
        except Exception as audit_error:
            # 审计日志失败不应该影响数据创建
            print(f"审计日志记录失败: {audit_error}")
        
        return new_idea
        
    except HTTPException:
        # 重新抛出HTTP异常
        raise
    except Exception as e:
        # 捕获其他所有异常并返回详细错误信息
        print(f"创建Idea时发生错误: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"创建Idea失败: {str(e)}"
        )

@router.put("/{idea_id}", response_model=IdeaSchema)
async def update_idea(
    idea_id: int,
    idea_update: IdeaUpdate,
    request: Request,
    db: Session = Depends(get_db)
):
    """更新Idea"""
    try:
        # 获取现有记录
        db_idea = idea_crud.get(db, id=idea_id)
        if not db_idea:
            raise HTTPException(status_code=404, detail="Idea not found")
        
        # 验证maturity值（如果提供）
        if idea_update.maturity and idea_update.maturity not in ['mature', 'immature']:
            raise HTTPException(status_code=400, detail="Maturity must be 'mature' or 'immature'")
        
        # 记录原始值用于审计
        old_values = {
            "project_name": db_idea.project_name,
            "project_description": db_idea.project_description,
            "research_method": db_idea.research_method,
            "source": db_idea.source,
            "responsible_person": db_idea.responsible_person,
            "maturity": db_idea.maturity
        }
        
        # 使用CRUD基类更新
        updated_idea = idea_crud.update(db, db_obj=db_idea, obj_in=idea_update)
        
        # 记录审计日志
        try:
            audit_service = AuditService(db)
            audit_service.log_action(
                table_name="ideas",
                action="UPDATE",
                record_id=idea_id,
                old_values=old_values,
                new_values=idea_update.model_dump(exclude_unset=True)
            )
        except Exception as audit_error:
            print(f"审计日志记录失败: {audit_error}")
        
        return updated_idea
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新Idea失败: {str(e)}")

@router.delete("/{idea_id}")
async def delete_idea(
    idea_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """删除Idea"""
    try:
        # 获取要删除的记录
        db_idea = idea_crud.get(db, id=idea_id)
        if not db_idea:
            raise HTTPException(status_code=404, detail="Idea not found")
        
        # 记录原始值用于审计
        old_values = {
            "project_name": getattr(db_idea, "project_name", ""),
            "project_description": getattr(db_idea, "project_description", ""),
            "research_method": getattr(db_idea, "research_method", ""),
            "source": getattr(db_idea, "source", ""),
            "responsible_person": getattr(db_idea, "responsible_person", ""),
            "maturity": getattr(db_idea, "maturity", "")
        }
        
        # 使用CRUD基类删除
        idea_crud.remove(db, id=idea_id)
        
        # 记录审计日志
        try:
            audit_service = AuditService(db)
            audit_service.log_action(
                table_name="ideas",
                action="DELETE",
                record_id=idea_id,
                old_values=old_values
            )
        except Exception as audit_error:
            print(f"审计日志记录失败: {audit_error}")
        
        return success_response(message="Idea deleted successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除Idea失败: {str(e)}")

@router.post("/{idea_id}/convert-to-project")
async def convert_to_project(
    idea_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """将Idea转化为研究项目"""
    try:
        # 获取Idea
        idea = idea_crud.get(db, id=idea_id)
        if not idea:
            raise HTTPException(status_code=404, detail="Idea not found")
        
        # 创建新的研究项目
        new_project = ResearchProject(
            title=idea.project_name,
            idea_description=idea.project_description or idea.project_name,
            research_method=idea.research_method,
            source=idea.source,
            status="active",
            progress=0.0
        )
        
        # 添加到数据库
        db.add(new_project)
        
        # 删除已转化的Idea
        idea_crud.remove(db, id=idea_id)
        
        # 提交事务
        db.commit()
        db.refresh(new_project)
        
        # 记录审计日志
        try:
            audit_service = AuditService(db)
            audit_service.log_action(
                table_name="ideas",
                action="CONVERT",
                record_id=idea_id,
                new_values={
                    "converted_to_project_id": new_project.id,
                    "project_title": new_project.title
                }
            )
        except Exception as audit_error:
            print(f"审计日志记录失败: {audit_error}")
        
        return {
            "message": "Idea successfully converted to research project",
            "project_id": new_project.id,
            "project_title": new_project.title
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"转化为研究项目失败: {str(e)}")