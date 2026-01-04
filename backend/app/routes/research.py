from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc
from typing import List, Optional
from datetime import datetime
import json
from ..models import (
    get_db, ResearchProject, Collaborator, CommunicationLog,
    ResearchProjectSchema, ResearchProjectCreate, ResearchProjectUpdate,
    CommunicationLogSchema, CommunicationLogCreate, CommunicationLogUpdate,
    ResearchMethod
)
from ..utils import DataValidator
from ..utils.security_validators import SecurityValidator
from ..utils.response import success_response

router = APIRouter()


def update_research_method_usage(db: Session, method_name: str, increment: int = 1):
    """
    更新研究方法的使用次数

    Args:
        db: 数据库会话
        method_name: 研究方法名称
        increment: 增量（正数增加，负数减少）
    """
    if not method_name:
        return

    method = db.query(ResearchMethod).filter(ResearchMethod.name == method_name).first()
    if method:
        method.usage_count = max(0, method.usage_count + increment)

@router.get("/", response_model=List[ResearchProjectSchema])
async def get_research_projects(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    my_role: Optional[str] = None,
    research_method: Optional[str] = None,
    target_journal: Optional[str] = None,
    reference_journal: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """获取研究项目列表（数据共享，包含交流记录）"""
    # 基础查询 + 安全的关联加载
    query = db.query(ResearchProject).options(
        joinedload(ResearchProject.collaborators),
        joinedload(ResearchProject.communication_logs)
    )

    # 按状态筛选
    if status:
        query = query.filter(ResearchProject.status == status)

    # 按我的身份筛选
    if my_role:
        query = query.filter(ResearchProject.my_role == my_role)

    # 按研究方法筛选（模糊匹配）
    if research_method:
        query = query.filter(ResearchProject.research_method.contains(research_method))

    # 按投稿期刊筛选（模糊匹配）
    if target_journal:
        query = query.filter(ResearchProject.target_journal.contains(target_journal))

    # 按参考期刊筛选（模糊匹配）
    if reference_journal:
        query = query.filter(ResearchProject.reference_journal.contains(reference_journal))

    projects = query.offset(skip).limit(limit).all()
    return projects

# ============ 用户独立待办功能 API ============
# 注意：这些路由必须在 /{project_id} 之前定义，否则会被错误匹配

@router.get("/todos", response_model=List[ResearchProjectSchema])
async def get_user_todos(
    db: Session = Depends(get_db)
):
    """获取所有待办项目（单用户模式）"""
    # 直接查询is_todo=True的项目
    projects = db.query(ResearchProject).filter(
        ResearchProject.is_todo == True
    ).options(
        joinedload(ResearchProject.collaborators),
        joinedload(ResearchProject.communication_logs)
    ).order_by(desc(ResearchProject.todo_marked_at)).all()

    return projects

@router.get("/{project_id}", response_model=ResearchProjectSchema)
async def get_research_project(project_id: int, db: Session = Depends(get_db)):
    """获取单个研究项目详情（包含交流记录）"""
    project = db.query(ResearchProject).options(
        joinedload(ResearchProject.communication_logs)
    ).filter(ResearchProject.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Research project not found"
        )
    return project

@router.post("/", response_model=ResearchProjectSchema)
async def create_research_project(
    project: ResearchProjectCreate, 
    db: Session = Depends(get_db)
):
    """创建新研究项目"""
    # 安全验证和清理数据
    security_result = SecurityValidator.validate_and_sanitize_project_data(project.model_dump())
    if not security_result["valid"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "数据验证失败", "errors": security_result["errors"]}
        )
    
    # 业务逻辑验证
    validation_result = DataValidator.validate_project_data(security_result["sanitized_data"], db)
    if not validation_result["valid"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"errors": validation_result["errors"], "warnings": validation_result["warnings"]}
        )
    
    # Create project without collaborators first, using sanitized data
    sanitized_data = security_result["sanitized_data"]
    project_data = {k: v for k, v in sanitized_data.items() if k != 'collaborator_ids'}

    # 处理start_date字段
    if 'start_date' in project_data:
        # 如果用户提供了start_date，使用它
        if project_data['start_date'] is not None:
            project_data['start_date'] = project_data['start_date']
        else:
            # 如果为None，使用当前时间
            project_data['start_date'] = datetime.utcnow()
    else:
        # 如果没有提供，使用当前时间
        project_data['start_date'] = datetime.utcnow()
    
    db_project = ResearchProject(**project_data)
    db.add(db_project)
    db.flush()  # Get the project ID
    
    # Add collaborators using sanitized data
    collaborator_ids = sanitized_data.get('collaborator_ids', [])
    if collaborator_ids:
        collaborators = db.query(Collaborator).filter(
            Collaborator.id.in_(collaborator_ids),
            Collaborator.is_deleted == False
        ).all()
        db_project.collaborators = collaborators

    db.commit()
    db.refresh(db_project)

    # 更新研究方法的使用次数（v4.7）
    if db_project.research_method:
        update_research_method_usage(db, db_project.research_method, 1)
        db.commit()

    return db_project

@router.put("/{project_id}", response_model=ResearchProjectSchema)
async def update_research_project(
    project_id: int,
    project_update: ResearchProjectUpdate,
    db: Session = Depends(get_db)
):
    """更新研究项目"""
    db_project = db.query(ResearchProject).filter(ResearchProject.id == project_id).first()
    if not db_project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Research project not found"
        )

    # 保存旧的研究方法，用于更新usage_count（v4.7）
    old_research_method = db_project.research_method

    update_data = project_update.model_dump(exclude_unset=True, exclude={'collaborator_ids'})

    # 特殊处理is_todo字段
    if 'is_todo' in update_data:
        from datetime import datetime
        db_project.is_todo = update_data['is_todo']
        if update_data['is_todo']:
            # 标记为待办时记录时间
            db_project.todo_marked_at = datetime.utcnow()
        else:
            # 取消待办标记时清除时间
            db_project.todo_marked_at = None
        update_data.pop('is_todo')  # 从 update_data 中移除，已单独处理

    # 处理其他字段
    for field, value in update_data.items():
        setattr(db_project, field, value)

    # Update collaborators if provided
    if project_update.collaborator_ids is not None:
        collaborators = db.query(Collaborator).filter(
            Collaborator.id.in_(project_update.collaborator_ids)
        ).all()
        db_project.collaborators = collaborators

    db.commit()
    db.refresh(db_project)

    # 更新研究方法的使用次数（v4.7）
    new_research_method = db_project.research_method
    if old_research_method != new_research_method:
        # 减少旧方法的使用次数
        if old_research_method:
            update_research_method_usage(db, old_research_method, -1)
        # 增加新方法的使用次数
        if new_research_method:
            update_research_method_usage(db, new_research_method, 1)
        db.commit()

    return db_project

@router.delete("/{project_id}")
async def delete_research_project(project_id: int, db: Session = Depends(get_db)):
    """删除研究项目及其关联数据"""
    db_project = db.query(ResearchProject).filter(ResearchProject.id == project_id).first()
    if not db_project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Research project not found"
        )

    # 保存研究方法，用于更新usage_count（v4.7）
    research_method = db_project.research_method

    try:
        # 获取关联数据统计（用于返回信息）
        log_count = db.query(CommunicationLog).filter(CommunicationLog.project_id == project_id).count()
        collaborator_count = len(db_project.collaborators)

        # 删除项目（级联删除会自动处理关联的交流日志）
        db.delete(db_project)
        db.commit()

        # 更新研究方法的使用次数（v4.7）
        if research_method:
            update_research_method_usage(db, research_method, -1)
            db.commit()

        return {
            "message": "Research project deleted successfully",
            "deleted_logs": log_count,
            "removed_collaborators": collaborator_count
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete project: {str(e)}"
        )

@router.get("/{project_id}/logs", response_model=List[CommunicationLogSchema])
async def get_project_communication_logs(
    project_id: int, 
    db: Session = Depends(get_db)
):
    """获取项目交流日志"""
    logs = db.query(CommunicationLog).filter(
        CommunicationLog.project_id == project_id
    ).order_by(CommunicationLog.communication_date.desc()).all()
    return logs

@router.post("/{project_id}/logs", response_model=CommunicationLogSchema)
async def create_communication_log(
    project_id: int,
    log: CommunicationLogCreate,
    db: Session = Depends(get_db)
):
    """创建交流日志"""
    # Verify project exists
    project = db.query(ResearchProject).filter(ResearchProject.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Research project not found"
        )
    
    # Ensure project_id matches
    log_data = log.model_dump()
    log_data['project_id'] = project_id
    
    db_log = CommunicationLog(**log_data)
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log

@router.put("/{project_id}/logs/{log_id}", response_model=CommunicationLogSchema)
async def update_communication_log(
    project_id: int,
    log_id: int,
    log_update: CommunicationLogUpdate,
    db: Session = Depends(get_db)
):
    """更新交流日志"""
    # Verify project exists
    project = db.query(ResearchProject).filter(ResearchProject.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Research project not found"
        )
    
    # Get the log
    db_log = db.query(CommunicationLog).filter(
        CommunicationLog.id == log_id,
        CommunicationLog.project_id == project_id
    ).first()
    if not db_log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Communication log not found"
        )
    
    # Update the log
    update_data = log_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_log, field, value)
    
    db.commit()
    db.refresh(db_log)
    return db_log

@router.delete("/{project_id}/logs/{log_id}")
async def delete_communication_log(
    project_id: int,
    log_id: int,
    db: Session = Depends(get_db)
):
    """删除交流日志"""
    # Verify project exists
    project = db.query(ResearchProject).filter(ResearchProject.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Research project not found"
        )
    
    # Get the log
    db_log = db.query(CommunicationLog).filter(
        CommunicationLog.id == log_id,
        CommunicationLog.project_id == project_id
    ).first()
    if not db_log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Communication log not found"
        )
    
    db.delete(db_log)
    db.commit()
    return success_response(message="Communication log deleted successfully")

@router.put("/{project_id}/progress")
async def update_project_progress(
    project_id: int,
    progress: float,
    db: Session = Depends(get_db)
):
    """更新项目进度"""
    if not 0 <= progress <= 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Progress must be between 0 and 100"
        )
    
    db_project = db.query(ResearchProject).filter(ResearchProject.id == project_id).first()
    if not db_project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Research project not found"
        )
    
    db_project.progress = progress
    db.commit()
    return {"message": "Progress updated successfully", "progress": progress}

@router.get("/{project_id}/check-dependencies")
async def check_project_dependencies(project_id: int, db: Session = Depends(get_db)):
    """检查项目的依赖关系"""
    dependencies = DataValidator.check_project_dependencies(project_id, db)
    if not dependencies["exists"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Research project not found"
        )
    return dependencies


@router.post("/{project_id}/todo")
async def mark_project_as_todo(
    project_id: int,
    db: Session = Depends(get_db)
):
    """将项目标记为待办（单用户模式）"""
    project = db.query(ResearchProject).filter(ResearchProject.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Research project not found"
        )

    project.is_todo = True
    project.todo_marked_at = datetime.utcnow()
    db.commit()
    return {"message": "Project marked as todo successfully"}


@router.delete("/{project_id}/todo")
async def unmark_project_as_todo(
    project_id: int,
    db: Session = Depends(get_db)
):
    """取消项目的待办标记（单用户模式）"""
    project = db.query(ResearchProject).filter(ResearchProject.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Research project not found"
        )

    project.is_todo = False
    project.todo_marked_at = None
    db.commit()
    return {"message": "Project todo unmarked successfully"}


@router.get("/{project_id}/todo-status")
async def get_project_todo_status(
    project_id: int,
    db: Session = Depends(get_db)
):
    """获取项目的待办状态（单用户模式）"""
    project = db.query(ResearchProject).filter(ResearchProject.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Research project not found"
        )

    return {
        "is_todo": project.is_todo if project.is_todo else False,
        "marked_at": project.todo_marked_at
    }