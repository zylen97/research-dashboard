"""
Ideas管理路由 - 负责人外键化版本
简化的表单设计：项目名称、项目描述、研究方法、来源、负责人ID、成熟度
包含转化为研究项目功能（自动添加负责人到合作者列表）
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
import logging

from ..models import get_db, Idea, ResearchProject, IdeaCreate, IdeaUpdate, IdeaSchema
from ..models.schemas import BatchDeleteRequest, BatchUpdateMaturityRequest
from ..services.audit import AuditService
from ..utils.crud_base import CRUDBase
from ..utils.response import success_response

logger = logging.getLogger(__name__)

router = APIRouter()

# 创建CRUD实例
idea_crud = CRUDBase[Idea, IdeaCreate, IdeaUpdate](Idea)

@router.get("/", response_model=List[IdeaSchema])
async def get_ideas(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    maturity: Optional[str] = None,
    responsible_person_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """获取Ideas列表（预加载负责人信息）"""
    try:
        # 使用joinedload预加载responsible_person关系，避免N+1查询
        query = db.query(Idea).options(joinedload(Idea.responsible_person))

        if maturity:
            query = query.filter(Idea.maturity == maturity)
        if responsible_person_id:
            query = query.filter(Idea.responsible_person_id == responsible_person_id)

        ideas = query.offset(skip).limit(limit).all()

        # 按创建时间倒序排序
        ideas.sort(key=lambda x: x.created_at, reverse=True)

        return ideas
    except Exception as e:
        logger.error(f"获取Ideas列表失败: {e}")
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
            AuditService.log_create(
                db,
                table_name="ideas",
                record_id=new_idea.id,
                new_values=idea.model_dump()
            )
        except Exception as audit_error:
            # 审计日志失败不应该影响数据创建
            logger.warning(f"审计日志记录失败: {audit_error}")
        
        return new_idea
        
    except HTTPException:
        # 重新抛出HTTP异常
        raise
    except Exception as e:
        # 捕获其他所有异常并返回详细错误信息
        logger.error(f"创建Idea时发生错误: {e}")
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
            "responsible_person_id": db_idea.responsible_person_id,
            "maturity": db_idea.maturity
        }
        
        # 使用CRUD基类更新
        updated_idea = idea_crud.update(db, db_obj=db_idea, obj_in=idea_update)
        
        # 记录审计日志
        try:
            AuditService.log_update(
                db,
                table_name="ideas",
                record_id=idea_id,
                old_values=old_values,
                new_values=idea_update.model_dump(exclude_unset=True)
            )
        except Exception as audit_error:
            logger.warning(f"审计日志记录失败: {audit_error}")

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
    """
    删除Idea

    注意：删除Idea后，关联的Paper的source_paper_id会被设为NULL（数据库外键约束）
    """
    try:
        # 获取要删除的记录
        db_idea = idea_crud.get(db, id=idea_id)
        if not db_idea:
            raise HTTPException(status_code=404, detail="Idea not found")

        # 使用序列化服务记录审计日志
        old_values = AuditService.serialize_model_instance(db_idea)

        # 使用CRUD基类删除
        idea_crud.remove(db, id=idea_id)

        # 记录审计日志
        try:
            AuditService.log_delete(
                db,
                table_name="ideas",
                record_id=idea_id,
                old_values=old_values
            )
        except Exception as audit_error:
            logger.warning(f"审计日志记录失败: {audit_error}")

        return success_response(
            message="Idea deleted successfully",
            data={"idea_id": idea_id}
        )

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
    """将Idea转化为研究项目（自动添加负责人到合作者列表）"""
    try:
        # 预加载负责人关系
        idea = db.query(Idea).options(joinedload(Idea.responsible_person)).filter(Idea.id == idea_id).first()
        if not idea:
            raise HTTPException(status_code=404, detail="Idea not found")

        # 创建新的研究项目
        new_project = ResearchProject(
            title=idea.project_name,
            idea_description=idea.project_description or idea.project_name,
            research_method=idea.research_method,
            # 优先使用新字段，如果新字段为空则回退到source
            reference_paper=idea.reference_paper if idea.reference_paper else None,
            reference_journal=idea.reference_journal if idea.reference_journal else None,
            target_journal=idea.target_journal if idea.target_journal else None,
            source=idea.source if (not idea.reference_paper and not idea.reference_journal) else None,
            status="active",
            progress=0.0,
            my_role='first_author'  # 新增：默认设置为第一作者
        )

        # 🔥 核心新增：自动将负责人添加到合作者列表
        responsible_collaborator = idea.responsible_person
        if responsible_collaborator:
            new_project.collaborators.append(responsible_collaborator)
            logger.info(f"自动添加负责人 {responsible_collaborator.name} 到项目合作者列表")

        # 添加到数据库
        db.add(new_project)

        # 删除已转化的Idea
        db.delete(idea)

        # 提交事务
        db.commit()
        db.refresh(new_project)

        # 记录审计日志（CONVERT 视为 DELETE，附加转换信息）
        try:
            AuditService.log_delete(
                db,
                table_name="ideas",
                record_id=idea_id,
                old_values={
                    "action": "CONVERT",
                    "converted_to_project_id": new_project.id,
                    "project_title": new_project.title,
                    "responsible_person_added": responsible_collaborator.name if responsible_collaborator else None,
                    "original_idea": {
                        "project_name": idea.project_name,
                        "project_description": idea.project_description
                    }
                }
            )
        except Exception as audit_error:
            logger.warning(f"审计日志记录失败: {audit_error}")

        return {
            "message": "Idea successfully converted to research project",
            "project_id": new_project.id,
            "project_title": new_project.title,
            "responsible_person_added": responsible_collaborator.name if responsible_collaborator else None
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"转化为研究项目失败: {e}")
        raise HTTPException(status_code=500, detail=f"转化为研究项目失败: {str(e)}")


@router.post("/batch-delete")
async def batch_delete_ideas(
    request_data: BatchDeleteRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """批量删除Ideas"""
    try:
        # 获取所有要删除的记录
        ideas_to_delete = db.query(Idea).filter(Idea.id.in_(request_data.ids)).all()
        deleted_count = len(ideas_to_delete)

        # 记录审计日志
        for idea in ideas_to_delete:
            try:
                AuditService.log_delete(
                    db,
                    table_name="ideas",
                    record_id=idea.id,
                    old_values={
                        "project_name": idea.project_name,
                        "project_description": idea.project_description,
                        "maturity": idea.maturity
                    }
                )
            except Exception as audit_error:
                logger.warning(f"审计日志记录失败: {audit_error}")

        # 批量删除
        db.query(Idea).filter(Idea.id.in_(request_data.ids)).delete(synchronize_session=False)
        db.commit()

        return success_response(
            message=f"Successfully deleted {deleted_count} ideas",
            data={"deleted_count": deleted_count}
        )

    except Exception as e:
        db.rollback()
        logger.error(f"批量删除失败: {e}")
        raise HTTPException(status_code=500, detail=f"批量删除失败: {str(e)}")


@router.post("/batch-update-maturity")
async def batch_update_maturity(
    request_data: BatchUpdateMaturityRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """批量更新Ideas成熟度"""
    try:
        # 获取现有记录用于审计
        existing_ideas = db.query(Idea).filter(Idea.id.in_(request_data.ids)).all()

        # 记录审计日志
        for idea in existing_ideas:
            try:
                AuditService.log_update(
                    db,
                    table_name="ideas",
                    record_id=idea.id,
                    old_values={"maturity": idea.maturity},
                    new_values={"maturity": request_data.maturity}
                )
            except Exception as audit_error:
                logger.warning(f"审计日志记录失败: {audit_error}")

        # 批量更新
        updated_count = db.query(Idea).filter(
            Idea.id.in_(request_data.ids)
        ).update(
            {"maturity": request_data.maturity},
            synchronize_session=False
        )
        db.commit()

        return success_response(
            message=f"Successfully updated {updated_count} ideas",
            data={"updated_count": updated_count, "new_maturity": request_data.maturity}
        )

    except Exception as e:
        db.rollback()
        logger.error(f"批量更新成熟度失败: {e}")
        raise HTTPException(status_code=500, detail=f"批量更新成熟度失败: {str(e)}")


@router.get("/stats")
async def get_ideas_stats(
    request: Request,
    db: Session = Depends(get_db)
):
    """获取Ideas统计信息"""
    try:
        total = db.query(Idea).count()
        mature = db.query(Idea).filter(Idea.maturity == 'mature').count()
        immature = db.query(Idea).filter(Idea.maturity == 'immature').count()

        # 按负责人统计
        responsible_stats = db.query(
            Idea.responsible_person_id,
            func.count(Idea.id).label('count')
        ).group_by(Idea.responsible_person_id).all()

        return {
            "total": total,
            "by_maturity": {
                "mature": mature,
                "immature": immature
            },
            "by_responsible": [
                {"responsible_person_id": item[0], "count": item[1]}
                for item in responsible_stats
            ]
        }

    except Exception as e:
        logger.error(f"获取统计信息失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取统计信息失败: {str(e)}")