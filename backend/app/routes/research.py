from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc
from typing import List, Optional
from ..models import (
    get_db, ResearchProject, Collaborator, CommunicationLog,
    ResearchProjectSchema, ResearchProjectCreate, ResearchProjectUpdate,
    CommunicationLogSchema, CommunicationLogCreate, CommunicationLogUpdate
)
from ..utils import DataValidator
from ..utils.security_validators import SecurityValidator

router = APIRouter()

@router.get("/", response_model=List[ResearchProjectSchema])
async def get_research_projects(
    skip: int = 0, 
    limit: int = 100, 
    status_filter: str = None,
    db: Session = Depends(get_db)
):
    """获取研究项目列表"""
    query = db.query(ResearchProject).options(joinedload(ResearchProject.collaborators))
    if status_filter:
        query = query.filter(ResearchProject.status == status_filter)
    projects = query.offset(skip).limit(limit).all()
    
    # 为每个项目获取最新交流进度和实际开始时间
    for project in projects:
        # 获取最新的交流日志
        latest_log = db.query(CommunicationLog).filter(
            CommunicationLog.project_id == project.id
        ).order_by(desc(CommunicationLog.communication_date)).first()
        
        if latest_log:
            # 设置最新交流进度摘要：日期 - 标题
            project.latest_communication = f"{latest_log.communication_date.strftime('%Y-%m-%d')} - {latest_log.title}"
            
        # 获取最早的交流日志作为实际开始时间
        first_log = db.query(CommunicationLog).filter(
            CommunicationLog.project_id == project.id
        ).order_by(CommunicationLog.communication_date).first()
        
        if first_log:
            project.actual_start_date = first_log.communication_date
        else:
            project.actual_start_date = project.start_date
    
    return projects

@router.get("/{project_id}", response_model=ResearchProjectSchema)
async def get_research_project(project_id: int, db: Session = Depends(get_db)):
    """获取单个研究项目详情"""
    project = db.query(ResearchProject).filter(ResearchProject.id == project_id).first()
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
    security_result = SecurityValidator.validate_and_sanitize_project_data(project.dict())
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
    
    update_data = project_update.dict(exclude_unset=True, exclude={'collaborator_ids'})
    
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
    
    try:
        # 获取关联数据统计（用于返回信息）
        log_count = db.query(CommunicationLog).filter(CommunicationLog.project_id == project_id).count()
        collaborator_count = len(db_project.collaborators)
        
        # 删除项目（级联删除会自动处理关联的交流日志）
        db.delete(db_project)
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
    log_data = log.dict()
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
    update_data = log_update.dict(exclude_unset=True)
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
    return {"message": "Communication log deleted successfully"}

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