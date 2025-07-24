"""
合作者路由 - 改进版，使用统一响应格式
这是一个示例文件，展示如何将原有的直接返回改为统一响应格式
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import pandas as pd
import io
import re
from datetime import datetime
from ..models import (
    get_db, Collaborator, CollaboratorSchema, 
    CollaboratorCreate, CollaboratorUpdate, FileUploadResponse, User
)
from ..services import AuditService
from ..utils import DataValidator
from ..utils.auth import get_current_user
from ..utils.response import success_response, error_response, paginated_response

router = APIRouter()

@router.get("/")
async def get_collaborators(
    skip: int = 0, 
    limit: int = 100,
    include_deleted: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """获取合作者列表 - 使用统一响应格式"""
    try:
        query = db.query(Collaborator)
        if not include_deleted:
            query = query.filter(Collaborator.is_deleted == False)
        
        # 获取总数
        total = query.count()
        
        # 获取分页数据
        collaborators = query.offset(skip).limit(limit).all()
        
        # 转换为schema对象
        collaborators_data = [CollaboratorSchema.from_orm(c) for c in collaborators]
        
        # 使用分页响应格式
        return paginated_response(
            items=collaborators_data,
            total=total,
            page=(skip // limit) + 1,
            page_size=limit,
            message="获取合作者列表成功"
        )
    except Exception as e:
        return error_response(
            message="获取合作者列表失败",
            errors=[str(e)]
        )

@router.get("/{collaborator_id}")
async def get_collaborator(
    collaborator_id: int, 
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """获取单个合作者详情 - 使用统一响应格式"""
    try:
        collaborator = db.query(Collaborator).filter(
            Collaborator.id == collaborator_id,
            Collaborator.is_deleted == False
        ).first()
        
        if not collaborator:
            return error_response(
                message="合作者不存在",
                errors=[f"ID为{collaborator_id}的合作者未找到"]
            )
        
        # 转换为schema对象
        collaborator_data = CollaboratorSchema.from_orm(collaborator)
        
        return success_response(
            data=collaborator_data,
            message="获取合作者详情成功"
        )
    except Exception as e:
        return error_response(
            message="获取合作者详情失败",
            errors=[str(e)]
        )

@router.post("/")
async def create_collaborator(
    collaborator: CollaboratorCreate, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """创建合作者 - 使用统一响应格式"""
    try:
        # 验证数据
        validator = DataValidator()
        if not validator.validate_collaborator(collaborator.dict()):
            return error_response(
                message="数据验证失败",
                errors=validator.errors
            )
        
        # 检查是否已存在
        existing = db.query(Collaborator).filter(
            Collaborator.name == collaborator.name,
            Collaborator.is_deleted == False
        ).first()
        
        if existing:
            return error_response(
                message="合作者已存在",
                errors=[f"名为'{collaborator.name}'的合作者已存在"]
            )
        
        # 创建新合作者
        db_collaborator = Collaborator(**collaborator.dict())
        db.add(db_collaborator)
        db.commit()
        db.refresh(db_collaborator)
        
        # 记录审计日志
        AuditService.log_action(
            db=db,
            user_id=current_user.id,
            action="create_collaborator",
            target_type="collaborator",
            target_id=db_collaborator.id,
            details={"name": collaborator.name}
        )
        
        # 转换为schema对象
        collaborator_data = CollaboratorSchema.from_orm(db_collaborator)
        
        return success_response(
            data=collaborator_data,
            message="创建合作者成功"
        )
    except Exception as e:
        db.rollback()
        return error_response(
            message="创建合作者失败",
            errors=[str(e)]
        )

@router.put("/{collaborator_id}")
async def update_collaborator(
    collaborator_id: int,
    collaborator_update: CollaboratorUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """更新合作者 - 使用统一响应格式"""
    try:
        collaborator = db.query(Collaborator).filter(
            Collaborator.id == collaborator_id,
            Collaborator.is_deleted == False
        ).first()
        
        if not collaborator:
            return error_response(
                message="合作者不存在",
                errors=[f"ID为{collaborator_id}的合作者未找到"]
            )
        
        # 更新字段
        update_data = collaborator_update.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(collaborator, key, value)
        
        db.commit()
        db.refresh(collaborator)
        
        # 记录审计日志
        AuditService.log_action(
            db=db,
            user_id=current_user.id,
            action="update_collaborator",
            target_type="collaborator",
            target_id=collaborator_id,
            details=update_data
        )
        
        # 转换为schema对象
        collaborator_data = CollaboratorSchema.from_orm(collaborator)
        
        return success_response(
            data=collaborator_data,
            message="更新合作者成功"
        )
    except Exception as e:
        db.rollback()
        return error_response(
            message="更新合作者失败",
            errors=[str(e)]
        )

@router.delete("/{collaborator_id}")
async def delete_collaborator(
    collaborator_id: int,
    permanent: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """删除合作者 - 使用统一响应格式"""
    try:
        collaborator = db.query(Collaborator).filter(
            Collaborator.id == collaborator_id
        ).first()
        
        if not collaborator:
            return error_response(
                message="合作者不存在",
                errors=[f"ID为{collaborator_id}的合作者未找到"]
            )
        
        if permanent:
            # 永久删除
            db.delete(collaborator)
            action = "delete_collaborator_permanent"
        else:
            # 软删除
            collaborator.is_deleted = True
            collaborator.deleted_at = datetime.utcnow()
            action = "delete_collaborator_soft"
        
        db.commit()
        
        # 记录审计日志
        AuditService.log_action(
            db=db,
            user_id=current_user.id,
            action=action,
            target_type="collaborator",
            target_id=collaborator_id,
            details={"permanent": permanent}
        )
        
        return success_response(
            message=f"{'永久' if permanent else '软'}删除合作者成功"
        )
    except Exception as e:
        db.rollback()
        return error_response(
            message="删除合作者失败",
            errors=[str(e)]
        )